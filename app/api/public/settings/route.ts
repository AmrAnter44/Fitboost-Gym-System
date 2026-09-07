import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiCache } from '@/lib/cache';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';

// Cache TTL: 60s — settings rarely change, and mobile apps poll on launch only
const SETTINGS_CACHE_TTL = 60_000

const DEFAULTS = {
  pointsEnabled: true,
  spaEnabled: true,
  nutritionEnabled: true,
  physiotherapyEnabled: true,
  groupClassEnabled: true,
  inBodyEnabled: true,
}

export async function GET(request: NextRequest) {
  // Rate limit: 30 requests/minute per IP
  const rl = checkRateLimit(getClientIdentifier(request), {
    id: 'public-settings',
    limit: 30,
    windowMs: 60_000,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'طلبات كثيرة جداً، حاول بعد قليل' },
      { status: 429 }
    )
  }

  const cacheKey = 'public:settings'
  const cached = apiCache.get<object>(cacheKey)
  if (cached) {
    return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } })
  }

  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'singleton' },
      select: {
        pointsEnabled: true,
        spaEnabled: true,
        nutritionEnabled: true,
        physiotherapyEnabled: true,
        groupClassEnabled: true,
        inBodyEnabled: true,
        gymLogo: true,
        primaryColor: true,
        appTerms: true,
      },
    })

    // نص الشروط اللي التطبيق بيعرضه. مقصود إنه منفصل عن receiptTerms:
    // شروط الإيصال ممكن تكون أي حاجة (لينكات، ملاحظات)، ومش صح تتعرض
    // للعضو كشروط لازم يوافق عليها. فاضي = مفيش شاشة موافقة أصلاً.
    let result: Record<string, unknown> = { ...DEFAULTS }
    if (settings) {
      const { appTerms, ...rest } = settings
      result = { ...rest, terms: (appTerms || '').trim() || null }
    }

    apiCache.set(cacheKey, result, SETTINGS_CACHE_TTL)

    return NextResponse.json(result, { headers: { 'X-Cache': 'MISS' } })
  } catch (error) {
    console.error('Get public settings error:', error);
    // On DB error, return safe defaults — app should still function
    return NextResponse.json(DEFAULTS)
  }
}
