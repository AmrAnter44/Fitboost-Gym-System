import { prisma } from './prisma'

/**
 * يتحقق إن صاحب الطلب يعرف رقم هاتف العضو صاحب الـ memberId.
 *
 * ده الدفاع ضد الـ IDOR في مسارات /api/public/member/[memberId]/* :
 * من غيره أي حد يقدر يعدّل/يقرأ بيانات أي عضو بمجرد معرفة الـ id.
 * بنقارن بآخر 10 أرقام عشان نتجاهل صيغ +20 / 0020 / المسافات.
 *
 * (نفس المنطق المستخدم أصلاً في profile-image/route.ts)
 */
/** آخر 10 أرقام من رقم التليفون — أو null لو أقل من 10 أرقام */
export function phoneTail(v: unknown): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const d = String(v).replace(/\D/g, '')
  return d.length >= 10 ? d.slice(-10) : null
}

/** 🔒 مطابقة كاملة لآخر 10 أرقام (مش "contains") — رقم ناقص أو فاضي مبيطابقش أي حد */
export function samePhone(stored: unknown, provided: unknown): boolean {
  const a = phoneTail(stored)
  const b = phoneTail(provided)
  return !!a && !!b && a === b
}

export async function verifyMemberPhone(memberId: string, phoneNumber: unknown): Promise<boolean> {
  if (!memberId || typeof memberId !== 'string' || !phoneTail(phoneNumber)) return false
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { phone: true },
  })
  return !!member && samePhone(member.phone, phoneNumber)
}
