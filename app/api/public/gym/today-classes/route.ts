import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiCache } from '@/lib/cache';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';
import { verifyMemberPhone } from '@/lib/memberVerify';

// Cache TTL: 5 minutes — schedule rarely changes during the day
const TODAY_CLASSES_TTL = 5 * 60 * 1000

// أقصى عدد أسامي بنرجّعها لكل كلاس — الباقي بيتعرض كـ «و N تانيين»
const NAMES_LIMIT = 8

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

  try {
    // الجدول نفسه بيتكاش — عدد الحاجزين لأ، لإنه بيتغيّر مع كل حجز/إلغاء
    let classes = apiCache.get<ClassRow[]>(cacheKey)
    const cacheHit = !!classes

    if (!classes) {
      classes = await prisma.classSchedule.findMany({
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
          gender: true,
        },
        orderBy: { startTime: 'asc' },
      })

      apiCache.set(cacheKey, classes, TODAY_CLASSES_TTL)
    }

    // 🔒 العدد متاح للكل، لكن أسامي الحاجزين للأعضاء المتحققين بس —
    // الراوت ده عام، فمن غير التحقق ده أي حد يقدر يقرا أسامي الأعضاء.
    const { searchParams } = new URL(request.url)
    const showNames = await verifyMemberPhone(
      searchParams.get('memberId') || '',
      searchParams.get('phone')
    )

    const classIds = classes.map((c) => c.id)
    const [bookedCounts, bookedNames] = await Promise.all([
      countTodayBookings(classIds),
      showNames ? firstNamesPerClass(classIds) : Promise.resolve({}),
    ])

    return NextResponse.json(
      {
        classes: classes.map((c) => ({
          ...c,
          bookedCount: bookedCounts[c.id] || 0,
          // undefined لما العضو مش متحقق — التطبيق ساعتها بيعرض العدد بس
          bookedNames: showNames ? bookedNames[c.id] || [] : undefined,
        })),
      },
      { headers: { 'X-Cache': cacheHit ? 'HIT' : 'MISS' } }
    )
  } catch (error) {
    console.error('Get today classes error:', error)
    return NextResponse.json({ classes: [] })
  }
}

type ClassRow = {
  id: string
  startTime: string
  className: string
  coachName: string
  duration: number
  gender: string
}

/** عدد الحاجزين لكل كلاس النهاردة (id -> count). */
async function countTodayBookings(classScheduleIds: string[]): Promise<Record<string, number>> {
  if (classScheduleIds.length === 0) return {}

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const grouped = await prisma.classBooking.groupBy({
    by: ['classScheduleId'],
    where: {
      classScheduleId: { in: classScheduleIds },
      bookingDate: { gte: today, lt: tomorrow },
    },
    _count: { _all: true },
  })

  return Object.fromEntries(grouped.map((g) => [g.classScheduleId, g._count._all]))
}

/**
 * الاسم الأول لكل حاجز النهاردة (id -> أسامي).
 * الاسم الأول بس — مش بنعرض الاسم الكامل ولا رقم العضوية ولا التليفون لباقي الأعضاء.
 */
async function firstNamesPerClass(classScheduleIds: string[]): Promise<Record<string, string[]>> {
  if (classScheduleIds.length === 0) return {}

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const bookings = await prisma.classBooking.findMany({
    where: {
      classScheduleId: { in: classScheduleIds },
      bookingDate: { gte: today, lt: tomorrow },
    },
    select: { classScheduleId: true, memberId: true },
    orderBy: { createdAt: 'asc' },
  })

  if (bookings.length === 0) return {}

  const members = await prisma.member.findMany({
    where: { id: { in: [...new Set(bookings.map((b) => b.memberId))] } },
    select: { id: true, name: true },
  })
  const firstNameById = new Map(
    members.map((m) => [m.id, (m.name || '').trim().split(/\s+/)[0] || ''])
  )

  const byClass: Record<string, string[]> = {}
  for (const b of bookings) {
    const list = (byClass[b.classScheduleId] ||= [])
    if (list.length >= NAMES_LIMIT) continue
    const firstName = firstNameById.get(b.memberId)
    if (firstName) list.push(firstName)
  }

  return byClass
}
