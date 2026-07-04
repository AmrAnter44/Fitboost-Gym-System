import { z } from 'zod'

/**
 * سكيمات تحقّق للمسارات المالية (تجديد/ترقية/برايفت).
 *
 * فلسفة التصميم: نتحقق من الثوابت الحرجة بس (المبالغ أرقام موجبة، الـ IDs
 * موجودة) من غير ما نرفض أي حقول إضافية — zod بيتجاهل المفاتيح الزيادة
 * افتراضياً. بنستخدم coerce عشان نتقبّل الأرقام لو جت كنص من الفرونت.
 * النتيجة: نمنع بيانات مالية فاسدة (سعر سالب/NaN/بدون عضو) من غير ما نكسر
 * أي طلب صحيح موجود.
 */

const money = z.coerce.number().finite().nonnegative()

export const RenewInputSchema = z.object({
  memberId: z.string().min(1, 'رقم العضو مطلوب'),
  subscriptionPrice: money,
  remainingAmount: money.optional(),
})

export const UpgradeInputSchema = z.object({
  memberId: z.string().min(1, 'رقم العضو مطلوب'),
  newOfferId: z.string().min(1, 'الباقة الجديدة مطلوبة'),
  remainingAmount: money.optional(),
  customPrice: money.nullable().optional(),
})

export const PtRenewInputSchema = z.object({
  ptNumber: z.union([z.string().min(1), z.number()]),
  totalPrice: money.optional(),
  sessionsPurchased: z.coerce.number().int().positive('عدد الحصص يجب أن يكون أكبر من صفر'),
  remainingAmount: money.optional(),
})

/**
 * helper موحّد: يرجّع رسالة الخطأ الأولى لو التحقق فشل، أو null لو نجح.
 */
export function firstIssue(result: { success: boolean; error?: z.ZodError }): string | null {
  if (result.success) return null
  return result.error?.issues?.[0]?.message || 'بيانات غير صحيحة'
}
