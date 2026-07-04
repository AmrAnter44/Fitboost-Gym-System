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
export async function verifyMemberPhone(memberId: string, phoneNumber: unknown): Promise<boolean> {
  if (!memberId || !phoneNumber || typeof phoneNumber !== 'string') return false
  const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10)
  if (cleanPhone.length < 7) return false
  const member = await prisma.member.findFirst({
    where: { id: memberId, phone: { contains: cleanPhone } },
    select: { id: true },
  })
  return !!member
}
