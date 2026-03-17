import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  console.log('🔵 /api/license/gyms - Request received')
  try {
    console.log('🔐 Verifying auth...')
    const user = await verifyAuth(request)
    console.log('✅ Auth verified - User:', { userId: user.userId, role: user.role })

    // فقط OWNER يمكنه الوصول
    if (user.role !== 'OWNER') {
      console.log('❌ Access denied - User is not OWNER')
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 403 }
      )
    }

    console.log('📡 Fetching gyms from Supabase...')
    const { data: gyms, error } = await supabaseAdmin
      .from('gyms')
      .select('id, name_en, name_ar')
      .order('name_en')

    if (error) {
      console.error('❌ Supabase fetch gyms error:', error)
      return NextResponse.json(
        { error: 'فشل جلب الصالات', details: error.message },
        { status: 500 }
      )
    }

    console.log('✅ Gyms fetched successfully:', gyms?.length || 0, 'gyms')
    console.log('📊 Gyms data:', JSON.stringify(gyms, null, 2))

    return NextResponse.json({ gyms: gyms || [] })
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
