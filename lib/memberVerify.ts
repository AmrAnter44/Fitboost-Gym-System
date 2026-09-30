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

/**
 * 🔒 الرقم اللي كتبه العضو لازم يكون كامل (10 أرقام على الأقل)، وبعدها لازم آخر 10 أرقام
 * منه تكون موجودة في رقم العضو المتسجّل. ده بيقبل الصيغ المختلفة (+20 / مسافات)
 * وبيقبل خانة فيها رقمين، بس رقم ناقص أو فاضي مبيطابقش أي حد.
 */
export function samePhone(stored: unknown, provided: unknown): boolean {
  const b = phoneTail(provided)
  if (!b || (typeof stored !== 'string' && typeof stored !== 'number')) return false
  const storedDigits = String(stored).replace(/\D/g, '')
  return storedDigits.length >= 10 && storedDigits.includes(b)
}

/**
 * رقم العضو من هيدر x-member-phone (الأبلكيشن الجديد بيبعته في الهيدر بدل الرابط
 * عشان مايتسجلش في لوجات السيرفر/Cloudflare). لو مش موجود بنرجع للقيمة القديمة
 * (?phone= أو phoneNumber في الـ body) عشان النسخ القديمة من الأبلكيشن تفضل شغالة.
 */
export function memberPhoneFrom(request: { headers: Headers }, fallback?: unknown): unknown {
  const h = request.headers.get('x-member-phone')
  return h && h.trim() ? h : fallback
}

export async function verifyMemberPhone(memberId: string, phoneNumber: unknown): Promise<boolean> {
  if (!memberId || typeof memberId !== 'string' || !phoneTail(phoneNumber)) return false
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { phone: true },
  })
  return !!member && samePhone(member.phone, phoneNumber)
}
