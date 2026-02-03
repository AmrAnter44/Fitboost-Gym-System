// app/api/groupClass/sessions/attendance/route.ts - تسجيل حضور GroupClass باستخدام Barcode
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requirePermission } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'


/**
 * POST - تسجيل حضور حصة GroupClass باستخدام Barcode/رقم GroupClass
 *
 * النظام:
 * - Barcode (رقم GroupClass) واحد لكل GroupClass subscription
 * - المدرب يمسح Barcode الخاص بالعميل أو يدخل رقم GroupClass
 * - النظام يبحث عن GroupClass بالـ Barcode
 * - ينشئ session جديدة ويخصم من الحصص المتبقية
 */
export async function POST(request: Request) {
  try {
    // التحقق من صلاحية تسجيل الحضور
    const user = await requirePermission(request, 'canRegisterGroupClassAttendance')

    const body = await request.json()
    const { qrCode, notes } = body

    console.log('📝 محاولة تسجيل حضور بـ Barcode:', { barcode: qrCode, userId: user.userId })

    // التحقق من وجود Barcode/رقم GroupClass
    if (!qrCode || typeof qrCode !== 'string') {
      return NextResponse.json(
        { error: 'رقم GroupClass أو Barcode مطلوب' },
        { status: 400 }
      )
    }

    // البحث عن GroupClass subscription بالـ Barcode (رقم GroupClass)
    const groupClass = await prisma.groupClass.findUnique({
      where: { qrCode: qrCode.trim() },
      include: {
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    if (!groupClass) {
      console.warn('⚠️ Barcode غير موجود في قاعدة البيانات')
      return NextResponse.json(
        { error: 'رقم GroupClass غير صحيح أو منتهي الصلاحية' },
        { status: 404 }
      )
    }

    // التحقق من أن المدرب هو المسؤول عن هذا الاشتراك
    if (user.role === 'COACH') {
      if (groupClass.instructorUserId !== user.userId) {
        return NextResponse.json(
          { error: 'ليس لديك صلاحية تسجيل حضور لهذا العميل. هذا العميل مع أخصائي جروب كلاسيس آخر.' },
          { status: 403 }
        )
      }
    }

    // التحقق من وجود حصص متبقية
    if (groupClass.sessionsRemaining <= 0) {
      return NextResponse.json(
        {
          error: 'لا توجد حصص متبقية لهذا العميل',
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
        notes: notes || null,
        attended: true,
        attendedAt: new Date(),
        attendedBy: user.name
      }
    })

    // تقليل عدد الحصص المتبقية
    await prisma.groupClass.update({
      where: { classNumber: groupClass.classNumber },
      data: { sessionsRemaining: groupClass.sessionsRemaining - 1 }
    })

    console.log(`✅ تم تسجيل حضور ${groupClass.clientName} بنجاح (الحصص المتبقية: ${groupClass.sessionsRemaining - 1})`)

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
        sessionsRemaining: groupClass.sessionsRemaining - 1 // القيمة الجديدة
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
        { error: 'ليس لديك صلاحية تسجيل حضور جروب كلاسيس' },
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
 * GET - التحقق من Barcode وعرض معلومات GroupClass
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
