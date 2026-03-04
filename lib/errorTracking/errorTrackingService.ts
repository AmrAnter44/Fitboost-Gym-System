// ==========================================
// Error Tracking Service - Core
// ==========================================

import { createClient } from '@supabase/supabase-js'
import { prisma } from '../prisma'
import { sanitizeErrorMessage } from '../errorSanitizer'

// Create Supabase client with SERVICE_ROLE_KEY for error tracking
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export type ErrorType = 'FRONTEND' | 'BACKEND_API' | 'DATABASE' | 'AUTHENTICATION' | 'UNKNOWN'
export type ErrorCategory =
  | 'PRISMA_ERROR'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'JWT_ERROR'
  | 'PERMISSION_ERROR'
  | 'NOT_FOUND'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'UNKNOWN'

export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface ErrorLogInput {
  // Required
  errorType: ErrorType
  message: string

  // Context
  errorCategory?: ErrorCategory
  severity?: ErrorSeverity
  endpoint?: string
  httpMethod?: string
  statusCode?: number

  // Error details
  error?: Error | any
  errorCode?: string
  stackTrace?: string

  // User info
  userId?: string
  userEmail?: string
  userName?: string
  userRole?: string
  staffId?: string

  // Request info
  requestBody?: any
  requestHeaders?: any
  ipAddress?: string
  userAgent?: string

  // Additional
  additionalContext?: Record<string, any>
  browserInfo?: {
    url?: string
    userAgent?: string
    viewport?: string
    timestamp?: string
  }
}

/**
 * معالج ذكي لتحديد نوع الخطأ وشدته تلقائياً
 */
function categorizeError(input: ErrorLogInput): {
  category: ErrorCategory
  severity: ErrorSeverity
} {
  const message = input.message?.toLowerCase() || ''
  const error = input.error

  // Prisma Errors
  if (error?.code?.startsWith('P')) {
    return {
      category: 'PRISMA_ERROR',
      severity: ['P2002', 'P2003', 'P2025'].includes(error.code) ? 'MEDIUM' : 'HIGH'
    }
  }

  // JWT/Auth Errors
  if (message.includes('jwt') || message.includes('token') || message.includes('unauthorized')) {
    return {
      category: 'JWT_ERROR',
      severity: 'HIGH'
    }
  }

  // Permission Errors
  if (message.includes('permission') || message.includes('forbidden') || message.includes('صلاحية')) {
    return {
      category: 'PERMISSION_ERROR',
      severity: 'LOW'
    }
  }

  // Validation Errors
  if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    return {
      category: 'VALIDATION_ERROR',
      severity: 'LOW'
    }
  }

  // Network Errors
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return {
      category: 'NETWORK_ERROR',
      severity: 'MEDIUM'
    }
  }

  // Not Found
  if (input.statusCode === 404 || message.includes('not found')) {
    return {
      category: 'NOT_FOUND',
      severity: 'LOW'
    }
  }

  // Rate Limit
  if (input.statusCode === 429 || message.includes('rate limit')) {
    return {
      category: 'RATE_LIMIT',
      severity: 'MEDIUM'
    }
  }

  // Default
  return {
    category: 'UNKNOWN',
    severity: input.statusCode && input.statusCode >= 500 ? 'HIGH' : 'MEDIUM'
  }
}

/**
 * تنظيف البيانات الحساسة من request body و headers
 */
function sanitizeRequestData(data: any): any {
  if (!data || typeof data !== 'object') return data

  const sensitive = ['password', 'token', 'secret', 'apiKey', 'jwt', 'authorization', 'cookie']
  const sanitized = Array.isArray(data) ? [...data] : { ...data }

  Object.keys(sanitized).forEach(key => {
    const lowerKey = key.toLowerCase()
    if (sensitive.some(s => lowerKey.includes(s))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeRequestData(sanitized[key])
    }
  })

  return sanitized
}

/**
 * حفظ الخطأ في Supabase (non-blocking)
 */
async function logErrorToSupabase(data: any): Promise<string | null> {
  try {
    const { data: result, error } = await supabase
      .from('error_logs')
      .insert([data])
      .select('id')
      .single()

    if (error) {
      console.error('[ErrorTracking] Supabase insert failed:', error)
      return null
    }

    return result?.id || null
  } catch (err) {
    console.error('[ErrorTracking] Supabase exception:', err)
    return null
  }
}

/**
 * حفظ الخطأ في SQLite المحلي (fallback)
 */
async function logErrorToDatabase(data: any, supabaseId: string | null): Promise<boolean> {
  try {
    await prisma.errorLog.create({
      data: {
        errorType: data.error_type,
        errorCategory: data.error_category,
        severity: data.severity,
        message: data.message,
        sanitizedMessage: data.sanitized_message,
        errorCode: data.error_code,
        stackTrace: data.stack_trace,
        endpoint: data.endpoint,
        httpMethod: data.http_method,
        statusCode: data.status_code,
        userId: data.user_id,
        userEmail: data.user_email,
        userName: data.user_name,
        userRole: data.user_role,
        staffId: data.staff_id,
        requestBody: data.request_body ? JSON.stringify(data.request_body) : null,
        requestHeaders: data.request_headers ? JSON.stringify(data.request_headers) : null,
        ipAddress: data.ip_address,
        userAgent: data.user_agent,
        additionalContext: data.additional_context ? JSON.stringify(data.additional_context) : null,
        browserInfo: data.browser_info ? JSON.stringify(data.browser_info) : null,
        environment: data.environment || 'production',
        appVersion: data.app_version,
        supabaseId: supabaseId,
        syncedToSupabase: supabaseId !== null,
      }
    })

    return true
  } catch (err) {
    console.error('[ErrorTracking] SQLite insert failed:', err)
    return false
  }
}

/**
 * الدالة الرئيسية لتسجيل الأخطاء (Double Save: Supabase + SQLite)
 */
export async function logError(input: ErrorLogInput): Promise<void> {
  try {
    // 1. Auto-categorize if not provided
    const auto = categorizeError(input)
    const category = input.errorCategory || auto.category
    const severity = input.severity || auto.severity

    // 2. Extract and sanitize data
    const sanitizedMessage = sanitizeErrorMessage(input.error || input.message)
    const sanitizedBody = input.requestBody ? sanitizeRequestData(input.requestBody) : null
    const sanitizedHeaders = input.requestHeaders ? sanitizeRequestData(input.requestHeaders) : null

    // 3. Extract stack trace
    let stackTrace = input.stackTrace
    if (!stackTrace && input.error instanceof Error) {
      stackTrace = input.error.stack || null
    }

    // 4. Prepare data object
    const errorData = {
      error_type: input.errorType,
      error_category: category,
      severity: severity,
      message: input.message,
      sanitized_message: sanitizedMessage,
      error_code: input.errorCode || (input.error as any)?.code || null,
      stack_trace: stackTrace,
      endpoint: input.endpoint || null,
      http_method: input.httpMethod || null,
      status_code: input.statusCode || null,
      user_id: input.userId || null,
      user_email: input.userEmail || null,
      user_name: input.userName || null,
      user_role: input.userRole || null,
      staff_id: input.staffId || null,
      request_body: sanitizedBody,
      request_headers: sanitizedHeaders,
      ip_address: input.ipAddress || null,
      user_agent: input.userAgent || null,
      additional_context: input.additionalContext || null,
      browser_info: input.browserInfo || null,
      environment: process.env.NODE_ENV || 'production',
      app_version: process.env.NEXT_PUBLIC_APP_VERSION || null,
    }

    // 5. Save to Supabase (non-blocking - don't wait)
    const supabaseId = await logErrorToSupabase(errorData)

    // 6. Save to SQLite (local backup)
    await logErrorToDatabase(errorData, supabaseId)

    // 7. Keep file log for critical errors
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      try {
        const { logError: logToFile } = await import('../errorLogger')
        logToFile({
          error: input.error || new Error(input.message),
          endpoint: input.endpoint || 'UNKNOWN',
          method: input.httpMethod || 'UNKNOWN',
          statusCode: input.statusCode || 500,
          userId: input.userId,
          userEmail: input.userEmail,
          userRole: input.userRole,
          staffId: input.staffId,
          requestBody: sanitizedBody,
          additionalContext: {
            errorType: input.errorType,
            severity,
            category,
            ...input.additionalContext
          }
        })
      } catch (fileLogError) {
        // Ignore file log errors
        console.error('[ErrorTracking] File log failed:', fileLogError)
      }
    }

  } catch (loggingError) {
    // إذا فشل نظام التسجيل نفسه، اطبع في console فقط
    console.error('[ErrorTracking] FATAL: Failed to log error:', loggingError)
    console.error('[ErrorTracking] Original error:', input)
  }
}

/**
 * Helper: Log Backend API Error
 */
export async function logBackendError(params: {
  error: Error | any
  endpoint: string
  method: string
  statusCode?: number
  userId?: string
  userEmail?: string
  userName?: string
  userRole?: string
  staffId?: string
  requestBody?: any
  ipAddress?: string
  userAgent?: string
  additionalContext?: Record<string, any>
}): Promise<void> {
  await logError({
    errorType: 'BACKEND_API',
    message: params.error?.message || String(params.error),
    error: params.error,
    endpoint: params.endpoint,
    httpMethod: params.method,
    statusCode: params.statusCode || 500,
    userId: params.userId,
    userEmail: params.userEmail,
    userName: params.userName,
    userRole: params.userRole,
    staffId: params.staffId,
    requestBody: params.requestBody,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    additionalContext: params.additionalContext,
  })
}

/**
 * Helper: Log Database Error
 */
export async function logDatabaseError(params: {
  error: any
  operation: string
  model?: string
  userId?: string
  userName?: string
  userRole?: string
  additionalContext?: Record<string, any>
}): Promise<void> {
  await logError({
    errorType: 'DATABASE',
    message: params.error?.message || String(params.error),
    error: params.error,
    errorCode: params.error?.code,
    endpoint: `Database/${params.model || 'Unknown'}`,
    httpMethod: params.operation,
    userId: params.userId,
    userName: params.userName,
    userRole: params.userRole,
    additionalContext: {
      model: params.model,
      ...params.additionalContext
    }
  })
}

/**
 * Helper: Log Frontend Error
 */
export async function logFrontendError(params: {
  message: string
  error?: Error | any
  url?: string
  userAgent?: string
  userId?: string
  userName?: string
  additionalContext?: Record<string, any>
}): Promise<void> {
  await logError({
    errorType: 'FRONTEND',
    message: params.message,
    error: params.error,
    browserInfo: {
      url: params.url || (typeof window !== 'undefined' ? window.location.href : undefined),
      userAgent: params.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
      viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : undefined,
      timestamp: new Date().toISOString()
    },
    userId: params.userId,
    userName: params.userName,
    additionalContext: params.additionalContext
  })
}

/**
 * Sync unsynchronized errors to Supabase (background job)
 */
export async function syncErrorsToSupabase(): Promise<{
  synced: number
  failed: number
}> {
  try {
    // Get unsynced errors (max 100 at a time)
    const unsynced = await prisma.errorLog.findMany({
      where: {
        syncedToSupabase: false,
        syncAttempts: { lt: 3 } // Max 3 attempts
      },
      take: 100,
      orderBy: { createdAt: 'asc' }
    })

    let synced = 0
    let failed = 0

    for (const log of unsynced) {
      const supabaseData = {
        error_type: log.errorType,
        error_category: log.errorCategory,
        severity: log.severity,
        message: log.message,
        sanitized_message: log.sanitizedMessage,
        error_code: log.errorCode,
        stack_trace: log.stackTrace,
        endpoint: log.endpoint,
        http_method: log.httpMethod,
        status_code: log.statusCode,
        user_id: log.userId,
        user_email: log.userEmail,
        user_name: log.userName,
        user_role: log.userRole,
        staff_id: log.staffId,
        request_body: log.requestBody ? JSON.parse(log.requestBody) : null,
        request_headers: log.requestHeaders ? JSON.parse(log.requestHeaders) : null,
        ip_address: log.ipAddress,
        user_agent: log.userAgent,
        additional_context: log.additionalContext ? JSON.parse(log.additionalContext) : null,
        browser_info: log.browserInfo ? JSON.parse(log.browserInfo) : null,
        environment: log.environment,
        app_version: log.appVersion,
        created_at: log.createdAt.toISOString(),
      }

      const { data, error } = await supabase
        .from('error_logs')
        .insert([supabaseData])
        .select('id')
        .single()

      if (error) {
        // Update failed attempt
        await prisma.errorLog.update({
          where: { id: log.id },
          data: {
            syncAttempts: log.syncAttempts + 1,
            lastSyncAttempt: new Date()
          }
        })
        failed++
      } else {
        // Update success
        await prisma.errorLog.update({
          where: { id: log.id },
          data: {
            syncedToSupabase: true,
            supabaseId: data.id,
            lastSyncAttempt: new Date()
          }
        })
        synced++
      }
    }

    return { synced, failed }
  } catch (error) {
    console.error('[ErrorTracking] Sync failed:', error)
    return { synced: 0, failed: 0 }
  }
}
