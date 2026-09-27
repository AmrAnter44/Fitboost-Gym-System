// lib/routeGuard.ts
// 🔒 حارس موحّد للـ API routes: بيرجّع المستخدم، أو NextResponse بـ 401/403 جاهز.
//   const g = await guard(request, ['canViewMembers']); if (g instanceof NextResponse) return g

import { NextResponse } from 'next/server'
import { verifyAuth, type UserPayload } from './auth'
import type { Permissions } from '../types/permissions'

export async function guard(
  request: Request,
  anyOf?: Array<keyof Permissions>,
  opts: { adminOnly?: boolean } = {}
): Promise<UserPayload | NextResponse> {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
  const isAdmin = user.role === 'OWNER' || user.role === 'ADMIN'
  if (opts.adminOnly && !isAdmin) {
    return NextResponse.json({ error: 'للأدمن بس' }, { status: 403 })
  }
  if (anyOf?.length && !isAdmin && !anyOf.some((p) => (user.permissions as any)?.[p])) {
    return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
  }
  return user
}

export function isAdminUser(user: UserPayload | null | undefined) {
  return !!user && (user.role === 'OWNER' || user.role === 'ADMIN')
}

export function hasAnyPermission(user: UserPayload | null | undefined, anyOf: Array<keyof Permissions>) {
  if (!user) return false
  if (isAdminUser(user)) return true
  return anyOf.some((p) => (user.permissions as any)?.[p])
}

/** يشيل كود الـ QR (ربط الواتساب) لأي حد مش مدير واتساب */
export function stripQr<T>(data: T, user: UserPayload): T {
  if (hasAnyPermission(user, ['canManageWhatsApp'])) return data
  const walk = (v: any): any => {
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const out: any = {}
      for (const [k, val] of Object.entries(v)) out[k] = /^qr/i.test(k) ? null : walk(val)
      return out
    }
    return v
  }
  return walk(data)
}
