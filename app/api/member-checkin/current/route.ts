import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '../../../../lib/prisma'

// GET: الحصول على تسجيلات دخول اليوم

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!(await verifyAuth(request))) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 })
  try {
    // ✅ الحصول على تسجيلات دخول اليوم
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const todayCheckIns = await prisma.memberCheckIn.findMany({
      where: {
        checkInTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        member: {
          select: {
            name: true,
            memberNumber: true,
            phone: true,
          },
        },
      },
      orderBy: {
        checkInTime: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      count: todayCheckIns.length,
      members: todayCheckIns,
    })
  } catch (error) {
    console.error('Error getting current count:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء الاستعلام' },
      { status: 500 }
    )
  }
}
