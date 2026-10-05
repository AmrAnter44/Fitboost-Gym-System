import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * نظام التحقق التلقائي من أعياد الميلاد
 * يتم استدعاؤه تلقائياً من الصفحة الرئيسية
 * يشتغل مرة واحدة فقط في اليوم
 */
export async function GET(request: Request) {
  try {
    // 🔒 حماية: المسار كان مكشوف بالكامل — أي حد كان بيقدر يسحب بيانات
    //    الأعضاء (اسم/تليفون) بالجملة. لازم تسجيل دخول.
    const { verifyAuth } = await import('@/lib/auth')
    const authedUser = await verifyAuth(request)
    if (!authedUser) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }

    // جلب الإعدادات
    const settings = await prisma.systemSettings.findFirst()

    if (!settings) {
      return NextResponse.json({ success: false, message: 'لا توجد إعدادات' })
    }

    // 🎁 النقاط اختيارية — تهنئة الأبلكيشن بتتبعت حتى لو النقاط مقفولة
    const pointsOn = !!settings.pointsEnabled && !!settings.pointsPerBirthday

    // التاريخ الحالي — بتوقيت محلي عشان يتطابق مع مقارنة الشهر/اليوم تحت
    // (لو استخدمنا UTC عند منتصف الليل بتوقيت مصر، الـ guard والمقارنة يختلفوا
    //  فتتمنح نقط في اليوم الغلط أو تتكرّر/تتسكب قرب منتصف الليل)
    const today = new Date()
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const startOfTomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    // التحقق إذا كان تم الفحص اليوم
    if (settings.lastBirthdayPointsCheck === todayString) {
      return NextResponse.json({
        success: true,
        message: 'تم التحقق من أعياد الميلاد اليوم بالفعل',
        alreadyChecked: true
      })
    }


    const currentMonth = today.getMonth() + 1
    const currentDay = today.getDate()

    // البحث عن الأعضاء النشطين الذين عيد ميلادهم اليوم
    const membersWithBirthday = await prisma.member.findMany({
      where: {
        AND: [
          { isActive: true },
          { birthDate: { not: null } }
        ]
      },
      select: {
        id: true,
        memberNumber: true,
        name: true,
        birthDate: true,
        points: true
      }
    })

    // فلترة الأعضاء الذين عيد ميلادهم اليوم
    const birthdayMembers = membersWithBirthday.filter(member => {
      if (!member.birthDate) return false
      const birthDate = new Date(member.birthDate)
      return birthDate.getMonth() + 1 === currentMonth &&
             birthDate.getDate() === currentDay
    })


    if (birthdayMembers.length === 0) {
      // مفيش أعياد النهاردة — نوسم الفحص ونرجع
      await prisma.systemSettings.update({
        where: { id: settings.id },
        data: { lastBirthdayPointsCheck: todayString }
      })
      return NextResponse.json({
        success: true,
        message: 'لا توجد أعياد ميلاد اليوم',
        count: 0,
        checked: true
      })
    }

    // منح النقاط لكل عضو — كل عضو في transaction، ومع idempotency check عشان
    // لو الـ process وقع في نص اللوب، إعادة التشغيل ما تمنحش نفس العضو مرتين.
    const results = []
    const awardedIds = new Set<string>()
    for (const member of pointsOn ? birthdayMembers : []) {
      try {
        const awarded = await prisma.$transaction(async (tx) => {
          const already = await tx.pointsHistory.findFirst({
            where: {
              memberId: member.id,
              action: 'birthday',
              createdAt: { gte: startOfToday, lt: startOfTomorrow },
            },
          })
          if (already) return false

          await tx.member.update({
            where: { id: member.id },
            data: { points: { increment: settings.pointsPerBirthday } },
          })
          await tx.pointsHistory.create({
            data: {
              memberId: member.id,
              points: settings.pointsPerBirthday,
              action: 'birthday',
              description: `🎂 عيد ميلاد سعيد! تم منح ${settings.pointsPerBirthday} نقطة تلقائياً`,
            },
          })
          return true
        })

        if (awarded) {
          awardedIds.add(member.id)
          results.push({
            memberNumber: member.memberNumber,
            name: member.name,
            pointsAwarded: settings.pointsPerBirthday
          })
        }

      } catch (error) {
        console.error(`❌ [AUTO] خطأ في منح نقاط لـ ${member.name}:`, error)
      }
    }

    // 🎂 إشعار التهنئة على الأبلكيشن (مرة في السنة لكل عضو)
    const { sendBirthdayGreetings } = await import('@/lib/birthdayGreeting')
    const greeted = await sendBirthdayGreetings(birthdayMembers, {
      year: today.getFullYear(),
      gymName: (settings as any).gymName ?? null,
      pointsAwarded: awardedIds,
      points: settings.pointsPerBirthday ?? 0,
    }).catch(() => 0)

    // وسم الفحص بعد ما نخلّص المنح (مش قبله) عشان لو حصل crash في النص،
    // الأعضاء الباقيين ما يتسكبوش — إعادة التشغيل بتكمّل الباقي.
    await prisma.systemSettings.update({
      where: { id: settings.id },
      data: { lastBirthdayPointsCheck: todayString }
    })

    return NextResponse.json({
      success: true,
      message: `أعياد ميلاد النهارده: ${birthdayMembers.length} — نقاط: ${results.length} — تهنئة: ${greeted}`,
      count: results.length,
      greeted,
      pointsPerBirthday: settings.pointsPerBirthday,
      members: results,
      checked: true
    })

  } catch (error) {
    console.error('❌ [AUTO] خطأ في نظام نقاط عيد الميلاد التلقائي:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'فشل التحقق التلقائي',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
