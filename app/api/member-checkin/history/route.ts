import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { withPhotoUrl } from '../../../../lib/memberPhoto'

// GET: الحصول على سجل الحضور (للتقارير والجرافات)
// 🚀 الإحصائيات بتتحسب بـ SQL تجميعي (زي dashboard/summary) بدل سحب كل الصفوف،
//    والجدول التفصيلي له حد أقصى — عشان الفترات الطويلة ما تسحبش عشرات الآلاف من الصفوف

export const dynamic = 'force-dynamic'

// أقصى صفوف للجدول التفصيلي — بعد كده الرندر في المتصفح بيبقى هو المشكلة
const DEFAULT_LIST_LIMIT = 500
const MAX_LIST_LIMIT = 2000

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const memberId = searchParams.get('memberId')
    const limit = searchParams.get('limit')
    // statsOnly=1 → من غير قايمة تفصيلية خالص (الداشبورد محتاج الأرقام بس)
    const statsOnly = searchParams.get('statsOnly') === '1'

    // بناء شروط الاستعلام
    const where: any = {}
    let startDate: Date | null = null
    let endDate: Date | null = null

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam)
      startDate.setHours(0, 0, 0, 0)

      endDate = new Date(endDateParam)
      endDate.setHours(23, 59, 59, 999)

      where.checkInTime = {
        gte: startDate,
        lte: endDate,
      }
    }

    if (memberId) {
      where.memberId = memberId
    }

    // الجدول التفصيلي (أحدث السجلات) — statsOnly بيتخطاه
    const take = Math.min(limit ? parseInt(limit) || DEFAULT_LIST_LIMIT : DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT)
    const checkInsRaw = statsOnly
      ? []
      : await prisma.memberCheckIn.findMany({
          where,
          include: {
            member: {
              select: {
                name: true,
                memberNumber: true,
                phone: true,
                profileImage: true,
              },
            },
          },
          orderBy: {
            checkInTime: 'desc',
          },
          take,
        })
    // صور base64 القديمة بتتحول لينكات — 500 صف بصورهم كانوا بيبقوا عشرات الميجا JSON
    const checkIns = checkInsRaw.map(c => ({ ...c, member: withPhotoUrl(c.memberId, c.member) }))

    // إحصائيات الفترة — كلها تجميع في SQL، مفيش تحميل صفوف
    let stats = null
    if (startDate && endDate) {
      const startMs = startDate.getTime()
      const endMs = endDate.getTime()

      const [dailyRaw, totalCheckIns, uniqueRaw, topMembers] = await Promise.all([
        // تجميع باليوم المحلي (نفس نمط dashboard/summary) — وده كمان بيصلّح
        // انحراف التوقيت اللي كان بيحسب حضور بعد نص الليل على اليوم اللي قبله
        prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
          SELECT date(checkInTime / 1000, 'unixepoch', 'localtime') AS day,
                 COUNT(*) AS count
          FROM MemberCheckIn
          WHERE checkInTime >= ${startMs} AND checkInTime <= ${endMs}
          GROUP BY day
          ORDER BY day
        `,
        // العدد الكلي بنفس شروط القايمة (بيحترم memberId لو موجود — زي السلوك القديم)
        prisma.memberCheckIn.count({ where }),
        prisma.$queryRaw<Array<{ n: bigint }>>`
          SELECT COUNT(DISTINCT memberId) AS n
          FROM MemberCheckIn
          WHERE checkInTime >= ${startMs} AND checkInTime <= ${endMs}
        `,
        // الأعضاء الأكثر زيارة
        prisma.memberCheckIn.groupBy({
          by: ['memberId'],
          where: {
            checkInTime: { gte: startDate, lte: endDate },
          },
          _count: { memberId: true },
          orderBy: { _count: { memberId: 'desc' } },
          take: 10,
        }),
      ])

      // الحصول على معلومات الأعضاء (batch query بدلاً من N+1)
      const topMemberIds = topMembers.map(item => item.memberId)
      const membersInfo = await prisma.member.findMany({
        where: { id: { in: topMemberIds } },
        select: { id: true, name: true, memberNumber: true, profileImage: true },
      })
      const membersMap = new Map(membersInfo.map(m => [m.id, m]))

      const topMembersWithInfo = topMembers.map(item => ({
        member: withPhotoUrl(item.memberId, membersMap.get(item.memberId) || null),
        visits: item._count.memberId,
      }))

      stats = {
        totalCheckIns,
        uniqueMembers: Number(uniqueRaw[0]?.n ?? 0),
        dailyStats: dailyRaw.map(row => ({ date: row.day, count: Number(row.count) })),
        topMembers: topMembersWithInfo,
      }
    }

    return NextResponse.json({
      success: true,
      checkIns,
      stats,
    })
  } catch (error) {
    console.error('Error getting history:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء الاستعلام' },
      { status: 500 }
    )
  }
}
