import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiCache } from '@/lib/cache';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';

const WEEKLY_CLASSES_TTL = 5 * 60 * 1000

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(getClientIdentifier(request), {
    id: 'public-weekly-classes',
    limit: 60,
    windowMs: 60_000,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'طلبات كثيرة جداً، حاول بعد قليل' },
      { status: 429 }
    )
  }

  const cacheKey = 'gym:weekly-classes'

  const cached = apiCache.get<object>(cacheKey)
  if (cached) {
    return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } })
  }

  try {
    const classes = await prisma.classSchedule.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        className: true,
        coachName: true,
        duration: true,
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
      ],
    })

    const result = { classes }

    apiCache.set(cacheKey, result, WEEKLY_CLASSES_TTL)

    return NextResponse.json(result, { headers: { 'X-Cache': 'MISS' } })
  } catch (error) {
    console.error('Get weekly classes error:', error)
    return NextResponse.json({ classes: [] })
  }
}
