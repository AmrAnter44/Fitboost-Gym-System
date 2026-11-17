// 🩺 الهيستوري الطبي للعضو — بيتخزن JSON في Member.medicalHistory
//  [{ condition: 'سكر', chronic: true }, ...] — بيظهر في بروفايل العضو بس (مش في السكان)

export interface MedicalEntry {
  condition: string
  chronic: boolean
}

export const MEDICAL_MAX_ENTRIES = 20
export const MEDICAL_MAX_LEN = 100

/** تنظيف المدخلات: نشيل الفاضي، نقصّ الطول، ونحدد العدد */
export function sanitizeMedicalHistory(v: unknown): MedicalEntry[] {
  if (!Array.isArray(v)) return []
  const out: MedicalEntry[] = []
  for (const e of v) {
    const condition = String((e as any)?.condition ?? '').trim().slice(0, MEDICAL_MAX_LEN)
    if (!condition) continue
    out.push({ condition, chronic: !!(e as any)?.chronic })
    if (out.length >= MEDICAL_MAX_ENTRIES) break
  }
  return out
}

export function parseMedicalHistory(raw: unknown): MedicalEntry[] {
  if (!raw || typeof raw !== 'string') return []
  try { return sanitizeMedicalHistory(JSON.parse(raw)) } catch { return [] }
}
