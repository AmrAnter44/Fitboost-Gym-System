import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { addPoints } from '../../../lib/points'

// POST: تسجيل دخول عضو

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { memberId, method = 'scan' } = await request.json()

    if (!memberId) {
      return NextResponse.json(
        { error: 'يجب توفير رقم العضو' },
        { status: 400 }
      )
    }

    // التحقق من وجود العضو وأن اشتراكه نشط
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    })

    if (!member) {
      return NextResponse.json(
        { error: 'العضو غير موجود' },
        { status: 404 }
      )
    }

    if (!member.isActive) {
      return NextResponse.json(
        { error: 'اشتراك العضو منتهي' },
        { status: 400 }
      )
    }

    // التحقق من أن العضو غير مجمد
    if (member.isFrozen) {
      return NextResponse.json(
        { error: 'الاشتراك مجمد حالياً ❄️' },
        { status: 400 }
      )
    }

    // التحقق من أن العضو لم يسجل حضوره اليوم
    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    const endOfToday = new Date(now)
    endOfToday.setHours(23, 59, 59, 999)

    const todayCheckIn = await prisma.memberCheckIn.findFirst({
      where: {
        memberId,
        checkInTime: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    })

    if (todayCheckIn) {
      return NextResponse.json(
        {
          error: 'تم تسجيل الحضور مسبقاً اليوم ✅',
          alreadyCheckedIn: true,
          checkInTime: todayCheckIn.checkInTime,
        },
        { status: 400 }
      )
    }

    // إنشاء تسجيل دخول جديد


    const checkIn = await prisma.memberCheckIn.create({
      data: {
        memberId,
        checkInTime: now,
        checkInMethod: method,
      },
    })

    // إضافة نقاط عند الحضور (إذا كان نظام النقاط مفعل)
    try {
      const settings = await prisma.systemSettings.findUnique({
        where: { id: 'singleton' }
      })

      if (settings && settings.pointsEnabled && settings.pointsPerCheckIn > 0) {
        await addPoints(
          memberId,
          settings.pointsPerCheckIn,
          'check-in',
          `حضور بتاريخ ${now.toLocaleDateString('ar-EG')}`
        )
      }
    } catch (pointsError) {
      console.error('Error adding check-in points:', pointsError)
      // لا نوقف العملية إذا فشلت إضافة النقاط
    }

    return NextResponse.json({
      success: true,
      checkIn,
      message: 'تم تسجيل الدخول بنجاح',
      alreadyCheckedIn: false,
    })
  } catch (error) {
    console.error('Error in member check-in:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تسجيل الدخول' },
      { status: 500 }
    )
  }
}

// GET: الحصول على حالة تسجيل دخول عضو معين
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json(
        { error: 'يجب توفير رقم العضو' },
        { status: 400 }
      )
    }

    // إرجاع آخر تسجيل دخول للعضو
    const latestCheckIn = await prisma.memberCheckIn.findFirst({
      where: {
        memberId,
      },
      include: {
        member: {
          select: {
            name: true,
            memberNumber: true,
          },
        },
      },
      orderBy: {
        checkInTime: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      checkIn: latestCheckIn,
      isCheckedIn: !!latestCheckIn,
    })
  } catch (error) {
    console.error('Error getting check-in status:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء الاستعلام' },
      { status: 500 }
    )
  }
}
