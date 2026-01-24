// app/api/admin/active-sessions/route.ts
import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/auth'
import { getActiveSessions, cleanupOldSessions } from '../../../../lib/auditLog'

export async function GET(request: Request) {
  try {
    // ✅ التحقق من صلاحية Admin
    await requireAdmin(request)

    // تنظيف الـ sessions القديمة
    await cleanupOldSessions()

    // جلب الـ active sessions
    const sessions = await getActiveSessions()

    return NextResponse.json(sessions)
  } catch (error: any) {
    console.error('Error fetching active sessions:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Admin access required')) {
      return NextResponse.json(
        { error: 'يجب أن تكون Admin للوصول لهذه الصفحة' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل جلب الجلسات النشطة' },
      { status: 500 }
    )
  }
}
