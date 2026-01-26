import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const { memberId } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const checkIns = await prisma.memberCheckIn.findMany({
      where: { memberId },
      orderBy: { checkInTime: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        checkInTime: true,
        checkInMethod: true,
      },
    });

    const totalCheckIns = await prisma.memberCheckIn.count({
      where: { memberId },
    });

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyCheckIns = await prisma.memberCheckIn.count({
      where: {
        memberId,
        checkInTime: { gte: firstDayOfMonth },
      },
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weeklyCheckIns = await prisma.memberCheckIn.count({
      where: {
        memberId,
        checkInTime: { gte: sevenDaysAgo },
      },
    });

    return NextResponse.json({
      checkIns,
      stats: {
        total: totalCheckIns,
        thisMonth: monthlyCheckIns,
        thisWeek: weeklyCheckIns,
      },
      pagination: {
        limit,
        offset,
        hasMore: totalCheckIns > offset + limit,
      },
    });
  } catch (error) {
    console.error('Get check-ins error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
