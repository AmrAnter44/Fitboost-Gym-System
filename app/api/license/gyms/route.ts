import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)

    // فقط OWNER يمكنه الوصول
    if (user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 403 }
      )
    }

    // Select all columns first so missing columns don't silently exclude rows,
    // then order client-side to avoid Supabase null-handling quirks.
    const { data: rawGyms, error } = await supabaseAdmin
      .from('gyms')
      .select('*')
      .range(0, 999)

    if (error) {
      console.error('❌ Supabase fetch gyms error:', error)
      return NextResponse.json(
        { error: 'فشل جلب الصالات', details: error.message },
        { status: 500 }
      )
    }

    // Normalize: every row gets id/name_en/name_ar even if Supabase has null/missing
    const gyms = (rawGyms || []).map((g: any) => ({
      id: g.id,
      name_en: g.name_en ?? g.name ?? g.id,
      name_ar: g.name_ar ?? g.name_en ?? g.name ?? g.id,
    }))

    // Client-side sort by Arabic name (fallback to en), nulls go last
    gyms.sort((a: any, b: any) => {
      const ka = (a.name_ar || a.name_en || '').toString()
      const kb = (b.name_ar || b.name_en || '').toString()
      if (!ka && !kb) return 0
      if (!ka) return 1
      if (!kb) return -1
      return ka.localeCompare(kb, 'ar')
    })

    console.log(`[license/gyms] returned ${gyms.length} gym(s) from supabase`)

    return NextResponse.json({ gyms, count: gyms.length })
  } catch (error: any) {
    console.error('❌ Unexpected error in /api/license/gyms:', error)
    console.error('Error type:', typeof error)
    console.error('Error message:', error?.message)
    console.error('Error stack:', error?.stack)
    return NextResponse.json(
      {
        error: 'خطأ في الخادم',
        message: error?.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}
