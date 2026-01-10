import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const staffId = searchParams.get('staffId')

    const where: any = {}
    if (type) where.type = type
    if (staffId) where.staffId = staffId

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
