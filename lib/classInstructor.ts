// lib/classInstructor.ts — مين بيقدّم الكلاس (ClassSchedule.instructorStaffId / instructorPhone)
//  - كابتن من الجيم: موظف موجود.
//  - كابتن من برا: بيتعمله حساب موظف (position «كابتن خارجي») بـ staffCode جديد عشان يعمل حضور/انصراف
//    في صفحة الموظفين. لو رقمه متسجل لموظف قبل كده بنستخدم نفس الحساب (مابنكررش).
//  الأعمدة جديدة → raw SQL (الـ Prisma client ممكن يكون قديم).

export const EXTERNAL_COACH_POSITION = 'كابتن خارجي'

export type InstructorInput = {
  instructorStaffId?: string | null
  externalName?: string | null
  externalPhone?: string | null
}

export type ResolvedInstructor = {
  staffId: string
  name: string
  phone: string | null
  staffCode: string
  created: boolean
}

const tail10 = (p: unknown) => String(p || '').replace(/\D/g, '').slice(-10)

/** أول staffCode فاضي بعد أكبر رقم (s001 … s999 … s1000) */
async function nextStaffCode(db: any): Promise<string> {
  const rows: Array<{ staffCode: string }> = await db.staff.findMany({ select: { staffCode: true } })
  let max = 0
  for (const r of rows) {
    const m = /^s(\d+)$/i.exec(String(r.staffCode || '').trim())
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  const taken = new Set(rows.map(r => String(r.staffCode).toLowerCase()))
  let n = max + 1
  while (taken.has(`s${String(n).padStart(3, '0')}`)) n++
  return `s${String(n).padStart(3, '0')}`
}

/**
 * يحدد الكابتن: موظف موجود، أو كابتن من برا (ينشئ/يلاقي حساب موظف ليه).
 * بيرجّع null لو مفيش اختيار؛ وبيرمي Error برسالة عربي لو البيانات ناقصة/غلط.
 */
export async function resolveInstructor(db: any, input: InstructorInput): Promise<ResolvedInstructor | null> {
  if (input.instructorStaffId) {
    const s = await db.staff.findUnique({ where: { id: input.instructorStaffId }, select: { id: true, name: true, phone: true, staffCode: true } })
    if (!s) throw new Error('الكابتن المختار مش موجود')
    return { staffId: s.id, name: s.name, phone: s.phone || null, staffCode: s.staffCode, created: false }
  }

  const name = String(input.externalName || '').trim()
  const phone = String(input.externalPhone || '').trim()
  if (!name && !phone) return null
  if (!name) throw new Error('اكتب اسم الكابتن')
  if (tail10(phone).length !== 10) throw new Error('رقم تليفون الكابتن غير صحيح')

  //  نفس الرقم متسجل لموظف؟ → نفس الحساب (ونرجّعه نشط لو كان موقوف)
  const t = tail10(phone)
  const candidates: Array<{ id: string; name: string; phone: string | null; staffCode: string; isActive: boolean }> =
    await db.staff.findMany({ where: { phone: { endsWith: t.slice(-4) } }, select: { id: true, name: true, phone: true, staffCode: true, isActive: true } })
  const existing = candidates.find(c => tail10(c.phone) === t)
  if (existing) {
    if (!existing.isActive) await db.staff.update({ where: { id: existing.id }, data: { isActive: true, terminatedAt: null } })
    return { staffId: existing.id, name: existing.name, phone: existing.phone, staffCode: existing.staffCode, created: false }
  }

  const staffCode = await nextStaffCode(db)
  const created = await db.staff.create({
    data: {
      staffCode,
      name,
      phone,
      position: EXTERNAL_COACH_POSITION,
      notes: 'كابتن كلاسات من برا الجيم — اتعمل تلقائي من جدول الكلاسيز',
      isActive: true,
      joinedDate: new Date(),
    },
    select: { id: true, name: true, phone: true, staffCode: true },
  })
  return { staffId: created.id, name: created.name, phone: created.phone, staffCode: created.staffCode, created: true }
}

/** يحفظ الكابتن على الكلاس (raw) */
export async function setClassInstructor(db: any, classId: string, ins: ResolvedInstructor | null): Promise<void> {
  await db.$executeRawUnsafe(
    `UPDATE ClassSchedule SET instructorStaffId = ?, instructorPhone = ? WHERE id = ?`,
    ins ? ins.staffId : null,
    ins ? ins.phone : null,
    classId
  )
}

/** يضيف بيانات الكابتن (الموظف + الـ ID بتاعه) لقايمة كلاسات */
export async function withInstructors<T extends { id: string }>(db: any, schedules: T[]): Promise<Array<T & { instructorStaffId: string | null; instructorPhone: string | null; instructorCode: string | null }>> {
  if (schedules.length === 0) return []
  let rows: Array<{ id: string; instructorStaffId: string | null; instructorPhone: string | null }> = []
  try {
    rows = await db.$queryRawUnsafe(
      `SELECT id, instructorStaffId, instructorPhone FROM ClassSchedule WHERE id IN (${schedules.map(() => '?').join(',')})`,
      ...schedules.map(s => s.id)
    )
  } catch { /* العمود لسه مش متضاف */ }
  const byId = new Map(rows.map(r => [r.id, r]))
  const staffIds = Array.from(new Set(rows.map(r => r.instructorStaffId).filter(Boolean))) as string[]
  const staff: Array<{ id: string; staffCode: string }> = staffIds.length
    ? await db.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, staffCode: true } })
    : []
  const codeById = new Map(staff.map(s => [s.id, s.staffCode]))
  return schedules.map(s => {
    const r = byId.get(s.id)
    const sid = r?.instructorStaffId || null
    return { ...s, instructorStaffId: sid, instructorPhone: r?.instructorPhone || null, instructorCode: sid ? codeById.get(sid) || null : null }
  })
}
