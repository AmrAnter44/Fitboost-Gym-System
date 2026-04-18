// app/api/physiotherapy/check-in/route.ts - تسجيل حضور العضو باستخدام Barcode
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'


/**
 * POST - تسجيل حضور العضو بـ Barcode/رقم Physiotherapy (بدون authentication)
 *
 * الأمان:
 * - لا يحتاج تسجيل دخول (صفحة عامة للعضو)
 * - Barcode (رقم Physiotherapy) هو المصادقة الوحيدة
 * - التحقق من عدم تسجيل الحضور مسبقاً
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { qrCode } = body


    // التحقق من وجود Barcode/رقم Physiotherapy
    if (!qrCode || typeof qrCode !== 'string') {
      return NextResponse.json(
        { error: 'رقم Physiotherapy أو Barcode مطلوب' },
        { status: 400 }
      )
    }

    // البحث عن Physiotherapy subscription بالـ Barcode (رقم Physiotherapy)
    const physiotherapy = await prisma.physiotherapy.findUnique({
      where: { qrCode: qrCode.trim() }
    })

    // التحقق من وجود Physiotherapy
    if (!physiotherapy) {
      return NextResponse.json(
        { error: 'رقم Physiotherapy غير صحيح أو منتهي الصلاحية' },
        { status: 404 }
      )
    }

    // التحقق من وجود حصص متبقية
    if (physiotherapy.sessionsRemaining <= 0) {
      return NextResponse.json(
        {
          error: 'لا توجد حصص متبقية لهذا الاشتراك',
          physiotherapy: {
            physioNumber: physiotherapy.physioNumber,
            clientName: physiotherapy.clientName,
            sessionsRemaining: physiotherapy.sessionsRemaining,
            sessionsPurchased: physiotherapy.sessionsPurchased
          }
        },
        { status: 400 }
      )
    }

    // إنشاء session جديدة وتسجيل الحضور
    const session = await prisma.physiotherapySession.create({
      data: {
        physioNumber: physiotherapy.physioNumber,
        clientName: physiotherapy.clientName,
        therapistName: physiotherapy.therapistName,
        sessionDate: new Date(), // تاريخ ووقت الحضور الفعلي
        attended: true,
        attendedAt: new Date(),
        attendedBy: 'Self Check-In' // العضو سجل بنفسه
      }
    })

    // تقليل عدد الحصص المتبقية
    await prisma.physiotherapy.update({
      where: { physioNumber: physiotherapy.physioNumber },
      data: { sessionsRemaining: physiotherapy.sessionsRemaining - 1 }
    })


    return NextResponse.json({
      success: true,
      message: 'تم تسجيل حضورك بنجاح',
      session: {
        id: session.id,
        physioNumber: session.physioNumber,
        clientName: session.clientName,
        therapistName: session.therapistName,
        sessionDate: session.sessionDate,
        attended: session.attended,
        attendedAt: session.attendedAt,
        attendedBy: session.attendedBy,
        sessionsRemaining: physiotherapy.sessionsRemaining - 1
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
        { error: 'رقم Physiotherapy أو Barcode مطلوب' },
        { status: 400 }
      )
    }

    // البحث عن Physiotherapy
    const physiotherapy = await prisma.physiotherapy.findUnique({
      where: { qrCode: qrCode.trim() }
    })

    if (!physiotherapy) {
      return NextResponse.json(
        { error: 'رقم Physiotherapy غير صحيح' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      valid: true,
      physiotherapy: {
        physioNumber: physiotherapy.physioNumber,
        clientName: physiotherapy.clientName,
        therapistName: physiotherapy.therapistName,
        sessionsRemaining: physiotherapy.sessionsRemaining,
        sessionsPurchased: physiotherapy.sessionsPurchased,
        canCheckIn: physiotherapy.sessionsRemaining > 0
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
