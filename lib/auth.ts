// lib/auth.ts - نظام المصادقة والصلاحيات المحدث
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { Permissions } from '../types/permissions'
import { logError } from './errorLogger'
import { prisma } from './prisma'

// الحساب الاحتياطي (OWNER) بيتحقق من الـ env مش من الـ DB — نتخطى فحص الـ DB له
const FALLBACK_OWNER_ID = 'fallback-fitboost-account'

/**
 * التحقق من كلمة مرور الـ OWNER — بيقبلها لو طابقت أيّ من:
 *  1) بيانات الـ env الاحتياطية (OWNER_PASSWORD_HASH_B64 / OWNER_PASSWORD_HASH / OWNER_PASSWORD)
 *     — دي نفس اللي بيتسجّل بيها الأونر الاحتياطي (fallback-fitboost-account) اللي مش موجود في الـ DB.
 *  2) باسورد حساب الأونر المخزّن في قاعدة البيانات (لو الأونر حساب حقيقي في الـ DB).
 * كده التحقق بيطابق سلوك تسجيل الدخول بدل ما يفشل مع الأونر الاحتياطي.
 */
export async function verifyOwnerPassword(
  password: string,
  currentUser: { userId?: string; email?: string }
): Promise<boolean> {
  if (!password) return false

  // 1) بيانات الـ env الاحتياطية (زي مسار تسجيل الدخول بالظبط)
  try {
    const ownerPasswordHashB64 = process.env.OWNER_PASSWORD_HASH_B64?.trim()
    const ownerPasswordHash = ownerPasswordHashB64
      ? Buffer.from(ownerPasswordHashB64, 'base64').toString('utf8')
      : process.env.OWNER_PASSWORD_HASH?.trim()
    const ownerPasswordPlain = process.env.OWNER_PASSWORD?.trim()

    if (ownerPasswordHash) {
      if (await bcrypt.compare(password, ownerPasswordHash)) return true
    } else if (ownerPasswordPlain) {
      if (password === ownerPasswordPlain) return true
    }
  } catch {
    // تجاهل وكمّل على تحقق الـ DB
  }

  // 2) حساب الأونر في قاعدة البيانات (لو موجود)
  try {
    let dbUser = currentUser.userId
      ? await prisma.user.findUnique({ where: { id: currentUser.userId }, select: { password: true } })
      : null
    if (!dbUser && currentUser.email) {
      dbUser = await prisma.user.findUnique({ where: { email: currentUser.email }, select: { password: true } })
    }
    if (dbUser?.password && await bcrypt.compare(password, dbUser.password)) return true
  } catch {
    // تجاهل
  }

  return false
}

// كاش قصير لحالة المستخدم (isActive/role) عشان منعملش DB read مع كل ريكوست.
// TTL 60 ثانية = تعطيل المستخدم أو تغيير دوره بيسري خلال دقيقة على الأكثر.
const USER_STATE_TTL_MS = 60_000
const userStateCache = new Map<string, { active: boolean; role: string; ts: number }>()

/**
 * يمسح كاش حالة مستخدم عشان أي تغيير (تعطيل/تغيير دور) يسري فوراً بدل ما
 * يستنى انتهاء الـ TTL. نادِها من مسارات تعديل/تعطيل المستخدمين.
 */
export function invalidateUserState(userId: string): void {
  userStateCache.delete(userId)
}

/**
 * يتحقق إن المستخدم لسه نشط (isActive) ودوره الحالي من الـ DB — عشان تعطيل
 * موظف أو تخفيض دوره يسري فوراً بدل ما يفضل التوكن صالح 7 أيام.
 * بيرجّع null لو المستخدم متعطّل/محذوف. لو الـ DB وقع، بيرجّع التوكن كما هو
 * (fail-open للـ availability — نفس فلسفة باقي النظام).
 */
async function applyLiveUserState(decoded: UserPayload): Promise<UserPayload | null> {
  if (!decoded?.userId || decoded.userId === FALLBACK_OWNER_ID) return decoded

  const cached = userStateCache.get(decoded.userId)
  const now = Date.now()
  if (cached && now - cached.ts < USER_STATE_TTL_MS) {
    if (!cached.active) return null
    return { ...decoded, role: cached.role as UserPayload['role'] }
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { isActive: true, role: true },
    })
    if (!dbUser) {
      userStateCache.set(decoded.userId, { active: false, role: decoded.role, ts: now })
      return null
    }
    userStateCache.set(decoded.userId, { active: dbUser.isActive, role: dbUser.role, ts: now })
    if (!dbUser.isActive) return null
    // نحدّث الدور من الـ DB عشان تخفيض الصلاحية (admin→staff) يسري فوراً
    return { ...decoded, role: dbUser.role as UserPayload['role'] }
  } catch {
    // DB unavailable — منمنعش الدخول عشان الـ availability
    return decoded
  }
}

// JWT secret is validated lazily at first use, not at module load.
// This lets `next build` succeed in CI environments that don't set the env var
// (the build only needs to compile routes — actual JWT operations happen at runtime).
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters')
  }
  return secret
}

export interface UserPayload {
  userId: string
  name: string
  email: string
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'COACH'
  staffId?: string | null
  isSales?: boolean
  permissions?: Permissions
}

// ✅ التحقق من المصادقة
export async function verifyAuth(request: Request): Promise<UserPayload | null> {
  try {
    // قراءة الـ cookie من headers مباشرة (أكثر موثوقية)
    const cookieHeader = request.headers.get('cookie')
    if (!cookieHeader) {
      return null
    }

    // استخراج auth-token من الـ cookies
    const cookies = cookieHeader.split(';').map(c => c.trim())
    const authCookie = cookies.find(c => c.startsWith('auth-token='))

    if (!authCookie) {
      return null
    }

    const token = authCookie.split('=')[1]
    if (!token) {
      return null
    }

    const decoded = jwt.verify(token, getJWTSecret()) as UserPayload
    // فحص حي: المستخدم لسه نشط ودوره الحالي (مع كاش 60 ثانية)
    return await applyLiveUserState(decoded)
  } catch (error) {
    // لا تطبع محتوى التوكن أو الـ payload — فقط نوع الخطأ
    const errName = error instanceof Error ? error.name : 'UnknownError'
    console.error('❌ Auth verification error:', errName)
    if (error instanceof jwt.JsonWebTokenError) {
      (error as any).clearCookies = true
    }
    return null
  }
}

// ✅ التحقق من أن المستخدم Admin أو Owner
export async function requireAdmin(request: Request): Promise<UserPayload> {
  const user = await verifyAuth(request)

  if (!user) {
    throw new Error('Unauthorized')
  }

  if (user.role !== 'ADMIN' && user.role !== 'OWNER') {
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

  // الـ Owner والـ Admin عندهم كل الصلاحيات
  if (user.role === 'OWNER' || user.role === 'ADMIN') {
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

  // الـ Owner والـ Admin عندهم كل الصلاحيات
  if (user.role === 'OWNER' || user.role === 'ADMIN') {
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

  // الـ Owner والـ Admin عندهم كل الصلاحيات
  if (user.role === 'OWNER' || user.role === 'ADMIN') {
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

// ✅ التحقق من أي صلاحية من القائمة مع قراءة fresh من الداتابيز لو التوكن قديم.
//  مفيدة للصلاحيات الجديدة (زي canManageOffers) اللي ممكن التوكن أو الـ Prisma client
//  يكون قديم عنها — فبنعمل fallback على raw SQL يقرا العمود مباشرة من جدول Permission.
export async function requireAnyPermissionFresh(
  request: Request,
  permissions: Array<keyof UserPayload['permissions']>
): Promise<UserPayload> {
  const user = await verifyAuth(request)
  if (!user) {
    throw new Error('Unauthorized')
  }
  if (user.role === 'OWNER' || user.role === 'ADMIN') {
    return user
  }
  //  من التوكن أولاً (أسرع)
  if (permissions.some(perm => user.permissions?.[perm])) {
    return user
  }
  //  fallback: قراءة الأعمدة مباشرة من الداتابيز (التوكن ممكن يكون قديم/الـ client outdated)
  try {
    const cols = permissions.map(p => `"${String(p)}"`).join(', ')
    const rows: any = await prisma.$queryRawUnsafe(
      `SELECT ${cols} FROM Permission WHERE userId = ? LIMIT 1`,
      user.userId
    )
    if (Array.isArray(rows) && rows.length && permissions.some(p => rows[0][p as string])) {
      return user
    }
  } catch { /* الأعمدة ممكن تكون لسه مش موجودة — نكمّل للرفض */ }
  throw new Error(`Forbidden: Missing required permissions`)
}