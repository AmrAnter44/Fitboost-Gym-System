// app/api/members/pay-remaining/route.ts
//
// Atomic "collect remaining balance" endpoint for members.
// Combines updating Member.remainingAmount + creating a Receipt in ONE call,
// so the frontend doesn't have to chain two endpoints (each with their own
// permission gate that block STAFF — see issue with `canEditMembers` and
// `canEditReceipts` defaulting to false for the staff role).
//
// Auth model: any logged-in non-coach user can collect a payment. This is a
// front-desk task, not a member edit; the audit log captures who did it.

import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods,
} from '../../../../lib/paymentHelpers'
import { getRequestedPoints } from '../../../../lib/paymentProcessor'
import { deductPoints } from '../../../../lib/points'
import {
  getNextReceiptNumber,
  runReceiptTransaction,
  PaymentValidationError,
} from '../../../../lib/receiptHelpers'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }

    // الكوتش مش بيتعامل مع المدفوعات
    if (user.role === 'COACH') {
      return NextResponse.json(
        { error: 'الكوتش غير مسموح له بقبول المدفوعات' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { memberId, amount, paymentMethod, notes } = body as {
      memberId?: string
      amount?: number
      paymentMethod?: string | PaymentMethod[]
      notes?: string
    }

    if (!memberId || typeof memberId !== 'string') {
      return NextResponse.json({ error: 'معرف العضو مطلوب' }, { status: 400 })
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'مبلغ الدفع يجب أن يكون أكبر من صفر' }, { status: 400 })
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: { salesStaff: { select: { name: true } } },
    })

    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }

    // ✅ كل التحققات بتحصل قبل أي كتابة في قاعدة البيانات
    let finalPaymentMethod: string
    if (Array.isArray(paymentMethod)) {
      const validation = validatePaymentDistribution(paymentMethod, amount)
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

    // النقاط المطلوب خصمها (لو الدفع كله أو جزء منه بالنقاط)
    const pointsRequest = await getRequestedPoints(paymentMethod ?? 'cash', amount, prisma)
    if (pointsRequest.message) {
      return NextResponse.json({ error: pointsRequest.message }, { status: 400 })
    }

    // ⚙️ عملية ذرّية واحدة: قراءة الباقي الحالي + حجز رقم الإيصال + تحديث
    // الباقي + إنشاء الإيصال + خصم النقاط. لو أي خطوة فشلت بترولّبك كلها —
    // مستحيل يتخصم باقي من غير إيصال أو العكس.
    const result = await runReceiptTransaction(prisma, async (tx) => {
      const freshMember = await tx.member.findUnique({
        where: { id: memberId },
        select: { remainingAmount: true },
      })
      if (!freshMember) {
        throw new PaymentValidationError('العضو غير موجود')
      }

      const currentRemaining = freshMember.remainingAmount || 0
      if (amount > currentRemaining) {
        throw new PaymentValidationError(
          `المبلغ المدفوع (${amount}) أكبر من المتبقي (${currentRemaining})`
        )
      }
      const newRemaining = currentRemaining - amount

      const updatedMember = await tx.member.update({
        where: { id: memberId },
        data: { remainingAmount: newRemaining },
      })

      const receiptNumber = await getNextReceiptNumber(tx)

      const itemDetails = {
        memberNumber: member.memberNumber,
        memberName: member.name,
        phone: member.phone,
        startDate: member.startDate,
        expiryDate: member.expiryDate,
        subscriptionPrice: member.subscriptionPrice,
        previousRemaining: currentRemaining,
        paidAmount: amount,
        remainingAmount: newRemaining,
        paymentMethod: finalPaymentMethod,
        staffName: user.name,
        salesPersonName: member.salesStaff?.name || null,
        notes: notes || '',
      }

      const receipt = await tx.receipt.create({
        data: {
          receiptNumber,
          type: 'Payment',
          amount,
          itemDetails: JSON.stringify(itemDetails),
          paymentMethod: finalPaymentMethod,
          staffName: user.name || '',
          memberId,
        },
      })

      if (pointsRequest.pointsUsed > 0) {
        const deduction = await deductPoints(
          memberId,
          pointsRequest.pointsUsed,
          `دفع متبقي - ${member.name}`,
          tx
        )
        if (!deduction.success) {
          throw new PaymentValidationError(deduction.message || 'فشل خصم النقاط')
        }
      }

      return { updatedMember, receipt, currentRemaining, newRemaining }
    })

    createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action: 'UPDATE',
      resource: 'Member',
      resourceId: member.id,
      details: {
        operation: 'PayRemaining',
        memberNumber: member.memberNumber,
        memberName: member.name,
        amount,
        previousRemaining: result.currentRemaining,
        newRemaining: result.newRemaining,
        pointsDeducted: pointsRequest.pointsUsed || 0,
        receiptNumber: result.receipt.receiptNumber,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
      status: 'success',
    })

    return NextResponse.json({
      success: true,
      member: result.updatedMember,
      receipt: result.receipt,
      message: 'تم دفع المبلغ المتبقي بنجاح',
    })
  } catch (error: any) {
    if (error instanceof PaymentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('❌ pay-remaining error:', error)
    return NextResponse.json(
      { error: 'فشل دفع المبلغ المتبقي — لم يتم خصم أي مبلغ ولم يُنشأ إيصال، حاول مرة أخرى' },
      { status: 500 }
    )
  }
}
