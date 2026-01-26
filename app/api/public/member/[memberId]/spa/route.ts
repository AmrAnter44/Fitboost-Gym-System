import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const { memberId } = params;
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
