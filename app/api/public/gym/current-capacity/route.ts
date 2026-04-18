import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiCache, CACHE_TTL } from '@/lib/cache';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  // Rate limit: 60 requests/minute per IP
  const rl = checkRateLimit(getClientIdentifier(request), {
    id: 'public-gym-capacity',
    limit: 60,
    windowMs: 60_000,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'طلبات كثيرة جداً، حاول بعد قليل' },
      { status: 429 }
    )
  }

  const cacheKey = 'gym:current-capacity'
  const cached = apiCache.get<object>(cacheKey)
  if (cached) {
    return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } })
  }

  try {
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000)

    const currentCount = await prisma.memberCheckIn.count({
      where: {
        checkInTime: { gte: sixtyMinutesAgo },
      },
    })

    const result = { currentCount }

    apiCache.set(cacheKey, result, CACHE_TTL.GYM_CAPACITY) // 15s TTL

    return NextResponse.json(result, { headers: { 'X-Cache': 'MISS' } })
  } catch (error) {
    console.error('Get gym capacity error:', error);
    return NextResponse.json({ currentCount: 0 })
  }
}
