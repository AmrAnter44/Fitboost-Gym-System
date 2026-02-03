import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyAuth } from '../../../lib/auth'

export const dynamic = 'force-dynamic'


export async function GET(request: Request) {
  try {
    // التحقق من المصادقة
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const staffId = searchParams.get('staffId')

    const where: any = {}
    if (type) where.type = type

    // إذا كان المستخدم COACH، فلتر بناءً على staffId الخاص به
    if (user.role === 'COACH' && user.staffId) {
      where.staffId = user.staffId
      console.log('🏋️ Filtering commissions for COACH staffId:', user.staffId)
    } else if (staffId) {
      // إذا كان Admin وأرسل staffId في query params
      where.staffId = staffId
    }

    const commissions = await prisma.commission.findMany({
      where,
      include: {
        staff: {
          select: {
            name: true,
            staffCode: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(commissions)
  } catch (error) {
    console.error('Error fetching commissions:', error)
    return NextResponse.json({ error: 'Failed to fetch commissions' }, { status: 500 })
  }
}
