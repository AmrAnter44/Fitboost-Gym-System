//  🎟️ هل باقة حصص (PT / More) تنفع يتخصم منها حصة دلوقتي؟
//
//  نفس قواعد السيستم: الحصص الباقية > 0، حد الدفع (isPaymentLocked)، ومعاهم قواعد
//  سكان المزيد (app/api/more/scan): الباقة بدأت ومش منتهية (مقارنة بالأيام)، و More
//  لازم يكون isActive. للـ PT كمان الباقة المتجمّدة مابيتخصمش منها.
//  الملف ده pure (من غير prisma) عشان يتستخدم في عرض الباقات وفي الخصم.

import { isPaymentLocked, paymentLockMessage, PaymentLockRow } from './sessionPaymentLimit'

export type PackageBlockReason =
  | 'no-sessions'
  | 'not-started'
  | 'expired'
  | 'frozen'
  | 'inactive'
  | 'payment-required'
  | 'already-today' // More بس: حصة واحدة في اليوم (زي سكان المزيد) — بيتحدد من سجل الحصص مش من الصف

export interface UsablePackageRow extends PaymentLockRow {
  sessionsRemaining: number
  startDate?: Date | string | null
  expiryDate?: Date | string | null
  isFrozen?: boolean | null
  isActive?: boolean | null
}

function dayStart(d: Date | string): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

/** null = تنفع يتخصم منها، غير كده سبب المنع */
export function packageBlockReason(row: UsablePackageRow, now: Date = new Date()): PackageBlockReason | null {
  const today = dayStart(now)
  if ((row.sessionsRemaining ?? 0) <= 0) return 'no-sessions'
  if (row.isActive === false) return 'inactive'
  if (row.isFrozen) return 'frozen'
  if (row.startDate && dayStart(row.startDate) > today) return 'not-started'
  if (row.expiryDate && dayStart(row.expiryDate) < today) return 'expired'
  if (isPaymentLocked(row)) return 'payment-required'
  return null
}

/** رسالة عربي واضحة للعميل في الأبلكيشن */
export function packageBlockMessage(reason: PackageBlockReason, row: UsablePackageRow): string {
  switch (reason) {
    case 'no-sessions':
      return 'لا توجد حصص متبقية'
    case 'not-started':
      return 'الباقة لسه مابدأتش'
    case 'expired':
      return 'الباقة منتهية — جدّدها من الاستقبال'
    case 'frozen':
      return 'الباقة متجمّدة حالياً'
    case 'inactive':
      return 'الباقة غير نشطة'
    case 'payment-required':
      return paymentLockMessage(row)
    case 'already-today':
      return 'اتسجّلت حصة النهاردة بالفعل — مسموح حصة واحدة في اليوم'
  }
}
