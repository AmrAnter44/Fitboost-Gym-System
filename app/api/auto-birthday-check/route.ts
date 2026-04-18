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

    // التحقق من التاريخ الحالي
    const today = new Date()
    const todayString = today.toISOString().split('T')[0] // YYYY-MM-DD

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


    // تحديث تاريخ آخر فحص (حتى لو لم يكن هناك أعضاء)
    await prisma.systemSettings.update({
      where: { id: settings.id },
      data: { lastBirthdayPointsCheck: todayString }
    })

    if (birthdayMembers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'لا توجد أعياد ميلاد اليوم',
        count: 0,
        checked: true
      })
    }

    // منح النقاط لكل عضو
    const results = []
    for (const member of birthdayMembers) {
      try {
        // تحديث نقاط العضو
        await prisma.member.update({
          where: { id: member.id },
          data: {
            points: {
              increment: settings.pointsPerBirthday
            }
          }
        })

        // تسجيل في تاريخ النقاط
        await prisma.pointsHistory.create({
          data: {
            memberId: member.id,
            points: settings.pointsPerBirthday,
            action: 'birthday',
            description: `🎂 عيد ميلاد سعيد! تم منح ${settings.pointsPerBirthday} نقطة تلقائياً`
          }
        })

        results.push({
          memberNumber: member.memberNumber,
          name: member.name,
          pointsAwarded: settings.pointsPerBirthday
        })

      } catch (error) {
        console.error(`❌ [AUTO] خطأ في منح نقاط لـ ${member.name}:`, error)
      }
    }

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
