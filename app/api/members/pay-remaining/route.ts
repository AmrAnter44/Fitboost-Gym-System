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
import { processPaymentWithPoints } from '../../../../lib/paymentProcessor'
import { getNextReceiptNumberDirect } from '../../../../lib/receiptHelpers'
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

    const currentRemaining = member.remainingAmount || 0
    if (amount > currentRemaining) {
      return NextResponse.json(
        { error: `المبلغ المدفوع (${amount}) أكبر من المتبقي (${currentRemaining})` },
        { status: 400 }
      )
    }

    // ✅ معالجة وسائل الدفع المتعددة
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

    const newRemaining = currentRemaining - amount
    const receiptNumber = await getNextReceiptNumberDirect(prisma)

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

    // ⚙️ تحديث الـ remainingAmount + إنشاء الإيصال — عمليتين متتاليتين
    // (مش transaction كاملة لأن Prisma في SQLite ممكن يبط، بس الترتيب آمن:
    //  لو فشل الإيصال بعد التحديث، الباقي اتعدّل بس مفيش إيصال — نقدر نتعقّب من audit log)
    const [updatedMember, receipt] = await prisma.$transaction([
      prisma.member.update({
        where: { id: memberId },
        data: { remainingAmount: newRemaining },
      }),
      prisma.receipt.create({
        data: {
          receiptNumber,
          type: 'Payment',
          amount,
          itemDetails: JSON.stringify(itemDetails),
          paymentMethod: finalPaymentMethod,
          memberId,
        },
      }),
    ])

    // خصم النقاط لو اتم استخدامها (خارج الـ transaction علشان الـ helper بيعمل عمليات تانية)
    const pointsResult = await processPaymentWithPoints(
      member.id,
      member.phone,
      member.memberNumber,
      finalPaymentMethod,
      `دفع متبقي - ${member.name}`,
      prisma
    )

    if (!pointsResult.success) {
      // الـ DB updated بالفعل، فبنرجّع warning بس مش error كامل
      return NextResponse.json(
        {
          warning: pointsResult.message || 'تم الدفع بس فشل خصم النقاط',
          member: updatedMember,
          receipt,
        },
        { status: 200 }
      )
    }

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
        previousRemaining: currentRemaining,
        newRemaining,
        receiptNumber: receipt.receiptNumber,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
      status: 'success',
    })

    return NextResponse.json({
      success: true,
      member: updatedMember,
      receipt,
      message: 'تم دفع المبلغ المتبقي بنجاح',
    })
  } catch (error: any) {
    console.error('❌ pay-remaining error:', error)
    return NextResponse.json(
      { error: error.message || 'فشل دفع المبلغ المتبقي' },
      { status: 500 }
    )
  }
}
