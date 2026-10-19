import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiCache } from '@/lib/cache'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

// الأسعار مش بتتغير كتير — كاش دقيقة زي /api/public/settings
const OFFERS_CACHE_TTL = 60_000

// الحصص المجانية في الباقة + الإعداد اللي بيخفيها لو الخدمة متقفلة في الجيم
const FREE_SESSION_FIELDS = [
  { field: 'freePTSessions', type: 'pt', label: 'حصص PT', setting: null },
  { field: 'freeNutritionSessions', type: 'nutrition', label: 'جلسات تغذية', setting: 'nutritionEnabled' },
  { field: 'freePhysioSessions', type: 'physio', label: 'جلسات علاج طبيعي', setting: 'physiotherapyEnabled' },
  { field: 'freeGroupClassSessions', type: 'groupClass', label: 'حصص جروب كلاس', setting: 'groupClassEnabled' },
  { field: 'freePoolSessions', type: 'pool', label: 'حصص حمام سباحة', setting: 'poolEnabled' },
  { field: 'freePadelSessions', type: 'padel', label: 'حصص بادل', setting: 'padelEnabled' },
  { field: 'freeAssessmentSessions', type: 'assessment', label: 'جلسات تقييم', setting: null },
  { field: 'freeMoreSessions', type: 'more', label: 'حصص المزيد', setting: 'moreEnabled' },
] as const

/**
 * GET — باقات الاشتراك (Offer) وباقات الحصص (PT / More من ServicePackage) النشطة
 * للعرض في شاشة "العروض والأسعار" في الأبلكيشن، للجيمات اللي مالهاش بيانات موقع.
 *
 * 🔒 حقول للعميل بس — مفيش minPrice ولا ptCommission ولا upgradePoints ولا
 * أسعار الخدمات الداخلية (nutritionPrice…) ولا moreCommission.
 */
export async function GET(request: NextRequest) {
  const rl = checkRateLimit(getClientIdentifier(request), {
    id: 'public-offers',
    limit: 30,
    windowMs: 60_000,
  })
  if (!rl.success) {
    return NextResponse.json({ error: 'طلبات كثيرة جداً، حاول بعد قليل' }, { status: 429 })
  }

  const cacheKey = 'public:offers'
  const cached = apiCache.get<object>(cacheKey)
  if (cached) {
    return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } })
  }

  try {
    const [offers, packages, settings] = await Promise.all([
      prisma.offer.findMany({
        where: { isActive: true },
        orderBy: [{ duration: 'asc' }, { price: 'asc' }],
        select: {
          id: true, name: true, duration: true, price: true,
          freePTSessions: true, freeNutritionSessions: true, freePhysioSessions: true,
          freeGroupClassSessions: true, freePoolSessions: true, freePadelSessions: true,
          freeAssessmentSessions: true, freeMoreSessions: true,
          inBodyScans: true, invitations: true, freezeDays: true, maxCheckIns: true,
          allowedCheckInStart: true, allowedCheckInEnd: true, icon: true,
        },
      }),
      prisma.servicePackage.findMany({
        where: { isActive: true, serviceType: { in: ['PT', 'More'] } },
        orderBy: [{ serviceType: 'asc' }, { sessions: 'asc' }, { price: 'asc' }],
        select: { id: true, name: true, serviceType: true, sessions: true, price: true, durationDays: true },
      }),
      prisma.systemSettings.findUnique({
        where: { id: 'singleton' },
        select: {
          nutritionEnabled: true, physiotherapyEnabled: true, groupClassEnabled: true,
          moreEnabled: true, poolEnabled: true, padelEnabled: true,
        },
      }),
    ])

    const enabled = (key: string | null) =>
      !key || !settings || (settings as Record<string, boolean | null>)[key] !== false

    const memberships = offers.map((o) => ({
      id: o.id,
      name: o.name,
      durationDays: o.duration,
      price: o.price,
      freezeDays: o.freezeDays,
      invitations: o.invitations,
      inBodyScans: o.inBodyScans,
      maxCheckIns: o.maxCheckIns, // 0 = دخول غير محدود طول المدة
      allowedCheckInStart: o.allowedCheckInStart || null,
      allowedCheckInEnd: o.allowedCheckInEnd || null,
      icon: o.icon,
      freeSessions: FREE_SESSION_FIELDS
        .filter((f) => enabled(f.setting) && (o[f.field] ?? 0) > 0)
        .map((f) => ({ type: f.type, label: f.label, count: o[f.field] })),
    }))

    const sessionPackages = packages
      .filter((p) => p.serviceType !== 'More' || enabled('moreEnabled'))
      .map((p) => ({
        id: p.id,
        name: p.name,
        serviceType: p.serviceType === 'More' ? ('more' as const) : ('pt' as const),
        sessions: p.sessions,
        price: p.price,
        durationDays: p.durationDays,
      }))

    const result = { memberships, sessionPackages }
    apiCache.set(cacheKey, result, OFFERS_CACHE_TTL)
    return NextResponse.json(result, { headers: { 'X-Cache': 'MISS' } })
  } catch (error) {
    console.error('Get public offers error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ memberships: [], sessionPackages: [] })
  }
}
