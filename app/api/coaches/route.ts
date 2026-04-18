import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyAuth } from '../../../lib/auth'

// GET - جلب قائمة الموظفين لاختيار المدرب

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // التحقق من المصادقة فقط (بدون صلاحيات محددة)
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // جلب الموظفين النشطين الذين دورهم COACH فقط
    const allStaff = await prisma.staff.findMany({
      where: {
        isActive: true,
      },
      include: {
        user: {
          select: {
            role: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // فلتر الموظفين الذين دورهم COACH فقط
    const coaches = allStaff.filter(staff => staff.user && staff.user.role === 'COACH')

    // إرجاع البيانات بدون حقل user
    const formattedCoaches = coaches.map(coach => ({
      id: coach.id,
      name: coach.name,
      staffCode: coach.staffCode,
      position: coach.position,
    }))

    return NextResponse.json(formattedCoaches)
  } catch (error) {
    console.error('Error fetching coaches:', error)
    return NextResponse.json(
      { error: 'Failed to fetch coaches' },
      { status: 500 }
    )
  }
}
