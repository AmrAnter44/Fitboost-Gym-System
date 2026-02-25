import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// GET - الحصول على الاختيار الحالي للترخيص
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

    // جلب آخر سجل من SupabaseLicense
    const currentLicense = await prisma.supabaseLicense.findFirst({
      orderBy: { updatedAt: 'desc' }
    })

    if (!currentLicense) {
      return NextResponse.json({
        success: true,
        license: null,
        message: 'لم يتم اختيار صالة وفرع بعد'
      })
    }

    return NextResponse.json({
      success: true,
      license: currentLicense
    })

  } catch (error: any) {
    console.error('❌ خطأ في جلب الترخيص الحالي:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'فشل في جلب الترخيص الحالي' },
      { status: 500 }
    )
  }
}
