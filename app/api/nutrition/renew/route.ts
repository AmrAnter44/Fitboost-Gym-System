import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods,
  getActualAmountPaid
} from '../../../../lib/paymentHelpers'
import { processPaymentWithPoints } from '../../../../lib/paymentProcessor'
import { addPointsForPayment } from '../../../../lib/points'
import { RECEIPT_TYPES } from '../../../../lib/receiptTypes'
import { getNextReceiptNumber } from '../../../../lib/receiptHelpers'
import { logError } from '../../../../lib/errorLogger'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية إنشاء Nutrition (تشمل التجديد)
    await requirePermission(request, 'canCreateNutrition')

    const body = await request.json()
    const {
      nutritionNumber,
      phone,
      memberNumber,
      sessionsPurchased,
      nutritionistName,
      totalPrice,
      startDate,
      expiryDate,
      paymentMethod,
      staffName
    } = body

    // حساب سعر الحصة الواحدة من السعر الإجمالي
    const pricePerSession = sessionsPurchased > 0 ? totalPrice / sessionsPurchased : 0


    // التحقق من وجود جلسة Nutrition
    const existingNutrition = await prisma.nutrition.findUnique({
      where: { nutritionNumber: parseInt(nutritionNumber) }
    })

    if (!existingNutrition) {
      return NextResponse.json(
        { error: 'جلسة Nutrition غير موجودة' },
        { status: 404 }
      )
    }

    // التحقق من التواريخ
    if (startDate && expiryDate) {
      const start = new Date(startDate)
      const end = new Date(expiryDate)

      if (end <= start) {
        return NextResponse.json(
          { error: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية' },
          { status: 400 }
        )
      }
    }

    // حفظ المبلغ المتبقي القديم قبل التحديث
    const oldRemainingAmount = existingNutrition.remainingAmount || 0

    // تحديث جلسة Nutrition (استبدال البيانات بالبيانات الجديدة وإرجاع المبلغ المتبقي)
    const updatedNutrition = await prisma.nutrition.update({
      where: { nutritionNumber: parseInt(nutritionNumber) },
      data: {
        phone,
        sessionsPurchased: sessionsPurchased,
        sessionsRemaining: sessionsPurchased,
        nutritionistName,
        pricePerSession,
        startDate: startDate ? new Date(startDate) : existingNutrition.startDate,
        expiryDate: expiryDate ? new Date(expiryDate) : existingNutrition.expiryDate,
        remainingAmount: 0, // ✅ تصفير المبلغ المتبقي عند التجديد
      },
    })

    if (oldRemainingAmount > 0) {
    }

    // إنشاء إيصال للتجديد باستخدام Transaction
    try {
      // التأكد من وجود totalPrice، وإلا احسبها
      const totalAmount = totalPrice !== undefined && totalPrice !== null && totalPrice > 0
        ? Number(totalPrice)
        : Number(sessionsPurchased * pricePerSession)

      let subscriptionDays = null
      if (startDate && expiryDate) {
        const start = new Date(startDate)
        const end = new Date(expiryDate)
        subscriptionDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      }

      // استخدام Transaction مع البحث عن أول رقم متاح
      const result = await prisma.$transaction(async (tx) => {
        const receiptNumber = await getNextReceiptNumber(tx)

        // ✅ معالجة وسائل الدفع المتعددة
        let finalPaymentMethod: string
        if (Array.isArray(paymentMethod)) {
          const validation = validatePaymentDistribution(paymentMethod, totalAmount)
          if (!validation.valid) {
            throw new Error(validation.message || 'توزيع المبالغ غير صحيح')
          }
          finalPaymentMethod = serializePaymentMethods(paymentMethod)
        } else {
          finalPaymentMethod = paymentMethod || 'cash'
        }

        // إنشاء الإيصال
        const receipt = await tx.receipt.create({
          data: {
            receiptNumber: receiptNumber,
            type: RECEIPT_TYPES.NUTRITION_RENEWAL,
            amount: totalAmount,
            paymentMethod: finalPaymentMethod,
            staffName: staffName || '',
            itemDetails: JSON.stringify({
              nutritionNumber: updatedNutrition.nutritionNumber,
              clientName: existingNutrition.clientName,
              phone: phone || existingNutrition.phone,
              sessionsPurchased: Number(sessionsPurchased),
              pricePerSession: Number(pricePerSession),
              totalAmount: totalAmount,
              nutritionistName: nutritionistName || existingNutrition.nutritionistName,
              startDate: startDate || null,
              expiryDate: expiryDate || null,
              subscriptionDays: subscriptionDays,
              oldSessionsRemaining: existingNutrition.sessionsRemaining,
              newSessionsRemaining: updatedNutrition.sessionsRemaining,
              oldRemainingAmount: oldRemainingAmount, // ✅ المبلغ المتبقي القديم المرتجع
              newRemainingAmount: 0, // ✅ المبلغ المتبقي الجديد (صفر)
            }),
            ptNumber: updatedNutrition.nutritionNumber,
          },
        })

        // خصم النقاط إذا تم استخدامها في الدفع
        const pointsResult = await processPaymentWithPoints(
          null,  // لا يوجد memberId لـ Nutrition
          phone || existingNutrition.phone,
          memberNumber,  // ✅ تمرير رقم العضوية للبحث عن العضو
          finalPaymentMethod,
          `دفع تجديد تغذية - ${existingNutrition.clientName}`,
          tx
        )

        if (!pointsResult.success) {
          throw new Error(pointsResult.message || 'فشل خصم النقاط')
        }

        // ✅ إضافة نقاط مكافأة للعضو بناءً على المبلغ المدفوع
        // حساب المبلغ الفعلي المدفوع (بدون قيمة النقاط المستخدمة)
        const actualAmountPaid = getActualAmountPaid(finalPaymentMethod, totalAmount)

        if (actualAmountPaid > 0 && memberNumber) {
          try {
            // البحث عن العضو برقم العضوية فقط
            const member = await tx.member.findUnique({
              where: { memberNumber: parseInt(memberNumber) },
              select: { id: true, name: true }
            })

            if (member) {
              const rewardResult = await addPointsForPayment(
                member.id,
                Number(actualAmountPaid),
                `مكافأة تجديد تغذية - ${existingNutrition.clientName}`,
                tx
              )

              if (rewardResult.success && rewardResult.pointsEarned && rewardResult.pointsEarned > 0) {
              }
            } else {
            }
          } catch (rewardError) {
            console.error('⚠️ فشل إضافة نقاط المكافأة (غير حرج):', rewardError)
            // لا نفشل العملية إذا فشلت المكافأة
          }
        }

        // ✅ البحث عن coachUserId من أخصائي التغذية
        let coachUserId = null
        if (nutritionistName || existingNutrition.nutritionistName) {
          const nutritionistStaff = await tx.staff.findFirst({
            where: { name: nutritionistName || existingNutrition.nutritionistName },
            include: { user: true }
          })
          if (nutritionistStaff?.user) {
            coachUserId = nutritionistStaff.user.id
          }
        }

        // ✅ إنشاء سجل عمولة لأخصائي التغذية
        if (coachUserId && totalAmount > 0) {
          try {
            const { createPTCommission } = await import('../../../../lib/commissionHelpers')
            await createPTCommission(
              tx,
              coachUserId,
              totalAmount,
              `عمولة تجديد تغذية - ${existingNutrition.clientName} (#${updatedNutrition.nutritionNumber})`,
              updatedNutrition.nutritionNumber
            )
          } catch (commissionError) {
            console.error('⚠️ فشل إنشاء سجل العمولة (غير حرج):', commissionError)
          }
        }

        return receipt
      })


      return NextResponse.json({
        nutrition: updatedNutrition,
        receipt: {
          receiptNumber: result.receiptNumber,
          amount: result.amount,
          itemDetails: result.itemDetails,
          createdAt: result.createdAt
        }
      }, { status: 200 })

    } catch (receiptError: any) {
      console.error('❌ خطأ في إنشاء الإيصال:', receiptError)
      console.error('❌ تفاصيل الخطأ:', {
        message: receiptError.message,
        code: receiptError.code,
        meta: receiptError.meta,
        name: receiptError.name,
        stack: receiptError.stack
      })

      // إرجاع البيانات المحدثة حتى لو فشل الإيصال
      logError({ error: receiptError, endpoint: '/api/nutrition/renew', method: 'POST', statusCode: 200, additionalContext: { type: 'receipt_creation_failed' } })
      return NextResponse.json({
        nutrition: updatedNutrition,
        error: 'تم التجديد بنجاح ولكن فشل إنشاء الإيصال. يرجى إنشاء الإيصال يدوياً.',
        errorDetails: receiptError.message
      }, { status: 200 })
    }

  } catch (error) {
    console.error('❌ خطأ في تجديد جلسة Nutrition:', error)
    logError({ error, endpoint: '/api/nutrition/renew', method: 'POST', statusCode: 500 })
    return NextResponse.json({ error: 'فشل تجديد جلسة التغذية' }, { status: 500 })
  }
}
