import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get points history
    const pointsHistory = await prisma.pointsHistory.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        points: true,
        action: true,
        description: true,
        createdAt: true,
      },
    });

    // Get total count
    const total = await prisma.pointsHistory.count({
      where: { memberId },
    });

    // Transform to match mobile app format
    const transactions = pointsHistory.map((item) => ({
      id: parseInt(item.id.substring(0, 8), 16), // Convert cuid to number for compatibility
      points: Math.abs(item.points),
      type: item.points > 0 ? 'earned' : 'redeemed',
      reason: item.description || item.action,
      createdAt: item.createdAt.toISOString(),
    }));

    return NextResponse.json({
      transactions,
      total,
    });
  } catch (error) {
    console.error('Get points history error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
