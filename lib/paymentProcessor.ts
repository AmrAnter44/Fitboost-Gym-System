// lib/paymentProcessor.ts
// معالج الدفع - يتعامل مع خصم النقاط والتحقق من الدفع

import { deductPoints } from './points'
import {
  deserializePaymentMethods,
  getPointsUsedFromPayment,
  calculatePointsRequired,
  type PaymentMethod,
} from './paymentHelpers'

/**
 * حساب عدد النقاط المطلوب خصمها من وسيلة/وسائل الدفع.
 * بيغطي الحالتين:
 * - array فيها method='points' مع pointsUsed محسوبة من الواجهة
 * - string واحدة = 'points' (الوضع المفرد في PaymentMethodSelector) —
 *   هنا بنحسب النقاط من الإعدادات لأن الواجهة مش بتبعت pointsUsed
 *
 * بترجع message لو الدفع بالنقاط مطلوب بس مش ممكن (النظام متعطل مثلاً) —
 * ساعتها لازم العملية تترفض قبل أي خصم.
 */
export async function getRequestedPoints(
  paymentMethod: string | PaymentMethod[],
  amount: number,
  db: any
): Promise<{ pointsUsed: number; message?: string }> {
  let pointsAmount = 0
  let declaredPoints = 0

  if (Array.isArray(paymentMethod)) {
    const pointsEntry = paymentMethod.find(m => m.method === 'points')
    if (!pointsEntry || pointsEntry.amount <= 0) return { pointsUsed: 0 }
    pointsAmount = pointsEntry.amount
    declaredPoints = getPointsUsedFromPayment(paymentMethod)
  } else if (paymentMethod === 'points') {
    pointsAmount = amount
  } else {
    return { pointsUsed: 0 }
  }

  if (declaredPoints > 0) return { pointsUsed: declaredPoints }

  const settings = await db.systemSettings.findUnique({
    where: { id: 'singleton' },
    select: { pointsEnabled: true, pointsValueInEGP: true },
  })

  if (!settings?.pointsEnabled || !settings.pointsValueInEGP || settings.pointsValueInEGP <= 0) {
    return {
      pointsUsed: 0,
      message: 'نظام النقاط غير مفعل — اختر وسيلة دفع أخرى',
    }
  }

  return { pointsUsed: calculatePointsRequired(pointsAmount, settings.pointsValueInEGP) }
}

/**
 * إيجاد العضو اللي هيتخصم منه النقاط عن طريق رقم الهاتف.
 * جلسات PT/التغذية/العلاج الطبيعي/الجروب كلاسيس مش مربوطة بـ memberId،
 * فبنطابق بالهاتف — وبنرفض لو مفيش عضو أو فيه أكتر من عضو بنفس الرقم
 * (عشان منخصمش من عضو غلط).
 */
export async function resolveMemberIdByPhone(
  db: any,
  phone: string | null | undefined
): Promise<{ memberId?: string; message?: string }> {
  if (!phone || !String(phone).trim()) {
    return { message: 'لا يمكن الدفع بالنقاط: لا يوجد رقم هاتف مسجل على الاشتراك' }
  }

  const members = await db.member.findMany({
    where: { phone: String(phone).trim() },
    select: { id: true },
    take: 2,
  })

  if (members.length === 0) {
    return { message: 'لا يمكن الدفع بالنقاط: لا يوجد عضو مسجل بهذا الرقم' }
  }
  if (members.length > 1) {
    return { message: 'لا يمكن الدفع بالنقاط: يوجد أكثر من عضو بنفس رقم الهاتف' }
  }

  return { memberId: members[0].id }
}

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
          where: { memberNumber: String(memberNumber).trim() },
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
