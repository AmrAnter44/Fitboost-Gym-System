import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * نظام التحقق التلقائي من أعياد الميلاد
 * يتم استدعاؤه تلقائياً من الصفحة الرئيسية
 * يشتغل مرة واحدة فقط في اليوم
 */
export async function GET(request: Request) {
  try {
    // جلب الإعدادات
    const settings = await prisma.systemSettings.findFirst()

    if (!settings) {
      return NextResponse.json({ success: false, message: 'لا توجد إعدادات' })
    }

    // التحقق من تفعيل نظام النقاط
    if (!settings.pointsEnabled || !settings.pointsPerBirthday) {
      return NextResponse.json({
        success: false,
        message: 'نظام نقاط عيد الميلاد غير مفعل',
        alreadyChecked: true
      })
    }

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
    for (const member of birthdayMembers) {
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

    // وسم الفحص بعد ما نخلّص المنح (مش قبله) عشان لو حصل crash في النص،
    // الأعضاء الباقيين ما يتسكبوش — إعادة التشغيل بتكمّل الباقي.
    await prisma.systemSettings.update({
      where: { id: settings.id },
      data: { lastBirthdayPointsCheck: todayString }
    })

    return NextResponse.json({
      success: true,
      message: `تم منح نقاط عيد الميلاد لـ ${results.length} عضو تلقائياً`,
      count: results.length,
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
