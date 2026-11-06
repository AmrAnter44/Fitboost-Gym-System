// lib/fitboostAdminSession.ts
// جلسة حساب FitBoost Admin (بعد ما Control يتحقق من الباسورد + كود التحقق) —
// مشتركة بين /api/auth/login و /api/license/admin-activate.
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { DEFAULT_PERMISSIONS } from '../types/permissions'
import { logLogin, getIpAddress, getUserAgent } from './auditLog'

// JWT secret is read lazily so `next build` can compile routes in CI without the env var.
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters')
  }
  return secret
}

/**
 * Cookies should be marked Secure only when actually served over HTTPS.
 * On a gym LAN where employees connect via plain HTTP to the host PC's
 * Fitboost server, Secure cookies would be silently dropped by the browser.
 *   1. x-forwarded-proto header (proxies / reverse-proxies)
 *   2. request.url scheme (direct connection)
 *   3. Falls back to NODE_ENV
 */
export function cookieSecure(request?: Request): boolean {
  if (request) {
    const xfProto = request.headers.get('x-forwarded-proto')
    if (xfProto) return xfProto.toLowerCase() === 'https'
    try {
      return new URL(request.url).protocol === 'https:'
    } catch { /* fall through */ }
  }
  return process.env.NODE_ENV === 'production'
}

/** يعمل جلسة FitBoost Admin (١٢ ساعة) ويرجّع الرد بالكوكي */
export async function fitboostAdminSessionResponse(
  request: Request,
  admin: { name?: string | null; email: string },
  extra: Record<string, unknown> = {}
) {
  const adminUser = {
    id: 'fallback-fitboost-account',
    name: admin.name ? `FitBoost · ${admin.name}` : 'FitBoost Admin',
    email: admin.email.trim().toLowerCase(),
    role: 'OWNER' as const,
    staffId: null,
    permissions: DEFAULT_PERMISSIONS.OWNER
  }
  const token = jwt.sign(
    {
      userId: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      staffId: null,
      permissions: DEFAULT_PERMISSIONS.OWNER
    },
    getJwtSecret(),
    { expiresIn: '12h' } // جلسة قصيرة لحساب بيدخل على كل الجيمات
  )
  const response = NextResponse.json({ success: true, user: adminUser, ...extra })
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: cookieSecure(request),
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 12
  })
  try {
    await logLogin({
      userId: adminUser.id,
      userEmail: adminUser.email,
      userName: adminUser.name,
      userRole: adminUser.role,
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request)
    })
  } catch { /* audit اختياري */ }
  return response
}
