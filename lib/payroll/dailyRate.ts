import { prisma } from '../prisma'

/**
 * Computes a staff member's daily wage rate, used by the "by-days" bonus/deduction
 * feature (بونص يوم / خصم يوم).
 *
 * Formula: monthlySalary / workingDaysPerMonth
 *  - workingDaysPerMonth = SystemSettings.payrollWorkingDaysPerMonth (default 26),
 *    the same configurable denominator the payroll uses as its fallback.
 *
 * Kept intentionally simple (settings-based, not month/rotation specific) so that
 * "يوم واحد" has a single predictable value the owner controls from payroll settings.
 */
export async function getStaffDailyRate(
  staffId: string,
): Promise<{ dailyRate: number; workingDays: number; monthlySalary: number }> {
  const [staff, settings] = await Promise.all([
    prisma.staff.findUnique({ where: { id: staffId }, select: { salary: true } }),
    prisma.systemSettings.findUnique({
      where: { id: 'singleton' },
      select: { payrollWorkingDaysPerMonth: true },
    }),
  ])

  const monthlySalary = staff?.salary ?? 0
  let workingDays = settings?.payrollWorkingDaysPerMonth ?? 26
  if (workingDays < 1) workingDays = 1

  return { dailyRate: monthlySalary / workingDays, workingDays, monthlySalary }
}
