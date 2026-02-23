import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

// GET - جلب سجلات حضور جلسات PT

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // التحقق من الصلاحيات - الكوتش والأدمن فقط
    const user = await requirePermission(request, 'canRegisterPTAttendance')

    const { searchParams } = new URL(request.url)
    const ptNumber = searchParams.get('ptNumber')

    if (ptNumber) {
      // التحقق من أن الكوتش يطلب بيانات عميل خاص به
      if (user.role === 'COACH') {
        const pt = await prisma.pT.findUnique({
          where: { ptNumber: parseInt(ptNumber) }
        })

        if (pt && pt.coachUserId !== user.userId) {
          return NextResponse.json(
            { error: 'ليس لديك صلاحية عرض سجلات هذا العميل' },
            { status: 403 }
          )
        }
      }

      // جلب سجلات جلسة PT معينة
      const sessions = await prisma.pTSession.findMany({
        where: { ptNumber: parseInt(ptNumber) },
        orderBy: { sessionDate: 'desc' },
        include: {
          pt: {
            select: {
              clientName: true,
              coachName: true,
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
            pt: {
              coachUserId: user.userId  // الكوتش يرى سجلات عملائه فقط
            }
          }
        : {}  // الأدمن يرى الكل

      // جلب جميع سجلات الحضور
      const sessions = await prisma.pTSession.findMany({
        where: whereClause,
        orderBy: { sessionDate: 'desc' },
        include: {
          pt: {
            select: {
              clientName: true,
              coachName: true,
              phone: true
            }
          }
        }
      })
      return NextResponse.json(sessions)
    }
  } catch (error: any) {
    console.error('Error fetching PT sessions:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية عرض سجلات PT' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل جلب سجلات الحضور' }, { status: 500 })
  }
}

// POST - تسجيل حضور جلسة PT
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { ptNumber, sessionDate, notes } = body


    // التحقق من وجود جلسة PT
    const pt = await prisma.pT.findUnique({
      where: { ptNumber: parseInt(ptNumber) }
    })

    if (!pt) {
      return NextResponse.json(
        { error: 'جلسة PT غير موجودة' },
        { status: 404 }
      )
    }

    // التحقق من وجود جلسات متبقية
    if (pt.sessionsRemaining <= 0) {
      return NextResponse.json(
        { error: 'لا توجد جلسات متبقية' },
        { status: 400 }
      )
    }

    // تسجيل جلسة جديدة مع الحضور
    const session = await prisma.pTSession.create({
      data: {
        ptNumber: parseInt(ptNumber),
        clientName: pt.clientName,
        coachName: pt.coachName,
        sessionDate: new Date(sessionDate),
        notes: notes || null,
        attended: true,
        attendedAt: new Date(),
        attendedBy: 'Staff Registration'
      }
    })

    // خصم جلسة من الجلسات المتبقية
    await prisma.pT.update({
      where: { ptNumber: parseInt(ptNumber) },
      data: { sessionsRemaining: pt.sessionsRemaining - 1 }
    })


    return NextResponse.json({
      ...session,
      sessionsRemaining: pt.sessionsRemaining - 1
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
    const session = await prisma.pTSession.findUnique({
      where: { id: sessionId }
    })

    if (!session) {
      return NextResponse.json({ error: 'الجلسة غير موجودة' }, { status: 404 })
    }

    // حذف السجل
    await prisma.pTSession.delete({
      where: { id: sessionId }
    })

    // إعادة الجلسة للعداد
    const pt = await prisma.pT.findUnique({
      where: { ptNumber: session.ptNumber }
    })

    if (pt) {
      await prisma.pT.update({
        where: { ptNumber: session.ptNumber },
        data: { sessionsRemaining: pt.sessionsRemaining + 1 }
      })
    }

    return NextResponse.json({ message: 'تم حذف السجل بنجاح' })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json({ error: 'فشل حذف السجل' }, { status: 500 })
  }
}