// lib/genderSchedule.ts — مواعيد الرجالة/السيدات (الجيم المكس)
//  - الكلاسيز: ClassSchedule.gender ('male' | 'female' | 'mixed') — العضو يشوف/يحجز جنسه + المختلط بس.
//  - الاسبا: SystemSettings.spaGenderSlots (JSON) — مواعيد لكل خدمة ولكل جنس، العضو يحجز جوه مواعيد جنسه بس.
//  كله شغّال بس لما «جيم مكس» يكون مفعّل. الأعمدة بنقراها raw SQL (الـ Prisma client ممكن يكون قديم).

import { timeToMinutes } from './spaHours'

export type Gender = 'male' | 'female'
export type SpaService = 'massage' | 'sauna' | 'jacuzzi'

/** ميعاد اسبا لجنس معيّن: خدمة (أو كل الخدمات) + أيام الأسبوع (0=الأحد) + من/إلى "HH:MM" */
export interface SpaGenderSlot {
  service: SpaService | 'all'
  gender: Gender
  days: number[]
  from: string
  to: string
}

const SERVICES = ['massage', 'sauna', 'jacuzzi', 'all']

/** جنس العضو بشكل موحّد — null = مش متحدد */
export function normalizeGender(g: unknown): Gender | null {
  const s = String(g || '').trim().toLowerCase()
  return s === 'male' || s === 'female' ? s : null
}

/** الجيم المكس مفعّل؟ */
export async function isMixedGymEnabled(db: any): Promise<boolean> {
  try {
    const rows: any = await db.$queryRawUnsafe(`SELECT mixedGymEnabled FROM SystemSettings WHERE id = 'singleton' LIMIT 1`)
    return !!(Array.isArray(rows) && rows[0] && Number(rows[0].mixedGymEnabled))
  } catch {
    return false
  }
}

/** جنس العضو (raw — العمود جديد) */
export async function getMemberGender(db: any, memberId: string): Promise<Gender | null> {
  try {
    const rows: any = await db.$queryRawUnsafe(`SELECT gender FROM Member WHERE id = ? LIMIT 1`, memberId)
    return normalizeGender(Array.isArray(rows) && rows[0] ? rows[0].gender : null)
  } catch {
    return null
  }
}

// ─────────────── الكلاسيز ───────────────

/** الكلاس ده يظهر/يتحجز للعضو ده؟ المختلط للكل؛ اللي جنسه مش متحدد يشوف المختلط بس */
export function classAllowedForGender(classGender: unknown, memberGender: Gender | null): boolean {
  const cg = String(classGender || 'mixed').toLowerCase()
  if (cg !== 'male' && cg !== 'female') return true
  return memberGender === cg
}

// ─────────────── الاسبا ───────────────

/** ينضّف قايمة المواعيد (اللي جاية من الإعدادات أو الداتابيز) ويشيل أي حاجة غلط */
export function sanitizeSpaSlots(input: unknown): SpaGenderSlot[] {
  if (!Array.isArray(input)) return []
  const out: SpaGenderSlot[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as any
    const gender = normalizeGender(r.gender)
    const service = SERVICES.includes(r.service) ? r.service : null
    const from = typeof r.from === 'string' ? r.from.trim() : ''
    const to = typeof r.to === 'string' ? r.to.trim() : ''
    const fm = timeToMinutes(from)
    const tm = timeToMinutes(to)
    const days = Array.isArray(r.days)
      ? Array.from(new Set(r.days.map((d: any) => Number(d)).filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6))).sort() as number[]
      : []
    if (!gender || !service || fm === null || tm === null || tm <= fm || days.length === 0) continue
    out.push({ service, gender, days, from, to })
  }
  return out
}

export async function getSpaGenderSlots(db: any): Promise<SpaGenderSlot[]> {
  try {
    const rows: any = await db.$queryRawUnsafe(`SELECT spaGenderSlots FROM SystemSettings WHERE id = 'singleton' LIMIT 1`)
    const raw = Array.isArray(rows) && rows[0] ? rows[0].spaGenderSlots : null
    return raw ? sanitizeSpaSlots(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

/** مواعيد الخدمة دي (الخاصة بيها + «كل الخدمات») */
function slotsForService(slots: SpaGenderSlot[], service: string): SpaGenderSlot[] {
  return slots.filter(s => s.service === service || s.service === 'all')
}

/** مواعيد العضو ده بس (جنسه) — للعرض في الأبليكيشن */
export function spaSlotsForGender(slots: SpaGenderSlot[], gender: Gender | null): SpaGenderSlot[] {
  return gender ? slots.filter(s => s.gender === gender) : []
}

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

/**
 * الحجز ده (خدمة + يوم + بداية + مدة) مسموح للعضو ده؟
 * لو الخدمة مالهاش مواعيد رجالة/سيدات خالص → مفيش قيد (زي الأول).
 * غير كده لازم الحجز يقع كله جوه ميعاد لجنس العضو في نفس اليوم.
 */
export function checkSpaGenderSlot(
  slots: SpaGenderSlot[],
  service: string,
  bookingDate: Date,
  bookingTime: string,
  duration: number,
  memberGender: Gender | null
): { ok: boolean; error?: string } {
  const relevant = slotsForService(slots, service)
  if (relevant.length === 0) return { ok: true }
  if (!memberGender) {
    return { ok: false, error: 'مواعيد الخدمة دي مقسومة رجالة وسيدات — اطلب من الريسيبشن يحدد الجنس في بياناتك' }
  }
  const start = timeToMinutes(bookingTime)
  if (start === null) return { ok: false, error: 'وقت الحجز غير صالح' }
  const end = start + (Number(duration) || 0)
  const day = bookingDate.getDay()
  const mine = relevant.filter(s => s.gender === memberGender && s.days.includes(day))
  const fits = mine.some(s => start >= timeToMinutes(s.from)! && end <= timeToMinutes(s.to)!)
  if (fits) return { ok: true }
  const label = memberGender === 'female' ? 'السيدات' : 'الرجالة'
  if (mine.length === 0) {
    return { ok: false, error: `مفيش مواعيد ${label} للخدمة دي يوم ${DAY_NAMES[day]}` }
  }
  const windows = mine.map(s => `${s.from}–${s.to}`).join(' ، ')
  return { ok: false, error: `مواعيد ${label} يوم ${DAY_NAMES[day]}: ${windows} — اختار ميعاد جوّاها` }
}
