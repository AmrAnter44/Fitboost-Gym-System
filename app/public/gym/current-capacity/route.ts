import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Get current gym capacity - count of members who checked in within the last 60 minutes
 * عدد الأعضاء الموجودين حالياً في الجيم (check-in في آخر 60 دقيقة)
 */
export async function GET(request: NextRequest) {
  try {
    // Calculate 60 minutes ago from now
    const sixtyMinutesAgo = new Date();
    sixtyMinutesAgo.setMinutes(sixtyMinutesAgo.getMinutes() - 60);

    // Count unique members who checked in within the last 60 minutes
    const recentCheckIns = await prisma.memberCheckIn.groupBy({
      by: ['memberId'],
      where: {
        checkInTime: {
          gte: sixtyMinutesAgo,
        },
      },
    });

    const currentCount = recentCheckIns.length;

    // Get total active members for percentage calculation
    const totalActiveMembers = await prisma.member.count({
      where: {
        isActive: true,
      },
    });

    // Calculate percentage
    const percentage = totalActiveMembers > 0
      ? Math.round((currentCount / totalActiveMembers) * 100)
      : 0;

    return NextResponse.json({
      currentCount,
      totalActiveMembers,
      percentage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get gym current capacity error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
