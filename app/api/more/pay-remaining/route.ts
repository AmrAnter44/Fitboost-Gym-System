import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods
} from '../../../../lib/paymentHelpers'
import { getRequestedPoints, resolveMemberIdByPhone } from '../../../../lib/paymentProcessor'
import { deductPoints } from '../../../../lib/points'
import {
  getNextReceiptNumber,
  runReceiptTransaction,
  PaymentValidationError,
} from '../../../../lib/receiptHelpers'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

// POST - دفع المبلغ المتبقي لاشتراك "المزيد"
// قبل الـ endpoint ده، صفحة المزيد كانت بتعدّل remainingAmount عبر PUT /api/more
// من غير ما يتسجّل أي إيصال — الفلوس كانت بتختفي من الباقي بدون أثر مالي.
export async function POST(request: Request) {
  try {
    // ✅ قبول دفعة باقي يحتاج فقط تسجيل دخول — ده task front-desk عادي
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (user.role === 'COACH') {
      return NextResponse.json({ error: 'الكوتش غير مسموح له بقبول المدفوعات' }, { status: 403 })
    }

    const body = await request.json()
    const {
      moreNumber,
      paymentAmount,
      paymentMethod,
      staffName
    } = body

    if (!moreNumber) {
      return NextResponse.json(
        { error: 'رقم الاشتراك مطلوب' },
        { status: 400 }
      )
    }

    if (!paymentAmount || paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'مبلغ الدفع يجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    // البحث عن الاشتراك
    const more = await prisma.more.findUnique({
      where: { moreNumber: parseInt(moreNumber) }
    })

    if (!more) {
      return NextResponse.json(
        { error: 'الاشتراك غير موجود' },
        { status: 404 }
      )
    }

    // ✅ كل التحققات قبل أي كتابة
    let finalPaymentMethod: string
    if (Array.isArray(paymentMethod)) {
      const validation = validatePaymentDistribution(paymentMethod, paymentAmount)
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.message || 'توزيع المبالغ غير صحيح' },
          { status: 400 }
        )
      }
      finalPaymentMethod = serializePaymentMethods(paymentMethod)
    } else {
      finalPaymentMethod = paymentMethod || 'cash'
    }

    const pointsRequest = await getRequestedPoints(paymentMethod ?? 'cash', paymentAmount, prisma)
    if (pointsRequest.message) {
      return NextResponse.json({ error: pointsRequest.message }, { status: 400 })
    }

    // اشتراك المزيد ممكن يكون مربوط بعضو مباشرة — لو لأ بنحدد بالهاتف
    let pointsMemberId: string | null = null
    if (pointsRequest.pointsUsed > 0) {
      if (more.memberId) {
        pointsMemberId = more.memberId
      } else {
        const resolved = await resolveMemberIdByPhone(prisma, more.phone)
        if (!resolved.memberId) {
          return NextResponse.json({ error: resolved.message }, { status: 400 })
        }
        pointsMemberId = resolved.memberId
      }
    }

    // ⚙️ عملية ذرّية: تحديث الباقي + الإيصال + النقاط مع بعض
    const result = await runReceiptTransaction(prisma, async (tx) => {
      const fresh = await tx.more.findUnique({
        where: { moreNumber: more.moreNumber },
        select: { remainingAmount: true }
      })
      if (!fresh) {
        throw new PaymentValidationError('الاشتراك غير موجود')
      }

      const currentRemaining = fresh.remainingAmount || 0
      if (paymentAmount > currentRemaining + 0.01) {
        throw new PaymentValidationError(
          `المبلغ المدفوع (${paymentAmount}) أكبر من المتبقي (${currentRemaining})`
        )
      }
      const newRemainingAmount = Math.max(0, currentRemaining - paymentAmount)

      const updatedMore = await tx.more.update({
        where: { moreNumber: more.moreNumber },
        data: { remainingAmount: newRemainingAmount }
      })

      const receiptNumber = await getNextReceiptNumber(tx)

      const receipt = await tx.receipt.create({
        data: {
          receiptNumber,
          type: 'دفع باقي مزيد',
          amount: paymentAmount,
          paymentMethod: finalPaymentMethod,
          staffName: staffName || '',
          moreNumber: more.moreNumber,
          memberId: more.memberId || null,
          itemDetails: JSON.stringify({
            moreNumber: more.moreNumber,
            clientName: more.clientName,
            phone: more.phone,
            coachName: more.coachName,
            paymentAmount,
            previousRemaining: currentRemaining,
            newRemaining: newRemainingAmount,
            paymentType: 'remaining_amount_payment'
          }),
        },
      })

      if (pointsMemberId && pointsRequest.pointsUsed > 0) {
        const deduction = await deductPoints(
          pointsMemberId,
          pointsRequest.pointsUsed,
          `دفع باقي مزيد - ${more.clientName} (#${more.moreNumber})`,
          tx
        )
        if (!deduction.success) {
          throw new PaymentValidationError(deduction.message || 'فشل خصم النقاط')
        }
      }

      return { updatedMore, receipt, currentRemaining, newRemainingAmount }
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'More', resourceId: more.moreNumber.toString(),
      details: { operation: 'PayRemaining', moreNumber, clientName: more.clientName, paymentAmount, previousRemaining: result.currentRemaining, newRemaining: result.newRemainingAmount, pointsDeducted: pointsRequest.pointsUsed || 0, receiptNumber: result.receipt.receiptNumber },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({
      success: true,
      more: result.updatedMore,
      receipt: result.receipt,
      message: 'تم دفع المبلغ المتبقي بنجاح'
    })
  } catch (error: any) {
    if (error instanceof PaymentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('❌ خطأ في دفع باقي المزيد:', error)

    return NextResponse.json(
      { error: 'فشل دفع المبلغ المتبقي — لم يتم خصم أي مبلغ ولم يُنشأ إيصال، حاول مرة أخرى' },
      { status: 500 }
    )
  }
}
