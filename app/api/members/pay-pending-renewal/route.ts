// app/api/members/pay-pending-renewal/route.ts
//
//  💰 تحصيل باقي «التجديد المجدول» قبل ما يبدأ.
//  الباقي بتاع التجديد متخزّن في pendingRenewalData.remainingAmount (مش على العضو نفسه).
//  الـ endpoint ده بيقلّل الباقي المخزّن ويعمل إيصال، فالريسيبشن يقدر يحصّله على دفعات
//  قبل ميعاد تفعيل التجديد. أول ما التجديد يتفعّل، الباقي المتبقّي (لو فيه) بينزل على العضو عادي.
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
import { readPendingRenewal, writePendingRenewal } from '../../../../lib/pendingRenewal'
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods,
} from '../../../../lib/paymentHelpers'
import { getNextReceiptNumber, runReceiptTransaction, PaymentValidationError } from '../../../../lib/receiptHelpers'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    if (user.role === 'COACH') {
      return NextResponse.json({ error: 'الكوتش غير مسموح له بقبول المدفوعات' }, { status: 403 })
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
    if (!member) return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })

    const pending = await readPendingRenewal(memberId)
    if (!pending) return NextResponse.json({ error: 'مفيش تجديد مجدول لهذا العضو' }, { status: 404 })

    const currentRemaining = round2(pending.data.remainingAmount || 0)
    if (currentRemaining <= 0) {
      return NextResponse.json({ error: 'مفيش باقي على التجديد المجدول' }, { status: 400 })
    }
    if (amount > currentRemaining) {
      return NextResponse.json(
        { error: `المبلغ المدفوع (${amount}) أكبر من باقي التجديد (${currentRemaining})` },
        { status: 400 }
      )
    }

    // تحقّق من توزيع طرق الدفع (لو multi) — النقاط مش مدعومة هنا عشان التجديد لسه ما اتفعّلش
    let finalPaymentMethod: string
    if (Array.isArray(paymentMethod)) {
      const hasPoints = paymentMethod.some(p => p.method === 'points')
      if (hasPoints) {
        return NextResponse.json({ error: 'الدفع بالنقاط غير متاح لباقي التجديد المجدول' }, { status: 400 })
      }
      const validation = validatePaymentDistribution(paymentMethod, amount)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.message || 'توزيع المبالغ غير صحيح' }, { status: 400 })
      }
      finalPaymentMethod = serializePaymentMethods(paymentMethod)
    } else {
      if (paymentMethod === 'points') {
        return NextResponse.json({ error: 'الدفع بالنقاط غير متاح لباقي التجديد المجدول' }, { status: 400 })
      }
      finalPaymentMethod = paymentMethod || 'cash'
    }

    const newRemaining = round2(currentRemaining - amount)

    // عملية ذرّية: حجز رقم إيصال + إنشاء الإيصال + تحديث الباقي المخزّن في التجديد
    const result = await runReceiptTransaction(prisma, async (tx) => {
      const receiptNumber = await getNextReceiptNumber(tx)

      const itemDetails = {
        memberNumber: member.memberNumber,
        memberName: member.name,
        phone: member.phone,
        operation: 'PayScheduledRenewalRemaining',
        renewalStartDate: pending.startDate.toISOString(),
        renewalExpiryDate: pending.expiryDate ? pending.expiryDate.toISOString() : null,
        renewalPrice: pending.data.subscriptionPrice || 0,
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

      // نحدّث الباقي المخزّن في التجديد المؤجل (نفس التواريخ/باقي البيانات)
      const newData = { ...pending.data, remainingAmount: newRemaining }
      // لو اتسدّد بالكامل، نشيل تاريخ الاستحقاق كمان
      if (newRemaining <= 0) newData.remainingDueDate = null
      await writePendingRenewal(memberId, pending.startDate, pending.expiryDate, newData, tx)

      return { receipt }
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Member', resourceId: member.id,
      details: {
        operation: 'PayScheduledRenewalRemaining',
        memberNumber: member.memberNumber, memberName: member.name,
        amount, previousRemaining: currentRemaining, newRemaining,
        receiptNumber: result.receipt.receiptNumber,
      },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success',
    })

    return NextResponse.json({
      success: true,
      receipt: result.receipt,
      newRemaining,
      message: 'تم تحصيل جزء من باقي التجديد المجدول',
    })
  } catch (error: any) {
    if (error instanceof PaymentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('❌ pay-pending-renewal error:', error)
    return NextResponse.json({ error: 'فشل تحصيل باقي التجديد — حاول مرة أخرى' }, { status: 500 })
  }
}
