/**
 * In-memory rate limiter
 * - مجاني 100%
 * - مناسب للتطبيقات الصغيرة والمتوسطة
 * - بسيط وسريع
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed
   */
  limit: number

  /**
   * Time window in milliseconds
   */
  windowMs: number

  /**
   * Unique identifier for this rate limiter
   */
  id: string
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
  error?: string
}

// In-memory storage للـ rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Check if request should be rate limited
 * Uses in-memory storage
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = `${config.id}:${identifier}`
  const now = Date.now()

  // الحصول على البيانات الحالية
  const entry = rateLimitStore.get(key)

  // إذا لم يكن هناك entry أو انتهى الوقت، إنشاء window جديد
  if (!entry || now > entry.resetAt) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs
    }
    rateLimitStore.set(key, newEntry)

    // تنظيف البيانات القديمة بعد انتهاء الـ window
    setTimeout(() => {
      rateLimitStore.delete(key)
    }, config.windowMs)

    return {
      success: true,
      remaining: config.limit - 1,
      resetAt: newEntry.resetAt
    }
  }

  // التحقق من الحد الأقصى
  if (entry.count >= config.limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
      error: `محاولات كثيرة جداً. حاول مرة أخرى بعد ${new Date(entry.resetAt).toLocaleTimeString('ar-EG')}`
    }
  }

  // زيادة العداد
  entry.count++

  return {
    success: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt
  }
}

/**
 * Get client identifier from request
 * يستخدم IP address أو fallback على identifier من headers
 */
export function getClientIdentifier(request: Request): string {
  // محاولة الحصول على IP من headers
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  if (realIp) {
    return realIp
  }

  // Fallback: use a combination of user agent and host
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const host = request.headers.get('host') || 'unknown'
  return `${host}-${userAgent.slice(0, 50)}`
}

/**
 * Clear rate limit for a specific identifier
 * Useful for testing or manual resets
 */
export function clearRateLimit(identifier: string, configId: string): void {
  const key = `${configId}:${identifier}`
  rateLimitStore.delete(key)
}
