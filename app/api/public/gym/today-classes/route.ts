import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiCache } from '@/lib/cache';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';

// Cache TTL: 5 minutes — schedule rarely changes during the day
const TODAY_CLASSES_TTL = 5 * 60 * 1000

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(getClientIdentifier(request), {
    id: 'public-today-classes',
    limit: 60,
    windowMs: 60_000,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'طلبات كثيرة جداً، حاول بعد قليل' },
      { status: 429 }
    )
  }

  const todayDayOfWeek = new Date().getDay() // 0=Sunday ... 6=Saturday
  const cacheKey = `gym:today-classes:${todayDayOfWeek}`

  const cached = apiCache.get<object>(cacheKey)
  if (cached) {
    return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } })
  }

  try {
    const classes = await prisma.classSchedule.findMany({
      where: {
        dayOfWeek: todayDayOfWeek,
        isActive: true,
      },
      select: {
        id: true,
        startTime: true,
        className: true,
        coachName: true,
        duration: true,
      },
      orderBy: { startTime: 'asc' },
    })

    const result = { classes }

    apiCache.set(cacheKey, result, TODAY_CLASSES_TTL)

    return NextResponse.json(result, { headers: { 'X-Cache': 'MISS' } })
  } catch (error) {
    console.error('Get today classes error:', error)
    return NextResponse.json({ classes: [] })
  }
}
