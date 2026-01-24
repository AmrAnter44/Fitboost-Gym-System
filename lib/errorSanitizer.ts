/**
 * Error Response Sanitization
 * يمنع تسريب معلومات حساسة في error responses
 */

/**
 * قائمة بالكلمات الحساسة التي يجب عدم كشفها في الأخطاء
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /api[_-]?key/i,
  /auth/i,
  /jwt/i,
  /session/i,
  /cookie/i,
  /database/i,
  /connection/i,
  /prisma/i,
  /sql/i,
  /env/i,
  /config/i
]

/**
 * رسائل خطأ عامة وآمنة للمستخدم
 */
export const SAFE_ERROR_MESSAGES = {
  GENERIC: 'حدث خطأ. يرجى المحاولة مرة أخرى',
  DATABASE: 'خطأ في الاتصال بقاعدة البيانات',
  VALIDATION: 'البيانات المدخلة غير صحيحة',
  AUTHENTICATION: 'خطأ في المصادقة',
  AUTHORIZATION: 'ليس لديك صلاحية للقيام بهذا الإجراء',
  NOT_FOUND: 'العنصر المطلوب غير موجود',
  RATE_LIMIT: 'تم تجاوز عدد المحاولات المسموحة',
  SERVER_ERROR: 'خطأ في الخادم. يرجى المحاولة لاحقاً'
} as const

/**
 * التحقق من وجود معلومات حساسة في النص
 */
function containsSensitiveInfo(text: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(text))
}

/**
 * تنظيف رسالة الخطأ من المعلومات الحساسة
 */
export function sanitizeErrorMessage(error: unknown): string {
  // إذا كان النص فارغ أو null
  if (!error) {
    return SAFE_ERROR_MESSAGES.GENERIC
  }

  // استخراج رسالة الخطأ
  let message: string

  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'string') {
    message = error
  } else if (typeof error === 'object' && 'message' in error) {
    message = String((error as any).message)
  } else {
    return SAFE_ERROR_MESSAGES.GENERIC
  }

  // إذا كانت الرسالة تحتوي على معلومات حساسة
  if (containsSensitiveInfo(message)) {
    console.warn('⚠️ Sensitive information detected in error message:', message)
    return SAFE_ERROR_MESSAGES.GENERIC
  }

  // إذا كانت الرسالة طويلة جداً (قد تحتوي على stack trace)
  if (message.length > 200) {
    console.warn('⚠️ Error message too long, truncating:', message.substring(0, 100))
    return SAFE_ERROR_MESSAGES.GENERIC
  }

  // رسائل خطأ محددة من Prisma
  if (message.includes('Unique constraint') || message.includes('P2002')) {
    return 'هذه البيانات موجودة مسبقاً'
  }

  if (message.includes('Foreign key constraint') || message.includes('P2003')) {
    return 'لا يمكن حذف هذا العنصر لأنه مرتبط بعناصر أخرى'
  }

  if (message.includes('Record to update not found') || message.includes('P2025')) {
    return SAFE_ERROR_MESSAGES.NOT_FOUND
  }

  // إرجاع الرسالة إذا كانت آمنة
  return message
}

/**
 * إنشاء error response آمن
 */
export function createSafeErrorResponse(
  error: unknown,
  statusCode: number = 500
): { error: string; statusCode: number } {
  const safeMessage = sanitizeErrorMessage(error)

  return {
    error: safeMessage,
    statusCode
  }
}

/**
 * تسجيل الخطأ الكامل (للسيرفر فقط)
 * مع إرجاع رسالة آمنة للمستخدم
 */
export function logAndSanitizeError(
  error: unknown,
  context: {
    endpoint: string
    method: string
    userId?: string
  }
): string {
  // تسجيل الخطأ الكامل في console
  console.error(`❌ Error at ${context.method} ${context.endpoint}:`, {
    error,
    userId: context.userId,
    timestamp: new Date().toISOString()
  })

  // إرجاع رسالة آمنة للمستخدم
  return sanitizeErrorMessage(error)
}

/**
 * معالجة أخطاء Prisma بشكل خاص
 */
export function handlePrismaError(error: any): string {
  if (!error.code) {
    return SAFE_ERROR_MESSAGES.DATABASE
  }

  switch (error.code) {
    case 'P2002': // Unique constraint
      return 'هذه البيانات موجودة مسبقاً'

    case 'P2003': // Foreign key constraint
      return 'لا يمكن حذف هذا العنصر لأنه مرتبط بعناصر أخرى'

    case 'P2025': // Record not found
      return SAFE_ERROR_MESSAGES.NOT_FOUND

    case 'P2014': // Required relation violation
      return 'العلاقة المطلوبة غير موجودة'

    case 'P2001': // Record does not exist
      return SAFE_ERROR_MESSAGES.NOT_FOUND

    case 'P2015': // Related record not found
      return 'العنصر المرتبط غير موجود'

    default:
      console.error('Unknown Prisma error code:', error.code)
      return SAFE_ERROR_MESSAGES.DATABASE
  }
}
