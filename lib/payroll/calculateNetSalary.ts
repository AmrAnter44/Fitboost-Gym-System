import { prisma } from '../prisma'
import { round2 } from '../money'
import { calcLateMinutes } from '../shiftTime'
import type {
  PayrollBreakdown,
  LateOccurrence,
  LoanItem,
  PayrollSettings,
} from './types'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

function daysInMonth(year: number, month: number): number {
  // month is 1-12
  return new Date(year, month, 0).getDate()
}

function dateOnlyISO(date: Date): string {
  // ⚠️ لازم نستخدم مكوّنات التاريخ المحلية (مش toISOString/UTC) عشان تتطابق مع
  // تكرار الأيام اللي بيتبني بـ new Date(year, month-1, day) — ده بيبني midnight
  // محلي. لو استخدمنا UTC، على سيرفر مصري (UTC+2/3) مفاتيح الحضور بتـ shift يوم
  // وتتحسب أيام حاضرة كـ غياب.
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}` // YYYY-MM-DD (local)
}

/**
 * Calculate the full payroll breakdown for one staff member in one month.
 * The `net` field is the final amount after partial loan deductions.
 *
 * Pure read — does NOT modify any records. To actually deduct loans
 * and create a Payslip record, use `generatePayslip()` in a separate module.
 */
export async function calculateNetSalary(
  staffId: string,
  year: number,
  month: number, // 1-12
): Promise<PayrollBreakdown> {
  // ────────── 1. Load staff + settings + related data
  const [staff, settings, attendance, leaves, bonuses, commissions, manualDeductions, loans, rotations, holidays] = await Promise.all([
    prisma.staff.findUniqueOrThrow({ where: { id: staffId } }),
    getPayrollSettings(),
    prisma.attendance.findMany({
      where: {
        staffId,
        checkIn: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
      },
      orderBy: { checkIn: 'asc' },
    }),
    prisma.leave.findMany({
      where: {
        staffId,
        status: 'approved',
        // Overlapping leaves within this month
        startDate: { lt: new Date(year, month, 1) },
        endDate: { gte: new Date(year, month - 1, 1) },
      },
    }),
    prisma.bonus.findMany({ where: { staffId, year, month } }),
    prisma.commission.findMany({
      where: {
        staffId,
        createdAt: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.staffDeduction.findMany({
      where: {
        staffId,
        // Manual deductions: include any that were created in this month OR
        // explicitly marked applied in this month
        OR: [
          {
            createdAt: {
              gte: new Date(year, month - 1, 1),
              lt: new Date(year, month, 1),
            },
            isApplied: false,
          },
          {
            appliedAt: {
              gte: new Date(year, month - 1, 1),
              lt: new Date(year, month, 1),
            },
          },
        ],
      },
    }),
    prisma.expense.findMany({
      where: {
        staffId,
        type: 'staff_loan',
        isPaid: false,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.rotation.findMany({ where: { staffId, isActive: true } }),
    // Holidays during this month (including recurring same-month/day for any year)
    prisma.holiday.findMany({
      where: {
        OR: [
          {
            date: {
              gte: new Date(year, month - 1, 1),
              lt: new Date(year, month, 1),
            },
          },
          {
            recurring: true, // we filter month/day below in code
          },
        ],
      },
    }),
  ])

  const monthlySalary = staff.salary ?? 0
  const totalDays = daysInMonth(year, month)

  // ────────── Build holiday date set (for this month)
  const holidayDates = new Set<string>()
  for (const h of holidays) {
    const d = h.date
    if (h.recurring) {
      // Match month/day in target year
      if (d.getMonth() + 1 === month) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        if (h.isPaid) holidayDates.add(iso)
      }
    } else {
      if (d.getFullYear() === year && d.getMonth() + 1 === month && h.isPaid) {
        holidayDates.add(dateOnlyISO(d))
      }
    }
  }

  // ────────── 2. Compute working days in the month
  // If rotation is set: working days = days whose dayOfWeek is in rotation
  // Otherwise fallback to settings.payrollWorkingDaysPerMonth
  let workingDays = settings.payrollWorkingDaysPerMonth
  let workingDayChecker: ((d: Date) => boolean) | null = null

  if (rotations.length > 0) {
    const workingDayNames = new Set(rotations.map(r => r.dayOfWeek))
    workingDayChecker = (d: Date) => workingDayNames.has(DAY_NAMES[d.getDay()])
    workingDays = 0
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month - 1, day)
      if (workingDayChecker(d)) workingDays++
    }
  }
  if (workingDays < 1) workingDays = 1 // safety

  const dailyRate = monthlySalary / workingDays

  // ────────── 3. Build attendance & leave sets per-day
  const attendanceDates = new Set(attendance.map(a => dateOnlyISO(a.checkIn)))

  // Each Leave covers a range; build per-day map
  const leavePaidDates = new Set<string>()
  const leaveUnpaidDates = new Set<string>()
  for (const lv of leaves) {
    const start = new Date(Math.max(lv.startDate.getTime(), new Date(year, month - 1, 1).getTime()))
    const end = new Date(Math.min(lv.endDate.getTime(), new Date(year, month, 0, 23, 59, 59).getTime()))
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = dateOnlyISO(d)
      if (lv.isPaid) leavePaidDates.add(iso)
      else leaveUnpaidDates.add(iso)
    }
  }

  // ────────── 4. Detect absences (working day && no attendance && no leave && not holiday && within employment)
  //  أي إجازة معتمدة (مدفوعة أو غير مدفوعة) مش بتتحسب غياب
  // - الإجازة المدفوعة: مفيش خصم
  // - الإجازة بدون راتب: بتنخصم كـ "إجازة بدون راتب" منفصل (مش غياب)
  // Pre-employment days OR post-termination days do NOT count as absence (and don't earn salary either — pro-rated below)
  const absenceDates: string[] = []
  //  أيام الإجازة بدون راتب — منفصلة عن الغياب
  const unpaidLeaveDatesInMonth: string[] = []
  const monthStart = new Date(year, month - 1, 1)
  const monthEndExclusive = new Date(year, month, 1)
  const employmentStart = staff.joinedDate && staff.joinedDate > monthStart ? staff.joinedDate : monthStart
  const employmentEnd = staff.terminatedAt && staff.terminatedAt < monthEndExclusive ? staff.terminatedAt : monthEndExclusive
  let employedDaysInMonth = 0
  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(year, month - 1, day)
    const iso = dateOnlyISO(d)
    if (d < employmentStart || d >= employmentEnd) continue
    const isWorkingDay = workingDayChecker ? workingDayChecker(d) : true
    if (!isWorkingDay) continue
    employedDaysInMonth++
    if (holidayDates.has(iso)) continue
    if (attendanceDates.has(iso)) continue
    if (leavePaidDates.has(iso)) continue
    //  لو يوم إجازة بدون راتب — مش غياب، لكن بنخصمه من الراتب كـ unpaid leave
    if (leaveUnpaidDates.has(iso)) {
      unpaidLeaveDatesInMonth.push(iso)
      continue
    }
    // For days in the future (relative to today), don't count as absence yet
    const now = new Date()
    if (d > now) continue
    absenceDates.push(iso)
  }
  const absenceDays = absenceDates.length
  const absenceAmount = round2(absenceDays * dailyRate)
  //  حساب خصم الإجازة بدون راتب (لو موجودة)
  const unpaidLeaveDays = unpaidLeaveDatesInMonth.length
  const unpaidLeaveAmount = round2(unpaidLeaveDays * dailyRate)

  // ────────── Pro-rate base salary if employment is partial within this month
  const isPartialMonth = employedDaysInMonth < workingDays
  const proRatedBase = isPartialMonth ? Math.round(dailyRate * employedDaysInMonth) : monthlySalary

  // ────────── 5. Detect late arrivals (info only)
  // Compare check-in time vs shift start (from rotation for that day, or staff default)
  const lateOccurrences: LateOccurrence[] = []
  const grace = settings.payrollLateGraceMinutes
  for (const att of attendance) {
    const checkInDate = att.checkIn
    const dayName = DAY_NAMES[checkInDate.getDay()]
    const rot = rotations.find(r => r.dayOfWeek === dayName)
    const shiftStartHM = rot?.startTime ?? staff.shiftStartTime
    const shiftEndHM = rot?.endTime ?? staff.shiftEndTime
    if (!shiftStartHM) continue
    //  استخدم helper بيدعم الـ overnight shifts (e.g. 20:00 → 03:00)
    // لو shiftEnd مش متاح، fallback لـ نفس الـ start (هيتعامل كـ same-day)
    const rawLate = calcLateMinutes(checkInDate, shiftStartHM, shiftEndHM || shiftStartHM)
    if (rawLate === null) continue
    const minutesLate = Math.max(0, rawLate - grace)
    if (minutesLate > 0) {
      lateOccurrences.push({
        date: dateOnlyISO(checkInDate),
        scheduledStart: shiftStartHM,
        actualCheckIn: checkInDate.toISOString(),
        minutesLate,
      })
    }
  }
  const totalLateMinutes = lateOccurrences.reduce((s, o) => s + o.minutesLate, 0)
  const suggestedLatePenalty = totalLateMinutes * settings.payrollSuggestedLatePerMinute

  // ────────── 6. Sum earnings & manual deductions
  const totalBonuses = bonuses.reduce((s, b) => s + b.amount, 0)
  const totalCommission = commissions.reduce((s, c) => s + c.amount, 0)
  const totalManual = manualDeductions.reduce((s, d) => s + d.amount, 0)

  const earningsTotal = proRatedBase + totalBonuses + totalCommission
  //  ضفنا unpaidLeaveAmount للخصومات (إجازة بدون راتب — مش غياب)
  const nonLoanDeductions = absenceAmount + unpaidLeaveAmount + totalManual // late is NOT auto-deducted
  let netSoFar = earningsTotal - nonLoanDeductions

  // ────────── 7. Apply partial-loan deductions
  // For each loan, deduct min(outstanding, installmentLimit, netSoFar)
  const loanItems: LoanItem[] = []
  for (const loan of loans) {
    const paidBeforeThisMonth = loan.paidAmount ?? 0
    const outstanding = loan.amount - paidBeforeThisMonth
    if (outstanding <= 0) continue

    const installmentLimit = loan.installmentLimit ?? Number.POSITIVE_INFINITY
    const maxDeductible = round2(Math.max(0, Math.min(outstanding, installmentLimit, netSoFar)))

    loanItems.push({
      id: loan.id,
      totalAmount: loan.amount,
      paidBeforeThisMonth,
      outstanding,
      willDeductThisMonth: maxDeductible,
      remainingAfterDeduction: outstanding - maxDeductible,
      description: loan.description,
      installmentLimit: loan.installmentLimit ?? null,
    })

    netSoFar -= maxDeductible
    if (netSoFar <= 0) {
      netSoFar = 0
      // Continue to record remaining loans as "0 deducted, full outstanding"
    }
  }

  const totalLoansDeducted = round2(loanItems.reduce((s, l) => s + l.willDeductThisMonth, 0))

  const totalDeductions = round2(absenceAmount + unpaidLeaveAmount + totalManual + totalLoansDeducted)

  return {
    staffId,
    staffName: staff.name,
    staffCode: staff.staffCode,
    month,
    year,
    base: {
      monthlySalary,
      workingDaysInMonth: workingDays,
      daysAttended: attendance.length,
      dailyRate,
    },
    earnings: {
      base: proRatedBase,
      bonuses: {
        total: totalBonuses,
        items: bonuses.map(b => ({ id: b.id, amount: b.amount, reason: b.reason })),
      },
      commission: {
        total: totalCommission,
        items: commissions.map(c => ({
          id: c.id,
          amount: c.amount,
          type: c.type,
          description: c.description,
          createdAt: c.createdAt.toISOString(),
        })),
      },
    },
    deductions: {
      absences: {
        days: absenceDays,
        amount: absenceAmount,
        dates: absenceDates,
      },
      //  إجازة بدون راتب — منفصلة عن الغياب (يوم إجازة ≠ يوم غياب)
      unpaidLeave: {
        days: unpaidLeaveDays,
        amount: unpaidLeaveAmount,
        dates: unpaidLeaveDatesInMonth,
      },
      lateArrivals: {
        totalMinutes: totalLateMinutes,
        occurrences: lateOccurrences,
        suggestedPenalty: suggestedLatePenalty,
      },
      manual: {
        total: totalManual,
        items: manualDeductions.map(d => ({ id: d.id, amount: d.amount, reason: d.reason })),
      },
      loans: {
        total: totalLoansDeducted,
        items: loanItems,
      },
    },
    net: round2(Math.max(0, netSoFar)),
    totalEarnings: round2(earningsTotal),
    totalDeductions,
  }
}

async function getPayrollSettings(): Promise<PayrollSettings> {
  const s = await prisma.systemSettings.findUnique({ where: { id: 'singleton' } })
  return {
    payrollLateGraceMinutes: s?.payrollLateGraceMinutes ?? 5,
    payrollWorkingDaysPerMonth: s?.payrollWorkingDaysPerMonth ?? 26,
    payrollMonthEndDay: s?.payrollMonthEndDay ?? 28,
    payrollSuggestedLatePerMinute: s?.payrollSuggestedLatePerMinute ?? 2,
  }
}
