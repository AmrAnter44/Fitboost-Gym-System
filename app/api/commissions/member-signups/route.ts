import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'


export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)

    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    // بناء الفلتر بناءً على دور المستخدم
    const whereClause: any = {
      type: 'member_signup',
      createdAt: {
        gte: start,
        lte: end
      }
    }

    // إذا كان المستخدم COACH، فلتر بناءً على staffId
    if (user.role === 'COACH' && user.staffId) {
      whereClause.staffId = user.staffId
    }

    // جلب العمولات من نوع member_signup في الفترة المحددة
    const commissions = await prisma.commission.findMany({
      where: whereClause,
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            staffCode: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // تجميع البيانات حسب الكوتش
    const coachCommissions = commissions.reduce((acc: any, commission) => {
      const coachId = commission.staffId
      const coachName = commission.staff?.name || 'غير معروف'

      if (!acc[coachId]) {
        acc[coachId] = {
          coachId: coachId,
          coachName: coachName,
          staffCode: commission.staff?.staffCode || '',
          count: 0,
          totalAmount: 0,
          commissions: []
        }
      }

      acc[coachId].count += 1
      acc[coachId].totalAmount += commission.amount
      acc[coachId].commissions.push({
        id: commission.id,
        amount: commission.amount,
        description: commission.description,
        createdAt: commission.createdAt
      })

      return acc
    }, {})

    // تحويل الـ object لـ array
    const result = Object.values(coachCommissions).sort((a: any, b: any) => b.totalAmount - a.totalAmount)


    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching member signup commissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch commissions' },
      { status: 500 }
    )
  }
}
