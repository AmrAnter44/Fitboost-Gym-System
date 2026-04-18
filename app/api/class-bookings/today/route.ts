import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

// Force dynamic rendering (uses request.headers)
export const dynamic = 'force-dynamic'

// Get all class bookings for today with member details
export async function GET(request: NextRequest) {
  const user = await verifyAuth(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get today's date at 00:00:00
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get tomorrow's date at 23:59:59
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(23, 59, 59, 999)


    // Get all bookings for today with member and class details (single query)
    const bookings = await prisma.classBooking.findMany({
      where: {
        bookingDate: {
          gte: today,
          lte: tomorrow,
        },
      },
      select: {
        id: true,
        memberId: true,
        classScheduleId: true,
        bookingDate: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // Batch fetch members and class schedules (2 queries instead of 2N)
    const memberIds = [...new Set(bookings.map(b => b.memberId))]
    const classScheduleIds = [...new Set(bookings.map(b => b.classScheduleId))]

    const [members, classSchedules] = await Promise.all([
      prisma.member.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, memberNumber: true, name: true, phone: true },
      }),
      prisma.classSchedule.findMany({
        where: { id: { in: classScheduleIds } },
        select: { id: true, className: true, coachName: true, startTime: true, dayOfWeek: true },
      }),
    ])

    const membersMap = new Map(members.map(m => [m.id, m]))
    const classesMap = new Map(classSchedules.map(c => [c.id, c]))

    const bookingsWithDetails = bookings.map(booking => ({
      ...booking,
      member: membersMap.get(booking.memberId) || null,
      class: classesMap.get(booking.classScheduleId) || null,
    }))

    return NextResponse.json({
      count: bookings.length,
      bookings: bookingsWithDetails,
    })
  } catch (error) {
    console.error('Get today class bookings error:', error)
    return NextResponse.json(
      { error: 'فشل جلب حجوزات الكلاس' },
      { status: 500 }
    )
  }
}
