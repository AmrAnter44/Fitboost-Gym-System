// app/api/physiotherapy/sessions/attendance/route.ts - تسجيل حضور Physiotherapy باستخدام Barcode
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requirePermission } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'


/**
 * POST - تسجيل حضور حصة Physiotherapy باستخدام Barcode/رقم Physiotherapy
 *
 * النظام:
 * - Barcode (رقم Physiotherapy) واحد لكل Physiotherapy subscription
 * - أخصائي العلاج الطبيعي يمسح Barcode الخاص بالعميل أو يدخل رقم Physiotherapy
 * - النظام يبحث عن Physiotherapy بالـ Barcode
 * - ينشئ session جديدة ويخصم من الحصص المتبقية
 */
export async function POST(request: Request) {
  try {
    // التحقق من صلاحية تسجيل الحضور
    const user = await requirePermission(request, 'canRegisterPhysioAttendance')

    const body = await request.json()
    const { qrCode, notes } = body

    console.log('📝 محاولة تسجيل حضور بـ Barcode:', { barcode: qrCode, userId: user.userId })

    // التحقق من وجود Barcode/رقم Physiotherapy
    if (!qrCode || typeof qrCode !== 'string') {
      return NextResponse.json(
        { error: 'رقم Physiotherapy أو Barcode مطلوب' },
        { status: 400 }
      )
    }

    // البحث عن Physiotherapy subscription بالـ Barcode (رقم Physiotherapy)
    const physiotherapy = await prisma.physiotherapy.findUnique({
      where: { qrCode: qrCode.trim() },
      include: {
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    if (!physiotherapy) {
      console.warn('⚠️ Barcode غير موجود في قاعدة البيانات')
      return NextResponse.json(
        { error: 'رقم Physiotherapy غير صحيح أو منتهي الصلاحية' },
        { status: 404 }
      )
    }

    // التحقق من أن أخصائي العلاج الطبيعي هو المسؤول عن هذا الاشتراك
    if (user.role === 'COACH') {
      if (physiotherapy.therapistUserId !== user.userId) {
        return NextResponse.json(
          { error: 'ليس لديك صلاحية تسجيل حضور لهذا العميل. هذا العميل مع أخصائي علاج طبيعي آخر.' },
          { status: 403 }
        )
      }
    }

    // التحقق من وجود حصص متبقية
    if (physiotherapy.sessionsRemaining <= 0) {
      return NextResponse.json(
        {
          error: 'لا توجد حصص متبقية لهذا العميل',
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
        notes: notes || null,
        attended: true,
        attendedAt: new Date(),
        attendedBy: user.name
      }
    })

    // تقليل عدد الحصص المتبقية
    await prisma.physiotherapy.update({
      where: { physioNumber: physiotherapy.physioNumber },
      data: { sessionsRemaining: physiotherapy.sessionsRemaining - 1 }
    })

    console.log(`✅ تم تسجيل حضور ${physiotherapy.clientName} بنجاح (الحصص المتبقية: ${physiotherapy.sessionsRemaining - 1})`)

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
        sessionsRemaining: physiotherapy.sessionsRemaining - 1 // القيمة الجديدة
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
        { error: 'ليس لديك صلاحية تسجيل حضور العلاج الطبيعي' },
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
 * GET - التحقق من Barcode وعرض معلومات Physiotherapy
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
