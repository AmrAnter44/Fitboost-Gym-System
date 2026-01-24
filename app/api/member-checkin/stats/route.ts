import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

// GET: الحصول على إحصائيات اليوم

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')

    // إذا لم يتم توفير تاريخ، استخدم اليوم
    const targetDate = dateParam ? new Date(dateParam) : new Date()

    // ✅ بداية اليوم (00:00:00) - استخدام UTC لتجنب مشاكل timezone
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)

    // ✅ نهاية اليوم (23:59:59)
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    console.log('📊 جلب إحصائيات:', {
      date: targetDate.toISOString().split('T')[0],
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString(),
      localStart: startOfDay.toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }),
      localEnd: endOfDay.toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })
    })

    // عدد الأعضاء الذين سجلوا دخول اليوم
    const todayCheckIns = await prisma.memberCheckIn.count({
      where: {
        checkInTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    })

    // ✅ لم نعد نتتبع من هو داخل حالياً
    const currentCount = 0

    // إحصائيات إضافية: عدد الأعضاء الفريدين اليوم
    const uniqueMembers = await prisma.memberCheckIn.findMany({
      where: {
        checkInTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        memberId: true,
      },
      distinct: ['memberId'],
    })

    // ملاحظة: لا يتم تتبع مدة البقاء في النظام الحالي
    // لأن schema لا يحتوي على حقول actualCheckOutTime أو isActive
    const averageDuration = 0

    return NextResponse.json({
      success: true,
      date: targetDate.toISOString().split('T')[0],
      stats: {
        totalCheckIns: todayCheckIns,
        uniqueMembers: uniqueMembers.length,
        currentlyInside: currentCount,
        averageDurationMinutes: averageDuration,
      },
    })
  } catch (error) {
    console.error('Error getting stats:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء الاستعلام' },
      { status: 500 }
    )
  }
}
