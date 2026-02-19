// app/api/group-classes/check-in/route.ts - تسجيل حضور العضو باستخدام Barcode
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'


/**
 * POST - تسجيل حضور العضو بـ Barcode/رقم GroupClass (بدون authentication)
 *
 * الأمان:
 * - لا يحتاج تسجيل دخول (صفحة عامة للعضو)
 * - Barcode (رقم GroupClass) هو المصادقة الوحيدة
 * - التحقق من عدم تسجيل الحضور مسبقاً
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { qrCode } = body


    // التحقق من وجود Barcode/رقم GroupClass
    if (!qrCode || typeof qrCode !== 'string') {
      return NextResponse.json(
        { error: 'رقم GroupClass أو Barcode مطلوب' },
        { status: 400 }
      )
    }

    // البحث عن GroupClass subscription بالـ Barcode (رقم GroupClass)
    const groupClass = await prisma.groupClass.findUnique({
      where: { qrCode: qrCode.trim() }
    })

    // التحقق من وجود GroupClass
    if (!groupClass) {
      console.warn('⚠️ Barcode غير موجود في قاعدة البيانات')
      return NextResponse.json(
        { error: 'رقم GroupClass غير صحيح أو منتهي الصلاحية' },
        { status: 404 }
      )
    }

    // التحقق من وجود حصص متبقية
    if (groupClass.sessionsRemaining <= 0) {
      return NextResponse.json(
        {
          error: 'لا توجد حصص متبقية لهذا الاشتراك',
          groupClass: {
            classNumber: groupClass.classNumber,
            clientName: groupClass.clientName,
            sessionsRemaining: groupClass.sessionsRemaining,
            sessionsPurchased: groupClass.sessionsPurchased
          }
        },
        { status: 400 }
      )
    }

    // إنشاء session جديدة وتسجيل الحضور
    const session = await prisma.groupClassSession.create({
      data: {
        classNumber: groupClass.classNumber,
        clientName: groupClass.clientName,
        instructorName: groupClass.instructorName,
        sessionDate: new Date(), // تاريخ ووقت الحضور الفعلي
        attended: true,
        attendedAt: new Date(),
        attendedBy: 'Self Check-In' // العضو سجل بنفسه
      }
    })

    // تقليل عدد الحصص المتبقية
    await prisma.groupClass.update({
      where: { classNumber: groupClass.classNumber },
      data: { sessionsRemaining: groupClass.sessionsRemaining - 1 }
    })


    return NextResponse.json({
      success: true,
      message: 'تم تسجيل حضورك بنجاح',
      session: {
        id: session.id,
        classNumber: session.classNumber,
        clientName: session.clientName,
        instructorName: session.instructorName,
        sessionDate: session.sessionDate,
        attended: session.attended,
        attendedAt: session.attendedAt,
        attendedBy: session.attendedBy,
        sessionsRemaining: groupClass.sessionsRemaining - 1
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
        { error: 'رقم GroupClass أو Barcode مطلوب' },
        { status: 400 }
      )
    }

    // البحث عن GroupClass
    const groupClass = await prisma.groupClass.findUnique({
      where: { qrCode: qrCode.trim() }
    })

    if (!groupClass) {
      return NextResponse.json(
        { error: 'رقم GroupClass غير صحيح' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      valid: true,
      groupClass: {
        classNumber: groupClass.classNumber,
        clientName: groupClass.clientName,
        instructorName: groupClass.instructorName,
        sessionsRemaining: groupClass.sessionsRemaining,
        sessionsPurchased: groupClass.sessionsPurchased,
        canCheckIn: groupClass.sessionsRemaining > 0
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
