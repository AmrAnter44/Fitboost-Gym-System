import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyAuth } from '../../../../../lib/auth'
import { RECEIPT_TYPES } from '../../../../../lib/receiptTypes'

export const dynamic = 'force-dynamic'

// سجل تجديدات العضوية — يجمع إيصال التسجيل الأول (type: Member) + كل إيصالات التجديد
// (type: membershipRenewal) ويطلّع فترة كل اشتراك من امتى لامتى.
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const memberId = params.id
    if (!memberId) {
      return NextResponse.json({ error: 'معرف العضو مطلوب' }, { status: 400 })
    }

    // إيصالات العضو المتعلقة بالعضوية: التسجيل الأول + التجديدات
    const receipts = await prisma.receipt.findMany({
      where: {
        memberId,
        type: { in: [RECEIPT_TYPES.MEMBERSHIP_RENEWAL, 'Member'] }
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        receiptNumber: true,
        type: true,
        amount: true,
        staffName: true,
        itemDetails: true,
        createdAt: true
      }
    })

    const history = receipts
      .map((r) => {
        let details: any = {}
        try {
          details = typeof r.itemDetails === 'string' ? JSON.parse(r.itemDetails) : (r.itemDetails || {})
        } catch {
          details = {}
        }

        // التجديد بيخزّن newStartDate/newExpiryDate، والتسجيل الأول بيخزّن startDate/expiryDate
        const startDate = details.newStartDate || details.startDate || null
        const expiryDate = details.newExpiryDate || details.expiryDate || null
        const isRenewal = r.type === RECEIPT_TYPES.MEMBERSHIP_RENEWAL

        return {
          id: r.id,
          receiptNumber: r.receiptNumber,
          isRenewal,
          startDate,
          expiryDate,
          previousExpiryDate: details.previousExpiryDate || null,
          subscriptionDays: details.subscriptionDays ?? null,
          subscriptionPrice: details.subscriptionPrice ?? r.amount ?? null,
          paidAmount: details.paidAmount ?? r.amount ?? null,
          staffName: r.staffName || details.staffName || null,
          createdAt: r.createdAt
        }
      })
      // نستبعد الإيصالات اللي مش فيها تواريخ اشتراك (مش تجديد فعلي)
      .filter((h) => h.startDate && h.expiryDate)

    return NextResponse.json(history)
  } catch (error: any) {
    console.error('Error fetching renewal history:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'حدث خطأ في جلب سجل التجديدات' }, { status: 500 })
  }
}
