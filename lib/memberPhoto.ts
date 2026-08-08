// ==========================================
// صور الأعضاء في القوايم — الداتا القديمة فيها صور base64 متخزنة جوه عمود
// Member.profileImage، ولو رجعناها زي ما هي في قوايم (أعضاء/حضور) كل صفحة
// بتشيل ميجابايتس في الـ JSON وبتقعد في رامات المتصفح.
// بدل كده بنستبدلها بلينك /api/members/[id]/photo — المتصفح بيحمّل بس
// الصور الظاهرة فعلًا (LazyAvatar) وبيكاشيها.
// القيم اللي هي أصلًا لينكات ملفات (بعد المهاجرة أو الرفع الجديد) بتعدي زي ما هي.
// ==========================================

export function memberPhotoUrl(
  memberId: string,
  profileImage: string | null | undefined
): string | null {
  if (!profileImage) return null
  if (profileImage.startsWith('data:')) return `/api/members/${memberId}/photo`
  return profileImage
}

/** بيستبدل profileImage في object عضو (أو null) — للاستخدام في includes الجداول التانية */
export function withPhotoUrl<T extends { profileImage?: string | null }>(
  memberId: string,
  member: T | null
): T | null {
  if (!member) return member
  return { ...member, profileImage: memberPhotoUrl(memberId, member.profileImage) }
}
