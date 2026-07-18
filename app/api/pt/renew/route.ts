import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods
} from '../../../../lib/paymentHelpers'
import { processPaymentWithPoints } from '../../../../lib/paymentProcessor'
import { RECEIPT_TYPES } from '../../../../lib/receiptTypes'
import { getNextReceiptNumber } from '../../../../lib/receiptHelpers'
import { round2 } from '../../../../lib/money'
import { PtRenewInputSchema, firstIssue } from '../../../../lib/schemas/financialSchemas'
import { logError } from '../../../../lib/errorLogger'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // ✅ تجديد PT متاح لأي موظف مسجّل دخول (مش الكوتش)
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (user.role === 'COACH') {
      return NextResponse.json({ error: 'الكوتش غير مسموح له بتجديد الاشتراكات' }, { status: 403 })
    }

    const body = await request.json()

    // ✅ تحقّق من صحة المدخلات المالية
    const ptRenewErr = firstIssue(PtRenewInputSchema.safeParse(body))
    if (ptRenewErr) {
      return NextResponse.json({ error: ptRenewErr }, { status: 400 })
    }

    const {
      ptNumber,
      phone,
      sessionsPurchased,
      coachName,
      totalPrice,
      remainingAmount, //  مبلغ متبقي على الميمبر في التجديد الجديد (اختياري)
      startDate,
      expiryDate,
      paymentMethod,
      staffName
    } = body
    //  المبلغ المتبقي في التجديد الجديد — لازم يكون رقم بين 0 و totalPrice
    //  ⚠️ Math.round مهم: عمود remainingAmount في الـ schema نوعه Int،
    //     ولو اتكتب فيه كسر عشري Prisma بترفض والترانزاكشن كلها بترجع (التجديد مايتسجلش)
    const parsedRemaining = Math.round(
      Math.max(0, Math.min(Number(remainingAmount) || 0, Number(totalPrice) || 0))
    )

    //  سعر الحصة بيتحسب من الحصص المشتراة الجديدة بس (قبل إضافة المرحّل)
    //  عشان السعر مايتخفّفش على حصص مدفوعة قبل كده ويقلّل قيمة العمولة
    const pricePerSession = sessionsPurchased > 0 ? totalPrice / sessionsPurchased : 0


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

    //  ترحيل الحصص المتبقية من الباقة القديمة بدل ما تتلغي (نفس سلوك /api/pt/upgrade)
    //  بنضيفها للـ purchased والـ remaining مع بعض عشان remaining ما يبقاش أكبر من purchased
    //  (اللي كان هيخلي completedSessions = purchased - remaining رقم سالب)
    const carriedOverSessions = Math.max(0, existingPT.sessionsRemaining || 0)
    const totalSessionsAfterRenew = Number(sessionsPurchased) + carriedOverSessions

    // إنشاء إيصال للتجديد باستخدام Transaction
    // ملاحظة: تحديث الـ PT اتنقل جوّه الـ transaction عشان لو الإيصال فشل يترجع
    // التجديد بالكامل (مفيش PT متجدّد بدون إيصال).
    try {
      // التأكد من وجود totalPrice، وإلا احسبها
      const totalAmount = totalPrice !== undefined && totalPrice !== null && totalPrice > 0
        ? Number(totalPrice)
        : Number(sessionsPurchased * pricePerSession)
      //  المبلغ المدفوع فعلاً = الإجمالي - المتبقي
      const paidAmount = round2(Math.max(0, totalAmount - parsedRemaining))

      let subscriptionDays = null
      if (startDate && expiryDate) {
        const start = new Date(startDate)
        const end = new Date(expiryDate)
        subscriptionDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      }

      // استخدام Transaction مع البحث عن أول رقم متاح
      const result = await prisma.$transaction(async (tx) => {
        // تحديث جلسة PT جوّه الـ transaction
        const updatedPT = await tx.pT.update({
          where: { ptNumber: parseInt(ptNumber) },
          data: {
            phone,
            sessionsPurchased: totalSessionsAfterRenew,
            sessionsRemaining: totalSessionsAfterRenew,
            coachName,
            pricePerSession,
            startDate: startDate ? new Date(startDate) : existingPT.startDate,
            expiryDate: expiryDate ? new Date(expiryDate) : existingPT.expiryDate,
            remainingAmount: parsedRemaining,
          },
        })

        const receiptNumber = await getNextReceiptNumber(tx)

        // ✅ معالجة وسائل الدفع المتعددة
        let finalPaymentMethod: string
        if (Array.isArray(paymentMethod)) {
          //  نتحقق من توزيع المبالغ بناءً على المدفوع فعلاً (مش الإجمالي)
          const validation = validatePaymentDistribution(paymentMethod, paidAmount)
          if (!validation.valid) {
            const e: any = new Error(validation.message || 'توزيع المبالغ غير صحيح')
            e.code = 'VALIDATION'
            throw e
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
            //  amount = المدفوع فعلاً (مش الإجمالي) عشان التقفيل والتقارير
            // يحسبوا الفلوس اللي اتحصلت بالظبط
            amount: paidAmount,
            paymentMethod: finalPaymentMethod,
            staffName: staffName || '',
            itemDetails: JSON.stringify({
              ptNumber: updatedPT.ptNumber,
              clientName: existingPT.clientName,
              phone: phone || existingPT.phone,
              sessionsPurchased: Number(sessionsPurchased),
              pricePerSession: Number(pricePerSession),
              totalAmount: totalAmount,
              paidAmount: paidAmount,
              remainingAmount: parsedRemaining,
              coachName: coachName || existingPT.coachName,
              startDate: startDate || null,
              expiryDate: expiryDate || null,
              subscriptionDays: subscriptionDays,
              oldSessionsRemaining: existingPT.sessionsRemaining,
              carriedOverSessions: carriedOverSessions, //  الحصص المرحّلة من الباقة القديمة
              newSessionsRemaining: updatedPT.sessionsRemaining,
              oldRemainingAmount: oldRemainingAmount, // ✅ المبلغ المتبقي القديم المرتجع
              newRemainingAmount: parsedRemaining, //  المبلغ المتبقي الجديد
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

        return { pt: updatedPT, receipt }
      })


      return NextResponse.json({
        pt: result.pt,
        receipt: {
          //  بنرجّع الإيصال كامل عشان الفورم يفتح مودال التأكيد على طول
          //  (مفيش endpoint اسمه GET /api/receipts/[id] فمينفعش يعيد جلبه)
          id: result.receipt.id,
          receiptNumber: result.receipt.receiptNumber,
          type: result.receipt.type,
          amount: result.receipt.amount,
          paymentMethod: result.receipt.paymentMethod,
          itemDetails: result.receipt.itemDetails,
          createdAt: result.receipt.createdAt
        }
      }, { status: 200 })

    } catch (receiptError: any) {
      // خطأ توزيع المبالغ → 400 للموظف
      if (receiptError?.code === 'VALIDATION') {
        return NextResponse.json({ error: receiptError.message }, { status: 400 })
      }
      console.error('❌ خطأ في تجديد PT (rolled back):', receiptError?.message)

      // الـ transaction بيـ rollback تحديث الـ PT والإيصال معاً — مفيش PT
      // متجدّد بدون إيصال. بنرجّع خطأ واضح عشان الموظف يعيد المحاولة.
      logError({ error: receiptError, endpoint: '/api/pt/renew', method: 'POST', statusCode: 500, additionalContext: { type: 'pt_renew_transaction_failed' } })
      return NextResponse.json({
        error: 'فشل تسجيل التجديد ولم يتم أي تغيير. من فضلك حاول مرة أخرى.'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ خطأ في تجديد جلسة PT:', error)
    logError({ error, endpoint: '/api/pt/renew', method: 'POST', statusCode: 500 })
    return NextResponse.json({ error: 'فشل تجديد جلسة PT' }, { status: 500 })
  }
}