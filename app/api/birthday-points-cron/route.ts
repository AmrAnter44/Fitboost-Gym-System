import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Vercel Cron Job للتحقق من أعياد الميلاد اليوم ومنح النقاط
 * يتم تشغيله تلقائياً كل يوم الساعة 12 صباحاً
 */
export async function GET(request: Request) {
  try {
    // التحقق من Vercel Cron header
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    // التحقق من تفعيل نظام النقاط
    const settings = await prisma.systemSettings.findFirst()

    if (!settings || !settings.pointsEnabled || !settings.pointsPerBirthday) {
      return NextResponse.json({
        success: false,
        message: 'نظام نقاط عيد الميلاد غير مفعل'
      })
    }

    const today = new Date()
    const currentMonth = today.getMonth() + 1 // 1-12
    const currentDay = today.getDate() // 1-31


    // البحث عن الأعضاء النشطين الذين عيد ميلادهم اليوم
    const membersWithBirthday = await prisma.member.findMany({
      where: {
        AND: [
          { isActive: true }, // نشط فقط
          { birthDate: { not: null } }, // لديه تاريخ ميلاد
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
      return NextResponse.json({
        success: true,
        message: 'لا توجد أعياد ميلاد اليوم',
        count: 0
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
            description: `🎂 عيد ميلاد سعيد! تم منح ${settings.pointsPerBirthday} نقطة تلقائياً (CRON)`
          }
        })

        results.push({
          memberNumber: member.memberNumber,
          name: member.name,
          pointsAwarded: settings.pointsPerBirthday,
          newTotal: member.points + settings.pointsPerBirthday
        })

      } catch (error) {
        console.error(`❌ [CRON] خطأ في منح نقاط لـ ${member.name}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `تم منح نقاط عيد الميلاد لـ ${results.length} عضو`,
      count: results.length,
      pointsPerBirthday: settings.pointsPerBirthday,
      members: results
    })

  } catch (error) {
    console.error('❌ [CRON] خطأ في نظام نقاط عيد الميلاد:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'فشل التحقق من أعياد الميلاد',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
