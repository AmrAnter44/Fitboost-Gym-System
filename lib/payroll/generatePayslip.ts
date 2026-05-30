import { prisma } from '../prisma'
import { calculateNetSalary } from './calculateNetSalary'
import type { PayrollBreakdown } from './types'

/**
 * Generate (create or replace) a Payslip record for a staff member for a given month.
 *
 * Side effects:
 *  - Creates a `Payslip` row (immutable snapshot)
 *  - Applies any unapplied `StaffDeduction` rows that fell into this month → sets `isApplied=true`, `appliedAt=now`
 *  - Increments `Expense.paidAmount` for each loan that had `willDeductThisMonth > 0`
 *  - Marks `Expense.isPaid = true` for loans whose `paidAmount >= amount` afterwards
 *
 * Idempotent in the sense that if a Payslip already exists for (staffId, year, month),
 * we throw — caller must explicitly delete first.
 */
export async function generatePayslip(
  staffId: string,
  year: number,
  month: number,
  paidBy?: string,
): Promise<{ payslip: { id: string }; breakdown: PayrollBreakdown }> {
  // Reject if a non-voided payslip already exists for this period
  const existing = await prisma.payslip.findUnique({
    where: { staffId_year_month: { staffId, year, month } },
  })
  if (existing) {
    if (existing.voidedAt) {
      // Delete the voided one so we can create a new active one
      await prisma.payslip.delete({ where: { id: existing.id } })
    } else {
      throw new Error('PAYSLIP_ALREADY_EXISTS')
    }
  }

  const breakdown = await calculateNetSalary(staffId, year, month)

  const payslip = await prisma.payslip.create({
    data: {
      staffId,
      year,
      month,
      baseSalary: breakdown.base.monthlySalary,
      totalBonuses: breakdown.earnings.bonuses.total,
      totalCommission: breakdown.earnings.commission.total,
      absenceDays: breakdown.deductions.absences.days,
      absenceDeduction: breakdown.deductions.absences.amount,
      lateMinutes: breakdown.deductions.lateArrivals.totalMinutes,
      latePenalty: 0, // never auto-deducted — info only
      manualDeductions: breakdown.deductions.manual.total,
      loansDeducted: breakdown.deductions.loans.total,
      netSalary: breakdown.net,
      breakdown: JSON.stringify(breakdown),
      paidBy: paidBy ?? null,
    },
  })

  // ────────── Apply manual deductions
  if (breakdown.deductions.manual.items.length > 0) {
    await prisma.staffDeduction.updateMany({
      where: {
        id: { in: breakdown.deductions.manual.items.map(i => i.id) },
        isApplied: false,
      },
      data: { isApplied: true, appliedAt: new Date() },
    })
  }

  // ────────── Apply loan partial deductions
  for (const loan of breakdown.deductions.loans.items) {
    if (loan.willDeductThisMonth <= 0) continue
    const newPaidAmount = loan.paidBeforeThisMonth + loan.willDeductThisMonth
    const isFullyPaid = newPaidAmount >= loan.totalAmount
    await prisma.expense.update({
      where: { id: loan.id },
      data: {
        paidAmount: newPaidAmount,
        isPaid: isFullyPaid,
      },
    })
  }

  return { payslip: { id: payslip.id }, breakdown }
}
