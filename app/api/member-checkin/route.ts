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

    // التحقق من أن العضو غير محظور
    if (member.isBanned) {
      return NextResponse.json(
        { error: 'هذا العضو محظور 🚫' },
        { status: 403 }
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

    // ⏳ انتهاء الاشتراك بالمدة — لو التاريخ عدّى يبقى الاشتراك خلص حتى لو فيه دخلات متبقية
    //    ده بيغطّي الباقات اللي فيها مدة + عدد دخلات: بينتهي بأول اللي يخلص (المدة أو الدخلات)
    if (member.expiryDate) {
      const exp = new Date(member.expiryDate)
      if (!isNaN(exp.getTime()) && exp < new Date()) {
        try {
          if (member.isActive) {
            await prisma.member.update({ where: { id: memberId }, data: { isActive: false } })
          }
        } catch (e) { /* تحديث الحالة مايكسرش الرد */ }
        return NextResponse.json(
          { error: 'انتهت مدة الاشتراك 🚫', expired: true },
          { status: 403 }
        )
      }
    }

    //  التحقق من عدد حصص الدخول المتبقية (باقات محدودة الدخلات) — null = دخول غير محدود
    const remainingCheckIns = (member as any).remainingCheckIns as number | null | undefined
    if (remainingCheckIns !== null && remainingCheckIns !== undefined && remainingCheckIns <= 0) {
      return NextResponse.json(
        { error: 'انتهى عدد حصص الدخول في الباقة 🚫', noCheckInsLeft: true },
        { status: 403 }
      )
    }

    // 🕐 التحقق من ساعات الدخول المسموح بها (لو مفعّلة)
    const allowedStart = (member as any).allowedCheckInStart as string | null
    const allowedEnd = (member as any).allowedCheckInEnd as string | null

    if (allowedStart && allowedEnd) {
      const timeRegex = /^([01]?\d|2[0-3]):[0-5]\d$/
      if (timeRegex.test(allowedStart) && timeRegex.test(allowedEnd)) {
        const nowDate = new Date()
        const [startH, startM] = allowedStart.split(':').map(Number)
        const [endH, endM] = allowedEnd.split(':').map(Number)
        const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes()
        const startMinutes = startH * 60 + startM
        const endMinutes = endH * 60 + endM

        // دعم الفترات اللي بتتعدى منتصف الليل (مثلاً 22:00 إلى 06:00)
        const withinAllowed = startMinutes <= endMinutes
          ? (currentMinutes >= startMinutes && currentMinutes <= endMinutes)
          : (currentMinutes >= startMinutes || currentMinutes <= endMinutes)

        if (!withinAllowed) {
          return NextResponse.json(
            {
              error: `⏰ تجاوزت للوقت المحدد. ساعات الدخول المسموح بها: ${allowedStart} - ${allowedEnd}`,
              outOfAllowedHours: true,
              allowedStart,
              allowedEnd,
            },
            { status: 403 }
          )
        }
      }
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

    //  إنقاص عدد حصص الدخول المتبقية للباقات المحدودة (الاشتراكات غير المحدودة remainingCheckIns=null مش بتتأثر)
    if (remainingCheckIns !== null && remainingCheckIns !== undefined) {
      try {
        const newRemaining = remainingCheckIns - 1
        await prisma.member.update({
          where: { id: memberId },
          //  لو خلصت الدخلات → العضو يبقى منتهي (isActive=false + expiryDate=now) عشان يظهر في المتابعات
          data: newRemaining <= 0
            ? { remainingCheckIns: 0, isActive: false, expiryDate: now }
            : { remainingCheckIns: newRemaining } as any,
        })
      } catch (e) {
        //  فشل الإنقاص مايكسرش تسجيل الدخول
      }
    }

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
