// «فلوسي» — حساب مرتب الشهر الحالي لحد النهارده للموظف المسجّل دخول بس
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
import { calculateNetSalary } from '../../../../lib/payroll/calculateNetSalary'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
  if (!user.staffId) return NextResponse.json({ error: 'حسابك مش مربوط بموظف', staff: false }, { status: 404 })

  const url = new URL(request.url)
  const now = new Date()
  const year = Number(url.searchParams.get('year')) || now.getFullYear()
  const month = Number(url.searchParams.get('month')) || now.getMonth() + 1
  if (month < 1 || month > 12 || year < 2020 || year > 2100) {
    return NextResponse.json({ error: 'شهر غير صحيح' }, { status: 400 })
  }

  try {
    const b = await calculateNetSalary(user.staffId, year, month)
    const slip = await prisma.payslip.findFirst({
      where: { staffId: user.staffId, year, month, voidedAt: null },
      select: { netSalary: true, paidAt: true },
    }).catch(() => null)
    return NextResponse.json({
      year, month,
      base: b.earnings.base,
      monthlySalary: b.base.monthlySalary,
      daysAttended: b.base.daysAttended,
      workingDays: b.base.workingDaysInMonth,
      bonuses: b.earnings.bonuses,
      commission: { total: b.earnings.commission.total, count: b.earnings.commission.items.length },
      deductions: {
        absences: { days: b.deductions.absences.days, amount: b.deductions.absences.amount },
        unpaidLeave: { days: b.deductions.unpaidLeave.days, amount: b.deductions.unpaidLeave.amount },
        manual: b.deductions.manual,
        loans: { total: b.deductions.loans.total },
        lateMinutes: b.deductions.lateArrivals.totalMinutes,
      },
      totalEarnings: b.totalEarnings,
      totalDeductions: b.totalDeductions,
      net: b.net,
      payslip: slip ? { net: slip.netSalary, paidAt: slip.paidAt } : null,
    })
  } catch (e: any) {
    console.error('me/money:', e?.message || e)
    return NextResponse.json({ error: 'مش قادر أحسب المرتب دلوقتي' }, { status: 500 })
  }
}
