import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

//  سجل تجديدات الـ PT
//  ملاحظة: التجديد بيعدّل نفس صف الـ PT في مكانه (نفس ptNumber) ومفيش جدول history،
//  فالسجل بيتبني من الإيصالات نفسها — كل إيصال فيه snapshot للحالة وقت العملية.
//  كل إيصالات الـ PT عندها ptNumber، فالسجل بيطلع بأثر رجعي للاشتراكات القديمة كمان.
const PT_RECEIPT_TYPES = [
  'newPT', 'ptRenewal', 'ptDayUse', 'PT',
  // أنواع قديمة (backward compatibility)
  'برايفت جديد', 'تجديد برايفت', 'دفع باقي برايفت', 'new pt', 'اشتراك برايفت', 'PT Day Use',
]

const RENEWAL_TYPES = ['ptRenewal', 'تجديد برايفت']

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ptNumberParam = searchParams.get('ptNumber')
    if (!ptNumberParam) {
      return NextResponse.json({ error: 'رقم الـ PT مطلوب' }, { status: 400 })
    }
    const ptNumber = parseInt(ptNumberParam)
    if (isNaN(ptNumber)) {
      return NextResponse.json({ error: 'رقم الـ PT غير صحيح' }, { status: 400 })
    }

    const receipts = await prisma.receipt.findMany({
      where: { ptNumber, type: { in: PT_RECEIPT_TYPES } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        receiptNumber: true,
        type: true,
        amount: true,
        staffName: true,
        itemDetails: true,
        createdAt: true,
        isCancelled: true,
        refundMethod: true,
      },
    })

    const history = receipts.map((r) => {
      let d: any = {}
      try {
        d = typeof r.itemDetails === 'string' ? JSON.parse(r.itemDetails) : (r.itemDetails || {})
      } catch {
        d = {}
      }

      const isRenewal = RENEWAL_TYPES.includes(r.type)

      return {
        id: r.id,
        receiptNumber: r.receiptNumber,
        type: r.type,
        isRenewal,
        clientName: d.clientName ?? null,
        coachName: d.coachName ?? null,
        //  عدد الحصص اللي اتشرت في العملية دي
        sessionsPurchased: d.sessionsPurchased ?? null,
        //  الحصص اللي كانت متبقية قبل التجديد + اللي اترحّلت (موجودة في التجديدات الجديدة بس)
        oldSessionsRemaining: d.oldSessionsRemaining ?? null,
        carriedOverSessions: d.carriedOverSessions ?? null,
        newSessionsRemaining: d.newSessionsRemaining ?? null,
        pricePerSession: d.pricePerSession ?? null,
        totalAmount: d.totalAmount ?? r.amount ?? null,
        paidAmount: d.paidAmount ?? r.amount ?? null,
        remainingAmount: d.remainingAmount ?? null,
        startDate: d.startDate ?? null,
        expiryDate: d.expiryDate ?? null,
        subscriptionDays: d.subscriptionDays ?? null,
        staffName: r.staffName || d.staffName || null,
        //  حالة الإيصال عشان الملغي/المرتجع يبان في السجل
        isCancelled: !!r.isCancelled,
        isRefunded: !!r.isCancelled && !!r.refundMethod,
        createdAt: r.createdAt,
      }
    })

    return NextResponse.json(history)
  } catch (error: any) {
    console.error('Error fetching PT renewal history:', error)
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'حدث خطأ في جلب سجل التجديدات' }, { status: 500 })
  }
}
