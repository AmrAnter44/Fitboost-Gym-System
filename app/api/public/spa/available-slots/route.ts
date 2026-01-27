import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Get available time slots for SPA booking
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceType = searchParams.get('serviceType');
    const date = searchParams.get('date');
    const duration = parseInt(searchParams.get('duration') || '60');

    // Validate input
    if (!serviceType || !date) {
      return NextResponse.json(
        { error: 'نوع الخدمة والتاريخ مطلوبان' },
        { status: 400 }
      );
    }

    const validServices = ['massage', 'sauna', 'jacuzzi'];
    if (!validServices.includes(serviceType)) {
      return NextResponse.json(
        { error: 'نوع الخدمة غير صحيح' },
        { status: 400 }
      );
    }

    const validDurations = [30, 60, 90];
    if (!validDurations.includes(duration)) {
      return NextResponse.json(
        { error: 'المدة غير صحيحة' },
        { status: 400 }
      );
    }

    // Parse date
    const bookingDate = new Date(date);

    // Check if date is valid
    if (isNaN(bookingDate.getTime())) {
      return NextResponse.json(
        { error: 'التاريخ غير صحيح' },
        { status: 400 }
      );
    }

    // Get all bookings for this service on this date
    const existingBookings = await prisma.spaBooking.findMany({
      where: {
        serviceType,
        bookingDate,
        status: {
          in: ['pending', 'confirmed'],
        },
      },
      select: {
        bookingTime: true,
        duration: true,
      },
    });

    // Working hours: 24/7 - Full day coverage
    const startHour = 0;
    const endHour = 24;
    const slotInterval = 60; // minutes - full hours only

    // Generate all possible time slots
    const allSlots: { time: string; available: boolean }[] = [];

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotInterval) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const slotStartMinutes = hour * 60 + minute;
        const slotEndMinutes = slotStartMinutes + duration;

        // Check if slot end time is within working hours
        const endTimeHour = Math.floor(slotEndMinutes / 60);
        if (endTimeHour > endHour) {
          continue;
        }

        // Check if this slot conflicts with any existing booking
        let isAvailable = true;

        for (const booking of existingBookings) {
          const [existingHour, existingMinute] = booking.bookingTime.split(':').map(Number);
          const existingStartMinutes = existingHour * 60 + existingMinute;
          const existingEndMinutes = existingStartMinutes + booking.duration;

          // Check if times overlap
          if (
            (slotStartMinutes >= existingStartMinutes && slotStartMinutes < existingEndMinutes) ||
            (slotEndMinutes > existingStartMinutes && slotEndMinutes <= existingEndMinutes) ||
            (slotStartMinutes <= existingStartMinutes && slotEndMinutes >= existingEndMinutes)
          ) {
            isAvailable = false;
            break;
          }
        }

        allSlots.push({
          time: timeString,
          available: isAvailable,
        });
      }
    }

    return NextResponse.json({
      slots: allSlots,
      serviceType,
      date,
      duration,
    });
  } catch (error) {
    console.error('Get available slots error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
