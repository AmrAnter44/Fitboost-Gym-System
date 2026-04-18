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
import { logBackendError } from '../../../../lib/errorTracking/errorTrackingService'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية إنشاء Physiotherapy (تشمل التجديد)
    await requirePermission(request, 'canCreatePhysiotherapy')

    const body = await request.json()
    const {
      physioNumber,
      phone,
      memberNumber,
      sessionsPurchased,
      therapistName,
      totalPrice,
      startDate,
      expiryDate,
      paymentMethod,
      staffName
    } = body

    // حساب سعر الحصة الواحدة من السعر الإجمالي
    const pricePerSession = sessionsPurchased > 0 ? totalPrice / sessionsPurchased : 0


    // التحقق من وجود جلسة Physiotherapy
    const existingPhysiotherapy = await prisma.physiotherapy.findUnique({
      where: { physioNumber: parseInt(physioNumber) }
    })

    if (!existingPhysiotherapy) {
      return NextResponse.json(
        { error: 'جلسة Physiotherapy غير موجودة' },
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
    const oldRemainingAmount = existingPhysiotherapy.remainingAmount || 0

    // تحديث جلسة Physiotherapy (استبدال البيانات بالبيانات الجديدة وإرجاع المبلغ المتبقي)
    const updatedPhysiotherapy = await prisma.physiotherapy.update({
      where: { physioNumber: parseInt(physioNumber) },
      data: {
        phone,
        sessionsPurchased: sessionsPurchased,
        sessionsRemaining: sessionsPurchased,
        therapistName,
        pricePerSession,
        startDate: startDate ? new Date(startDate) : existingPhysiotherapy.startDate,
        expiryDate: expiryDate ? new Date(expiryDate) : existingPhysiotherapy.expiryDate,
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
            type: RECEIPT_TYPES.PHYSIOTHERAPY_RENEWAL,
            amount: totalAmount,
            paymentMethod: finalPaymentMethod,
            staffName: staffName || '',
            itemDetails: JSON.stringify({
              physioNumber: updatedPhysiotherapy.physioNumber,
              clientName: existingPhysiotherapy.clientName,
              phone: phone || existingPhysiotherapy.phone,
              sessionsPurchased: Number(sessionsPurchased),
              pricePerSession: Number(pricePerSession),
              totalAmount: totalAmount,
              therapistName: therapistName || existingPhysiotherapy.therapistName,
              startDate: startDate || null,
              expiryDate: expiryDate || null,
              subscriptionDays: subscriptionDays,
              oldSessionsRemaining: existingPhysiotherapy.sessionsRemaining,
              newSessionsRemaining: updatedPhysiotherapy.sessionsRemaining,
              oldRemainingAmount: oldRemainingAmount, // ✅ المبلغ المتبقي القديم المرتجع
              newRemainingAmount: 0, // ✅ المبلغ المتبقي الجديد (صفر)
            }),
            ptNumber: updatedPhysiotherapy.physioNumber,
          },
        })

        // خصم النقاط إذا تم استخدامها في الدفع
        const pointsResult = await processPaymentWithPoints(
          null,  // لا يوجد memberId لـ Physiotherapy
          phone || existingPhysiotherapy.phone,
          memberNumber,  // ✅ تمرير رقم العضوية للبحث عن العضو
          finalPaymentMethod,
          `دفع تجديد علاج طبيعي - ${existingPhysiotherapy.clientName}`,
          tx
        )

        if (!pointsResult.success) {
          throw new Error(pointsResult.message || 'فشل خصم النقاط')
        }

        // ✅ إضافة نقاط مكافأة للعضو بناءً على المبلغ المدفوع
        // حساب المبلغ الفعلي المدفوع (بدون النقاط المستخدمة)
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
                `مكافأة تجديد علاج طبيعي - ${existingPhysiotherapy.clientName}`,
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

        // ✅ البحث عن therapistUserId من أخصائي العلاج الطبيعي
        let therapistUserId = null
        if (therapistName || existingPhysiotherapy.therapistName) {
          const therapistStaff = await tx.staff.findFirst({
            where: { name: therapistName || existingPhysiotherapy.therapistName },
            include: { user: true }
          })
          if (therapistStaff?.user) {
            therapistUserId = therapistStaff.user.id
          }
        }

        // ✅ إنشاء سجل عمولة لأخصائي العلاج الطبيعي
        if (therapistUserId && totalAmount > 0) {
          try {
            const { createPTCommission } = await import('../../../../lib/commissionHelpers')
            await createPTCommission(
              tx,
              therapistUserId,
              totalAmount,
              `عمولة تجديد علاج طبيعي - ${existingPhysiotherapy.clientName} (#${updatedPhysiotherapy.physioNumber})`,
              updatedPhysiotherapy.physioNumber
            )
          } catch (commissionError) {
            console.error('⚠️ فشل إنشاء سجل العمولة (غير حرج):', commissionError)
          }
        }

        return receipt
      })


      return NextResponse.json({
        physiotherapy: updatedPhysiotherapy,
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
      logBackendError({ error: receiptError, endpoint: '/api/physiotherapy/renew', method: 'POST', statusCode: 200, additionalContext: { type: 'receipt_creation_failed' } }).catch(() => {})
      return NextResponse.json({
        physiotherapy: updatedPhysiotherapy,
        error: 'تم التجديد بنجاح ولكن فشل إنشاء الإيصال. يرجى إنشاء الإيصال يدوياً.',
        errorDetails: receiptError.message
      }, { status: 200 })
    }

  } catch (error) {
    console.error('❌ خطأ في تجديد جلسة Physiotherapy:', error)
    logBackendError({ error, endpoint: '/api/physiotherapy/renew', method: 'POST', statusCode: 500 }).catch(() => {})
    return NextResponse.json({ error: 'فشل تجديد جلسة العلاج الطبيعي' }, { status: 500 })
  }
}
