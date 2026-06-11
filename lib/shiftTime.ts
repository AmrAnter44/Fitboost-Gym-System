/**
 * Helpers لحساب أوقات الشيفت — يدعم الـ overnight shifts بشكل صحيح
 * (مثال: شيفت يبدأ 20:00 وينتهي 03:00 الصبح).
 *
 * المشكلة اللي بيحلها: المقارنة بـ "دقائق-من-نص-الليل" بتفشل لو الشيفت يعدّي 12:00 ليلاً.
 * الحل: نبني Date objects كاملة للشيفت start/end ونقارن مباشرة.
 */

export type ShiftAnchors = {
  expectedStart: Date
  expectedEnd: Date
  isOvernight: boolean
}

function parseHHMM(hhmm: string): { h: number; m: number } | null {
  if (!hhmm || typeof hhmm !== 'string') return null
  const parts = hhmm.split(':')
  if (parts.length < 2) return null
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return { h, m }
}

/**
 * احسب الـ Date انكور للشيفت بناءً على وقت الـ check-in وأوقات الشيفت.
 *
 * - لو الشيفت overnight (e.g. 20:00 → 03:00) والـ check-in في الصبح الباكر:
 *   نعتبر الشيفت بدأ امبارح (ونرجّع الـ expectedStart ليوم -1).
 * - الـ expectedEnd دايماً = expectedStart + (مدّة الشيفت بالدقايق).
 *
 * @param refDate تاريخ الـ check-in (أو الـ check-out) كـ Date
 * @param shiftStartHM وقت بداية الشيفت "HH:MM"
 * @param shiftEndHM وقت نهاية الشيفت "HH:MM"
 * @returns null لو الـ inputs invalid
 */
export function getShiftAnchors(
  refDate: Date,
  shiftStartHM: string | null | undefined,
  shiftEndHM: string | null | undefined
): ShiftAnchors | null {
  if (!shiftStartHM || !shiftEndHM) return null
  const s = parseHHMM(shiftStartHM)
  const e = parseHHMM(shiftEndHM)
  if (!s || !e) return null

  const startMin = s.h * 60 + s.m
  const endMin = e.h * 60 + e.m
  const isOvernight = endMin <= startMin

  const refMin = refDate.getHours() * 60 + refDate.getMinutes()

  // اختار اليوم اللي الشيفت "بدأ فيه":
  // - شيفت عادي: الـ shift day هو نفس يوم الـ refDate
  // - شيفت overnight: لو refDate في الصبح الباكر (قبل ما الشيفت "كان مفروض ينتهي" + buffer)،
  //   فالشيفت بتاع امبارح
  const shiftDay = new Date(refDate)
  if (isOvernight && refMin < startMin) {
    // refDate جاي في الـ AM portion بعد منتصف الليل — الشيفت بدأ امبارح
    // (buffer = 4 ساعات بعد expected end عشان نسمح بـ overtime معقول)
    if (refMin <= endMin + 240) {
      shiftDay.setDate(shiftDay.getDate() - 1)
    }
  }
  shiftDay.setHours(0, 0, 0, 0)

  const expectedStart = new Date(shiftDay)
  expectedStart.setHours(s.h, s.m, 0, 0)

  const expectedEnd = new Date(shiftDay)
  expectedEnd.setHours(e.h, e.m, 0, 0)
  if (isOvernight) {
    expectedEnd.setDate(expectedEnd.getDate() + 1)
  }

  return { expectedStart, expectedEnd, isOvernight }
}

/**
 * احسب دقايق التأخير الفعلية بناءً على check-in و الـ shift start.
 * بيستخدم Date objects كاملة عشان يدعم overnight shifts.
 *
 * @returns عدد دقايق التأخير (>= 0)، أو null لو الـ shift mis-configured
 */
export function calcLateMinutes(
  checkIn: Date,
  shiftStartHM: string | null | undefined,
  shiftEndHM: string | null | undefined
): number | null {
  const anchors = getShiftAnchors(checkIn, shiftStartHM, shiftEndHM)
  if (!anchors) return null
  const lateMs = checkIn.getTime() - anchors.expectedStart.getTime()
  if (lateMs <= 0) return 0
  return Math.round(lateMs / 60000)
}

/**
 * احسب دقايق الخروج المبكر بناءً على check-out و الـ shift end.
 * بيستخدم Date objects كاملة عشان يدعم overnight shifts.
 *
 * @returns عدد دقايق الخروج المبكر (>= 0)، أو null لو الـ shift mis-configured
 */
export function calcEarlyMinutes(
  checkIn: Date,
  checkOut: Date,
  shiftStartHM: string | null | undefined,
  shiftEndHM: string | null | undefined
): number | null {
  // anchor الـ shift على يوم الـ check-in (مش الـ check-out)
  // ده مهم: لو شخص دخل 20:00 السبت وخرج 03:00 الأحد، الشيفت بتاع السبت
  const anchors = getShiftAnchors(checkIn, shiftStartHM, shiftEndHM)
  if (!anchors) return null
  const earlyMs = anchors.expectedEnd.getTime() - checkOut.getTime()
  if (earlyMs <= 0) return 0
  return Math.round(earlyMs / 60000)
}
