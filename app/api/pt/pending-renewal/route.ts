import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
import {
  validatePaymentDistribution,
  serializePaymentMethods,
} from '../../../../lib/paymentHelpers'
import {
  getNextReceiptNumber,
  runReceiptTransaction,
  PaymentValidationError,
} from '../../../../lib/receiptHelpers'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

//  🔁 إدارة التجديد المعلّق للـ PT (قبل ما يتفعّل):
//   - PUT  : تعديل تفاصيل الباقة المعلّقة (حصص/سعر/تواريخ/كوتش/باقي)
//   - POST : دفع باقي الباقة المعلّقة (بيطلّع إيصال ويقلّل الباقي المخزّن في المعلّق)
//  العمود pendingRenewalData جديد → بنقراه/نكتبه بـ raw SQL (الـ client ممكن يكون قديم).

async function readPending(db: any, ptNumber: number): Promise<any | null> {
  const rows: any = await db.$queryRawUnsafe(
    `SELECT pendingRenewalData FROM PT WHERE ptNumber = ? LIMIT 1`,
    ptNumber
  )
  const raw = Array.isArray(rows) && rows.length ? rows[0].pendingRenewalData : null
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

// PUT — تعديل الباقة المعلّقة
export async function PUT(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    if (user.role === 'COACH') return NextResponse.json({ error: 'غير مسموح' }, { status: 403 })

    const body = await request.json()
    const { ptNumber, sessions, pricePerSession, startDate, expiryDate, coachName, remainingAmount } = body
    if (!ptNumber) return NextResponse.json({ error: 'رقم PT مطلوب' }, { status: 400 })

    const ptNum = parseInt(ptNumber)
    const pending = await readPending(prisma, ptNum)
    if (!pending) return NextResponse.json({ error: 'مفيش تجديد معلّق على الاشتراك ده' }, { status: 404 })

    //  دمج القيم الجديدة (اللي اتبعتت بس)
    const updated = {
      ...pending,
      ...(sessions !== undefined ? { sessions: Math.max(1, parseInt(sessions) || pending.sessions) } : {}),
      ...(pricePerSession !== undefined ? { pricePerSession: Number(pricePerSession) || 0 } : {}),
      ...(startDate !== undefined ? { startDate: startDate || null } : {}),
      ...(expiryDate !== undefined ? { expiryDate: expiryDate || null } : {}),
      ...(coachName !== undefined ? { coachName: coachName || pending.coachName } : {}),
      ...(remainingAmount !== undefined ? { remainingAmount: Math.max(0, Math.round(Number(remainingAmount) || 0)) } : {}),
    }

    await prisma.$executeRawUnsafe(
      `UPDATE PT SET pendingRenewalData = ? WHERE ptNumber = ?`,
      JSON.stringify(updated),
      ptNum
    )

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'PT', resourceId: String(ptNum),
      details: { operation: 'EditPendingRenewal', ptNumber: ptNum, pending: updated },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({ success: true, pending: updated })
  } catch (error: any) {
    console.error('❌ خطأ في تعديل التجديد المعلّق:', error)
    return NextResponse.json({ error: 'فشل تعديل التجديد المعلّق' }, { status: 500 })
  }
}

// POST — دفع باقي الباقة المعلّقة
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    if (user.role === 'COACH') return NextResponse.json({ error: 'الكوتش غير مسموح له بقبول المدفوعات' }, { status: 403 })

    const body = await request.json()
    const { ptNumber, paymentAmount, paymentMethod, staffName } = body
    if (!ptNumber) return NextResponse.json({ error: 'رقم PT مطلوب' }, { status: 400 })
    if (!paymentAmount || paymentAmount <= 0) {
      return NextResponse.json({ error: 'مبلغ الدفع يجب أن يكون أكبر من صفر' }, { status: 400 })
    }

    const ptNum = parseInt(ptNumber)
    const pt = await prisma.pT.findUnique({ where: { ptNumber: ptNum } })
    if (!pt) return NextResponse.json({ error: 'جلسة PT غير موجودة' }, { status: 404 })

    let finalPaymentMethod: string
    if (Array.isArray(paymentMethod)) {
      const validation = validatePaymentDistribution(paymentMethod, paymentAmount)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.message || 'توزيع المبالغ غير صحيح' }, { status: 400 })
      }
      finalPaymentMethod = serializePaymentMethods(paymentMethod)
    } else {
      finalPaymentMethod = paymentMethod || 'cash'
    }

    const result = await runReceiptTransaction(prisma, async (tx) => {
      const pending = await readPending(tx, ptNum)
      if (!pending) throw new PaymentValidationError('مفيش تجديد معلّق على الاشتراك ده')
      const currentPending = Math.max(0, Number(pending.remainingAmount) || 0)
      if (currentPending <= 0) throw new PaymentValidationError('مفيش باقي على التجديد المعلّق')
      if (paymentAmount > currentPending) {
        throw new PaymentValidationError(`المبلغ المدفوع (${paymentAmount}) أكبر من باقي التجديد (${currentPending})`)
      }
      const newPendingRemaining = Math.round(currentPending - paymentAmount)

      //  إيصال بالمبلغ المدفوع (إيراد فوري)
      const receiptNumber = await getNextReceiptNumber(tx)
      const receipt = await tx.receipt.create({
        data: {
          receiptNumber,
          type: 'دفع باقي برايفت',
          amount: paymentAmount,
          paymentMethod: finalPaymentMethod,
          staffName: staffName || '',
          ptNumber: ptNum,
          itemDetails: JSON.stringify({
            ptNumber: ptNum,
            clientName: pt.clientName,
            phone: pt.phone,
            coachName: pending.coachName || pt.coachName,
            paymentAmount,
            previousRemaining: currentPending,
            newRemaining: newPendingRemaining,
            paymentType: 'pending_renewal_payment', //  دفع باقي تجديد معلّق
          }),
        },
      })

      //  تحديث الباقي المخزّن في المعلّق (raw SQL)
      const updatedPending = { ...pending, remainingAmount: newPendingRemaining }
      await tx.$executeRawUnsafe(
        `UPDATE PT SET pendingRenewalData = ? WHERE ptNumber = ?`,
        JSON.stringify(updatedPending),
        ptNum
      )

      return { receipt, currentPending, newPendingRemaining }
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'PT', resourceId: String(ptNum),
      details: { operation: 'PayPendingRenewal', ptNumber: ptNum, clientName: pt.clientName, paymentAmount, newRemaining: result.newPendingRemaining, receiptNumber: result.receipt.receiptNumber },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({ success: true, receipt: result.receipt, newRemaining: result.newPendingRemaining, message: 'تم دفع باقي التجديد بنجاح' })
  } catch (error: any) {
    if (error instanceof PaymentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('❌ خطأ في دفع باقي التجديد المعلّق:', error)
    return NextResponse.json({ error: 'فشل دفع باقي التجديد — لم يتم خصم أي مبلغ' }, { status: 500 })
  }
}
