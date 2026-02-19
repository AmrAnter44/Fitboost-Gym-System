import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

// GET - جلب سجلات حضور جلسات GroupClass

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // التحقق من الصلاحيات - المدرب والأدمن فقط
    const user = await requirePermission(request, 'canRegisterClassAttendance')

    const { searchParams } = new URL(request.url)
    const groupClassNumber = searchParams.get('groupClassNumber')

    if (groupClassNumber) {
      // التحقق من أن المدرب يطلب بيانات عميل خاص به
      if (user.role === 'COACH') {
        const groupClass = await prisma.groupClass.findUnique({
          where: { classNumber: parseInt(groupClassNumber) }
        })

        if (groupClass && groupClass.instructorUserId !== user.userId) {
          return NextResponse.json(
            { error: 'ليس لديك صلاحية عرض سجلات هذا العميل' },
            { status: 403 }
          )
        }
      }

      // جلب سجلات جلسة GroupClass معينة
      const sessions = await prisma.groupClassSession.findMany({
        where: { classNumber: parseInt(groupClassNumber) },
        orderBy: { sessionDate: 'desc' },
        include: {
          groupClass: {
            select: {
              clientName: true,
              instructorName: true,
              phone: true
            }
          }
        }
      })
      return NextResponse.json(sessions)
    } else {
      // فلترة حسب الدور
      const whereClause = user.role === 'COACH'
        ? {
            groupClass: {
              instructorUserId: user.userId  // المدرب يرى سجلات عملائه فقط
            }
          }
        : {}  // الأدمن يرى الكل

      // جلب جميع سجلات الحضور
      const sessions = await prisma.groupClassSession.findMany({
        where: whereClause,
        orderBy: { sessionDate: 'desc' },
        include: {
          groupClass: {
            select: {
              clientName: true,
              instructorName: true,
              phone: true
            }
          }
        }
      })
      return NextResponse.json(sessions)
    }
  } catch (error: any) {
    console.error('Error fetching GroupClass sessions:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية عرض سجلات جروب كلاسيس' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل جلب سجلات الحضور' }, { status: 500 })
  }
}

// POST - تسجيل حضور جلسة جروب كلاسيس
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { groupClassNumber, sessionDate, notes } = body


    // التحقق من وجود جلسة GroupClass
    const groupClass = await prisma.groupClass.findUnique({
      where: { classNumber: parseInt(groupClassNumber) }
    })

    if (!groupClass) {
      return NextResponse.json(
        { error: 'جلسة GroupClass غير موجودة' },
        { status: 404 }
      )
    }

    // التحقق من وجود جلسات متبقية
    if (groupClass.sessionsRemaining <= 0) {
      return NextResponse.json(
        { error: 'لا توجد جلسات متبقية' },
        { status: 400 }
      )
    }

    // تسجيل جلسة جديدة (بدون حضور)
    const session = await prisma.groupClassSession.create({
      data: {
        classNumber: parseInt(groupClassNumber),
        clientName: groupClass.clientName,
        instructorName: groupClass.instructorName,
        sessionDate: new Date(sessionDate),
        notes: notes || null,
        attended: false
      }
    })

    // خصم جلسة من الجلسات المتبقية
    await prisma.groupClass.update({
      where: { classNumber: parseInt(groupClassNumber) },
      data: { sessionsRemaining: groupClass.sessionsRemaining - 1 }
    })


    return NextResponse.json({
      ...session,
      sessionsRemaining: groupClass.sessionsRemaining - 1
    }, { status: 201 })
  } catch (error) {
    console.error('❌ خطأ في تسجيل حضور الجلسة:', error)
    return NextResponse.json({ error: 'فشل تسجيل حضور الجلسة' }, { status: 500 })
  }
}

// DELETE - حذف سجل حضور
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'معرف الجلسة مطلوب' }, { status: 400 })
    }

    // جلب بيانات الجلسة قبل الحذف
    const session = await prisma.groupClassSession.findUnique({
      where: { id: sessionId }
    })

    if (!session) {
      return NextResponse.json({ error: 'الجلسة غير موجودة' }, { status: 404 })
    }

    // حذف السجل
    await prisma.groupClassSession.delete({
      where: { id: sessionId }
    })

    // إعادة الجلسة للعداد
    const groupClass = await prisma.groupClass.findUnique({
      where: { classNumber: session.classNumber }
    })

    if (groupClass) {
      await prisma.groupClass.update({
        where: { classNumber: session.classNumber },
        data: { sessionsRemaining: groupClass.sessionsRemaining + 1 }
      })
    }

    return NextResponse.json({ message: 'تم حذف السجل بنجاح' })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json({ error: 'فشل حذف السجل' }, { status: 500 })
  }
}
