// lib/websiteContact.ts
// بيانات التواصل اللي بتظهر على موقع الجيم (فوتر، زراير الواتساب، الخريطة، المواعيد).
// بتتحفظ في Control كصف واحد لكل فرع — Control هو اللي بيتحقق من الداتا ويرجّع الأخطاء.

export const CONTACT_DAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const
export type ContactDay = (typeof CONTACT_DAYS)[number]

export const CONTACT_DAY_LABELS: Record<ContactDay, { ar: string; en: string }> = {
  sat: { ar: 'السبت', en: 'Saturday' },
  sun: { ar: 'الأحد', en: 'Sunday' },
  mon: { ar: 'الاثنين', en: 'Monday' },
  tue: { ar: 'الثلاثاء', en: 'Tuesday' },
  wed: { ar: 'الأربعاء', en: 'Wednesday' },
  thu: { ar: 'الخميس', en: 'Thursday' },
  fri: { ar: 'الجمعة', en: 'Friday' },
}

export interface ContactHours {
  day: ContactDay
  closed: boolean
  open: string | null
  close: string | null
}

export interface WebsiteContact {
  whatsapp: string | null
  phone: string | null
  address: string | null
  maps_url: string | null
  facebook: string | null
  instagram: string | null
  tiktok: string | null
  hours: ContactHours[]
  hours_note: string | null
}

export const CONTACT_TEXT_FIELDS = [
  'whatsapp', 'phone', 'address', 'maps_url', 'facebook', 'instagram', 'tiktok', 'hours_note',
] as const

/** ياخد body جاي من الواجهة ويرجّع الشكل اللي Control مستنيه (من غير أي مفاتيح زيادة) */
export function pickContact(input: unknown): WebsiteContact {
  const b = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
  const hoursIn = Array.isArray(b.hours) ? b.hours : []
  const hours: ContactHours[] = []
  for (const day of CONTACT_DAYS) {
    const h = hoursIn.find((x: any) => x && x.day === day) as Record<string, unknown> | undefined
    if (!h) continue
    hours.push({ day, closed: h.closed === true, open: str(h.open, 5), close: str(h.close, 5) })
  }
  return {
    whatsapp: str(b.whatsapp, 40),
    phone: str(b.phone, 40),
    address: str(b.address, 300),
    maps_url: str(b.maps_url, 500),
    facebook: str(b.facebook, 500),
    instagram: str(b.instagram, 500),
    tiktok: str(b.tiktok, 500),
    hours,
    hours_note: str(b.hours_note, 300),
  }
}
