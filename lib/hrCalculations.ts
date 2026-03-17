/**
 * HR Calculations Utility Functions
 * دوال مساعدة لحساب تحليلات الموارد البشرية
 */

/**
 * حساب عدد أيام العمل في شهر محدد (باستثناء الجمعة)
 * @param year السنة (مثل: 2024)
 * @param month الشهر (1-12)
 * @returns عدد أيام العمل
 */
export function getWorkingDaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate()
  let workingDays = 0

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const dayOfWeek = date.getDay()

    // استثناء الجمعة (يوم 5 في JavaScript: 0=Sunday, 5=Friday)
    if (dayOfWeek !== 5) {
      workingDays++
    }
  }

  return workingDays
}

/**
 * تحويل الدقائق إلى ساعات (مع الكسور)
 * @param minutes الدقائق
 * @returns الساعات (عدد عشري)
 */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100
}

/**
 * حساب نسبة الأداء المئوية
 * @param actualHours الساعات الفعلية
 * @param requiredHours الساعات المطلوبة
 * @returns النسبة المئوية (0-100+)
 */
export function calculatePerformancePercentage(
  actualHours: number,
  requiredHours: number
): number {
  if (requiredHours === 0) return 0
  return Math.round((actualHours / requiredHours) * 10000) / 100
}

/**
 * تحديد حالة أداء الموظف بناءً على النسبة المئوية
 * @param percentage نسبة الأداء المئوية
 * @returns الحالة: 'excellent' | 'good' | 'warning' | 'critical'
 */
export function getPerformanceStatus(
  percentage: number
): 'excellent' | 'good' | 'warning' | 'critical' {
  if (percentage >= 95) return 'excellent'  // متميز
  if (percentage >= 85) return 'good'       // جيد
  if (percentage >= 70) return 'warning'    // تحذير
  return 'critical'                         // حرج
}

/**
 * تحديد لون حالة الأداء للعرض في UI
 * @param status حالة الأداء
 * @returns كائن يحتوي على الألوان (bg, text, border)
 */
export function getStatusColors(status: 'excellent' | 'good' | 'warning' | 'critical') {
  const colors = {
    excellent: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-800 dark:text-green-300',
      border: 'border-green-300 dark:border-green-700',
      progress: 'bg-green-600'
    },
    good: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-800 dark:text-blue-300',
      border: 'border-blue-300 dark:border-blue-700',
      progress: 'bg-blue-600'
    },
    warning: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-800 dark:text-yellow-300',
      border: 'border-yellow-300 dark:border-yellow-700',
      progress: 'bg-yellow-600'
    },
    critical: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-800 dark:text-red-300',
      border: 'border-red-300 dark:border-red-700',
      progress: 'bg-red-600'
    }
  }

  return colors[status]
}

/**
 * إنشاء تنبيهات بناءً على بيانات التحليل
 * @param data بيانات التحليل
 * @param locale اللغة (ar/en)
 * @returns مصفوفة من التنبيهات
 */
export function generateAlerts(
  data: {
    hoursDifference: number
    daysAbsent: number
    vacationDaysRemaining: number
    performancePercentage: number
  },
  locale: 'ar' | 'en' = 'ar'
): string[] {
  const alerts: string[] = []

  // تنبيه نقص الساعات
  if (data.hoursDifference < 0) {
    const shortage = Math.abs(data.hoursDifference)
    alerts.push(
      locale === 'ar'
        ? `عمل ${shortage.toFixed(1)} ساعة أقل من المطلوب`
        : `Worked ${shortage.toFixed(1)} hours less than required`
    )
  }

  // تنبيه تجاوز أيام الإجازة
  if (data.vacationDaysRemaining < 0) {
    const exceeded = Math.abs(data.vacationDaysRemaining)
    alerts.push(
      locale === 'ar'
        ? `تجاوز ${exceeded} يوم إجازة عن المسموح`
        : `Exceeded ${exceeded} vacation days`
    )
  }

  // تنبيه استنفاذ أيام الإجازة
  if (data.vacationDaysRemaining === 0 && data.daysAbsent > 0) {
    alerts.push(
      locale === 'ar'
        ? 'استنفذ جميع أيام الإجازة المسموح بها'
        : 'Used all allowed vacation days'
    )
  }

  // تنبيه أداء منخفض
  if (data.performancePercentage < 70) {
    alerts.push(
      locale === 'ar'
        ? `⚠️ أداء منخفض جداً (${data.performancePercentage.toFixed(1)}%)`
        : `⚠️ Very low performance (${data.performancePercentage.toFixed(1)}%)`
    )
  }

  // تهنئة على الأداء الممتاز
  if (data.performancePercentage >= 100) {
    alerts.push(
      locale === 'ar'
        ? '🌟 أداء ممتاز! عمل ساعات إضافية'
        : '🌟 Excellent performance! Worked extra hours'
    )
  }

  return alerts
}

/**
 * تنسيق الساعات للعرض (مع الدقائق إذا كانت أكثر من صفر)
 * @param hours الساعات (عدد عشري)
 * @param locale اللغة
 * @returns نص منسق (مثل: "8 ساعات و 30 دقيقة")
 */
export function formatHours(hours: number, locale: 'ar' | 'en' = 'ar'): string {
  const wholeHours = Math.floor(hours)
  const minutes = Math.round((hours - wholeHours) * 60)

  if (minutes === 0) {
    return locale === 'ar'
      ? `${wholeHours} ${wholeHours === 1 ? 'ساعة' : 'ساعات'}`
      : `${wholeHours} ${wholeHours === 1 ? 'hour' : 'hours'}`
  }

  return locale === 'ar'
    ? `${wholeHours} ${wholeHours === 1 ? 'ساعة' : 'ساعات'} و ${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}`
    : `${wholeHours} ${wholeHours === 1 ? 'hour' : 'hours'} and ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
}

/**
 * حساب عدد أيام العمل الفعلية للموظف منذ تاريخ انضمامه
 * @param joinDate تاريخ الانضمام
 * @param year السنة
 * @param month الشهر
 * @returns عدد أيام العمل المتوقعة من الموظف
 */
export function getExpectedWorkingDays(
  joinDate: Date,
  year: number,
  month: number
): number {
  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0)

  // إذا كان الموظف انضم بعد الشهر المحدد، لا أيام عمل متوقعة
  if (joinDate > endOfMonth) return 0

  // إذا كان الموظف انضم قبل الشهر المحدد، حساب كامل الشهر
  if (joinDate < startOfMonth) {
    return getWorkingDaysInMonth(year, month)
  }

  // إذا كان الموظف انضم خلال الشهر، حساب من تاريخ الانضمام
  const lastDay = endOfMonth.getDate()
  let workingDays = 0

  for (let day = joinDate.getDate(); day <= lastDay; day++) {
    const date = new Date(year, month - 1, day)
    const dayOfWeek = date.getDay()

    if (dayOfWeek !== 5) { // استثناء الجمعة
      workingDays++
    }
  }

  return workingDays
}
