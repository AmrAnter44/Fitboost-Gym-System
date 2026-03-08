import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * API Endpoint للتحقق من أعياد الميلاد اليوم ومنح النقاط
 * يتم تشغيله تلقائياً كل يوم
 */
export async function POST(request: Request) {
  try {
    // التحقق من secret key للحماية من الاستخدام غير المصرح به
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'birthday-points-secret-2024'

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({
        success: false,
        error: 'غير مصرح به'
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

    console.log(`🎂 التحقق من أعياد الميلاد: ${currentDay}/${currentMonth}`)

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

    console.log(`🎉 تم العثور على ${birthdayMembers.length} عضو لديهم عيد ميلاد اليوم`)

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
            description: `🎂 عيد ميلاد سعيد! تم منح ${settings.pointsPerBirthday} نقطة تلقائياً`
          }
        })

        results.push({
          memberNumber: member.memberNumber,
          name: member.name,
          pointsAwarded: settings.pointsPerBirthday,
          newTotal: member.points + settings.pointsPerBirthday
        })

        console.log(`✅ منح ${settings.pointsPerBirthday} نقطة لـ ${member.name} (#${member.memberNumber})`)
      } catch (error) {
        console.error(`❌ خطأ في منح نقاط لـ ${member.name}:`, error)
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
    console.error('❌ خطأ في نظام نقاط عيد الميلاد:', error)
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

/**
 * GET endpoint للتحقق اليدوي من أعياد الميلاد
 */
export async function GET(request: Request) {
  try {
    const settings = await prisma.systemSettings.findFirst()

    if (!settings) {
      return NextResponse.json({
        success: false,
        message: 'لا توجد إعدادات'
      })
    }

    const today = new Date()
    const currentMonth = today.getMonth() + 1
    const currentDay = today.getDate()

    // البحث عن الأعضاء الذين لديهم عيد ميلاد اليوم
    const membersWithBirthday = await prisma.member.findMany({
      where: {
        AND: [
          { isActive: true },
          { birthDate: { not: null } }
        ]
      },
      select: {
        memberNumber: true,
        name: true,
        birthDate: true,
        isActive: true
      }
    })

    const birthdayMembers = membersWithBirthday.filter(member => {
      if (!member.birthDate) return false
      const birthDate = new Date(member.birthDate)
      return birthDate.getMonth() + 1 === currentMonth &&
             birthDate.getDate() === currentDay
    })

    return NextResponse.json({
      success: true,
      date: `${currentDay}/${currentMonth}/${today.getFullYear()}`,
      pointsPerBirthday: settings.pointsPerBirthday || 0,
      pointsEnabled: settings.pointsEnabled,
      birthdayMembersCount: birthdayMembers.length,
      birthdayMembers: birthdayMembers.map(m => ({
        memberNumber: m.memberNumber,
        name: m.name,
        birthDate: m.birthDate
      }))
    })

  } catch (error) {
    console.error('خطأ في GET birthday-points:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'فشل جلب بيانات أعياد الميلاد',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
