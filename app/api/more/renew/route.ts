import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import {
  validatePaymentDistribution,
  serializePaymentMethods,
  getActualAmountPaid
} from '../../../../lib/paymentHelpers'
import { processPaymentWithPoints } from '../../../../lib/paymentProcessor'
import { addPointsForPayment } from '../../../../lib/points'
import { RECEIPT_TYPES } from '../../../../lib/receiptTypes'
import { getNextReceiptNumber } from '../../../../lib/receiptHelpers'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

// POST - تجديد اشتراك More
export async function POST(request: Request) {
  try {
    const user = await requirePermission(request, 'canViewMore')
    const body = await request.json()
    const {
      oldMoreNumber,
      sessionsPurchased,
      totalPrice,
      remainingAmount,
      startDate,
      expiryDate,
      notes,
      paymentMethod,
      staffName,
      moreCommissionAmount  // 💰 عمولة المدرب من الباقة (اختياري)
    } = body

    if (!oldMoreNumber) {
      return NextResponse.json(
        { error: 'رقم الاشتراك القديم مطلوب' },
        { status: 400 }
      )
    }

    // جلب بيانات الاشتراك القديم
    const oldMore = await prisma.more.findUnique({
      where: { moreNumber: parseInt(oldMoreNumber) }
    })

    if (!oldMore) {
      return NextResponse.json(
        { error: 'الاشتراك القديم غير موجود' },
        { status: 404 }
      )
    }

    // حساب سعر الحصة
    const pricePerSession = sessionsPurchased > 0 ? totalPrice / sessionsPurchased : 0

    // ✅ التحقق من الحقول المطلوبة
    if (!sessionsPurchased || sessionsPurchased <= 0) {
      return NextResponse.json(
        { error: 'عدد الجلسات مطلوب ويجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    if (totalPrice === undefined || totalPrice < 0) {
      return NextResponse.json(
        { error: 'السعر الإجمالي مطلوب ولا يمكن أن يكون سالب' },
        { status: 400 }
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

    // 💰 جلب إعدادات العمولة
    const systemSettings = await prisma.systemSettings.findUnique({
      where: { id: 'singleton' }
    })

    // إنشاء اشتراك جديد بنفس بيانات القديم
    const newMoreData: any = {
      clientName: oldMore.clientName,
      phone: oldMore.phone,
      memberId: oldMore.memberId,
      sessionsPurchased,
      sessionsRemaining: sessionsPurchased,
      coachName: oldMore.coachName,
      coachUserId: oldMore.coachUserId,
      pricePerSession,
      totalAmount: totalPrice,
      remainingAmount: remainingAmount || 0,
      startDate: startDate ? new Date(startDate) : new Date(),
      expiryDate: expiryDate ? new Date(expiryDate) : new Date(),
      notes: notes || oldMore.notes
    }

    // إنشاء التجديد باستخدام Transaction
    try {
      const totalAmount = sessionsPurchased * pricePerSession
      const paidAmount = totalAmount - (remainingAmount || 0)

      let subscriptionDays = null
      if (startDate && expiryDate) {
        const start = new Date(startDate)
        const end = new Date(expiryDate)
        subscriptionDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      }

      const newMore = await prisma.$transaction(async (tx) => {
        // ✅ إنشاء اشتراك More جديد
        const newMore = await tx.more.create({
          data: newMoreData,
        })

        // ✅ الحصول على رقم الإيصال التالي
        const receiptNumber = await getNextReceiptNumber(tx)

        // ✅ معالجة وسائل الدفع المتعددة
        let finalPaymentMethod: string
        if (Array.isArray(paymentMethod)) {
          const validation = validatePaymentDistribution(paymentMethod, Number(paidAmount))
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
            type: RECEIPT_TYPES.MORE_RENEWAL,
            amount: Number(paidAmount),
            paymentMethod: finalPaymentMethod,
            staffName: staffName || '',
            itemDetails: JSON.stringify({
              moreNumber: newMore.moreNumber,
              oldMoreNumber: oldMore.moreNumber,
              clientName: oldMore.clientName,
              phone: oldMore.phone,
              sessionsPurchased: Number(sessionsPurchased),
              pricePerSession: Number(pricePerSession),
              totalAmount: Number(totalAmount),
              paidAmount: Number(paidAmount),
              remainingAmount: Number(remainingAmount || 0),
              coachName: oldMore.coachName,
              startDate: startDate || null,
              expiryDate: expiryDate || null,
              subscriptionDays: subscriptionDays
            }),
            moreNumber: newMore.moreNumber,
          },
        })

        // خصم النقاط إذا تم استخدامها في الدفع
        const pointsResult = await processPaymentWithPoints(
          null,
          oldMore.phone,
          null,
          finalPaymentMethod,
          `تجديد اشتراك مزيد - ${oldMore.clientName}`,
          tx
        )

        if (!pointsResult.success) {
          throw new Error(pointsResult.message || 'فشل خصم النقاط')
        }

        // 💰 إنشاء سجل عمولة للمدرب (إذا كان لديه حساب)
        const moreCommissionEnabled = systemSettings?.moreCommissionEnabled ?? true
        const defaultMoreCommissionAmount = systemSettings?.moreCommissionAmount ?? 50

        if (oldMore.coachUserId && paidAmount > 0 && moreCommissionEnabled) {
          try {
            const finalCommissionAmount =
              moreCommissionAmount && moreCommissionAmount > 0
                ? moreCommissionAmount
                : defaultMoreCommissionAmount

            await tx.commission.create({
              data: {
                staffId: oldMore.coachUserId,
                amount: finalCommissionAmount,
                type: 'more_renewal',
                description: `عمولة تجديد مزيد - ${oldMore.clientName} (#${newMore.moreNumber})`,
                notes: JSON.stringify({
                  moreNumber: newMore.moreNumber,
                  oldMoreNumber: oldMore.moreNumber,
                  clientName: oldMore.clientName,
                  commissionAmount: finalCommissionAmount,
                  source: moreCommissionAmount && moreCommissionAmount > 0 ? 'package' : 'settings'
                })
              }
            })
          } catch (commissionError) {
            console.error('⚠️ فشل إنشاء سجل العمولة (غير حرج):', commissionError)
          }
        }

        // ✅ إضافة نقاط مكافأة
        const actualAmountPaid = getActualAmountPaid(finalPaymentMethod, paidAmount)

        if (actualAmountPaid > 0) {
          try {
            await addPointsForPayment(
              oldMore.phone,
              actualAmountPaid,
              `تجديد اشتراك مزيد - ${oldMore.clientName}`,
              tx
            )
          } catch (pointsError) {
            console.error('⚠️ فشل إضافة نقاط المكافأة (غير حرج):', pointsError)
          }
        }

        // Audit log
        await createAuditLog({
          userId: user.userId,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: 'CREATE',
          resource: 'More',
          resourceId: newMore.moreNumber.toString(),
          details: {
            renewalFrom: oldMore.moreNumber,
            clientName: oldMore.clientName,
            sessionsPurchased,
            totalAmount,
            paidAmount
          },
          ipAddress: getIpAddress(request),
          userAgent: getUserAgent(request),
          status: 'success'
        })

        return newMore
      }, {
        maxWait: 10000,
        timeout: 10000,
      })

      return NextResponse.json({
        message: 'تم تجديد الاشتراك بنجاح',
        moreNumber: newMore.moreNumber,
        more: newMore
      })
    } catch (transactionError: any) {
      console.error('❌ فشل Transaction:', transactionError)
      return NextResponse.json(
        { error: transactionError.message || 'فشل تجديد الاشتراك' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error renewing More subscription:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تجديد الاشتراك' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل تجديد الاشتراك' },
      { status: 500 }
    )
  }
}
