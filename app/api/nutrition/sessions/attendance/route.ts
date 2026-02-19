// app/api/nutrition/sessions/attendance/route.ts - تسجيل حضور Nutrition باستخدام Barcode
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requirePermission } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'


/**
 * POST - تسجيل حضور حصة Nutrition باستخدام Barcode/رقم Nutrition
 *
 * النظام:
 * - Barcode (رقم Nutrition) واحد لكل Nutrition subscription
 * - أخصائي التغذية يمسح Barcode الخاص بالعميل أو يدخل رقم Nutrition
 * - النظام يبحث عن Nutrition بالـ Barcode
 * - ينشئ session جديدة ويخصم من الحصص المتبقية
 */
export async function POST(request: Request) {
  try {
    // التحقق من صلاحية تسجيل الحضور
    const user = await requirePermission(request, 'canRegisterNutritionAttendance')

    const body = await request.json()
    const { qrCode, notes } = body


    // التحقق من وجود Barcode/رقم Nutrition
    if (!qrCode || typeof qrCode !== 'string') {
      return NextResponse.json(
        { error: 'رقم Nutrition أو Barcode مطلوب' },
        { status: 400 }
      )
    }

    // البحث عن Nutrition subscription بالـ Barcode (رقم Nutrition)
    const nutrition = await prisma.nutrition.findUnique({
      where: { qrCode: qrCode.trim() },
      include: {
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    if (!nutrition) {
      console.warn('⚠️ Barcode غير موجود في قاعدة البيانات')
      return NextResponse.json(
        { error: 'رقم Nutrition غير صحيح أو منتهي الصلاحية' },
        { status: 404 }
      )
    }

    // التحقق من أن أخصائي التغذية هو المسؤول عن هذا الاشتراك
    if (user.role === 'COACH') {
      if (nutrition.coachUserId !== user.userId) {
        return NextResponse.json(
          { error: 'ليس لديك صلاحية تسجيل حضور لهذا العميل. هذا العميل مع أخصائي تغذية آخر.' },
          { status: 403 }
        )
      }
    }

    // التحقق من وجود حصص متبقية
    if (nutrition.sessionsRemaining <= 0) {
      return NextResponse.json(
        {
          error: 'لا توجد حصص متبقية لهذا العميل',
          nutrition: {
            nutritionNumber: nutrition.nutritionNumber,
            clientName: nutrition.clientName,
            sessionsRemaining: nutrition.sessionsRemaining,
            sessionsPurchased: nutrition.sessionsPurchased
          }
        },
        { status: 400 }
      )
    }

    // إنشاء session جديدة وتسجيل الحضور
    const session = await prisma.nutritionSession.create({
      data: {
        nutritionNumber: nutrition.nutritionNumber,
        clientName: nutrition.clientName,
        nutritionistName: nutrition.nutritionistName,
        sessionDate: new Date(), // تاريخ ووقت الحضور الفعلي
        notes: notes || null,
        attended: true,
        attendedAt: new Date(),
        attendedBy: user.name
      }
    })

    // تقليل عدد الحصص المتبقية
    await prisma.nutrition.update({
      where: { nutritionNumber: nutrition.nutritionNumber },
      data: { sessionsRemaining: nutrition.sessionsRemaining - 1 }
    })


    return NextResponse.json({
      success: true,
      message: 'تم تسجيل حضورك بنجاح',
      session: {
        id: session.id,
        nutritionNumber: session.nutritionNumber,
        clientName: session.clientName,
        nutritionistName: session.nutritionistName,
        sessionDate: session.sessionDate,
        attended: session.attended,
        attendedAt: session.attendedAt,
        attendedBy: session.attendedBy,
        sessionsRemaining: nutrition.sessionsRemaining - 1 // القيمة الجديدة
      }
    }, { status: 200 })

  } catch (error: any) {
    console.error('❌ خطأ في تسجيل الحضور بـ Barcode:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تسجيل حضور التغذية' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل تسجيل الحضور. يرجى المحاولة مرة أخرى.' },
      { status: 500 }
    )
  }
}

/**
 * GET - التحقق من Barcode وعرض معلومات Nutrition
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const qrCode = searchParams.get('qrCode')

    if (!qrCode) {
      return NextResponse.json(
        { error: 'رقم Nutrition أو Barcode مطلوب' },
        { status: 400 }
      )
    }

    // البحث عن Nutrition
    const nutrition = await prisma.nutrition.findUnique({
      where: { qrCode: qrCode.trim() }
    })

    if (!nutrition) {
      return NextResponse.json(
        { error: 'رقم Nutrition غير صحيح' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      valid: true,
      nutrition: {
        nutritionNumber: nutrition.nutritionNumber,
        clientName: nutrition.clientName,
        nutritionistName: nutrition.nutritionistName,
        sessionsRemaining: nutrition.sessionsRemaining,
        sessionsPurchased: nutrition.sessionsPurchased,
        canCheckIn: nutrition.sessionsRemaining > 0
      }
    }, { status: 200 })

  } catch (error) {
    console.error('❌ خطأ في التحقق من Barcode:', error)
    return NextResponse.json(
      { error: 'فشل التحقق من Barcode' },
      { status: 500 }
    )
  }
}
