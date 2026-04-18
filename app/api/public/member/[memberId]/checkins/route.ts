import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiCache, CACHE_TTL } from '@/lib/cache';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  // Rate limit: 60 requests/minute per IP
  const rl = checkRateLimit(getClientIdentifier(request), {
    id: 'public-checkins',
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
    const { memberId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Serve from cache if available (60s TTL — check-ins don't change in real time)
    const cacheKey = `checkins:${memberId}:${limit}:${offset}`
    const cached = apiCache.get<object>(cacheKey)
    if (cached) {
      return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } })
    }

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Run all 4 queries in a single DB transaction — one round-trip instead of 4
    const [checkIns, totalCheckIns, monthlyCheckIns, weeklyCheckIns] =
      await prisma.$transaction([
        prisma.memberCheckIn.findMany({
          where: { memberId },
          orderBy: { checkInTime: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            checkInTime: true,
            checkInMethod: true,
          },
        }),
        prisma.memberCheckIn.count({ where: { memberId } }),
        prisma.memberCheckIn.count({
          where: { memberId, checkInTime: { gte: firstDayOfMonth } },
        }),
        prisma.memberCheckIn.count({
          where: { memberId, checkInTime: { gte: sevenDaysAgo } },
        }),
      ]);

    const result = {
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
    }

    apiCache.set(cacheKey, result, CACHE_TTL.CHECKINS)

    return NextResponse.json(result, { headers: { 'X-Cache': 'MISS' } })
  } catch (error) {
    console.error('Get check-ins error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
