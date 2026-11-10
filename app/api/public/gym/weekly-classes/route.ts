import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiCache } from '@/lib/cache';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';
import { isMixedGymEnabled, getMemberGender, classAllowedForGender } from '@/lib/genderSchedule';

//  🚻 جيم مكس: لو الأبليكيشن بعت ?memberId= → كلاسات جنس العضو + المختلط بس
async function forMember(result: { classes: Array<{ gender: string }> }, memberId: string) {
  if (!memberId || !(await isMixedGymEnabled(prisma))) return result
  const g = await getMemberGender(prisma, memberId)
  return { ...result, classes: result.classes.filter((c) => classAllowedForGender(c.gender, g)) }
}

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
  const memberId = new URL(request.url).searchParams.get('memberId') || ''

  const cached = apiCache.get<{ classes: Array<{ gender: string }> }>(cacheKey)
  if (cached) {
    return NextResponse.json(await forMember(cached, memberId), { headers: { 'X-Cache': 'HIT' } })
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
        gender: true,
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
      ],
    })

    const result = { classes }

    apiCache.set(cacheKey, result, WEEKLY_CLASSES_TTL)

    return NextResponse.json(await forMember(result, memberId), { headers: { 'X-Cache': 'MISS' } })
  } catch (error) {
    console.error('Get weekly classes error:', error)
    return NextResponse.json({ classes: [] })
  }
}
