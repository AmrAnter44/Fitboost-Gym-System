import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

// GET - جلب سجلات حضور جلسات Nutrition

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // التحقق من الصلاحيات - أخصائي التغذية والأدمن فقط
    const user = await requirePermission(request, 'canRegisterNutritionAttendance')

    const { searchParams } = new URL(request.url)
    const nutritionNumber = searchParams.get('nutritionNumber')

    if (nutritionNumber) {
      // التحقق من أن أخصائي التغذية يطلب بيانات عميل خاص به
      if (user.role === 'COACH') {
        const nutrition = await prisma.nutrition.findUnique({
          where: { nutritionNumber: parseInt(nutritionNumber) }
        })

        if (nutrition && nutrition.coachUserId !== user.userId) {
          return NextResponse.json(
            { error: 'ليس لديك صلاحية عرض سجلات هذا العميل' },
            { status: 403 }
          )
        }
      }

      // جلب سجلات جلسة Nutrition معينة
      const sessions = await prisma.nutritionSession.findMany({
        where: { nutritionNumber: parseInt(nutritionNumber) },
        orderBy: { sessionDate: 'desc' },
        include: {
          nutrition: {
            select: {
              clientName: true,
              nutritionistName: true,
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
            nutrition: {
              coachUserId: user.userId  // أخصائي التغذية يرى سجلات عملائه فقط
            }
          }
        : {}  // الأدمن يرى الكل

      // جلب جميع سجلات الحضور
      const sessions = await prisma.nutritionSession.findMany({
        where: whereClause,
        orderBy: { sessionDate: 'desc' },
        include: {
          nutrition: {
            select: {
              clientName: true,
              nutritionistName: true,
              phone: true
            }
          }
        }
      })
      return NextResponse.json(sessions)
    }
  } catch (error: any) {
    console.error('Error fetching Nutrition sessions:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية عرض سجلات التغذية' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل جلب سجلات الحضور' }, { status: 500 })
  }
}

// POST - تسجيل حضور جلسة تغذية
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nutritionNumber, sessionDate, notes } = body


    // التحقق من وجود جلسة Nutrition
    const nutrition = await prisma.nutrition.findUnique({
      where: { nutritionNumber: parseInt(nutritionNumber) }
    })

    if (!nutrition) {
      return NextResponse.json(
        { error: 'جلسة Nutrition غير موجودة' },
        { status: 404 }
      )
    }

    // التحقق من وجود جلسات متبقية
    if (nutrition.sessionsRemaining <= 0) {
      return NextResponse.json(
        { error: 'لا توجد جلسات متبقية' },
        { status: 400 }
      )
    }

    // تسجيل جلسة جديدة (بدون حضور)
    const session = await prisma.nutritionSession.create({
      data: {
        nutritionNumber: parseInt(nutritionNumber),
        clientName: nutrition.clientName,
        nutritionistName: nutrition.nutritionistName,
        sessionDate: new Date(sessionDate),
        notes: notes || null,
        attended: false
      }
    })

    // خصم جلسة من الجلسات المتبقية
    await prisma.nutrition.update({
      where: { nutritionNumber: parseInt(nutritionNumber) },
      data: { sessionsRemaining: nutrition.sessionsRemaining - 1 }
    })


    return NextResponse.json({
      ...session,
      sessionsRemaining: nutrition.sessionsRemaining - 1
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
    const session = await prisma.nutritionSession.findUnique({
      where: { id: sessionId }
    })

    if (!session) {
      return NextResponse.json({ error: 'الجلسة غير موجودة' }, { status: 404 })
    }

    // حذف السجل
    await prisma.nutritionSession.delete({
      where: { id: sessionId }
    })

    // إعادة الجلسة للعداد
    const nutrition = await prisma.nutrition.findUnique({
      where: { nutritionNumber: session.nutritionNumber }
    })

    if (nutrition) {
      await prisma.nutrition.update({
        where: { nutritionNumber: session.nutritionNumber },
        data: { sessionsRemaining: nutrition.sessionsRemaining + 1 }
      })
    }

    return NextResponse.json({ message: 'تم حذف السجل بنجاح' })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json({ error: 'فشل حذف السجل' }, { status: 500 })
  }
}
