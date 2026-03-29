import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
import {
  getWorkingDaysInMonth,
  minutesToHours,
  calculatePerformancePercentage,
  getPerformanceStatus,
  generateAlerts,
  getExpectedWorkingDays
} from '../../../../lib/hrCalculations'
import { getLocaleFromRequest } from '../../../../lib/serverTranslation'

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
    const user = await verifyAuth(request)

    if (!user) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

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

    // حساب أيام العمل في الشهر
    const workingDaysInMonth = getWorkingDaysInMonth(year, month)

    // تحديد نطاق التاريخ للشهر المحدد
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

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
        }
      }
    })

    // حساب التحليلات لكل موظف
    const analytics: StaffAnalytics[] = allStaff.map((staff) => {
      // القيم الافتراضية
      const workingHours = staff.workingHours || 8
      const monthlyVacationDays = staff.monthlyVacationDays || 2

      // حساب عدد أيام العمل المتوقعة (مراعاة تاريخ الانضمام)
      const expectedWorkingDays = getExpectedWorkingDays(
        new Date(staff.createdAt),
        year,
        month
      )

      // حساب الساعات الفعلية (sum of durations)
      const totalMinutes = staff.attendance.reduce((sum, att) => {
        return sum + (att.duration || 0)
      }, 0)
      const actualHoursWorked = minutesToHours(totalMinutes)

      // عدد أيام الحضور
      const daysAttended = staff.attendance.length

      // عدد أيام الغياب
      const daysAbsent = expectedWorkingDays - daysAttended

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

        // حساب التأخير
        if (shiftStart) {
          const [shiftH, shiftM] = shiftStart.split(':').map(Number)
          const checkInH = checkInDate.getHours()
          const checkInM = checkInDate.getMinutes()
          const shiftStartMinutes = shiftH * 60 + shiftM
          const checkInMinutes = checkInH * 60 + checkInM
          if (checkInMinutes > shiftStartMinutes + 5) { // 5 دقائق سماح
            lateMins = checkInMinutes - shiftStartMinutes
            lateArrivals.push({
              date: dateStr,
              checkInTime: checkInTimeStr,
              shiftStart: shiftStart,
              lateMinutes: lateMins
            })
            dayStatus = 'late'
          }
        }

        // حساب الخروج المبكر
        if (shiftEnd && att.checkOut) {
          const [shiftEH, shiftEM] = shiftEnd.split(':').map(Number)
          const checkOutDate = new Date(att.checkOut)
          const checkOutH = checkOutDate.getHours()
          const checkOutM = checkOutDate.getMinutes()
          const shiftEndMinutes = shiftEH * 60 + shiftEM
          const checkOutMinutes = checkOutH * 60 + checkOutM
          if (checkOutMinutes < shiftEndMinutes - 5) { // 5 دقائق سماح
            earlyMins = shiftEndMinutes - checkOutMinutes
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

      // حساب العائدات من الكوميشن
      const revenueBreakdown = {
        pt: 0,
        nutrition: 0,
        physiotherapy: 0,
        other: 0,
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

      // حساب نسبة العائدات إلى الراتب
      const revenueToSalaryRatio = staff.salary && staff.salary > 0
        ? Math.round((revenueBreakdown.total / staff.salary) * 100) / 100
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

    return NextResponse.json(
      { error: 'فشل جلب التحليلات' },
      { status: 500 }
    )
  }
}
