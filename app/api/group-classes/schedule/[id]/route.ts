import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'

// PUT - تعديل موعد
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'canCreateGroupClass')

    const { id } = await params
    const body = await request.json()
    const { dayOfWeek, startTime, className, coachName, duration, isActive } = body

    const schedule = await prisma.classSchedule.update({
      where: { id },
      data: {
        ...(dayOfWeek !== undefined && { dayOfWeek: Number(dayOfWeek) }),
        ...(startTime && { startTime }),
        ...(className && { className: className.trim() }),
        ...(coachName && { coachName: coachName.trim() }),
        ...(duration !== undefined && { duration: Number(duration) }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(schedule)
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }
    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }
    console.error('Update class schedule error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

// DELETE - حذف موعد
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'canCreateGroupClass')

    const { id } = await params

    await prisma.classSchedule.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }
    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }
    console.error('Delete class schedule error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
