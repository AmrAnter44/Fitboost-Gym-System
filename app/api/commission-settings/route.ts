import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'

// GET - جلب إعدادات الكومشن
export async function GET(request: NextRequest) {
  try {
    // البحث عن الإعدادات الموجودة
    let settings = await prisma.commissionSettings.findFirst()

    // إذا لم توجد إعدادات، إنشاء إعدادات افتراضية
    if (!settings) {
      settings = await prisma.commissionSettings.create({
        data: {
          tierCount: 5,
          tier1Limit: 5000,
          tier2Limit: 11000,
          tier3Limit: 15000,
          tier4Limit: 20000,
          tier1Rate: 25,
          tier2Rate: 30,
          tier3Rate: 35,
          tier4Rate: 40,
          tier5Rate: 45
        }
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching commission settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch commission settings' },
      { status: 500 }
    )
  }
}

// PUT - تحديث إعدادات الكومشن
export async function PUT(request: NextRequest) {
  try {
    await requirePermission(request, 'canAccessSettings')

    const body = await request.json()

    // 🛡️ defaults حالية من الـ DB عشان أي حقل ناقص في الـ body ما يكسرش الكتابة
    const existing = await prisma.commissionSettings.findFirst()
    const fallback = existing ?? {
      tierCount: 5,
      tier1Limit: 5000,
      tier2Limit: 11000,
      tier3Limit: 15000,
      tier4Limit: 20000,
      tier1Rate: 25,
      tier2Rate: 30,
      tier3Rate: 35,
      tier4Rate: 40,
      tier5Rate: 45,
    }

    // 🔢 helper: يطلّع number صالح، أو يرجّع الـ default الحالي
    const num = (raw: any, fallbackVal: number): number => {
      if (raw === null || raw === undefined || raw === '') return fallbackVal
      const n = Number(raw)
      return Number.isFinite(n) ? n : fallbackVal
    }

    const tierCount = Math.min(5, Math.max(2, Math.round(num(body.tierCount, fallback.tierCount))))

    const tier1Limit = num(body.tier1Limit, fallback.tier1Limit)
    const tier2Limit = num(body.tier2Limit, fallback.tier2Limit)
    const tier3Limit = num(body.tier3Limit, fallback.tier3Limit)
    const tier4Limit = num(body.tier4Limit, fallback.tier4Limit)

    const tier1Rate = num(body.tier1Rate, fallback.tier1Rate)
    const tier2Rate = num(body.tier2Rate, fallback.tier2Rate)
    const tier3Rate = num(body.tier3Rate, fallback.tier3Rate)
    const tier4Rate = num(body.tier4Rate, fallback.tier4Rate)
    const tier5Rate = num(body.tier5Rate, fallback.tier5Rate)

    const limits = [tier1Limit, tier2Limit, tier3Limit, tier4Limit]
    const rates = [tier1Rate, tier2Rate, tier3Rate, tier4Rate, tier5Rate]

    // ✅ التحقق على الحدود الفعّالة (N-1 حد لـ N مستوى) — كلها لازم موجبة ومرتبة تصاعدياً
    const activeLimits = limits.slice(0, tierCount - 1)
    for (let i = 0; i < activeLimits.length; i++) {
      if (!Number.isFinite(activeLimits[i]) || activeLimits[i] < 0) {
        return NextResponse.json(
          { error: 'يجب أن تكون حدود الدخل أرقاماً صحيحة موجبة' },
          { status: 400 }
        )
      }
      if (i > 0 && activeLimits[i] <= activeLimits[i - 1]) {
        return NextResponse.json(
          { error: 'يجب أن تكون حدود الدخل مرتبة تصاعدياً' },
          { status: 400 }
        )
      }
    }

    // ✅ التحقق على النسب الفعّالة (N نسبة) — بين 0 و 100
    const activeRates = rates.slice(0, tierCount)
    for (const rate of activeRates) {
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        return NextResponse.json(
          { error: 'يجب أن تكون النسب بين 0 و 100' },
          { status: 400 }
        )
      }
    }

    const writeData = {
      tierCount,
      tier1Limit,
      tier2Limit,
      tier3Limit,
      tier4Limit,
      tier1Rate,
      tier2Rate,
      tier3Rate,
      tier4Rate,
      tier5Rate,
    }

    const settings = existing
      ? await prisma.commissionSettings.update({ where: { id: existing.id }, data: writeData })
      : await prisma.commissionSettings.create({ data: writeData })

    return NextResponse.json(settings)
  } catch (error: any) {
    console.error('Error updating commission settings:', error)

    // ✅ التعامل الصحيح مع أخطاء الـ auth (الكود القديم كان بيدوّر على 'Permission denied' اللي ما بيتمش رميه)
    if (error?.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    if (typeof error?.message === 'string' && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية لتعديل الإعدادات' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update commission settings' },
      { status: 500 }
    )
  }
}
