import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireValidLicense } from '../../../../lib/license'
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

    console.log('🔄 تجديد جلسات Physiotherapy:', { physioNumber, sessionsPurchased, totalPrice, pricePerSession })

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

    console.log('✅ تم تحديث جلسة Physiotherapy:', updatedPhysiotherapy.physioNumber)
    if (oldRemainingAmount > 0) {
      console.log(`💰 تم إرجاع المبلغ المتبقي: ${oldRemainingAmount} ج.م`)
    }

    // إنشاء إيصال للتجديد باستخدام Transaction
    try {
      // 🔒 License validation check
      await requireValidLicense()

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
        // استخدام upsert لتجنب race condition
        const counter = await tx.receiptCounter.upsert({
          where: { id: 1 },
          update: { current: { increment: 1 } },
          create: { id: 1, current: 1001 },
        })

        const receiptNumber = counter.current
        console.log('🔢 استخدام رقم الإيصال:', receiptNumber)

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
        console.log('🔵 Creating physiotherapy renewal receipt with type:', RECEIPT_TYPES.PHYSIOTHERAPY_RENEWAL)
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
        console.log('✅ Physiotherapy receipt created successfully:', { receiptNumber: receipt.receiptNumber, type: receipt.type, therapistName: therapistName || existingPhysiotherapy.therapistName })

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
                console.log(`✅ تمت إضافة ${rewardResult.pointsEarned} نقطة مكافأة للعضو ${member.name}`)
              }
            } else {
              console.log(`⚠️ لم يُعثر على عضو برقم العضوية: ${memberNumber}`)
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

      console.log('✅ تم إنشاء إيصال التجديد بنجاح:', result.receiptNumber)

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
      return NextResponse.json({
        physiotherapy: updatedPhysiotherapy,
        error: 'تم التجديد بنجاح ولكن فشل إنشاء الإيصال. يرجى إنشاء الإيصال يدوياً.',
        errorDetails: receiptError.message
      }, { status: 200 })
    }

  } catch (error) {
    console.error('❌ خطأ في تجديد جلسة Physiotherapy:', error)
    return NextResponse.json({ error: 'فشل تجديد جلسة العلاج الطبيعي' }, { status: 500 })
  }
}
