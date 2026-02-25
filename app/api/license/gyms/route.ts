import { NextResponse } from 'next/server'
import { requirePermission } from '../../../../lib/auth'
import { createFreshSupabaseClient } from '../../../../lib/supabase'

export const dynamic = 'force-dynamic'

// GET - جلب قائمة الصالات الرياضية من Supabase
export async function GET(request: Request) {
  try {
    // ✅ التحقق من أن المستخدم هو OWNER
    const user = await requirePermission(request, 'canAccessSettings')

    if (user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'هذه الصفحة متاحة فقط لمالك النظام (OWNER)' },
        { status: 403 }
      )
    }

    // جلب الصالات من Supabase
    const supabase = createFreshSupabaseClient()
    const { data: gyms, error } = await supabase
      .from('gyms')
      .select('id, name_ar, name_en')
      .order('name_ar')

    if (error) {
      console.error('❌ Supabase error fetching gyms:', error)
      return NextResponse.json(
        { error: 'فشل في جلب الصالات من الخادم' },
        { status: 500 }
      )
    }

    // تحويل البيانات لتتوافق مع الـ UI
    const formattedGyms = gyms?.map(gym => ({
      id: gym.id,
      name: gym.name_ar || gym.name_en // استخدام الاسم العربي أو الإنجليزي
    })) || []

    return NextResponse.json({
      success: true,
      gyms: formattedGyms
    })

  } catch (error: any) {
    console.error('❌ خطأ في جلب الصالات:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'فشل في جلب الصالات' },
      { status: 500 }
    )
  }
}
