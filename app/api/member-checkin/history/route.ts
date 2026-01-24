import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

// GET: الحصول على سجل الحضور (للتقارير والجرافات)

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const memberId = searchParams.get('memberId')
    const limit = searchParams.get('limit')

    // بناء شروط الاستعلام
    const where: any = {}

    if (startDateParam && endDateParam) {
      const startDate = new Date(startDateParam)
      startDate.setHours(0, 0, 0, 0)

      const endDate = new Date(endDateParam)
      endDate.setHours(23, 59, 59, 999)

      where.checkInTime = {
        gte: startDate,
        lte: endDate,
      }
    }

    if (memberId) {
      where.memberId = memberId
    }

    // الحصول على السجلات
    const checkIns = await prisma.memberCheckIn.findMany({
      where,
      include: {
        member: {
          select: {
            name: true,
            memberNumber: true,
            phone: true,
          },
        },
      },
      orderBy: {
        checkInTime: 'desc',
      },
      take: limit ? parseInt(limit) : undefined,
    })

    // حساب إحصائيات للفترة المحددة
    let stats = null
    if (startDateParam && endDateParam) {
      const startDate = new Date(startDateParam)
      startDate.setHours(0, 0, 0, 0)

      const endDate = new Date(endDateParam)
      endDate.setHours(23, 59, 59, 999)

      // جلب جميع السجلات في الفترة المحددة
      const checkInsInRange = await prisma.memberCheckIn.findMany({
        where: {
          checkInTime: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          checkInTime: true,
        },
      })

      // تجميع البيانات حسب اليوم
      const dailyMap: { [key: string]: number } = {}

      checkInsInRange.forEach((checkIn) => {
        const dateKey = checkIn.checkInTime.toISOString().split('T')[0]
        dailyMap[dateKey] = (dailyMap[dateKey] || 0) + 1
      })

      // تحويل إلى array وترتيب
      const formattedDailyStats = Object.entries(dailyMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))

      console.log('📊 إحصائيات يومية:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalDays: formattedDailyStats.length,
        totalCheckIns: formattedDailyStats.reduce((sum, s) => sum + s.count, 0)
      })

      // الأعضاء الأكثر زيارة
      const topMembers = await prisma.memberCheckIn.groupBy({
        by: ['memberId'],
        where: {
          checkInTime: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          memberId: true,
        },
        orderBy: {
          _count: {
            memberId: 'desc',
          },
        },
        take: 10,
      })

      // الحصول على معلومات الأعضاء
      const topMembersWithInfo = await Promise.all(
        topMembers.map(async (item) => {
          const member = await prisma.member.findUnique({
            where: { id: item.memberId },
            select: {
              name: true,
              memberNumber: true,
            },
          })
          return {
            member,
            visits: item._count.memberId,
          }
        })
      )

      stats = {
        totalCheckIns: checkIns.length,
        dailyStats: formattedDailyStats,
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
