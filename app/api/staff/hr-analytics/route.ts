import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth, requirePermission } from '../../../../lib/auth'
import {
  getWorkingDaysInMonth,
  minutesToHours,
  calculatePerformancePercentage,
  getPerformanceStatus,
  generateAlerts,
  getExpectedWorkingDays,
  getExpectedWorkingDaysWithSchedule,
  dayNamesToWeekdaySet
} from '../../../../lib/hrCalculations'
import { getLocaleFromRequest } from '../../../../lib/serverTranslation'
import { calcLateMinutes, calcEarlyMinutes } from '../../../../lib/shiftTime'

export const dynamic = 'force-dynamic'

interface UnderperformanceDay {
  date: string
  actualHours: number
  requiredHours: number
  shortfall: number
}

interface RevenueBreakdown {
  pt: number
  nutrition: number
  physiotherapy: number
  other: number
  sales: number   //  💼 عائدات السيلز الخاصة (إيصالات أعضاءه + يوم استخدامه)
  total: number
}

interface StaffAnalytics {
  staffId: string
  staffCode: string
  staffName: string
  position: string | null
  salary: number | null
  workingHours: number
  monthlyVacationDays: number
  actualHoursWorked: number
  requiredHours: number
  hoursDifference: number
  daysAttended: number
  daysAbsent: number
  vacationDaysRemaining: number
  performancePercentage: number
  underperformanceDays: UnderperformanceDay[]
  status: 'excellent' | 'good' | 'warning' | 'critical'
  alerts: string[]
  revenue: RevenueBreakdown
  revenueToSalaryRatio: number | null
  staffType: 'sales' | 'reception' | 'coach'   //  نوع الأكونت — يحدد شكل عرض العائدات
}

/**
 * GET - جلب تحليلات HR للموظفين
 * Query parameters:
 * - staffId (optional): معرف موظف محدد
 * - month (optional): الشهر (1-12) - افتراضي: الشهر الحالي
 * - year (optional): السنة - افتراضي: السنة الحالية
 */
export async function GET(request: Request) {
  try {
    //  🔒 مساعد الموارد البشرية للإدارة فقط (OWNER/ADMIN بيتجاوزوا، الباقي محتاج canAccessHR)
    const user = await requirePermission(request, 'canAccessHR')

    // استخراج query parameters
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')
    const locale = getLocaleFromRequest(request) as 'ar' | 'en'

    // الشهر والسنة (افتراضياً: الشهر والسنة الحاليين)
    const now = new Date()
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1))
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()))

    // التحقق من صحة الشهر والسنة
    if (month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'الشهر يجب أن يكون بين 1 و 12' },
        { status: 400 }
      )
    }

    // هل هو الشهر الحالي؟ (لحساب الأداء حتى اليوم فقط)
    const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()
    const todayCutoff = isCurrentMonth
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      : null

    // حساب أيام العمل (كامل الشهر أو حتى اليوم للشهر الحالي)
    const workingDaysInMonth = isCurrentMonth
      ? getExpectedWorkingDays(new Date(year, month - 1, 1), year, month, todayCutoff!)
      : getWorkingDaysInMonth(year, month)

    // تحديد نطاق التاريخ للشهر المحدد
    const startDate = new Date(year, month - 1, 1)
    const endDate = todayCutoff ?? new Date(year, month, 0, 23, 59, 59)

    // جلب الموظفين (جميعهم أو موظف محدد)
    const staffWhere: any = { isActive: true }
    if (staffId) {
      staffWhere.id = staffId
    }

    const allStaff = await prisma.staff.findMany({
      where: staffWhere,
      select: {
        id: true,
        staffCode: true,
        name: true,
        position: true,
        salary: true,
        workingHours: true,
        monthlyVacationDays: true,
        shiftStartTime: true,
        shiftEndTime: true,
        createdAt: true,
        attendance: {
          where: {
            checkIn: {
              gte: startDate,
              lte: endDate
            }
          },
          select: {
            id: true,
            checkIn: true,
            checkOut: true,
            duration: true
          },
          orderBy: {
            checkIn: 'asc'
          }
        },
        commissions: {
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          select: {
            amount: true,
            type: true
          }
        },
        expenses: {
          where: {
            type: 'staff_loan',
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          select: {
            id: true,
            amount: true,
            description: true,
            isPaid: true,
            createdAt: true,
            notes: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        //  📅 الكاليندر: شيفتات الموظف بالتاريخ (المصدر الأساسي) + الروتيشن الأسبوعي (احتياطي)
        shiftAssignments: {
          where: { date: { gte: startDate, lte: endDate } },
          select: { date: true }
        },
        rotations: {
          where: { isActive: true },
          select: { dayOfWeek: true }
        },
        leaves: {
          where: {
            status: 'approved',
            startDate: { lte: endDate },
            endDate: { gte: startDate }
          },
          select: { startDate: true, endDate: true }
        }
      }
    })

    //  📅 عطلات الشهر (Holiday) — تُحمّل مرة واحدة وتُطبّق على الجميع
    const monthHolidays = await prisma.holiday.findMany({
      select: { date: true, recurring: true }
    })
    const holidayKeys = new Set<string>()      // "MM-DD" للمتكرر + "YYYY-MM-DD" للثابت
    for (const h of monthHolidays) {
      const d = new Date(h.date)
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      if (h.recurring) holidayKeys.add(`*-${mm}-${dd}`)
      else holidayKeys.add(`${d.getFullYear()}-${mm}-${dd}`)
    }
    const isHoliday = (date: Date): boolean => {
      const mm = String(date.getMonth() + 1).padStart(2, '0')
      const dd = String(date.getDate()).padStart(2, '0')
      return holidayKeys.has(`*-${mm}-${dd}`) || holidayKeys.has(`${date.getFullYear()}-${mm}-${dd}`)
    }

    //  💼 حساب عائدات السيلز الخاصة (قبل اللوب) — إيصالات أعضاء منسوبين للسيلز + يوم استخدامه
    const staffIds = allStaff.map(s => s.id)
    const salesRevenueByStaff: Record<string, number> = {}

    // 1) أعضاء منسوبين لسيلز → إيصالاتهم في الشهر
    const salesMembers = await prisma.member.findMany({
      where: { salesStaffId: { in: staffIds } },
      select: { id: true, salesStaffId: true },
    })
    const memberToSales: Record<string, string> = {}
    salesMembers.forEach(m => { if (m.salesStaffId) memberToSales[m.id] = m.salesStaffId })
    const salesMemberIds = salesMembers.map(m => m.id)
    if (salesMemberIds.length) {
      const memberReceipts = await prisma.receipt.findMany({
        where: { memberId: { in: salesMemberIds }, isCancelled: false, createdAt: { gte: startDate, lte: endDate } },
        select: { memberId: true, amount: true },
      })
      memberReceipts.forEach(r => {
        const sid = r.memberId ? memberToSales[r.memberId] : null
        if (sid) salesRevenueByStaff[sid] = (salesRevenueByStaff[sid] || 0) + r.amount
      })
    }

    // 2) يوم الاستخدام المنسوب لسيلز → إيصالاته في الشهر
    const salesDayUse = await prisma.dayUseInBody.findMany({
      where: { salesStaffId: { in: staffIds } },
      select: { id: true, salesStaffId: true },
    })
    const dayUseToSales: Record<string, string> = {}
    salesDayUse.forEach(d => { if (d.salesStaffId) dayUseToSales[d.id] = d.salesStaffId })
    const salesDayUseIds = salesDayUse.map(d => d.id)
    if (salesDayUseIds.length) {
      const duReceipts = await prisma.receipt.findMany({
        where: { dayUseId: { in: salesDayUseIds }, isCancelled: false, createdAt: { gte: startDate, lte: endDate } },
        select: { dayUseId: true, amount: true },
      })
      duReceipts.forEach(r => {
        const sid = r.dayUseId ? dayUseToSales[r.dayUseId] : null
        if (sid) salesRevenueByStaff[sid] = (salesRevenueByStaff[sid] || 0) + r.amount
      })
    }

    // حساب التحليلات لكل موظف
    const analytics: StaffAnalytics[] = allStaff.map((staff) => {
      // القيم الافتراضية
      const workingHours = staff.workingHours || 8
      const monthlyVacationDays = staff.monthlyVacationDays || 2

      // حساب عدد أيام العمل المتوقعة (مراعاة تاريخ الانضمام + تاريخ القطع للشهر الحالي)
      //  📅 أيام العمل المتوقّعة حسب كاليندر الموظف:
      //  - المصدر الأساسي: الشيفتات المسجّلة في الكاليندر (يوم بلا شيفت = أوف)
      //  - لو مفيش شيفتات: الروتيشن الأسبوعي، وإلا كل الأيام
      //  - الإجازات المعتمدة + العطلات → مستثناة دايمًا
      const scheduledDays = new Set<number>(
        staff.shiftAssignments.map(s => new Date(s.date).getDate())
      )
      const workingWeekdays = dayNamesToWeekdaySet(staff.rotations.map(r => r.dayOfWeek))
      const leaveRanges = staff.leaves.map(l => ({
        start: new Date(new Date(l.startDate).setHours(0, 0, 0, 0)),
        end: new Date(new Date(l.endDate).setHours(23, 59, 59, 999)),
      }))
      const isOffDate = (date: Date): boolean => {
        if (isHoliday(date)) return true
        return leaveRanges.some(r => date >= r.start && date <= r.end)
      }
      const expectedWorkingDays = getExpectedWorkingDaysWithSchedule(
        new Date(staff.createdAt),
        year,
        month,
        todayCutoff ?? undefined,
        { scheduledDays, workingWeekdays, isOffDate }
      )

      // حساب الساعات الفعلية (sum of durations)
      const totalMinutes = staff.attendance.reduce((sum, att) => {
        return sum + (att.duration || 0)
      }, 0)
      const actualHoursWorked = minutesToHours(totalMinutes)

      // عدد أيام الحضور
      const daysAttended = staff.attendance.length

      // عدد أيام الغياب (مايبقاش سالب لو حضر في يوم أوف/عطلة)
      const daysAbsent = Math.max(0, expectedWorkingDays - daysAttended)

      // الساعات المطلوبة
      const requiredHours = workingHours * expectedWorkingDays

      // فرق الساعات
      const hoursDifference = actualHoursWorked - requiredHours

      // أيام الإجازة المتبقية
      const vacationDaysRemaining = monthlyVacationDays - daysAbsent

      // نسبة الأداء
      const performancePercentage = calculatePerformancePercentage(
        actualHoursWorked,
        requiredHours
      )

      // تحديد حالة الأداء
      const status = getPerformanceStatus(performancePercentage)

      // تحديد الأيام المقصرة
      const underperformanceDays: UnderperformanceDay[] = []
      staff.attendance.forEach((att) => {
        if (att.duration) {
          const dayHours = minutesToHours(att.duration)
          if (dayHours < workingHours) {
            underperformanceDays.push({
              date: att.checkIn.toISOString().split('T')[0],
              actualHours: dayHours,
              requiredHours: workingHours,
              shortfall: dayHours - workingHours
            })
          }
        }
      })

      // حساب التأخير والخروج المبكر
      const lateArrivals: { date: string; checkInTime: string; shiftStart: string; lateMinutes: number }[] = []
      const earlyDepartures: { date: string; checkOutTime: string; shiftEnd: string; earlyMinutes: number }[] = []
      const attendanceDetails: { date: string; checkIn: string; checkOut: string | null; duration: number | null; status: string; lateMinutes: number; earlyMinutes: number }[] = []

      const shiftStart = staff.shiftStartTime || null // e.g. "09:00"
      const shiftEnd = staff.shiftEndTime || null // e.g. "17:00"

      staff.attendance.forEach((att) => {
        const checkInDate = new Date(att.checkIn)
        const dateStr = checkInDate.toISOString().split('T')[0]
        const checkInTimeStr = checkInDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
        const checkOutTimeStr = att.checkOut ? new Date(att.checkOut).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : null

        let lateMins = 0
        let earlyMins = 0
        let dayStatus = 'on-time'

        //  حساب التأخير — يستخدم helper بيدعم overnight shifts (e.g. 20:00 → 03:00)
        if (shiftStart && shiftEnd) {
          const raw = calcLateMinutes(checkInDate, shiftStart, shiftEnd)
          if (raw !== null && raw > 5) { // 5 دقائق سماح
            lateMins = raw
            lateArrivals.push({
              date: dateStr,
              checkInTime: checkInTimeStr,
              shiftStart: shiftStart,
              lateMinutes: lateMins
            })
            dayStatus = 'late'
          }
        }

        //  حساب الخروج المبكر — نفس الـ helper
        if (shiftStart && shiftEnd && att.checkOut) {
          const checkOutDate = new Date(att.checkOut)
          const raw = calcEarlyMinutes(checkInDate, checkOutDate, shiftStart, shiftEnd)
          if (raw !== null && raw > 5) { // 5 دقائق سماح
            earlyMins = raw
            earlyDepartures.push({
              date: dateStr,
              checkOutTime: checkOutTimeStr!,
              shiftEnd: shiftEnd,
              earlyMinutes: earlyMins
            })
            if (dayStatus === 'late') dayStatus = 'late-and-early'
            else dayStatus = 'early'
          }
        }

        attendanceDetails.push({
          date: dateStr,
          checkIn: checkInTimeStr,
          checkOut: checkOutTimeStr,
          duration: att.duration,
          status: dayStatus,
          lateMinutes: lateMins,
          earlyMinutes: earlyMins
        })
      })

      const totalLateMinutes = lateArrivals.reduce((sum, l) => sum + l.lateMinutes, 0)
      const totalEarlyMinutes = earlyDepartures.reduce((sum, e) => sum + e.earlyMinutes, 0)
      const onTimeDays = daysAttended - lateArrivals.length
      const punctualityScore = daysAttended > 0 ? Math.round((onTimeDays / daysAttended) * 100) : 100

      // حساب العائدات من الكوميشن (للكوتش)
      const revenueBreakdown = {
        pt: 0,
        nutrition: 0,
        physiotherapy: 0,
        other: 0,
        sales: salesRevenueByStaff[staff.id] || 0,   //  💼 عائدات السيلز الخاصة
        total: 0
      }

      staff.commissions.forEach((commission) => {
        const amount = commission.amount || 0
        const type = commission.type?.toLowerCase() || 'other'

        if (type.includes('pt') || type.includes('personal') || type.includes('تدريب')) {
          revenueBreakdown.pt += amount
        } else if (type.includes('nutrition') || type.includes('تغذية')) {
          revenueBreakdown.nutrition += amount
        } else if (type.includes('physio') || type.includes('علاج') || type.includes('therapy')) {
          revenueBreakdown.physiotherapy += amount
        } else {
          revenueBreakdown.other += amount
        }
        revenueBreakdown.total += amount
      })

      //  تحديد نوع الأكونت من المسمّى الوظيفي (position ممكن يكون متعدد بفاصلة)
      const posLower = (staff.position || '').toLowerCase()
      const isSalesStaff = /sales|سيلز|مبيعات/.test(posLower)
      const isCoachStaff = /coach|مدرب|كوتش|تدريب/.test(posLower) || revenueBreakdown.total > 0
      const isReceptionStaff = /reception|ريسبشن|ريسيبشن|استقبال/.test(posLower)
      let staffType: 'sales' | 'reception' | 'coach' = 'coach'
      if (isSalesStaff) staffType = 'sales'
      else if (isReceptionStaff && !isCoachStaff) staffType = 'reception'

      // حساب السلف
      const advances = {
        total: staff.expenses.reduce((sum, e) => sum + e.amount, 0),
        paid: staff.expenses.filter(e => e.isPaid).reduce((sum, e) => sum + e.amount, 0),
        unpaid: staff.expenses.filter(e => !e.isPaid).reduce((sum, e) => sum + e.amount, 0),
        count: staff.expenses.length,
        items: staff.expenses.map(e => ({
          id: e.id,
          amount: e.amount,
          description: e.description,
          isPaid: e.isPaid,
          createdAt: e.createdAt.toISOString(),
          notes: e.notes
        }))
      }

      // حساب نسبة العائدات إلى الراتب — للسيلز نعتمد على عائداته الخاصة، للريسيبشن مفيش
      const ratioBase = staffType === 'sales' ? revenueBreakdown.sales
        : staffType === 'reception' ? 0
        : revenueBreakdown.total
      const revenueToSalaryRatio = staffType !== 'reception' && staff.salary && staff.salary > 0
        ? Math.round((ratioBase / staff.salary) * 100) / 100
        : null

      // توليد التنبيهات
      const alerts = generateAlerts(
        {
          hoursDifference,
          daysAbsent,
          vacationDaysRemaining,
          performancePercentage,
          lateCount: lateArrivals.length,
          totalLateMinutes,
          punctualityScore
        },
        locale
      )

      return {
        staffId: staff.id,
        staffCode: staff.staffCode,
        staffName: staff.name,
        position: staff.position,
        salary: staff.salary,
        workingHours,
        monthlyVacationDays,
        actualHoursWorked,
        requiredHours,
        hoursDifference,
        daysAttended,
        daysAbsent,
        vacationDaysRemaining,
        performancePercentage,
        underperformanceDays,
        status,
        alerts,
        revenue: revenueBreakdown,
        revenueToSalaryRatio,
        staffType,
        advances,
        shiftStartTime: shiftStart,
        shiftEndTime: shiftEnd,
        lateArrivals,
        earlyDepartures,
        attendanceDetails,
        totalLateMinutes,
        totalEarlyMinutes,
        punctualityScore
      }
    })

    // فرز حسب نسبة الأداء (الأسوأ أولاً)
    analytics.sort((a, b) => a.performancePercentage - b.performancePercentage)

    return NextResponse.json({
      month,
      year,
      workingDaysInMonth,
      isPartialMonth: isCurrentMonth,
      dataUpToDay: isCurrentMonth ? now.getDate() : new Date(year, month, 0).getDate(),
      analytics
    })

  } catch (error: any) {
    console.error('Error fetching HR analytics:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    if (typeof error?.message === 'string' && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية الوصول لمساعد الموارد البشرية' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل جلب التحليلات' },
      { status: 500 }
    )
  }
}
