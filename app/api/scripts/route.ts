// app/api/scripts/route.ts - API لجلب السكريبتات المنفذة
import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../lib/auth'
import { getExecutedScripts } from '../../../lib/scriptManager'

export async function GET(request: Request) {
  try {
    // التحقق من صلاحيات الأدمن
    await requireAdmin(request)

    // جلب السكريبتات
    const scripts = await getExecutedScripts()

    return NextResponse.json({ scripts })
  } catch (error) {
    console.error('❌ خطأ في جلب السكريبتات:', error)
    return NextResponse.json(
      { error: 'غير مصرح' },
      { status: 401 }
    )
  }
}
