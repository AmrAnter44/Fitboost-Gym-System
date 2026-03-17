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


    // Get all bookings for today
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


    // Get member and class details for each booking
    const bookingsWithDetails = await Promise.all(
      bookings.map(async (booking) => {
        const [member, classSchedule] = await Promise.all([
          prisma.member.findUnique({
            where: { id: booking.memberId },
            select: {
              memberNumber: true,
              name: true,
              phone: true,
            },
          }),
          prisma.classSchedule.findUnique({
            where: { id: booking.classScheduleId },
            select: {
              className: true,
              coachName: true,
              startTime: true,
              dayOfWeek: true,
            },
          }),
        ])


        return {
          ...booking,
          member: member || null,
          class: classSchedule || null,
        }
      })
    )


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
