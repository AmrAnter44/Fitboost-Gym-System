/**
 * Error Response Sanitization
 * يمنع تسريب معلومات حساسة في error responses
 */

/**
 * قائمة بالأنماط التي تدل على تسرّب معلومات حساسة فعلية
 * (مثل password=xxx أو Bearer token أو connection strings)
 *
 * ⚠️ هذه الأنماط مُحددة بدقة لتجنب false positives
 * مثلاً: كلمة "Unauthorized" لا تعتبر حساسة لأنها مجرد HTTP status
 */
const SENSITIVE_PATTERNS = [
  // كلمات مرور وأسرار مع قيم
  /\bpassword\s*[:=]\s*\S/i,
  /\bpasswd\s*[:=]\s*\S/i,
  /\bpwd\s*[:=]\s*\S/i,
  /\bsecret\s*[:=]\s*\S/i,
  /\bapi[_-]?key\s*[:=]\s*\S/i,
  /\baccess[_-]?token\s*[:=]\s*\S/i,
  /\brefresh[_-]?token\s*[:=]\s*\S/i,
  /\bprivate[_-]?key\s*[:=]\s*\S/i,
  // Bearer / JWT tokens
  /\bbearer\s+[A-Za-z0-9._-]{10,}/i,
  /\beyJ[A-Za-z0-9._-]{20,}/, // JWT pattern
  // Authorization headers
  /\bauthorization\s*:\s*\S/i,
  // Connection strings
  /\b(postgres|postgresql|mysql|mongodb|redis):\/\//i,
  // Environment variable leaks
  /process\.env\.\w+/i,
  // Stack traces with file paths
  /\/node_modules\//,
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
    return SAFE_ERROR_MESSAGES.GENERIC
  }

  // إذا كانت الرسالة طويلة جداً (قد تحتوي على stack trace)
  if (message.length > 200) {
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

/**
 * تنظيف stack trace من المسارات المطلقة والمعلومات الحساسة
 * يحتفظ بمعلومات debugging المفيدة بدون كشف بنية النظام
 */
export function sanitizeStackTrace(stack: string | null | undefined): string | null {
  if (!stack) return null

  let cleaned = stack

  // إزالة مسارات مطلقة على macOS/Linux: /Users/... /home/... إلخ
  cleaned = cleaned.replace(/\/Users\/[^/\s):]+/g, '~')
  cleaned = cleaned.replace(/\/home\/[^/\s):]+/g, '~')
  cleaned = cleaned.replace(/\/root\//g, '~/')

  // إزالة مسارات Windows: C:\Users\... إلخ
  cleaned = cleaned.replace(/[A-Z]:\\Users\\[^\\]+/gi, '~')
  cleaned = cleaned.replace(/[A-Z]:\\[^\\]*\\/gi, '~\\')

  // إزالة أي قيم JWT/tokens محتملة داخل الـ stack
  cleaned = cleaned.replace(/eyJ[A-Za-z0-9._-]{20,}/g, '[REDACTED_TOKEN]')
  cleaned = cleaned.replace(/\bbearer\s+[A-Za-z0-9._-]{10,}/gi, '[REDACTED_AUTH]')

  // قص الطول عند حد معقول (أول 20 frames تقريباً)
  if (cleaned.length > 3000) {
    cleaned = cleaned.substring(0, 3000) + '\n...[truncated]'
  }

  return cleaned
}

