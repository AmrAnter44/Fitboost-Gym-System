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
 * @param memberId - معرف العضو
 * @param memberPhone - رقم هاتف العضو (للبحث عن العضو)
 * @param memberNumber - رقم العضوية (للبحث عن العضو)
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

    // إذا لم يكن لدينا memberId، نحاول البحث بـ memberNumber أولاً، ثم بالهاتف
    let finalMemberId = memberId

    if (!finalMemberId) {
      // البحث برقم العضوية أولاً
      if (memberNumber) {
        console.log(`🔍 PaymentProcessor: البحث عن عضو برقم العضوية: ${memberNumber}`)
        const member = await prisma.member.findUnique({
          where: { memberNumber: typeof memberNumber === 'string' ? parseInt(memberNumber) : memberNumber },
          select: { id: true, name: true, points: true }
        })

        if (member) {
          console.log(`✅ PaymentProcessor: تم العثور على العضو برقم العضوية: ${member.name} (نقاط: ${member.points})`)
          finalMemberId = member.id
        }
      }

      // إذا لم يُعثر عليه، البحث بالهاتف
      if (!finalMemberId && memberPhone) {
        console.log(`🔍 PaymentProcessor: البحث عن عضو بالهاتف: ${memberPhone}`)
        const member = await prisma.member.findFirst({
          where: { phone: memberPhone },
          select: { id: true, name: true, points: true }
        })

        if (member) {
          console.log(`✅ PaymentProcessor: تم العثور على العضو بالهاتف: ${member.name} (نقاط: ${member.points})`)
          finalMemberId = member.id
        }
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
