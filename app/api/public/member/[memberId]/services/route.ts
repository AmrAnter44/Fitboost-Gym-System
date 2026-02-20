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
    id: 'public-services',
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

    const cacheKey = `services:${memberId}`
    const cached = apiCache.get<object>(cacheKey)
    if (cached) {
      return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } })
    }

    // Get member's memberNumber (needed to link Nutrition/Physio/GroupClass)
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { memberNumber: true },
    })

    if (!member) {
      return NextResponse.json({ services: null })
    }

    // Run all service queries in parallel
    const [ptReceipt, nutritionRecord, physioRecord, groupClassRecord] = await Promise.all([
      // PT: linked via Receipt (memberId → ptNumber)
      prisma.receipt.findFirst({
        where: {
          memberId,
          ptNumber: { not: null },
          pt: { sessionsRemaining: { gt: 0 } },
        },
        select: {
          pt: {
            select: {
              sessionsRemaining: true,
              sessionsPurchased: true,
              coachName: true,
            },
          },
        },
        orderBy: { id: 'desc' },
      }),

      // Nutrition: linked via memberNumber
      member.memberNumber
        ? prisma.nutrition.findFirst({
            where: {
              memberNumber: member.memberNumber,
              sessionsRemaining: { gt: 0 },
            },
            select: { sessionsRemaining: true },
            orderBy: { nutritionNumber: 'desc' },
          })
        : null,

      // Physiotherapy: linked via memberNumber
      member.memberNumber
        ? prisma.physiotherapy.findFirst({
            where: {
              memberNumber: member.memberNumber,
              sessionsRemaining: { gt: 0 },
            },
            select: { sessionsRemaining: true },
            orderBy: { physioNumber: 'desc' },
          })
        : null,

      // Group Classes: linked via memberNumber
      member.memberNumber
        ? prisma.groupClass.findFirst({
            where: {
              memberNumber: member.memberNumber,
              sessionsRemaining: { gt: 0 },
            },
            select: { sessionsRemaining: true },
            orderBy: { classNumber: 'desc' },
          })
        : null,
    ])

    const services = {
      pt: ptReceipt?.pt
        ? {
            sessionsRemaining: ptReceipt.pt.sessionsRemaining,
            sessionsPurchased: ptReceipt.pt.sessionsPurchased,
            coachName: ptReceipt.pt.coachName,
          }
        : null,
      nutrition: nutritionRecord
        ? { sessionsRemaining: nutritionRecord.sessionsRemaining }
        : null,
      physiotherapy: physioRecord
        ? { sessionsRemaining: physioRecord.sessionsRemaining }
        : null,
      groupClass: groupClassRecord
        ? { sessionsRemaining: groupClassRecord.sessionsRemaining }
        : null,
    }

    const result = { services }

    apiCache.set(cacheKey, result, CACHE_TTL.SPA) // 30s TTL

    return NextResponse.json(result, { headers: { 'X-Cache': 'MISS' } })
  } catch (error) {
    console.error('Get member services error:', error);
    return NextResponse.json({ services: null })
  }
}
