// lib/errorLogger.ts
// نظام تسجيل الأخطاء في ملف (Error Logging System)

import fs from 'fs'
import path from 'path'

// مسار مجلد اللوجات
const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'errors.log')
const DAYS_TO_KEEP = 30

/**
 * التأكد من وجود مجلد logs/
 */
function ensureLogDirectory(): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true })
      console.log('✅ Created logs directory:', LOG_DIR)
    }
  } catch (error) {
    console.error('⚠️ Cannot create logs directory:', error)
    // Fallback: استخدام temp directory
    const tempDir = path.join(require('os').tmpdir(), 'xgym-logs')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
  }
}

/**
 * إزالة البيانات الحساسة من request body
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body
  }

  const sanitized = { ...body }
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'secretKey']

  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]'
    }
  })

  return sanitized
}

/**
 * معلومات الخطأ للتسجيل
 */
export interface ErrorLogParams {
  error: Error | any
  endpoint: string
  method: string
  statusCode: number
  userId?: string
  userEmail?: string
  userRole?: string
  staffId?: string
  requestBody?: any
  additionalContext?: Record<string, any>
}

/**
 * تسجيل الخطأ في الملف
 */
export function logError(params: ErrorLogParams): void {
  try {
    ensureLogDirectory()

    const {
      error,
      endpoint,
      method,
      statusCode,
      userId,
      userEmail,
      userRole,
      staffId,
      requestBody,
      additionalContext
    } = params

    // تنسيق timestamp
    const timestamp = new Date().toISOString()

    // بناء log entry
    let logEntry = `[${timestamp}] ERROR | ${method} ${endpoint} | ${statusCode}\n`

    // معلومات المستخدم (إذا كانت متاحة)
    if (userEmail || userId) {
      logEntry += `User: ${userEmail || 'N/A'}`
      if (userRole) logEntry += ` (${userRole}`
      if (userId) logEntry += `, userId: ${userId}`
      if (staffId) logEntry += `, staffId: ${staffId}`
      if (userRole) logEntry += `)`
      logEntry += '\n'
    }

    // رسالة الخطأ
    const errorMessage = error?.message || String(error)
    logEntry += `Error: ${errorMessage}\n`

    // Stack trace (إذا كان متاحاً)
    if (error?.stack) {
      logEntry += `Stack:\n${error.stack}\n`
    }

    // Request body (مع sanitization)
    if (requestBody) {
      const sanitized = sanitizeBody(requestBody)
      logEntry += `Request Body: ${JSON.stringify(sanitized)}\n`
    }

    // Additional context
    if (additionalContext) {
      logEntry += `Additional Context: ${JSON.stringify(additionalContext)}\n`
    }

    // فاصل بين الـ entries
    logEntry += '---\n'

    // كتابة للملف (synchronous للأمان في حالة crash)
    fs.appendFileSync(LOG_FILE, logEntry, 'utf8')

  } catch (loggerError) {
    // Fallback: إذا فشل التسجيل في الملف، اطبع في console فقط
    console.error('⚠️ Logger failed to write to file:', loggerError)
    console.error('Original error:', params.error)
  }
}

/**
 * حذف اللوجات الأقدم من عدد معين من الأيام
 */
export function cleanupOldLogs(daysToKeep: number = DAYS_TO_KEEP): {
  success: boolean
  removedEntries?: number
  totalEntries?: number
  message?: string
} {
  try {
    ensureLogDirectory()

    // التحقق من وجود الملف
    if (!fs.existsSync(LOG_FILE)) {
      return {
        success: true,
        message: 'No log file to clean up'
      }
    }

    // فحص حجم الملف - إذا كان كبير جداً (>50MB)، اختصر المدة
    const stats = fs.statSync(LOG_FILE)
    const fileSizeMB = stats.size / (1024 * 1024)

    if (fileSizeMB > 50) {
      console.warn(`⚠️ Log file is ${fileSizeMB.toFixed(2)}MB, forcing aggressive cleanup...`)
      daysToKeep = 7 // احتفظ بـ 7 أيام فقط
    }

    // قراءة الملف
    const logContent = fs.readFileSync(LOG_FILE, 'utf8')

    // تقسيم إلى entries
    const entries = logContent.split('---\n').filter(e => e.trim())

    // حساب تاريخ الحد الأدنى
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    // تصفية الـ entries - الاحتفاظ بالحديثة فقط
    const recentEntries = entries.filter(entry => {
      // استخراج timestamp من أول سطر [2026-01-04T14:30:45.123Z]
      const timestampMatch = entry.match(/\[([^\]]+)\]/)
      if (!timestampMatch) return true // احتفظ بـ entries بدون timestamp

      try {
        const entryDate = new Date(timestampMatch[1])
        return entryDate >= cutoffDate
      } catch {
        return true // احتفظ بـ entries بتاريخ غير صالح
      }
    })

    const removedCount = entries.length - recentEntries.length

    // إعادة كتابة الملف بالـ entries الحديثة فقط
    if (removedCount > 0) {
      const newContent = recentEntries.join('---\n') + (recentEntries.length > 0 ? '---\n' : '')
      fs.writeFileSync(LOG_FILE, newContent, 'utf8')

      console.log(`✅ Cleaned up ${removedCount} old log entries (kept ${recentEntries.length})`)

      return {
        success: true,
        removedEntries: removedCount,
        totalEntries: entries.length,
        message: `Removed ${removedCount} entries older than ${daysToKeep} days`
      }
    } else {
      return {
        success: true,
        removedEntries: 0,
        totalEntries: entries.length,
        message: 'No old entries to remove'
      }
    }

  } catch (error) {
    console.error('⚠️ Cleanup failed:', error)
    return {
      success: false,
      message: `Cleanup failed: ${error}`
    }
  }
}

/**
 * الحصول على مسار ملف اللوجات
 */
export function getLogFilePath(): string {
  return LOG_FILE
}

/**
 * قراءة آخر N entries من اللوجات
 */
export function getRecentLogs(limit: number = 100): string[] {
  try {
    ensureLogDirectory()

    if (!fs.existsSync(LOG_FILE)) {
      return []
    }

    const logContent = fs.readFileSync(LOG_FILE, 'utf8')
    const entries = logContent.split('---\n').filter(e => e.trim())

    // إرجاع آخر N entries (الأحدث أولاً)
    return entries.slice(-limit).reverse()

  } catch (error) {
    console.error('⚠️ Failed to read logs:', error)
    return []
  }
}
