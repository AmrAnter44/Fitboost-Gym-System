// lib/timeFormatter.ts - وظائف لتحويل الوقت بين نظام 12 و 24 ساعة

/**
 * تحويل من 24 ساعة إلى 12 ساعة
 * @param time24 - الوقت بصيغة 24 ساعة (مثال: "14:00")
 * @param locale - اللغة ('ar' أو 'en')
 * @returns الوقت بصيغة 12 ساعة (مثال: "2:00 مساءً" أو "2:00 PM")
 */
export function formatTime12Hour(time24: string, locale: 'ar' | 'en' = 'ar'): string {
  const [hours, minutes] = time24.split(':').map(Number)

  let hour12 = hours % 12
  if (hour12 === 0) hour12 = 12

  const period = hours >= 12 ? (locale === 'ar' ? 'مساءً' : 'PM') : (locale === 'ar' ? 'صباحاً' : 'AM')

  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`
}

/**
 * تحويل من 12 ساعة إلى 24 ساعة
 * @param time12 - الوقت بصيغة 12 ساعة (مثال: "2:00 PM" أو "2:00 مساءً")
 * @returns الوقت بصيغة 24 ساعة (مثال: "14:00")
 */
export function formatTime24Hour(time12: string): string {
  // إزالة المسافات الزائدة
  const cleaned = time12.trim()

  // فصل الوقت عن الفترة (AM/PM أو صباحاً/مساءً)
  const isPM = cleaned.includes('PM') || cleaned.includes('مساءً') || cleaned.includes('pm')
  const isAM = cleaned.includes('AM') || cleaned.includes('صباحاً') || cleaned.includes('am')

  // استخراج الساعات والدقائق
  const timeOnly = cleaned.split(' ')[0]
  const [hour12Str, minutesStr] = timeOnly.split(':')
  let hour24 = parseInt(hour12Str)
  const minutes = minutesStr || '00'

  // تحويل إلى 24 ساعة
  if (isPM && hour24 !== 12) {
    hour24 += 12
  } else if (isAM && hour24 === 12) {
    hour24 = 0
  }

  return `${hour24.toString().padStart(2, '0')}:${minutes}`
}

/**
 * توليد قائمة الأوقات بصيغة 12 ساعة
 * @param startHour - ساعة البداية (24 ساعة)
 * @param endHour - ساعة النهاية (24 ساعة)
 * @param locale - اللغة
 * @returns مصفوفة من الأوقات بصيغة 12 ساعة مع القيمة بصيغة 24 ساعة
 */
export function generateTimeSlots12Hour(
  startHour: number = 9,
  endHour: number = 20,
  locale: 'ar' | 'en' = 'ar'
): Array<{ label: string; value: string }> {
  const slots: Array<{ label: string; value: string }> = []

  for (let hour = startHour; hour <= endHour; hour++) {
    const time24 = `${hour.toString().padStart(2, '0')}:00`
    const time12 = formatTime12Hour(time24, locale)

    slots.push({
      label: time12,
      value: time24
    })
  }

  return slots
}
