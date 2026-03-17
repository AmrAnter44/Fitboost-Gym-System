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
