//  🔒 حد الحصص لحد دفع الباقي (PT / تغذية / علاج طبيعي / مزيد)
//
//  لو على الاشتراك باقي فلوس، الموظف بيحدد عدد حصص مسموح بيها قبل الدفع (مثلاً 2).
//  بعد ما العميل يستخدمهم، تسجيل أي حصة تانية بيتقفل لحد ما الباقي يتدفع بالكامل.
//
//  التخزين: عمود unpaidSessionsLockAt = عدد الحصص الباقية اللي عنده القفل يبدأ.
//    مثال: 12 حصة والحد 2 → unpaidSessionsLockAt = 10 → القفل لما sessionsRemaining <= 10.
//  كده الحساب بيفضل صح حتى لو حد عدّل عدد الحصص، والقفل بيتفك لوحده أول ما
//  remainingAmount يبقى صفر (من غير ما مسارات دفع الباقي تتغير).
//
//  الملف ده pure (من غير prisma) عشان يتستخدم في الـ API والواجهة.

export interface PaymentLockRow {
  sessionsRemaining?: number | null
  remainingAmount?: number | null
  unpaidSessionsLockAt?: number | null
}

/**
 * يحوّل "عدد الحصص المسموح قبل الدفع" (اللي الموظف كتبه) لقيمة العمود.
 * بيرجّع null لو مفيش حد (فاضي / صفر / مفيش باقي).
 */
export function computeUnpaidLockAt(
  sessionsRemaining: number,
  limit: unknown,
  remainingAmount: unknown
): number | null {
  const n = Math.floor(Number(limit))
  if (!Number.isFinite(n) || n <= 0) return null
  if (!((Number(remainingAmount) || 0) > 0)) return null
  return Math.max(0, (Number(sessionsRemaining) || 0) - n)
}

/** عدد الحصص المسموح بيها لسه قبل ما الدفع يبقى لازم — null لو مفيش حد شغّال */
export function sessionsLeftBeforePayment(row: PaymentLockRow): number | null {
  if (row.unpaidSessionsLockAt === null || row.unpaidSessionsLockAt === undefined) return null
  if (!((Number(row.remainingAmount) || 0) > 0)) return null
  return Math.max(0, (Number(row.sessionsRemaining) || 0) - Number(row.unpaidSessionsLockAt))
}

/** هل تسجيل الحصص مقفول لحد دفع الباقي؟ */
export function isPaymentLocked(row: PaymentLockRow): boolean {
  return sessionsLeftBeforePayment(row) === 0
}

/** رسالة الخطأ اللي بتظهر لما تسجيل حصة يترفض */
export function paymentLockMessage(row: PaymentLockRow): string {
  const owed = Math.round(Number(row.remainingAmount) || 0)
  return `لا يمكن تسجيل حصة — العميل استخدم الحصص المسموحة قبل دفع الباقي. لازم يدفع الباقي (${owed}) عشان يكمل`
}
