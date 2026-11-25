// app/api/dashboard/summary/route.ts
// أرقام الداشبورد كلها باستعلامات تجميعية خفيفة — بديل تحميل جداول كاملة في المتصفح
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

//  نفس تطبيع الموبايل في صفحة المتابعات
const normalizePhone = (phone?: string | null) => {
  let n = String(phone || '').replace(/[\s\-\(\)\+]/g, '').trim()
  if (n.startsWith('2')) n = n.substring(1)
  if (n.startsWith('0')) n = n.substring(1)
  return n
}

//  📞 «متابعة معلقة» = شخص آخر متابعة ليه لسه متواصلش معاه — كل شخص مرة واحدة،
//  ومن غير الأعضاء النشطين (صفحة المتابعات بتخفيهم)، والسيلز بيشوف بتوعه بس
async function countPendingFollowups(user: { isSales?: boolean; staffId?: string | null; role?: string; permissions?: any }) {
  const [rows, activeMembers] = await Promise.all([
    prisma.followUp.findMany({
      where: { archived: false, visitor: { isDeleted: false } },
      select: { contacted: true, createdAt: true, assignedTo: true, visitor: { select: { phone: true, source: true } } },
    }),
    prisma.member.findMany({ where: { isActive: true }, select: { phone: true } }),
  ])
  const activePhones = new Set(activeMembers.map(m => normalizePhone(m.phone)).filter(Boolean))
  const salesOnlyMine = !!user.isSales && !!user.staffId && user.role !== 'OWNER' && user.role !== 'ADMIN' && !user.permissions?.canManageSales
  const latest = new Map<string, (typeof rows)[number]>()
  for (const r of rows) {
    const key = normalizePhone(r.visitor?.phone)
    if (!key) continue
    const cur = latest.get(key)
    if (!cur || r.createdAt > cur.createdAt) latest.set(key, r)
  }
  let n = 0
  latest.forEach((r, key) => {
    if (r.contacted) return
    if (activePhones.has(key)) return
    if (salesOnlyMine) {
      const src = r.visitor?.source
      const unassignedShared = !r.assignedTo && (src === 'member-invitation' || src === 'expired-member' || src === 'expiring-member')
      if (r.assignedTo !== user.staffId && !unassignedShared) return
    }
    n++
  })
  return n
}

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = new Date(startOfToday)
    endOfToday.setDate(endOfToday.getDate() + 1)
    const startOfYesterday = new Date(startOfToday)
    startOfYesterday.setDate(startOfYesterday.getDate() - 1)
    const in3Days = new Date(now)
    in3Days.setDate(in3Days.getDate() + 3)
    const fourteenDaysAgo = new Date(startOfToday)
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13)

    const [
      membersTotal,
      expiringToday,
      expiringIn3Days,
      activePT,
      totalReceipts,
      todayAgg,
      yesterdayAgg,
      pendingFollowups,
      dailyRevenueRaw,
      callsToday,
      callsNotInterestedToday,
      callsNoAnswerToday,
    ] = await Promise.all([
      prisma.member.count(),
      prisma.member.count({ where: { expiryDate: { gte: startOfToday, lt: endOfToday } } }),
      prisma.member.count({ where: { expiryDate: { gt: now, lte: in3Days } } }),
      prisma.pT.count({ where: { sessionsRemaining: { gt: 0 } } }),
      prisma.receipt.count(),
      prisma.receipt.aggregate({
        _sum: { amount: true },
        _count: true,
        // حد أعلى ضروري: فيه بيانات قديمة بتواريخ مستقبلية ماينفعش تتحسب ضمن "اليوم"
        where: { createdAt: { gte: startOfToday, lt: endOfToday } },
      }),
      prisma.receipt.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { createdAt: { gte: startOfYesterday, lt: startOfToday } },
      }),
      countPendingFollowups(user),
      // إيرادات آخر 14 يوم مجمعة باليوم في SQL (بتوقيت السيرفر المحلي)
      prisma.$queryRaw<Array<{ day: string; count: bigint; revenue: number }>>`
        SELECT date(createdAt / 1000, 'unixepoch', 'localtime') AS day,
               COUNT(*) AS count,
               COALESCE(SUM(amount), 0) AS revenue
        FROM Receipt
        WHERE createdAt >= ${fourteenDaysAgo.getTime()}
          AND createdAt < ${endOfToday.getTime()}
        GROUP BY day
        ORDER BY day
      `,
      //  مكالمات السيلز النهاردة — المتواصَلة فقط (contacted=true) عشان صفوف الإسناد الأولية ما تتحسبش
      prisma.followUp.count({ where: { createdAt: { gte: startOfToday, lt: endOfToday }, contacted: true } }),
      prisma.followUp.count({ where: { createdAt: { gte: startOfToday, lt: endOfToday }, contacted: true, result: 'not-interested' } }),
      prisma.followUp.count({ where: { createdAt: { gte: startOfToday, lt: endOfToday }, contacted: true, result: 'no-answer' } }),
    ])

    return NextResponse.json({
      members: membersTotal,
      expiringToday,
      expiringIn3Days,
      activePT,
      totalReceipts,
      todayRevenue: todayAgg._sum.amount ?? 0,
      todayReceiptsCount: todayAgg._count,
      yesterdayRevenue: yesterdayAgg._sum.amount ?? 0,
      yesterdayReceiptsCount: yesterdayAgg._count,
      pendingFollowups,
      //  مكالمات النهاردة
      callsToday,
      callsNotInterestedToday,
      callsNoAnswerToday,
      // BigInt من SQLite لازم يتحول قبل الـ JSON
      revenueLast14Days: dailyRevenueRaw.map(row => ({
        day: row.day,
        count: Number(row.count),
        revenue: Number(row.revenue),
      })),
    })
  } catch (error) {
    console.error('Error building dashboard summary:', error)
    return NextResponse.json({ error: 'فشل تحميل ملخص لوحة التحكم' }, { status: 500 })
  }
}
