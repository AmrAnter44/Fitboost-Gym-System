import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { resolveInstructor, setClassInstructor } from '@/lib/classInstructor'

// PUT - تعديل موعد
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'canCreateGroupClass')

    const { id } = await params
    const body = await request.json()
    const { dayOfWeek, startTime, className, duration, isActive, gender, instructorStaffId, externalName, externalPhone, clearInstructor } = body
    let { coachName } = body

    //  🧑‍🏫 الكابتن (لو اتبعت): موظف من الجيم أو كابتن من برا
    let instructor = null
    try {
      instructor = await resolveInstructor(prisma, { instructorStaffId, externalName, externalPhone })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    if (instructor) coachName = instructor.name

    if (gender !== undefined && !['male', 'female', 'mixed'].includes(gender)) {
      return NextResponse.json({ error: 'نوع الكلاس غير صحيح' }, { status: 400 })
    }

    const schedule = await prisma.classSchedule.update({
      where: { id },
      data: {
        ...(dayOfWeek !== undefined && { dayOfWeek: Number(dayOfWeek) }),
        ...(startTime && { startTime }),
        ...(className && { className: className.trim() }),
        ...(coachName && { coachName: coachName.trim() }),
        ...(duration !== undefined && { duration: Number(duration) }),
        ...(isActive !== undefined && { isActive }),
        ...(gender !== undefined && { gender }),
      },
    })

    if (instructor) await setClassInstructor(prisma, id, instructor)
    else if (clearInstructor) await setClassInstructor(prisma, id, null)

    return NextResponse.json({ ...schedule, instructor })
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
