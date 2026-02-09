import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireValidLicense } from '../../../../lib/license'
import { requirePermission } from '../../../../lib/auth'
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods
} from '../../../../lib/paymentHelpers'
import { processPaymentWithPoints } from '../../../../lib/paymentProcessor'
import { RECEIPT_TYPES } from '../../../../lib/receiptTypes'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية إنشاء PT (تشمل التجديد)
    await requirePermission(request, 'canCreatePT')

    const body = await request.json()
    const {
      ptNumber,
      phone,
      sessionsPurchased,
      coachName,
      totalPrice,
      startDate,
      expiryDate,
      paymentMethod,
      staffName
    } = body

    // حساب سعر الحصة الواحدة من السعر الإجمالي
    const pricePerSession = sessionsPurchased > 0 ? totalPrice / sessionsPurchased : 0

    console.log('🔄 تجديد جلسات PT:', { ptNumber, sessionsPurchased, totalPrice, pricePerSession })

    // التحقق من وجود جلسة PT
    const existingPT = await prisma.pT.findUnique({
      where: { ptNumber: parseInt(ptNumber) }
    })
    
    if (!existingPT) {
      return NextResponse.json(
        { error: 'جلسة PT غير موجودة' }, 
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
    const oldRemainingAmount = existingPT.remainingAmount || 0

    // تحديث جلسة PT (استبدال البيانات بالبيانات الجديدة وإرجاع المبلغ المتبقي)
    const updatedPT = await prisma.pT.update({
      where: { ptNumber: parseInt(ptNumber) },
      data: {
        phone,
        sessionsPurchased: sessionsPurchased,
        sessionsRemaining: sessionsPurchased,
        coachName,
        pricePerSession,
        startDate: startDate ? new Date(startDate) : existingPT.startDate,
        expiryDate: expiryDate ? new Date(expiryDate) : existingPT.expiryDate,
        remainingAmount: 0, // ✅ تصفير المبلغ المتبقي عند التجديد
      },
    })

    console.log('✅ تم تحديث جلسة PT:', updatedPT.ptNumber)
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
        const receipt = await tx.receipt.create({
          data: {
            receiptNumber: receiptNumber,
            type: RECEIPT_TYPES.PT_RENEWAL,
            amount: totalAmount,
            paymentMethod: finalPaymentMethod,
            staffName: staffName || '',
            itemDetails: JSON.stringify({
              ptNumber: updatedPT.ptNumber,
              clientName: existingPT.clientName,
              phone: phone || existingPT.phone,
              sessionsPurchased: Number(sessionsPurchased),
              pricePerSession: Number(pricePerSession),
              totalAmount: totalAmount,
              coachName: coachName || existingPT.coachName,
              startDate: startDate || null,
              expiryDate: expiryDate || null,
              subscriptionDays: subscriptionDays,
              oldSessionsRemaining: existingPT.sessionsRemaining,
              newSessionsRemaining: updatedPT.sessionsRemaining,
              oldRemainingAmount: oldRemainingAmount, // ✅ المبلغ المتبقي القديم المرتجع
              newRemainingAmount: 0, // ✅ المبلغ المتبقي الجديد (صفر)
            }),
            ptNumber: updatedPT.ptNumber,
          },
        })

        // خصم النقاط إذا تم استخدامها في الدفع
        const pointsResult = await processPaymentWithPoints(
          null,  // لا يوجد memberId لـ PT
          phone || existingPT.phone,
          null,  // PT model doesn't have memberNumber field
          finalPaymentMethod,
          `دفع تجديد برايفت - ${existingPT.clientName}`,
          tx
        )

        if (!pointsResult.success) {
          throw new Error(pointsResult.message || 'فشل خصم النقاط')
        }

        // ✅ البحث عن coachUserId من الكوتش
        let coachUserId = null
        if (coachName || existingPT.coachName) {
          const coachStaff = await tx.staff.findFirst({
            where: { name: coachName || existingPT.coachName },
            include: { user: true }
          })
          if (coachStaff?.user) {
            coachUserId = coachStaff.user.id
          }
        }

        // ✅ إنشاء سجل عمولة للكوتش
        if (coachUserId && totalAmount > 0) {
          try {
            const { createPTCommission } = await import('../../../../lib/commissionHelpers')
            await createPTCommission(
              tx,
              coachUserId,
              totalAmount,
              `عمولة تجديد برايفت - ${existingPT.clientName} (#${updatedPT.ptNumber})`,
              updatedPT.ptNumber
            )
          } catch (commissionError) {
            console.error('⚠️ فشل إنشاء سجل العمولة (غير حرج):', commissionError)
          }
        }

        return receipt
      })

      console.log('✅ تم إنشاء إيصال التجديد بنجاح:', result.receiptNumber)

      return NextResponse.json({
        pt: updatedPT,
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
        pt: updatedPT,
        error: 'تم التجديد بنجاح ولكن فشل إنشاء الإيصال. يرجى إنشاء الإيصال يدوياً.',
        errorDetails: receiptError.message
      }, { status: 200 })
    }

  } catch (error) {
    console.error('❌ خطأ في تجديد جلسة PT:', error)
    return NextResponse.json({ error: 'فشل تجديد جلسة PT' }, { status: 500 })
  }
}