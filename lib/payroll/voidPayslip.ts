import { prisma } from '../prisma'
import type { PayrollBreakdown } from './types'

/**
 * Reverse a Payslip's side effects:
 *  - For each manual deduction applied during this payslip → set isApplied=false, appliedAt=null
 *  - For each loan that had a paidAmount increment → decrement back; isPaid → false if needed
 *  - Mark the Payslip as voided (immutable but inactive)
 *
 * Caller must have OWNER role (enforced in API).
 */
export async function voidPayslip(
  payslipId: string,
  voidedBy: string,
  reason?: string,
): Promise<void> {
  // كل خطوات الإلغاء (عكس الخصومات + عكس السلف + وسم الـ payslip) في transaction
  // واحد. ده بيخلّي العملية atomic: لو أي خطوة فشلت أو الـ process وقع في النص،
  // كله بيترجع، فإعادة المحاولة بتبتدي من نظيف — مفيش عكس مزدوج للسلف.
  await prisma.$transaction(async (tx) => {
    const payslip = await tx.payslip.findUniqueOrThrow({ where: { id: payslipId } })
    if (payslip.voidedAt) {
      throw new Error('PAYSLIP_ALREADY_VOIDED')
    }

    let breakdown: PayrollBreakdown | null = null
    try {
      breakdown = JSON.parse(payslip.breakdown)
    } catch {}

    if (!breakdown) {
      // Fall back: just mark voided without reversal
      await tx.payslip.update({
        where: { id: payslipId },
        data: { voidedAt: new Date(), voidedBy, voidReason: reason ?? 'Manual void (no breakdown)' },
      })
      return
    }

    // ────────── Reverse manual deductions
    const deductionIds = breakdown.deductions.manual.items.map(i => i.id)
    if (deductionIds.length > 0) {
      await tx.staffDeduction.updateMany({
        where: { id: { in: deductionIds } },
        data: { isApplied: false, appliedAt: null },
      })
    }

    // ────────── Reverse loan paid amounts
    for (const loan of breakdown.deductions.loans.items) {
      if (loan.willDeductThisMonth <= 0) continue
      const current = await tx.expense.findUnique({ where: { id: loan.id } })
      if (!current) continue
      const newPaidAmount = Math.max(0, (current.paidAmount ?? 0) - loan.willDeductThisMonth)
      await tx.expense.update({
        where: { id: loan.id },
        data: {
          paidAmount: newPaidAmount,
          isPaid: newPaidAmount >= current.amount,
        },
      })
    }

    // ────────── Mark voided
    await tx.payslip.update({
      where: { id: payslipId },
      data: {
        voidedAt: new Date(),
        voidedBy,
        voidReason: reason ?? null,
      },
    })
  })
}
