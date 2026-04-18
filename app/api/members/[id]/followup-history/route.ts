import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyAuth } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // جلب بيانات العضو للحصول على رقم الهاتف
    const member = await prisma.member.findUnique({
      where: { id },
      select: { id: true, name: true, phone: true }
    })

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // البحث عن Visitor بنفس رقم الهاتف
    const visitor = await prisma.visitor.findFirst({
      where: { phone: member.phone },
      select: { id: true }
    })

    if (!visitor) {
      return NextResponse.json([])
    }

    // جلب كل المتابعات لهذا الفيزيتور (بما فيهم archived)
    const followUps = await prisma.followUp.findMany({
      where: { visitorId: visitor.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        notes: true,
        contacted: true,
        result: true,
        nextFollowUpDate: true,
        salesName: true,
        stage: true,
        priority: true,
        archived: true,
        archivedReason: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
        assignedStaff: {
          select: { id: true, name: true }
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            activityType: true,
            notes: true,
            createdAt: true,
            staff: { select: { name: true } }
          }
        }
      }
    })

    return NextResponse.json(followUps)
  } catch (error: any) {
    console.error('Error fetching follow-up history:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to fetch follow-up history' }, { status: 500 })
  }
}
