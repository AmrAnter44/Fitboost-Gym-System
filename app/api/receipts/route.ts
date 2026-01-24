import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'

export const dynamic = 'force-dynamic'


export async function GET(request: Request) {
  try {
    // ✅ محاولة التحقق من صلاحية عرض الإيصالات
    let user
    try {
      user = await requirePermission(request, 'canViewReceipts')
    } catch (permError: any) {
      // إذا لم يكن لديه صلاحية canViewReceipts، نتحقق إذا كان كوتش يريد رؤية إيصالات PT الخاصة به فقط
      const { verifyAuth } = await import('../../../lib/auth')
      user = await verifyAuth(request)

      if (!user) {
        throw new Error('Unauthorized')
      }

      // الكوتشات يمكنهم رؤية إيصالات PT الخاصة بهم فقط
      if (user.role === 'COACH') {
        // جلب كل PT records الخاصة بهذا الكوتش
        const coachPTs = await prisma.pT.findMany({
          where: { coachUserId: user.userId },
          select: { ptNumber: true }
        })

        if (coachPTs.length === 0) {
          // الكوتش ليس لديه أي PT sessions بعد
          return NextResponse.json([])
        }

        const ptNumbers = coachPTs.map(pt => pt.ptNumber)

        // جلب الإيصالات الخاصة بـ PT sessions هذا الكوتش فقط
        const receipts = await prisma.receipt.findMany({
          where: {
            ptNumber: { in: ptNumbers }
          },
          orderBy: { receiptNumber: 'desc' }
        })

        return NextResponse.json(receipts)
      }

      // إذا لم يكن كوتش، نرمي الخطأ الأصلي
      throw permError
    }

    // ✅ إذا كان لديه صلاحية canViewReceipts، نطبق المنطق العادي
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')
    const ptNumber = searchParams.get('ptNumber')
    const dayUseId = searchParams.get('dayUseId')
    const limit = searchParams.get('limit')

    let receipts

    if (memberId) {
      receipts = await prisma.receipt.findMany({
        where: { memberId },
        orderBy: { receiptNumber: 'desc' }
      })
    } else if (ptNumber) {
      receipts = await prisma.receipt.findMany({
        where: { ptNumber: parseInt(ptNumber) },
        orderBy: { receiptNumber: 'desc' }
      })
    } else if (dayUseId) {
      receipts = await prisma.receipt.findMany({
        where: { dayUseId },
        orderBy: { receiptNumber: 'desc' }
      })
    } else {
      // جلب كل الإيصالات أو عدد محدد
      receipts = await prisma.receipt.findMany({
        orderBy: { receiptNumber: 'desc' },
        take: limit ? parseInt(limit) : undefined
      })
    }

    return NextResponse.json(receipts)
  } catch (error: any) {
    console.error('Error fetching receipts:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية عرض الإيصالات' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل جلب الإيصالات' }, { status: 500 })
  }
}