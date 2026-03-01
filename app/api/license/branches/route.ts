import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { supabase } from '../../../../lib/supabase'

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

    const { searchParams } = new URL(request.url)
    const gymId = searchParams.get('gymId')

    if (!gymId) {
      return NextResponse.json(
        { error: 'gymId مطلوب' },
        { status: 400 }
      )
    }

    const { data: branches, error } = await supabase
      .from('branches')
      .select('id, name_en, name_ar, system_license')
      .eq('gym_id', gymId)
      .order('name_en')

    if (error) {
      console.error('Fetch branches error:', error)
      return NextResponse.json(
        { error: 'فشل جلب الفروع' },
        { status: 500 }
      )
    }

    return NextResponse.json({ branches: branches || [] })
  } catch (error) {
    console.error('Get branches error:', error)
    return NextResponse.json(
      { error: 'خطأ في الخادم' },
      { status: 500 }
    )
  }
}
