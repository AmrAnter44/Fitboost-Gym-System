// app/api/scripts/reset/route.ts - API لإعادة تعيين سكريبت
import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/auth'
import { resetScript } from '../../../../lib/scriptManager'

export async function POST(request: Request) {
  try {
    // التحقق من صلاحيات الأدمن
    await requireAdmin(request)

    const { scriptName } = await request.json()

    if (!scriptName) {
      return NextResponse.json(
        { error: 'اسم السكريبت مطلوب' },
        { status: 400 }
      )
    }

    // إعادة تعيين السكريبت
    await resetScript(scriptName)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ خطأ في إعادة تعيين السكريبت:', error)
    return NextResponse.json(
      { error: 'غير مصرح' },
      { status: 401 }
    )
  }
}
