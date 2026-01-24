import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

// GET: الحصول على ملخص حضور الأعضاء

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    // بناء شروط الاستعلام
    const where: any = {}

    if (startDateParam && endDateParam) {
      const startDate = new Date(startDateParam)
      startDate.setHours(0, 0, 0, 0)

      const endDate = new Date(endDateParam)
      endDate.setHours(23, 59, 59, 999)

      where.checkInTime = {
        gte: startDate,
        lte: endDate,
      }
    }

    // الحصول على جميع سجلات الحضور
    const checkIns = await prisma.memberCheckIn.findMany({
      where,
      include: {
        member: {
          select: {
            id: true,
            name: true,
            memberNumber: true,
            phone: true,
          },
        },
      },
      orderBy: {
        checkInTime: 'desc',
      },
    })

    // تجميع البيانات حسب العضو
    const memberAttendanceMap = new Map<string, {
      member: any
      count: number
      checkIns: any[]
    }>()

    checkIns.forEach((checkIn) => {
      const memberId = checkIn.memberId

      if (memberAttendanceMap.has(memberId)) {
        const data = memberAttendanceMap.get(memberId)!
        data.count++
        data.checkIns.push(checkIn)
      } else {
        memberAttendanceMap.set(memberId, {
          member: checkIn.member,
          count: 1,
          checkIns: [checkIn],
        })
      }
    })

    // تحويل الـ Map إلى Array وترتيب حسب عدد الحضور
    const summary = Array.from(memberAttendanceMap.values())
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      success: true,
      summary,
      totalCheckIns: checkIns.length,
      uniqueMembers: summary.length,
    })
  } catch (error) {
    console.error('Error getting attendance summary:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء الاستعلام' },
      { status: 500 }
    )
  }
}
