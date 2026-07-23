// app/api/dashboard/summary/route.ts
// أرقام الداشبورد كلها باستعلامات تجميعية خفيفة — بديل تحميل جداول كاملة في المتصفح
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

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
      prisma.followUp.count({ where: { contacted: false, archived: false } }),
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
