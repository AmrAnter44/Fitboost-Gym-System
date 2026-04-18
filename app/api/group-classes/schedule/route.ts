import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, requirePermission } from '@/lib/auth'

// GET - جلب جميع مواعيد الكلاسيس (أو كلاسيس اليوم فقط)
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const todayOnly = searchParams.get('today') === 'true'

    const where = todayOnly
      ? { isActive: true, dayOfWeek: new Date().getDay() }
      : {}

    const schedules = await prisma.classSchedule.findMany({
      where,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })

    return NextResponse.json(schedules)
  } catch (error) {
    console.error('Get class schedules error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

// POST - إضافة موعد جديد
export async function POST(request: Request) {
  try {
    await requirePermission(request, 'canCreateGroupClass')

    const body = await request.json()
    const { dayOfWeek, startTime, className, coachName, duration } = body

    if (dayOfWeek === undefined || !startTime || !className || !coachName) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    const schedule = await prisma.classSchedule.create({
      data: {
        dayOfWeek: Number(dayOfWeek),
        startTime,
        className: className.trim(),
        coachName: coachName.trim(),
        duration: duration ? Number(duration) : 60,
        isActive: true,
      },
    })

    return NextResponse.json(schedule, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }
    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }
    console.error('Create class schedule error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
