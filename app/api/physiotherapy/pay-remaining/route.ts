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
    // ✅ قبول دفعة باقي يحتاج فقط تسجيل دخول (مش canCreatePhysiotherapy)
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (user.role === 'COACH') {
      return NextResponse.json({ error: 'الكوتش غير مسموح له بقبول المدفوعات' }, { status: 403 })
    }

    const body = await request.json()
    const {
      physioNumber,
      paymentAmount,
      paymentMethod,
      staffName
    } = body

    if (!physioNumber) {
      return NextResponse.json(
        { error: 'رقم العلاج الطبيعي مطلوب' },
        { status: 400 }
      )
    }

    if (!paymentAmount || paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'مبلغ الدفع يجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    // البحث عن جلسة العلاج الطبيعي
    const physiotherapy = await prisma.physiotherapy.findUnique({
      where: { physioNumber: parseInt(physioNumber) }
    })

    if (!physiotherapy) {
      return NextResponse.json(
        { error: 'جلسة العلاج الطبيعي غير موجودة' },
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

    let pointsMemberId: string | null = null
    if (pointsRequest.pointsUsed > 0) {
      const resolved = await resolveMemberIdByPhone(prisma, physiotherapy.phone)
      if (!resolved.memberId) {
        return NextResponse.json({ error: resolved.message }, { status: 400 })
      }
      pointsMemberId = resolved.memberId
    }

    // ⚙️ عملية ذرّية: تحديث الباقي + الإيصال + النقاط مع بعض
    const result = await runReceiptTransaction(prisma, async (tx) => {
      const fresh = await tx.physiotherapy.findUnique({
        where: { physioNumber: physiotherapy.physioNumber },
        select: { remainingAmount: true }
      })
      if (!fresh) {
        throw new PaymentValidationError('جلسة العلاج الطبيعي غير موجودة')
      }

      const currentRemaining = fresh.remainingAmount || 0
      if (paymentAmount > currentRemaining) {
        throw new PaymentValidationError(
          `المبلغ المدفوع (${paymentAmount}) أكبر من المتبقي (${currentRemaining})`
        )
      }
      const newRemainingAmount = currentRemaining - paymentAmount

      const updatedPhysiotherapy = await tx.physiotherapy.update({
        where: { physioNumber: physiotherapy.physioNumber },
        data: { remainingAmount: newRemainingAmount }
      })

      const receiptNumber = await getNextReceiptNumber(tx)

      const receipt = await tx.receipt.create({
        data: {
          receiptNumber,
          type: 'دفع باقي علاج طبيعي',
          amount: paymentAmount,
          paymentMethod: finalPaymentMethod,
          staffName: staffName || '',
          physioNumber: physiotherapy.physioNumber,
          itemDetails: JSON.stringify({
            physioNumber: physiotherapy.physioNumber,
            clientName: physiotherapy.clientName,
            phone: physiotherapy.phone,
            therapistName: physiotherapy.therapistName,
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
          `دفع باقي علاج طبيعي - ${physiotherapy.clientName} (#${physiotherapy.physioNumber})`,
          tx
        )
        if (!deduction.success) {
          throw new PaymentValidationError(deduction.message || 'فشل خصم النقاط')
        }
      }

      return { updatedPhysiotherapy, receipt, currentRemaining, newRemainingAmount }
    })

    // ✅ إنشاء سجل عمولة لأخصائي العلاج الطبيعي (غير حرج)
    try {
      const therapistStaff = await prisma.staff.findFirst({
        where: { name: physiotherapy.therapistName },
        include: { user: true }
      })

      if (therapistStaff?.user) {
        const { createPTCommission } = await import('../../../../lib/commissionHelpers')
        await createPTCommission(
          prisma,
          therapistStaff.user.id,
          paymentAmount,
          `عمولة دفع باقي علاج طبيعي - ${physiotherapy.clientName} (#${physiotherapy.physioNumber})`,
          physiotherapy.physioNumber
        )
      }
    } catch (commissionError) {
      console.error('⚠️ فشل إنشاء سجل العمولة (غير حرج):', commissionError)
    }

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Physiotherapy', resourceId: physiotherapy.physioNumber.toString(),
      details: { operation: 'PayRemaining', physioNumber, clientName: physiotherapy.clientName, paymentAmount, previousRemaining: result.currentRemaining, newRemaining: result.newRemainingAmount, pointsDeducted: pointsRequest.pointsUsed || 0, receiptNumber: result.receipt.receiptNumber },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({
      success: true,
      physiotherapy: result.updatedPhysiotherapy,
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
        { error: 'ليس لديك صلاحية تعديل جلسات العلاج الطبيعي' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل دفع المبلغ المتبقي — لم يتم خصم أي مبلغ ولم يُنشأ إيصال، حاول مرة أخرى' },
      { status: 500 }
    )
  }
}
