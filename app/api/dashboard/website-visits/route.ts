import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { supabaseAdmin } from '../../../../lib/supabase'

export const dynamic = 'force-dynamic'

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
    await verifyAuth(request)

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

    // Look up the gym slug — we need it for the gym-level RPC.
    let gymSlug: string | null = null
    {
      const { data, error } = await supabaseAdmin
        .from('gyms')
        .select('slug')
        .eq('id', license.gymId)
        .single()
      if (!error && data?.slug) gymSlug = data.slug
    }

    // Fire both RPCs in parallel; failures degrade to 0.
    const [branchRes, gymRes] = await Promise.all([
      license.branchId
        ? supabaseAdmin.rpc('get_branch_visits_last_30_days', { p_branch_id: license.branchId })
        : Promise.resolve({ data: 0, error: null }),
      gymSlug
        ? supabaseAdmin.rpc('get_gym_visits_last_30_days', { p_gym_slug: gymSlug })
        : Promise.resolve({ data: 0, error: null })
    ])

    return NextResponse.json({
      configured: true,
      gymSlug,
      gymName: license.gymName,
      branchName: license.branchName,
      branchVisits: Number(branchRes.data) || 0,
      gymVisits: Number(gymRes.data) || 0
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }
    console.error('website-visits error:', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
