import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAdmin } from '../../../../lib/auth'
import { calculateNetSalary } from '../../../../lib/payroll/calculateNetSalary'

export const dynamic = 'force-dynamic'

// GET — preview الراتب الصافي لكل الموظفين النشطين في شهر معين
export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || '0', 10)
    const month = parseInt(searchParams.get('month') || '0', 10)

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'year و month مطلوبين' }, { status: 400 })
    }

    const staff = await prisma.staff.findMany({
      where: { isActive: true },
      select: { id: true },
      orderBy: { name: 'asc' },
    })

    // Compute in parallel — but limit to avoid hitting SQLite contention
    const results = await Promise.all(staff.map(s => calculateNetSalary(s.id, year, month)))

    // Also check which already have a NON-VOIDED Payslip (so UI can disable Generate)
    const existing = await prisma.payslip.findMany({
      where: { year, month, staffId: { in: staff.map(s => s.id) }, voidedAt: null },
      select: { staffId: true, id: true, paidAt: true },
    })
    const existingMap = new Map(existing.map(p => [p.staffId, p]))

    const enriched = results.map(r => ({
      ...r,
      payslip: existingMap.get(r.staffId)
        ? {
            id: existingMap.get(r.staffId)!.id,
            paidAt: existingMap.get(r.staffId)!.paidAt?.toISOString() ?? null,
          }
        : null,
    }))

    // Aggregated totals
    const totals = {
      base: enriched.reduce((s, r) => s + r.earnings.base, 0),
      bonuses: enriched.reduce((s, r) => s + r.earnings.bonuses.total, 0),
      commission: enriched.reduce((s, r) => s + r.earnings.commission.total, 0),
      deductions: enriched.reduce((s, r) => s + r.totalDeductions, 0),
      net: enriched.reduce((s, r) => s + r.net, 0),
      lateMinutes: enriched.reduce((s, r) => s + r.deductions.lateArrivals.totalMinutes, 0),
      staffCount: enriched.length,
      generatedCount: existing.length,
    }

    return NextResponse.json({ staff: enriched, totals })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية المدير مطلوبة' }, { status: 403 })
    console.error('Payroll preview-all error:', e)
    return NextResponse.json({ error: e.message || 'فشل حساب الرواتب' }, { status: 500 })
  }
}
