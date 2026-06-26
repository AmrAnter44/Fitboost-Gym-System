// Shared types for the Payroll system

export interface PayrollBreakdown {
  staffId: string
  staffName: string
  staffCode: string
  month: number
  year: number

  base: {
    monthlySalary: number
    workingDaysInMonth: number
    daysAttended: number
    dailyRate: number
  }

  earnings: {
    base: number
    bonuses: {
      total: number
      items: BonusItem[]
    }
    commission: {
      total: number
      items: CommissionItem[]
    }
  }

  deductions: {
    absences: {
      days: number
      amount: number
      dates: string[] // ISO date strings of missed working days
    }
    //  إجازة بدون راتب (الإجازة المعتمدة بـ isPaid=false) — منفصلة عن الغياب
    unpaidLeave: {
      days: number
      amount: number
      dates: string[]
    }
    lateArrivals: {
      // Late is INFO only — manager decides whether to add as manual deduction
      totalMinutes: number
      occurrences: LateOccurrence[]
      suggestedPenalty: number // totalMinutes × settings.payrollSuggestedLatePerMinute
    }
    manual: {
      total: number
      items: ManualDeductionItem[]
    }
    loans: {
      // What WILL be deducted this month given partial-deduct rules
      total: number
      items: LoanItem[]
    }
  }

  // The final number after all deductions are applied with partial-loans logic
  net: number

  // Totals for quick display
  totalEarnings: number
  totalDeductions: number
}

export interface BonusItem {
  id: string
  amount: number
  reason: string
}

export interface CommissionItem {
  id: string
  amount: number
  type: string
  description: string | null
  createdAt: string
}

export interface LateOccurrence {
  date: string // ISO
  scheduledStart: string // "HH:MM"
  actualCheckIn: string // ISO
  minutesLate: number
}

export interface ManualDeductionItem {
  id: string
  amount: number
  reason: string
}

export interface LoanItem {
  id: string
  totalAmount: number
  paidBeforeThisMonth: number
  outstanding: number
  willDeductThisMonth: number
  remainingAfterDeduction: number
  description: string
  installmentLimit: number | null
}

export interface PayrollSettings {
  payrollLateGraceMinutes: number
  payrollWorkingDaysPerMonth: number
  payrollMonthEndDay: number
  payrollSuggestedLatePerMinute: number
}
