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

// POST - دفع المبلغ المتبقي
export async function POST(request: Request) {
  try {
    // ✅ قبول دفعة باقي يحتاج فقط تسجيل دخول (مش canCreatePT)
    // ده task front-desk عادي بيعمله الموظفون. الـ audit log بيسجّل من قام بالعملية.
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (user.role === 'COACH') {
      return NextResponse.json({ error: 'الكوتش غير مسموح له بقبول المدفوعات' }, { status: 403 })
    }

    const body = await request.json()
    const {
      ptNumber,
      paymentAmount,
      paymentMethod,
      staffName
    } = body

    if (!ptNumber) {
      return NextResponse.json(
        { error: 'رقم PT مطلوب' },
        { status: 400 }
      )
    }

    if (!paymentAmount || paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'مبلغ الدفع يجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    // البحث عن جلسة PT
    const pt = await prisma.pT.findUnique({
      where: { ptNumber: parseInt(ptNumber) }
    })

    if (!pt) {
      return NextResponse.json(
        { error: 'جلسة PT غير موجودة' },
        { status: 404 }
      )
    }

    // ✅ كل التحققات قبل أي كتابة — التوزيع، النقاط، والعضو اللي هيتخصم منه
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

    // جلسات PT مش مربوطة بـ memberId — بنحدد عضو النقاط برقم الهاتف
    let pointsMemberId: string | null = null
    if (pointsRequest.pointsUsed > 0) {
      const resolved = await resolveMemberIdByPhone(prisma, pt.phone)
      if (!resolved.memberId) {
        return NextResponse.json({ error: resolved.message }, { status: 400 })
      }
      pointsMemberId = resolved.memberId
    }

    // ⚙️ عملية ذرّية: تحديث الباقي + الإيصال + النقاط مع بعض —
    // لو الإيصال فشل مفيش خصم، ولو الخصم فشل مفيش إيصال.
    const result = await runReceiptTransaction(prisma, async (tx) => {
      const fresh = await tx.pT.findUnique({
        where: { ptNumber: pt.ptNumber },
        select: { remainingAmount: true }
      })
      if (!fresh) {
        throw new PaymentValidationError('جلسة PT غير موجودة')
      }

      const currentRemaining = fresh.remainingAmount || 0
      if (paymentAmount > currentRemaining) {
        throw new PaymentValidationError(
          `المبلغ المدفوع (${paymentAmount}) أكبر من المتبقي (${currentRemaining})`
        )
      }
      const newRemainingAmount = currentRemaining - paymentAmount

      const updatedPT = await tx.pT.update({
        where: { ptNumber: pt.ptNumber },
        data: { remainingAmount: newRemainingAmount }
      })

      const receiptNumber = await getNextReceiptNumber(tx)

      const receipt = await tx.receipt.create({
        data: {
          receiptNumber,
          type: 'دفع باقي برايفت',
          amount: paymentAmount,
          paymentMethod: finalPaymentMethod,
          staffName: staffName || '',
          ptNumber: pt.ptNumber,
          itemDetails: JSON.stringify({
            ptNumber: pt.ptNumber,
            clientName: pt.clientName,
            phone: pt.phone,
            coachName: pt.coachName,
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
          `دفع باقي برايفت - ${pt.clientName} (#${pt.ptNumber})`,
          tx
        )
        if (!deduction.success) {
          throw new PaymentValidationError(deduction.message || 'فشل خصم النقاط')
        }
      }

      return { updatedPT, receipt, currentRemaining, newRemainingAmount }
    })

    // ✅ إنشاء سجل عمولة للكوتش (غير حرج — بعد نجاح العملية الأساسية)
    try {
      const coachStaff = await prisma.staff.findFirst({
        where: { name: pt.coachName },
        include: { user: true }
      })

      if (coachStaff?.user) {
        const { createPTCommission } = await import('../../../../lib/commissionHelpers')
        await createPTCommission(
          prisma,
          coachStaff.user.id,
          paymentAmount,
          `عمولة دفع باقي برايفت - ${pt.clientName} (#${pt.ptNumber})`,
          pt.ptNumber
        )
      }
    } catch (commissionError) {
      console.error('⚠️ فشل إنشاء سجل العمولة (غير حرج):', commissionError)
    }

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'PT', resourceId: pt.ptNumber.toString(),
      details: { operation: 'PayRemaining', ptNumber, clientName: pt.clientName, paymentAmount, previousRemaining: result.currentRemaining, newRemaining: result.newRemainingAmount, pointsDeducted: pointsRequest.pointsUsed || 0, receiptNumber: result.receipt.receiptNumber },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({
      success: true,
      pt: result.updatedPT,
      receipt: result.receipt,
      message: 'تم دفع المبلغ المتبقي بنجاح'
    })
  } catch (error: any) {
    if (error instanceof PaymentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('❌ خطأ في دفع المبلغ المتبقي:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تعديل جلسات PT' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل دفع المبلغ المتبقي — لم يتم خصم أي مبلغ ولم يُنشأ إيصال، حاول مرة أخرى' },
      { status: 500 }
    )
  }
}
