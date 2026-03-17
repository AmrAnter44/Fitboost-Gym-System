import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'

// Get member's bookings for today
export async function GET(request: NextRequest) {
  const rl = checkRateLimit(getClientIdentifier(request), {
    id: 'public-class-bookings-check',
    limit: 60,
    windowMs: 60_000,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'طلبات كثيرة جداً، حاول بعد قليل' },
      { status: 429 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID required' }, { status: 400 })
    }

    // Get today's date at 00:00:00
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get tomorrow's date at 00:00:00
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get all bookings for this member today
    const bookings = await prisma.classBooking.findMany({
      where: {
        memberId,
        bookingDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    })

    return NextResponse.json({
      bookings,
      bookedClassIds: bookings.map(b => b.classScheduleId),
    })
  } catch (error) {
    console.error('Check class booking error:', error)
    return NextResponse.json(
      { error: 'فشل التحقق من الحجز' },
      { status: 500 }
    )
  }
}

// Book a specific class
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(getClientIdentifier(request), {
    id: 'public-class-bookings-create',
    limit: 20,
    windowMs: 60_000,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'طلبات كثيرة جداً، حاول بعد قليل' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()
    const { memberId, classScheduleId } = body


    if (!memberId || !classScheduleId) {
      return NextResponse.json({ error: 'Member ID and Class Schedule ID required' }, { status: 400 })
    }

    // Verify class schedule exists
    const classSchedule = await prisma.classSchedule.findUnique({
      where: { id: classScheduleId },
    })

    if (!classSchedule) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      )
    }

    // Get today's date at 00:00:00
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Check if member already has a booking for this specific class today
    const existingBooking = await prisma.classBooking.findFirst({
      where: {
        memberId,
        classScheduleId,
        bookingDate: today,
      },
    })

    if (existingBooking) {
      return NextResponse.json(
        { error: 'Already booked this class' },
        { status: 400 }
      )
    }

    // Create the booking
    const booking = await prisma.classBooking.create({
      data: {
        memberId,
        classScheduleId,
        bookingDate: today,
      },
    })

    return NextResponse.json({ success: true, booking })
  } catch (error) {
    console.error('❌ Book class error:', error)
    return NextResponse.json(
      { error: 'فشل حجز الكلاس' },
      { status: 500 }
    )
  }
}

// Cancel a specific class booking
export async function DELETE(request: NextRequest) {
  const rl = checkRateLimit(getClientIdentifier(request), {
    id: 'public-class-bookings-delete',
    limit: 20,
    windowMs: 60_000,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'طلبات كثيرة جداً، حاول بعد قليل' },
      { status: 429 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')
    const classScheduleId = searchParams.get('classScheduleId')

    if (!memberId || !classScheduleId) {
      return NextResponse.json({ error: 'Member ID and Class Schedule ID required' }, { status: 400 })
    }

    // Get today's date at 00:00:00
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Delete the booking for this specific class
    const result = await prisma.classBooking.deleteMany({
      where: {
        memberId,
        classScheduleId,
        bookingDate: today,
      },
    })

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'لا يوجد حجز لإلغائه' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cancel class booking error:', error)
    return NextResponse.json(
      { error: 'فشل إلغاء الحجز' },
      { status: 500 }
    )
  }
}
