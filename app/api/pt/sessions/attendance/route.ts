// app/api/pt/sessions/attendance/route.ts - تسجيل حضور PT باستخدام Barcode
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requirePermission } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'


/**
 * POST - تسجيل حضور حصة PT باستخدام Barcode/رقم PT
 *
 * النظام:
 * - Barcode (رقم PT) واحد لكل PT subscription
 * - الكوتش يمسح Barcode الخاص بالعميل أو يدخل رقم PT
 * - النظام يبحث عن PT بالـ Barcode
 * - ينشئ session جديدة ويخصم من الحصص المتبقية
 */
export async function POST(request: Request) {
  try {
    // التحقق من صلاحية تسجيل الحضور
    const user = await requirePermission(request, 'canRegisterPTAttendance')

    const body = await request.json()
    const { qrCode, notes } = body

    console.log('📝 محاولة تسجيل حضور بـ Barcode:', { barcode: qrCode, userId: user.userId })

    // التحقق من وجود Barcode/رقم PT
    if (!qrCode || typeof qrCode !== 'string') {
      return NextResponse.json(
        { error: 'رقم PT أو Barcode مطلوب' },
        { status: 400 }
      )
    }

    // البحث عن PT subscription بالـ Barcode (رقم PT)
    const pt = await prisma.pT.findUnique({
      where: { qrCode: qrCode.trim() },
      include: {
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    if (!pt) {
      console.warn('⚠️ Barcode غير موجود في قاعدة البيانات')
      return NextResponse.json(
        { error: 'رقم PT غير صحيح أو منتهي الصلاحية' },
        { status: 404 }
      )
    }

    // التحقق من أن الكوتش هو المسؤول عن هذا الاشتراك
    if (user.role === 'COACH') {
      if (pt.coachUserId !== user.userId) {
        return NextResponse.json(
          { error: 'ليس لديك صلاحية تسجيل حضور لهذا العميل. هذا العميل مع كوتش آخر.' },
          { status: 403 }
        )
      }
    }

    // التحقق من وجود حصص متبقية
    if (pt.sessionsRemaining <= 0) {
      return NextResponse.json(
        {
          error: 'لا توجد حصص متبقية لهذا العميل',
          pt: {
            ptNumber: pt.ptNumber,
            clientName: pt.clientName,
            sessionsRemaining: pt.sessionsRemaining,
            sessionsPurchased: pt.sessionsPurchased
          }
        },
        { status: 400 }
      )
    }

    // إنشاء session جديدة وتسجيل الحضور
    const session = await prisma.pTSession.create({
      data: {
        ptNumber: pt.ptNumber,
        clientName: pt.clientName,
        coachName: pt.coachName,
        sessionDate: new Date(), // تاريخ ووقت الحضور الفعلي
        notes: notes || null,
        attended: true,
        attendedAt: new Date(),
        attendedBy: user.name
      }
    })

    // تقليل عدد الحصص المتبقية
    await prisma.pT.update({
      where: { ptNumber: pt.ptNumber },
      data: { sessionsRemaining: pt.sessionsRemaining - 1 }
    })

    console.log(`✅ تم تسجيل حضور ${pt.clientName} بنجاح (الحصص المتبقية: ${pt.sessionsRemaining - 1})`)

    return NextResponse.json({
      success: true,
      message: 'تم تسجيل حضورك بنجاح',
      session: {
        id: session.id,
        ptNumber: session.ptNumber,
        clientName: session.clientName,
        coachName: session.coachName,
        sessionDate: session.sessionDate,
        attended: session.attended,
        attendedAt: session.attendedAt,
        attendedBy: session.attendedBy,
        sessionsRemaining: pt.sessionsRemaining - 1 // القيمة الجديدة
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
        { error: 'ليس لديك صلاحية تسجيل حضور PT' },
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
 * GET - التحقق من Barcode وعرض معلومات PT
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const qrCode = searchParams.get('qrCode')

    if (!qrCode) {
      return NextResponse.json(
        { error: 'رقم PT أو Barcode مطلوب' },
        { status: 400 }
      )
    }

    // البحث عن PT
    const pt = await prisma.pT.findUnique({
      where: { qrCode: qrCode.trim() }
    })

    if (!pt) {
      return NextResponse.json(
        { error: 'رقم PT غير صحيح' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      valid: true,
      pt: {
        ptNumber: pt.ptNumber,
        clientName: pt.clientName,
        coachName: pt.coachName,
        sessionsRemaining: pt.sessionsRemaining,
        sessionsPurchased: pt.sessionsPurchased,
        canCheckIn: pt.sessionsRemaining > 0
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
