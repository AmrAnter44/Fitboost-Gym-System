import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

// GET - جلب الأعضاء المعينين للمدرب (assigned via coachId)

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'COACH') {
      return NextResponse.json(
        { error: 'هذه الصفحة للمدربين فقط' },
        { status: 403 }
      )
    }

    if (!user.staffId) {
      return NextResponse.json({ error: 'لا يوجد staffId للمدرب' }, { status: 400 })
    }

    const members = await prisma.member.findMany({
      where: {
        coachId: user.staffId,
      },
      select: {
        id: true,
        memberNumber: true,
        name: true,
        phone: true,
        profileImage: true,
        isActive: true,
        startDate: true,
        expiryDate: true,
        freePTSessions: true,
      },
      orderBy: { memberNumber: 'desc' },
    })

    return NextResponse.json(members)
  } catch (error) {
    console.error('Error fetching coach assigned members:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assigned members' },
      { status: 500 }
    )
  }
}
