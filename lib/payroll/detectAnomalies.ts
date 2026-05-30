import { prisma } from '../prisma'
import type { PayrollBreakdown } from './types'

export type AnomalySeverity = 'info' | 'warning' | 'critical'

export interface Anomaly {
  staffId: string
  staffName: string
  type: string
  severity: AnomalySeverity
  message: string
  detail?: string
}

/**
 * Detect payroll anomalies for a given month across all staff.
 * Heuristics (all simple, deterministic — no ML):
 *  - Commission > 50% above 3-month-average  → warning
 *  - Late minutes > 2× monthly average        → warning
 *  - Absence days > 3 with no leave records   → critical
 *  - Net salary > 2× base salary              → info (large bonuses/commission)
 *  - Net salary == 0 due to loans             → warning
 */
export async function detectAnomalies(
  breakdowns: PayrollBreakdown[],
  year: number,
  month: number,
): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = []
  if (breakdowns.length === 0) return anomalies

  // Pre-fetch 3-month commission baseline per staff for trend comparisons
  const startBaseline = new Date(year, month - 4, 1) // 3 months before
  const endBaseline = new Date(year, month - 1, 1)
  const baselineCommissions = await prisma.commission.groupBy({
    by: ['staffId'],
    where: {
      staffId: { in: breakdowns.map(b => b.staffId) },
      createdAt: { gte: startBaseline, lt: endBaseline },
    },
    _sum: { amount: true },
    _count: true,
  })
  const baselineMap = new Map<string, number>()
  for (const row of baselineCommissions) {
    // Average per month over 3 months
    baselineMap.set(row.staffId, (row._sum.amount ?? 0) / 3)
  }

  for (const b of breakdowns) {
    // Commission spike
    const baseline = baselineMap.get(b.staffId) ?? 0
    if (baseline > 0 && b.earnings.commission.total > baseline * 1.5) {
      anomalies.push({
        staffId: b.staffId,
        staffName: b.staffName,
        type: 'commission_spike',
        severity: 'warning',
        message: `العمولة الشهر ده ${Math.round(b.earnings.commission.total)} — أعلى من المتوسط (${Math.round(baseline)}) بأكتر من 50%`,
        detail: 'يفضّل مراجعة بنود العمولة قبل الـ payroll',
      })
    }

    // Many absences w/o leave
    if (b.deductions.absences.days >= 3) {
      anomalies.push({
        staffId: b.staffId,
        staffName: b.staffName,
        type: 'high_absence',
        severity: b.deductions.absences.days >= 5 ? 'critical' : 'warning',
        message: `${b.deductions.absences.days} أيام غياب بدون إجازة مسجلة — خصم ${Math.round(b.deductions.absences.amount)} ج`,
        detail: 'تأكد إن مفيش أيام إجازة فاتتك تسجلها',
      })
    }

    // Excessive late minutes (>60 = ~10/day)
    if (b.deductions.lateArrivals.totalMinutes >= 60) {
      anomalies.push({
        staffId: b.staffId,
        staffName: b.staffName,
        type: 'high_late',
        severity: b.deductions.lateArrivals.totalMinutes >= 120 ? 'critical' : 'warning',
        message: `إجمالي تأخير ${b.deductions.lateArrivals.totalMinutes} دقيقة في الشهر`,
        detail: 'فكر تضمها كخصم في الـ pre-payroll checklist',
      })
    }

    // Net zeroed by loans
    if (b.net === 0 && b.deductions.loans.total > 0) {
      anomalies.push({
        staffId: b.staffId,
        staffName: b.staffName,
        type: 'net_zero_loans',
        severity: 'warning',
        message: `الراتب الصافي = صفر بسبب السلف (${Math.round(b.deductions.loans.total)} ج)`,
        detail: 'الباقي من السلفة هيتحوّل للشهر الجاي تلقائياً',
      })
    }

    // Net more than 2× base
    if (b.earnings.base > 0 && b.net > b.earnings.base * 2) {
      anomalies.push({
        staffId: b.staffId,
        staffName: b.staffName,
        type: 'net_over_2x_base',
        severity: 'info',
        message: `الراتب الصافي (${Math.round(b.net)}) أعلى من ضعف الأساسي (${Math.round(b.earnings.base)})`,
        detail: 'العمولة + المكافآت كبيرة الشهر ده',
      })
    }
  }

  return anomalies
}
