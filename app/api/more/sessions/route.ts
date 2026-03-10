import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

// GET - جلب سجل الحضور
export async function GET(request: Request) {
  try {
    const user = await requirePermission(request, 'canViewMore')
    const { searchParams } = new URL(request.url)
    const moreNumber = searchParams.get('moreNumber')

    let whereClause: any = {}

    if (moreNumber) {
      whereClause.moreNumber = parseInt(moreNumber)
    }

    // فلترة للكوتش - يرى جلسات عملائه فقط
    if (user.role === 'COACH') {
      const coachStaff = await prisma.staff.findFirst({
        where: {
          user: {
            id: user.userId
          }
        }
      })

      if (coachStaff) {
        whereClause.coachName = coachStaff.name
      }
    }

    const sessions = await prisma.moreSession.findMany({
      where: whereClause,
      orderBy: { sessionDate: 'desc' },
      include: {
        more: {
          select: {
            moreNumber: true,
            clientName: true,
            phone: true,
            coachName: true
          }
        }
      }
    })

    return NextResponse.json(sessions)
  } catch (error: any) {
    console.error('Error fetching More sessions:', error)
    return NextResponse.json(
      { error: 'فشل جلب سجل الحضور' },
      { status: 500 }
    )
  }
}

// POST - تسجيل حضور جلسة
export async function POST(request: Request) {
  try {
    const user = await requirePermission(request, 'canRegisterMoreAttendance')
    const body = await request.json()
    const { moreNumber, notes } = body

    if (!moreNumber) {
      return NextResponse.json(
        { error: 'رقم الاشتراك مطلوب' },
        { status: 400 }
      )
    }

    // جلب بيانات More
    const more = await prisma.more.findUnique({
      where: { moreNumber: parseInt(moreNumber) }
    })

    if (!more) {
      return NextResponse.json(
        { error: 'الاشتراك غير موجود' },
        { status: 404 }
      )
    }

    // التحقق من الصلاحية للكوتش
    if (user.role === 'COACH' && more.coachUserId !== user.userId) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تسجيل حضور لهذا الاشتراك' },
        { status: 403 }
      )
    }

    // التحقق من الجلسات المتبقية
    if (more.sessionsRemaining <= 0) {
      return NextResponse.json(
        { error: 'لا توجد جلسات متبقية' },
        { status: 400 }
      )
    }

    // التحقق من حالة الاشتراك
    if (!more.isActive) {
      return NextResponse.json(
        { error: 'الاشتراك غير نشط' },
        { status: 400 }
      )
    }

    // التحقق من تاريخ الانتهاء
    if (new Date() > new Date(more.expiryDate)) {
      return NextResponse.json(
        { error: 'الاشتراك منتهي' },
        { status: 400 }
      )
    }

    // إنشاء جلسة + تقليل الجلسات المتبقية
    const result = await prisma.$transaction(async (tx) => {
      // إنشاء سجل الحضور
      const session = await tx.moreSession.create({
        data: {
          moreNumber: parseInt(moreNumber),
          clientName: more.clientName,
          coachName: more.coachName,
          sessionDate: new Date(),
          attended: true,
          attendedAt: new Date(),
          attendedBy: user.name || user.email,
          notes: notes || null,
          isFreeSession: false
        }
      })

      // تقليل الجلسات المتبقية
      const updatedMore = await tx.more.update({
        where: { moreNumber: parseInt(moreNumber) },
        data: {
          sessionsRemaining: {
            decrement: 1
          }
        }
      })

      return { session, updatedMore }
    }, {
      maxWait: 60000,  // 60 ثانية
      timeout: 60000,  // 60 ثانية
    })

    // ✅ Audit log خارج Transaction (غير حرج)
    createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action: 'CREATE',
      resource: 'More',
      resourceId: result.session.id,
      details: {
        moreNumber,
        clientName: more.clientName,
        coachName: more.coachName,
        sessionsRemaining: result.updatedMore.sessionsRemaining
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
      status: 'success'
    }).catch(err => console.error('⚠️ فشل Audit Log:', err))

    return NextResponse.json({
      message: 'تم تسجيل الحضور بنجاح',
      session: result.session,
      sessionsRemaining: result.updatedMore.sessionsRemaining
    })
  } catch (error: any) {
    console.error('Error registering More session:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تسجيل الحضور' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل تسجيل الحضور' },
      { status: 500 }
    )
  }
}
