// lib/spaHours.ts — مواعيد تشغيل الاسبا (ليميت)
// بنقرا الأعمدة بـ raw SQL لأن الـ Prisma client ممكن يكون قديم (الأعمدة جديدة).

export const DEFAULT_SPA_OPEN = '10:00'
export const DEFAULT_SPA_CLOSE = '22:00'

export interface SpaHours {
  openTime: string
  closeTime: string
}

/** يحوّل "HH:MM" لعدد دقائق من نص الليل. بيرجّع null لو الصيغة غلط. */
export function timeToMinutes(hhmm: unknown): number | null {
  if (typeof hhmm !== 'string') return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

/** يتأكد إن القيمة "HH:MM" صالحة، وإلا يرجّع القيمة الافتراضية. */
export function normalizeTime(value: unknown, fallback: string): string {
  return timeToMinutes(value) !== null ? (value as string).trim() : fallback
}

/** يقرأ مواعيد الاسبا من SystemSettings (raw SQL) مع قيم افتراضية آمنة. */
export async function getSpaHours(db: any): Promise<SpaHours> {
  try {
    const rows: any = await db.$queryRawUnsafe(
      `SELECT spaOpenTime, spaCloseTime FROM SystemSettings WHERE id = 'singleton' LIMIT 1`
    )
    const row = Array.isArray(rows) && rows.length ? rows[0] : null
    return {
      openTime: normalizeTime(row?.spaOpenTime, DEFAULT_SPA_OPEN),
      closeTime: normalizeTime(row?.spaCloseTime, DEFAULT_SPA_CLOSE),
    }
  } catch {
    return { openTime: DEFAULT_SPA_OPEN, closeTime: DEFAULT_SPA_CLOSE }
  }
}

/**
 * يتأكد إن الحجز (البداية + المدة) واقع بالكامل ضمن مواعيد تشغيل الاسبا.
 * لو الميعاد بره الأوقات بيرجّع { ok:false } مع رسالة عربية جاهزة للعرض.
 */
export function checkWithinSpaHours(
  bookingTime: string,
  duration: number,
  hours: SpaHours
): { ok: boolean; error?: string } {
  const start = timeToMinutes(bookingTime)
  const open = timeToMinutes(hours.openTime) ?? timeToMinutes(DEFAULT_SPA_OPEN)!
  const close = timeToMinutes(hours.closeTime) ?? timeToMinutes(DEFAULT_SPA_CLOSE)!

  if (start === null) {
    return { ok: false, error: 'وقت الحجز غير صالح' }
  }
  const dur = Number(duration) || 0
  const end = start + dur

  if (start < open || end > close) {
    return {
      ok: false,
      error: `الحجز متاح فقط في مواعيد تشغيل الاسبا من ${hours.openTime} إلى ${hours.closeTime}`,
    }
  }
  return { ok: true }
}
