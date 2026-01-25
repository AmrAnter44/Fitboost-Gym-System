/**
 * Audit Logging System
 * نظام شامل لتسجيل جميع العمليات الحساسة في النظام
 */

import { prisma } from './prisma'

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'VIEW'
  | 'ACCESS_DENIED'
  | 'PERMISSION_CHANGE'
  | 'PASSWORD_CHANGE'
  | 'USER_ACTIVATE'
  | 'USER_DEACTIVATE'
  | 'EXPORT'
  | 'RATE_LIMIT_HIT'

export type AuditResource =
  | 'Member'
  | 'Staff'
  | 'User'
  | 'Permission'
  | 'Receipt'
  | 'PT'
  | 'DayUse'
  | 'Visitor'
  | 'FollowUp'
  | 'Expense'
  | 'Offer'
  | 'Auth'
  | 'System'

export type AuditStatus = 'success' | 'failure' | 'warning'

export interface AuditLogData {
  userId?: string
  userEmail?: string
  userName?: string
  userRole?: string
  action: AuditAction
  resource: AuditResource
  resourceId?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  status?: AuditStatus
  errorMessage?: string
}

/**
 * إنشاء audit log entry
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
        userRole: data.userRole,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        details: data.details ? JSON.stringify(data.details) : null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: data.status || 'success',
        errorMessage: data.errorMessage
      }
    })
  } catch (error) {
    // Don't fail the main operation if audit log fails
    console.error('❌ Failed to create audit log:', error)
  }
}

/**
 * تسجيل login ناجح
 */
export async function logLogin(data: {
  userId: string
  userEmail: string
  userName: string
  userRole: string
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  await createAuditLog({
    ...data,
    action: 'LOGIN',
    resource: 'Auth',
    status: 'success',
    details: {
      timestamp: new Date().toISOString()
    }
  })

  // إنشاء active session
  await createActiveSession(data)
}

/**
 * تسجيل login فاشل
 */
export async function logLoginFailure(data: {
  email: string
  reason: string
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  await createAuditLog({
    userEmail: data.email,
    action: 'LOGIN_FAILED',
    resource: 'Auth',
    status: 'failure',
    errorMessage: data.reason,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    details: {
      timestamp: new Date().toISOString(),
      attemptedEmail: data.email
    }
  })
}

/**
 * تسجيل logout
 */
export async function logLogout(data: {
  userId: string
  userEmail: string
  userName: string
  userRole: string
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  await createAuditLog({
    ...data,
    action: 'LOGOUT',
    resource: 'Auth',
    status: 'success'
  })

  // تحديث active session
  await deactivateSession(data.userId)
}

/**
 * تسجيل عملية حذف
 */
export async function logDeletion(data: {
  userId: string
  userEmail: string
  userName: string
  userRole: string
  resource: AuditResource
  resourceId: string
  resourceName?: string
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  await createAuditLog({
    ...data,
    action: 'DELETE',
    status: 'success',
    details: {
      resourceName: data.resourceName,
      deletedAt: new Date().toISOString()
    }
  })
}

/**
 * تسجيل تعديل الصلاحيات
 */
export async function logPermissionChange(data: {
  userId: string
  userEmail: string
  userName: string
  userRole: string
  targetUserId: string
  targetUserEmail: string
  changes: Record<string, any>
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  await createAuditLog({
    userId: data.userId,
    userEmail: data.userEmail,
    userName: data.userName,
    userRole: data.userRole,
    action: 'PERMISSION_CHANGE',
    resource: 'Permission',
    resourceId: data.targetUserId,
    status: 'success',
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    details: {
      targetUser: data.targetUserEmail,
      changes: data.changes,
      changedAt: new Date().toISOString()
    }
  })
}

/**
 * تسجيل محاولة وصول مرفوضة
 */
export async function logAccessDenied(data: {
  userId?: string
  userEmail?: string
  userName?: string
  userRole?: string
  resource: AuditResource
  action: string
  reason: string
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  await createAuditLog({
    ...data,
    action: 'ACCESS_DENIED',
    status: 'warning',
    errorMessage: data.reason,
    details: {
      attemptedAction: data.action,
      deniedAt: new Date().toISOString()
    }
  })
}

/**
 * تسجيل rate limit hit
 */
export async function logRateLimitHit(data: {
  email?: string
  ipAddress?: string
  userAgent?: string
  endpoint: string
}): Promise<void> {
  await createAuditLog({
    userEmail: data.email,
    action: 'RATE_LIMIT_HIT',
    resource: 'System',
    status: 'warning',
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    details: {
      endpoint: data.endpoint,
      timestamp: new Date().toISOString()
    }
  })
}

// ==================== Active Sessions Management ====================

/**
 * إنشاء active session
 */
export async function createActiveSession(data: {
  userId: string
  userEmail: string
  userName: string
  userRole: string
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  try {
    // إلغاء أي sessions قديمة لنفس المستخدم
    await prisma.activeSession.updateMany({
      where: { userId: data.userId },
      data: { isActive: false }
    })

    // إنشاء session جديد
    await prisma.activeSession.create({
      data: {
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
        userRole: data.userRole,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        isActive: true
      }
    })
  } catch (error) {
    console.error('❌ Failed to create active session:', error)
  }
}

/**
 * تحديث last activity للـ session
 */
export async function updateSessionActivity(userId: string): Promise<void> {
  try {
    await prisma.activeSession.updateMany({
      where: {
        userId,
        isActive: true
      },
      data: {
        lastActivityAt: new Date()
      }
    })
  } catch (error) {
    console.error('❌ Failed to update session activity:', error)
  }
}

/**
 * إلغاء active session
 */
export async function deactivateSession(userId: string): Promise<void> {
  try {
    await prisma.activeSession.updateMany({
      where: { userId },
      data: { isActive: false }
    })
  } catch (error) {
    console.error('❌ Failed to deactivate session:', error)
  }
}

/**
 * جلب الـ active sessions
 */
export async function getActiveSessions() {
  return await prisma.activeSession.findMany({
    where: { isActive: true },
    orderBy: { lastActivityAt: 'desc' }
  })
}

/**
 * تنظيف الـ sessions القديمة (أكثر من 7 أيام بدون نشاط)
 */
export async function cleanupOldSessions(): Promise<void> {
  try {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    await prisma.activeSession.updateMany({
      where: {
        lastActivityAt: {
          lt: sevenDaysAgo
        },
        isActive: true
      },
      data: {
        isActive: false
      }
    })
  } catch (error) {
    console.error('❌ Failed to cleanup old sessions:', error)
  }
}

// ==================== Helper Functions ====================

/**
 * استخراج IP address من request
 */
export function getIpAddress(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  if (realIp) {
    return realIp
  }

  return undefined
}

/**
 * استخراج User Agent من request
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined
}

/**
 * جلب audit logs مع فلترة
 */
export async function getAuditLogs(options: {
  limit?: number
  offset?: number
  userId?: string
  userSearch?: string  // Search by name or email
  action?: AuditAction
  resource?: AuditResource
  status?: AuditStatus
  startDate?: Date
  endDate?: Date
}) {
  const where: any = {}

  if (options.userId) where.userId = options.userId

  // User search by name or email
  if (options.userSearch) {
    where.OR = [
      { userName: { contains: options.userSearch, mode: 'insensitive' } },
      { userEmail: { contains: options.userSearch, mode: 'insensitive' } }
    ]
  }

  if (options.action) where.action = options.action
  if (options.resource) where.resource = options.resource
  if (options.status) where.status = options.status

  if (options.startDate || options.endDate) {
    where.createdAt = {}
    if (options.startDate) where.createdAt.gte = options.startDate
    if (options.endDate) where.createdAt.lte = options.endDate
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 100,
      skip: options.offset || 0
    }),
    prisma.auditLog.count({ where })
  ])

  return { logs, total }
}
