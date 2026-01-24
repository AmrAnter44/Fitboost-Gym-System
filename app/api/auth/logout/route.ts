// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { logLogout, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export async function POST(request: Request) {
  try {
    // التحقق من المستخدم الحالي
    const user = await verifyAuth(request)

    if (user) {
      // 📝 Audit: Logout
      await logLogout({
        userId: user.userId,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      })
    }

    // حذف الـ cookie
    const response = NextResponse.json({ success: true })
    response.cookies.delete('auth-token')

    return response
  } catch (error) {
    console.error('Logout error:', error)
    // حذف الـ cookie حتى لو حدث خطأ
    const response = NextResponse.json({ success: true })
    response.cookies.delete('auth-token')
    return response
  }
}