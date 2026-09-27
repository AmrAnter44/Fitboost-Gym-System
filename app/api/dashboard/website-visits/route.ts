import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { gw } from '../../../../lib/gateway'

export const dynamic = 'force-dynamic'

// كاش ساعة: البيانات دي بتتجاب من Supabase على الإنترنت — إحصائية "آخر 30 يوم"
// مش محتاجة تحديث لحظي، ومن غير الكاش كل فتحة داشبورد كانت بتعمل رحلة إنترنت كاملة
let visitsCache: { data: unknown; at: number } | null = null
const VISITS_CACHE_TTL_MS = 60 * 60 * 1000

// Reads website visit counts (last ~30 days) for the gym/branch tied to the
// current Fitboost-System license. Reuses the existing Supabase RPCs that
// the web-fitboost admin dashboard already uses:
//   - get_branch_visits_last_30_days(p_branch_id UUID)
//   - get_gym_visits_last_30_days(p_gym_slug TEXT)
//
// We need the gym slug (not just gym_id) for the gym-level aggregate, so
// we resolve it on the server.
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

    if (visitsCache && Date.now() - visitsCache.at < VISITS_CACHE_TTL_MS) {
      return NextResponse.json(visitsCache.data)
    }

    const license = await prisma.supabaseLicense.findFirst({
      orderBy: { lastChecked: 'desc' }
    })

    if (!license?.gymId) {
      return NextResponse.json({
        configured: false,
        branchVisits: 0,
        gymVisits: 0
      })
    }

    // عن طريق Control — الفرع والجيم من توكن الجهاز. أي فشل → 0.
    const v = await gw<{ gymSlug: string | null; branchVisits: number; gymVisits: number }>('visits', {
      timeoutMs: 8000
    }).catch(() => null)
    const gymSlug = v?.gymSlug ?? null

    const payload = {
      configured: true,
      gymSlug,
      gymName: license.gymName,
      branchName: license.branchName,
      branchVisits: Number(v?.branchVisits) || 0,
      gymVisits: Number(v?.gymVisits) || 0
    }
    if (v) visitsCache = { data: payload, at: Date.now() }
    return NextResponse.json(payload)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }
    console.error('website-visits error:', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
