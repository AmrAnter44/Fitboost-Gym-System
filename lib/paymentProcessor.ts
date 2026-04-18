// lib/paymentProcessor.ts
// معالج الدفع - يتعامل مع خصم النقاط والتحقق من الدفع

import { deductPoints } from './points'
import { deserializePaymentMethods, getPointsUsedFromPayment, type PaymentMethod } from './paymentHelpers'

interface ProcessPaymentResult {
  success: boolean
  message?: string
  pointsDeducted?: number
}

/**
 * معالجة الدفع وخصم النقاط إذا تم استخدامها
 * @param memberId - معرف العضو (الأولوية الأولى)
 * @param memberPhone - رقم هاتف العضو (غير مستخدم - تم إزالته لتجنب الخطأ في حالة وجود عضوين بنفس الرقم)
 * @param memberNumber - رقم العضوية (الأولوية الثانية - المستخدم للبحث)
 * @param paymentMethod - وسيلة/وسائل الدفع (string أو JSON)
 * @param description - وصف عملية الدفع
 * @param prisma - Prisma client instance
 * @returns نتيجة العملية
 */
export async function processPaymentWithPoints(
  memberId: string | null,
  memberPhone: string | null,
  memberNumber: string | number | null,
  paymentMethod: string | PaymentMethod[],
  description: string,
  prisma: any
): Promise<ProcessPaymentResult> {
  try {
    // إذا كان paymentMethod هو string، نحوله لـ array
    let methods: PaymentMethod[] = []

    if (typeof paymentMethod === 'string') {
      methods = deserializePaymentMethods(paymentMethod)
    } else if (Array.isArray(paymentMethod)) {
      methods = paymentMethod
    } else {
      return { success: true } // لا توجد نقاط للخصم
    }

    // التحقق من وجود النقاط في وسائل الدفع
    const pointsUsed = getPointsUsedFromPayment(methods)

    if (pointsUsed === 0) {
      return { success: true } // لا توجد نقاط للخصم
    }

    // ✅ الاعتماد على memberNumber فقط (تم إزالة البحث بالهاتف لتجنب الخطأ في حالة وجود عضوين بنفس الرقم)
    let finalMemberId = memberId

    if (!finalMemberId) {
      // البحث برقم العضوية فقط
      if (memberNumber) {
        const member = await prisma.member.findUnique({
          where: { memberNumber: typeof memberNumber === 'string' ? parseInt(memberNumber) : memberNumber },
          select: { id: true, name: true, points: true }
        })

        if (member) {
          finalMemberId = member.id
        } else {
        }
      } else {
      }
    }

    if (!finalMemberId) {
      return {
        success: false,
        message: 'لا يمكن خصم النقاط: العضو غير موجود'
      }
    }

    // خصم النقاط
    const result = await deductPoints(finalMemberId, pointsUsed, description, prisma)

    if (!result.success) {
      return {
        success: false,
        message: result.message
      }
    }

    return {
      success: true,
      pointsDeducted: pointsUsed
    }
  } catch (error) {
    console.error('Error processing payment with points:', error)
    return {
      success: false,
      message: 'حدث خطأ أثناء معالجة الدفع بالنقاط'
    }
  }
}
