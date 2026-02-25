import { NextResponse } from 'next/server'
import { requirePermission } from '../../../../lib/auth'
import { createFreshSupabaseClient } from '../../../../lib/supabase'

export const dynamic = 'force-dynamic'

// GET - جلب فروع صالة معينة من Supabase
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

    // الحصول على gymId من query parameters
    const { searchParams } = new URL(request.url)
    const gymId = searchParams.get('gymId')

    if (!gymId) {
      return NextResponse.json(
        { error: 'معرف الصالة (gymId) مطلوب' },
        { status: 400 }
      )
    }

    // جلب الفروع من Supabase (fresh client لضمان أحدث البيانات)
    const supabase = createFreshSupabaseClient()
    const { data: branches, error } = await supabase
      .from('branches')
      .select('id, name_ar, name_en, system_license')
      .eq('gym_id', gymId)
      .order('name_ar')

    if (error) {
      console.error('❌ Supabase error fetching branches:', error)
      return NextResponse.json(
        { error: 'فشل في جلب الفروع من الخادم' },
        { status: 500 }
      )
    }

    // تحويل البيانات لتتوافق مع الـ UI
    const formattedBranches = branches?.map(branch => ({
      id: branch.id,
      name: branch.name_ar || branch.name_en, // استخدام الاسم العربي أو الإنجليزي
      system_license: branch.system_license
    })) || []

    return NextResponse.json({
      success: true,
      branches: formattedBranches
    })

  } catch (error: any) {
    console.error('❌ خطأ في جلب الفروع:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'فشل في جلب الفروع' },
      { status: 500 }
    )
  }
}
