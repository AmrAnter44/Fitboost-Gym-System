import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

// GET - جلب سجلات حضور جلسات Physiotherapy

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // التحقق من الصلاحيات - أخصائي العلاج الطبيعي والأدمن فقط
    const user = await requirePermission(request, 'canRegisterPhysiotherapyAttendance')

    const { searchParams } = new URL(request.url)
    const physioNumber = searchParams.get('physioNumber')

    if (physioNumber) {
      // التحقق من أن أخصائي العلاج الطبيعي يطلب بيانات عميل خاص به
      if (user.role === 'COACH') {
        const physiotherapy = await prisma.physiotherapy.findUnique({
          where: { physioNumber: parseInt(physioNumber) }
        })

        if (physiotherapy && physiotherapy.therapistUserId !== user.userId) {
          return NextResponse.json(
            { error: 'ليس لديك صلاحية عرض سجلات هذا العميل' },
            { status: 403 }
          )
        }
      }

      // جلب سجلات جلسة Physiotherapy معينة
      const sessions = await prisma.physiotherapySession.findMany({
        where: { physioNumber: parseInt(physioNumber) },
        orderBy: { sessionDate: 'desc' },
        include: {
          physiotherapy: {
            select: {
              clientName: true,
              therapistName: true,
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
            physiotherapy: {
              therapistUserId: user.userId  // أخصائي العلاج الطبيعي يرى سجلات عملائه فقط
            }
          }
        : {}  // الأدمن يرى الكل

      // جلب جميع سجلات الحضور
      const sessions = await prisma.physiotherapySession.findMany({
        where: whereClause,
        orderBy: { sessionDate: 'desc' },
        include: {
          physiotherapy: {
            select: {
              clientName: true,
              therapistName: true,
              phone: true
            }
          }
        }
      })
      return NextResponse.json(sessions)
    }
  } catch (error: any) {
    console.error('Error fetching Physiotherapy sessions:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية عرض سجلات العلاج الطبيعي' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل جلب سجلات الحضور' }, { status: 500 })
  }
}

// POST - تسجيل حضور جلسة علاج طبيعي
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { physioNumber, sessionDate, notes } = body

    console.log('📝 تسجيل حضور جلسة علاج طبيعي:', { physioNumber, sessionDate })

    // التحقق من وجود جلسة Physiotherapy
    const physiotherapy = await prisma.physiotherapy.findUnique({
      where: { physioNumber: parseInt(physioNumber) }
    })

    if (!physiotherapy) {
      return NextResponse.json(
        { error: 'جلسة Physiotherapy غير موجودة' },
        { status: 404 }
      )
    }

    // التحقق من وجود جلسات متبقية
    if (physiotherapy.sessionsRemaining <= 0) {
      return NextResponse.json(
        { error: 'لا توجد جلسات متبقية' },
        { status: 400 }
      )
    }

    // تسجيل جلسة جديدة (بدون حضور)
    const session = await prisma.physiotherapySession.create({
      data: {
        physioNumber: parseInt(physioNumber),
        clientName: physiotherapy.clientName,
        therapistName: physiotherapy.therapistName,
        sessionDate: new Date(sessionDate),
        notes: notes || null,
        attended: false
      }
    })

    // خصم جلسة من الجلسات المتبقية
    await prisma.physiotherapy.update({
      where: { physioNumber: parseInt(physioNumber) },
      data: { sessionsRemaining: physiotherapy.sessionsRemaining - 1 }
    })

    console.log(`✅ تم تسجيل الجلسة بنجاح (الحصص المتبقية: ${physiotherapy.sessionsRemaining - 1})`)

    return NextResponse.json({
      ...session,
      sessionsRemaining: physiotherapy.sessionsRemaining - 1
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
    const session = await prisma.physiotherapySession.findUnique({
      where: { id: sessionId }
    })

    if (!session) {
      return NextResponse.json({ error: 'الجلسة غير موجودة' }, { status: 404 })
    }

    // حذف السجل
    await prisma.physiotherapySession.delete({
      where: { id: sessionId }
    })

    // إعادة الجلسة للعداد
    const physiotherapy = await prisma.physiotherapy.findUnique({
      where: { physioNumber: session.physioNumber }
    })

    if (physiotherapy) {
      await prisma.physiotherapy.update({
        where: { physioNumber: session.physioNumber },
        data: { sessionsRemaining: physiotherapy.sessionsRemaining + 1 }
      })
    }

    return NextResponse.json({ message: 'تم حذف السجل بنجاح' })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json({ error: 'فشل حذف السجل' }, { status: 500 })
  }
}
