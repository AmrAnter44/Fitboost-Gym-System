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
    // ✅ التحقق من صلاحية إنشاء GroupClass (تشمل التجديد)
    await requirePermission(request, 'canCreateGroupClass')

    const body = await request.json()
    const {
      classNumber,
      phone,
      memberNumber,
      sessionsPurchased,
      instructorName,
      totalPrice,
      startDate,
      expiryDate,
      paymentMethod,
      staffName
    } = body

    // حساب سعر الحصة الواحدة من السعر الإجمالي
    const pricePerSession = sessionsPurchased > 0 ? totalPrice / sessionsPurchased : 0


    // التحقق من وجود جلسة GroupClass
    const existingGroupClass = await prisma.groupClass.findUnique({
      where: { classNumber: parseInt(classNumber) }
    })

    if (!existingGroupClass) {
      return NextResponse.json(
        { error: 'جلسة GroupClass غير موجودة' },
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
    const oldRemainingAmount = existingGroupClass.remainingAmount || 0

    // تحديث جلسة GroupClass (استبدال البيانات بالبيانات الجديدة وإرجاع المبلغ المتبقي)
    const updatedGroupClass = await prisma.groupClass.update({
      where: { classNumber: parseInt(classNumber) },
      data: {
        phone,
        sessionsPurchased: sessionsPurchased,
        sessionsRemaining: sessionsPurchased,
        instructorName,
        pricePerSession,
        startDate: startDate ? new Date(startDate) : existingGroupClass.startDate,
        expiryDate: expiryDate ? new Date(expiryDate) : existingGroupClass.expiryDate,
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
            type: RECEIPT_TYPES.GROUP_CLASS_RENEWAL,
            amount: totalAmount,
            paymentMethod: finalPaymentMethod,
            staffName: staffName || '',
            itemDetails: JSON.stringify({
              classNumber: updatedGroupClass.classNumber,
              clientName: existingGroupClass.clientName,
              phone: phone || existingGroupClass.phone,
              sessionsPurchased: Number(sessionsPurchased),
              pricePerSession: Number(pricePerSession),
              totalAmount: totalAmount,
              instructorName: instructorName || existingGroupClass.instructorName,
              startDate: startDate || null,
              expiryDate: expiryDate || null,
              subscriptionDays: subscriptionDays,
              oldSessionsRemaining: existingGroupClass.sessionsRemaining,
              newSessionsRemaining: updatedGroupClass.sessionsRemaining,
              oldRemainingAmount: oldRemainingAmount, // ✅ المبلغ المتبقي القديم المرتجع
              newRemainingAmount: 0, // ✅ المبلغ المتبقي الجديد (صفر)
            }),
            ptNumber: updatedGroupClass.classNumber,
          },
        })

        // خصم النقاط إذا تم استخدامها في الدفع
        const pointsResult = await processPaymentWithPoints(
          null,  // لا يوجد memberId لـ GroupClass
          phone || existingGroupClass.phone,
          memberNumber,  // ✅ تمرير رقم العضوية للبحث عن العضو
          finalPaymentMethod,
          `دفع تجديد جروب كلاسيس - ${existingGroupClass.clientName}`,
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
                `مكافأة تجديد جروب كلاسيس - ${existingGroupClass.clientName}`,
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

        // ✅ البحث عن instructorUserId من المدرب
        let instructorUserId = null
        if (instructorName || existingGroupClass.instructorName) {
          const instructorStaff = await tx.staff.findFirst({
            where: { name: instructorName || existingGroupClass.instructorName },
            include: { user: true }
          })
          if (instructorStaff?.user) {
            instructorUserId = instructorStaff.user.id
          }
        }

        // ✅ إنشاء سجل عمولة لالمدرب
        if (instructorUserId && totalAmount > 0) {
          try {
            const { createPTCommission } = await import('../../../../lib/commissionHelpers')
            await createPTCommission(
              tx,
              instructorUserId,
              totalAmount,
              `عمولة تجديد جروب كلاسيس - ${existingGroupClass.clientName} (#${updatedGroupClass.classNumber})`,
              updatedGroupClass.classNumber
            )
          } catch (commissionError) {
            console.error('⚠️ فشل إنشاء سجل العمولة (غير حرج):', commissionError)
          }
        }

        return receipt
      })


      return NextResponse.json({
        groupClass: updatedGroupClass,
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
      logError({ error: receiptError, endpoint: '/api/group-classes/renew', method: 'POST', statusCode: 200, additionalContext: { type: 'receipt_creation_failed' } })
      return NextResponse.json({
        groupClass: updatedGroupClass,
        error: 'تم التجديد بنجاح ولكن فشل إنشاء الإيصال. يرجى إنشاء الإيصال يدوياً.',
        errorDetails: receiptError.message
      }, { status: 200 })
    }

  } catch (error) {
    console.error('❌ خطأ في تجديد جلسة GroupClass:', error)
    logError({ error, endpoint: '/api/group-classes/renew', method: 'POST', statusCode: 500 })
    return NextResponse.json({ error: 'فشل تجديد جلسة جروب كلاسيس' }, { status: 500 })
  }
}
