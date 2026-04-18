import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

// GET - جلب بيانات مدرب واحد

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // التحقق من المصادقة فقط
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const coachId = params.id

    const coach = await prisma.staff.findUnique({
      where: { id: coachId },
      include: {
        user: {
          select: {
            role: true,
          },
        },
      },
    })

    if (!coach) {
      return NextResponse.json(
        { error: 'لم يتم العثور على المدرب' },
        { status: 404 }
      )
    }

    // التأكد من أن الموظف هو مدرب
    if (!coach.user || coach.user.role !== 'COACH') {
      return NextResponse.json(
        { error: 'هذا الموظف ليس مدرباً' },
        { status: 400 }
      )
    }

    // إرجاع البيانات بدون حقل user
    const formattedCoach = {
      id: coach.id,
      name: coach.name,
      staffCode: coach.staffCode,
      position: coach.position,
    }

    return NextResponse.json(formattedCoach)
  } catch (error) {
    console.error('Error fetching coach:', error)
    return NextResponse.json(
      { error: 'Failed to fetch coach' },
      { status: 500 }
    )
  }
}
