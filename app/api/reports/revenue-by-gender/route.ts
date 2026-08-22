// app/api/reports/revenue-by-gender/route.ts
// 🚻 إيرادات الرجالة مقابل الستات — مجموع إيصالات الأعضاء حسب الجنس في فترة
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAnyPermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await requireAnyPermission(request, ['canViewReports', 'canViewFinancials'])

    const { searchParams } = new URL(request.url)
    const startParam = searchParams.get('startDate')
    const endParam = searchParams.get('endDate')

    const where: any = { isCancelled: false, memberId: { not: null } }
    if (startParam || endParam) {
      where.createdAt = {}
      if (startParam) where.createdAt.gte = new Date(startParam)
      if (endParam) {
        const endRaw = endParam.length === 10 ? `${endParam}T23:59:59.999` : endParam
        where.createdAt.lte = new Date(endRaw)
      }
    }

    const receipts = await prisma.receipt.findMany({
      where,
      select: { amount: true, memberId: true, member: { select: { gender: true } } },
    })

    const buckets: Record<string, { revenue: number; members: Set<string> }> = {
      male: { revenue: 0, members: new Set() },
      female: { revenue: 0, members: new Set() },
      unknown: { revenue: 0, members: new Set() },
      unset: { revenue: 0, members: new Set() }, // أعضاء من غير جنس متسجّل
    }

    for (const r of receipts) {
      const g = r.member?.gender
      const key = g === 'male' ? 'male' : g === 'female' ? 'female' : g === 'unknown' ? 'unknown' : 'unset'
      buckets[key].revenue += r.amount
      if (r.memberId) buckets[key].members.add(r.memberId)
    }

    const total = buckets.male.revenue + buckets.female.revenue + buckets.unknown.revenue + buckets.unset.revenue
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0)

    return NextResponse.json({
      total,
      male: { revenue: buckets.male.revenue, members: buckets.male.members.size, percentage: pct(buckets.male.revenue) },
      female: { revenue: buckets.female.revenue, members: buckets.female.members.size, percentage: pct(buckets.female.revenue) },
      unknown: { revenue: buckets.unknown.revenue, members: buckets.unknown.members.size, percentage: pct(buckets.unknown.revenue) },
      unset: { revenue: buckets.unset.revenue, members: buckets.unset.members.size, percentage: pct(buckets.unset.revenue) },
    })
  } catch (error: any) {
    console.error('revenue-by-gender error:', error)
    if (error.message === 'Unauthorized' || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }
    return NextResponse.json({ error: 'فشل تحميل التقرير' }, { status: 500 })
  }
}
