// lib/auth.ts - نظام المصادقة والصلاحيات المحدث
import jwt from 'jsonwebtoken'
import { Permissions } from '../types/permissions'
import { logError } from './errorLogger'

// ✅ Use fallback for build time, but validate at runtime
const JWT_SECRET = process.env.JWT_SECRET || 'build-time-placeholder'

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET

  // ✅ في حالة عدم وجود JWT_SECRET، استخدم fallback آمن
  if (!secret) {
    // استخدام fallback secret - يعمل في Electron app و standalone deployments
    const fallbackSecret = 'gym-management-default-secret-2024-v1'

    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ JWT_SECRET not set, using development fallback')
    }

    return fallbackSecret
  }

  return secret
}

export interface UserPayload {
  userId: string
  name: string
  email: string
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'COACH'
  staffId?: string | null
  permissions?: Permissions
}

// ✅ التحقق من المصادقة
export async function verifyAuth(request: Request): Promise<UserPayload | null> {
  try {
    // قراءة الـ cookie من headers مباشرة (أكثر موثوقية)
    const cookieHeader = request.headers.get('cookie')
    if (!cookieHeader) {
      console.log('❌ No cookie header found')
      return null
    }

    // استخراج auth-token من الـ cookies
    const cookies = cookieHeader.split(';').map(c => c.trim())
    const authCookie = cookies.find(c => c.startsWith('auth-token='))

    if (!authCookie) {
      console.log('❌ No auth-token cookie found')
      return null
    }

    const token = authCookie.split('=')[1]
    if (!token) {
      console.log('❌ Empty auth-token')
      return null
    }

    const decoded = jwt.verify(token, getJWTSecret()) as UserPayload
    console.log('✅ Auth verified for user:', decoded.email)
    return decoded
  } catch (error) {
    console.error('❌ Auth verification error:', error)
    // Mark this as an invalid token error so we can clear cookies
    if (error instanceof jwt.JsonWebTokenError) {
      (error as any).clearCookies = true
    }
    return null
  }
}

// ✅ التحقق من أن المستخدم Admin
export async function requireAdmin(request: Request): Promise<UserPayload> {
  const user = await verifyAuth(request)
  
  if (!user) {
    throw new Error('Unauthorized')
  }
  
  if (user.role !== 'ADMIN') {
    throw new Error('Forbidden: Admin access required')
  }
  
  return user
}

// ✅ التحقق من صلاحية معينة
export async function requirePermission(
  request: Request, 
  permission: keyof UserPayload['permissions']
): Promise<UserPayload> {
  const user = await verifyAuth(request)
  
  if (!user) {
    throw new Error('Unauthorized')
  }
  
  // الـ Admin عنده كل الصلاحيات
  if (user.role === 'ADMIN') {
    return user
  }
  
  // التحقق من الصلاحية المطلوبة
  if (!user.permissions || !user.permissions[permission]) {
    throw new Error(`Forbidden: Missing permission '${permission}'`)
  }
  
  return user
}

// ✅ التحقق من صلاحيات متعددة (يجب توفر واحدة على الأقل)
export async function requireAnyPermission(
  request: Request,
  permissions: Array<keyof UserPayload['permissions']>
): Promise<UserPayload> {
  const user = await verifyAuth(request)
  
  if (!user) {
    throw new Error('Unauthorized')
  }
  
  // الـ Admin عنده كل الصلاحيات
  if (user.role === 'ADMIN') {
    return user
  }
  
  // التحقق من أي صلاحية من القائمة
  const hasPermission = permissions.some(
    perm => user.permissions?.[perm]
  )
  
  if (!hasPermission) {
    throw new Error(`Forbidden: Missing required permissions`)
  }
  
  return user
}

// ✅ التحقق من صلاحيات متعددة (يجب توفر الكل)
export async function requireAllPermissions(
  request: Request,
  permissions: Array<keyof UserPayload['permissions']>
): Promise<UserPayload> {
  const user = await verifyAuth(request)
  
  if (!user) {
    throw new Error('Unauthorized')
  }
  
  // الـ Admin عنده كل الصلاحيات
  if (user.role === 'ADMIN') {
    return user
  }
  
  // التحقق من كل الصلاحيات
  const hasAllPermissions = permissions.every(
    perm => user.permissions?.[perm]
  )
  
  if (!hasAllPermissions) {
    throw new Error(`Forbidden: Missing required permissions`)
  }
  
  return user
}