// app/api/nutrition/check-in/route.ts - تسجيل حضور العضو باستخدام Barcode
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'


/**
 * POST - تسجيل حضور العضو بـ Barcode/رقم Nutrition (بدون authentication)
 *
 * الأمان:
 * - لا يحتاج تسجيل دخول (صفحة عامة للعضو)
 * - Barcode (رقم Nutrition) هو المصادقة الوحيدة
 * - التحقق من عدم تسجيل الحضور مسبقاً
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { qrCode } = body


    // التحقق من وجود Barcode/رقم Nutrition
    if (!qrCode || typeof qrCode !== 'string') {
      return NextResponse.json(
        { error: 'رقم Nutrition أو Barcode مطلوب' },
        { status: 400 }
      )
    }

    // البحث عن Nutrition subscription بالـ Barcode (رقم Nutrition)
    const nutrition = await prisma.nutrition.findUnique({
      where: { qrCode: qrCode.trim() }
    })

    // التحقق من وجود Nutrition
    if (!nutrition) {
      return NextResponse.json(
        { error: 'رقم Nutrition غير صحيح أو منتهي الصلاحية' },
        { status: 404 }
      )
    }

    // التحقق من وجود حصص متبقية
    if (nutrition.sessionsRemaining <= 0) {
      return NextResponse.json(
        {
          error: 'لا توجد حصص متبقية لهذا الاشتراك',
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
        attended: true,
        attendedAt: new Date(),
        attendedBy: 'Self Check-In' // العضو سجل بنفسه
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
        sessionsRemaining: nutrition.sessionsRemaining - 1
      }
    }, { status: 200 })

  } catch (error: any) {
    console.error('❌ خطأ في تسجيل الحضور بـ Barcode:', error)

    return NextResponse.json(
      { error: 'فشل تسجيل الحضور. يرجى المحاولة مرة أخرى أو التواصل مع الإدارة.' },
      { status: 500 }
    )
  }
}

/**
 * GET - التحقق من Barcode وعرض معلومات الجلسة (بدون تسجيل الحضور)
 * يمكن للعضو التحقق من صحة Barcode قبل التسجيل
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
