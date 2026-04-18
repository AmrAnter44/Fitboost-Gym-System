import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = { memberId };
    if (status) {
      where.status = status;
    }

    const bookings = await prisma.spaBooking.findMany({
      where,
      orderBy: { bookingDate: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        bookingDate: true,
        bookingTime: true,
        serviceType: true,
        status: true,
        duration: true,
        notes: true,
        createdAt: true,
      },
    });

    const totalBookings = await prisma.spaBooking.count({ where });

    const upcomingCount = await prisma.spaBooking.count({
      where: {
        memberId,
        status: {
          in: ['pending', 'confirmed'],
        },
        bookingDate: {
          gte: new Date(),
        },
      },
    });

    return NextResponse.json({
      bookings,
      stats: {
        total: totalBookings,
        upcoming: upcomingCount,
      },
      pagination: {
        limit,
        offset,
        hasMore: totalBookings > offset + limit,
      },
    });
  } catch (error) {
    console.error('Get spa bookings error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}

/**
 * Create new SPA booking
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const body = await request.json();
    const { serviceType, bookingDate, bookingTime, duration, notes } = body;

    // Validate input
    if (!serviceType || !bookingDate || !bookingTime || !duration) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة' },
        { status: 400 }
      );
    }

    // Validate service type
    const validServices = ['massage', 'sauna', 'jacuzzi'];
    if (!validServices.includes(serviceType)) {
      return NextResponse.json(
        { error: 'نوع الخدمة غير صحيح' },
        { status: 400 }
      );
    }

    // Validate duration
    const validDurations = [30, 60, 90];
    if (!validDurations.includes(duration)) {
      return NextResponse.json(
        { error: 'المدة غير صحيحة' },
        { status: 400 }
      );
    }

    // Get member details
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: {
        name: true,
        phone: true,
        isActive: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'العضو غير موجود' },
        { status: 404 }
      );
    }

    if (!member.isActive) {
      return NextResponse.json(
        { error: 'الاشتراك غير نشط' },
        { status: 400 }
      );
    }

    // Check if booking date is in the past
    const bookingDateTime = new Date(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (bookingDateTime < today) {
      return NextResponse.json(
        { error: 'لا يمكن الحجز في تاريخ سابق' },
        { status: 400 }
      );
    }

    // Check for conflicting bookings (same service, same date, overlapping time)
    const existingBookings = await prisma.spaBooking.findMany({
      where: {
        serviceType,
        bookingDate: bookingDateTime,
        status: {
          in: ['pending', 'confirmed'],
        },
      },
      select: {
        bookingTime: true,
        duration: true,
      },
    });

    // Check for time conflicts
    const [requestHour, requestMinute] = bookingTime.split(':').map(Number);
    const requestStartMinutes = requestHour * 60 + requestMinute;
    const requestEndMinutes = requestStartMinutes + duration;

    for (const booking of existingBookings) {
      const [existingHour, existingMinute] = booking.bookingTime.split(':').map(Number);
      const existingStartMinutes = existingHour * 60 + existingMinute;
      const existingEndMinutes = existingStartMinutes + booking.duration;

      // Check if times overlap
      if (
        (requestStartMinutes >= existingStartMinutes && requestStartMinutes < existingEndMinutes) ||
        (requestEndMinutes > existingStartMinutes && requestEndMinutes <= existingEndMinutes) ||
        (requestStartMinutes <= existingStartMinutes && requestEndMinutes >= existingEndMinutes)
      ) {
        return NextResponse.json(
          { error: 'هذا الموعد محجوز بالفعل. يرجى اختيار موعد آخر' },
          { status: 400 }
        );
      }
    }

    // Create booking
    const booking = await prisma.spaBooking.create({
      data: {
        memberId,
        memberName: member.name,
        memberPhone: member.phone,
        serviceType,
        bookingDate: bookingDateTime,
        bookingTime,
        duration,
        notes: notes || null,
        status: 'pending',
        createdBy: member.name,
      },
    });

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        serviceType: booking.serviceType,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        duration: booking.duration,
        status: booking.status,
      },
      message: 'تم الحجز بنجاح! سيتم مراجعة الحجز وتأكيده قريباً',
    });
  } catch (error) {
    console.error('Create spa booking error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
