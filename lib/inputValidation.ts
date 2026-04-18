/**
 * Input Validation Helpers
 * دوال مساعدة للتحقق من صحة البيانات المدخلة ومنع الهجمات
 */

/**
 * تنظيف النصوص من XSS
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }

  // إزالة HTML tags
  let cleaned = input.replace(/<[^>]*>/g, '')

  // إزالة JavaScript event handlers
  cleaned = cleaned.replace(/on\w+\s*=/gi, '')

  // إزالة javascript: URLs
  cleaned = cleaned.replace(/javascript:/gi, '')

  // تنظيف المسافات الزائدة
  cleaned = cleaned.trim()

  return cleaned
}

/**
 * التحقق من صحة البريد الإلكتروني
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string' || !email) {
    return false
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254 // RFC 5321
}

/**
 * التحقق من صحة رقم الهاتف المصري
 */
export function isValidEgyptianPhone(phone: string): boolean {
  if (typeof phone !== 'string' || !phone) {
    return false
  }

  // أرقام مصرية فقط: 010, 011, 012, 015
  const phoneRegex = /^(010|011|012|015)[0-9]{8}$/
  return phoneRegex.test(phone)
}

/**
 * التحقق من قوة كلمة المرور
 */
export interface PasswordStrength {
  isValid: boolean
  errors: string[]
  strength: 'weak' | 'medium' | 'strong'
}

export function validatePasswordStrength(password: string): PasswordStrength {
  const errors: string[] = []
  let strength: 'weak' | 'medium' | 'strong' = 'weak'

  if (typeof password !== 'string') {
    return {
      isValid: false,
      errors: ['كلمة المرور يجب أن تكون نصاً'],
      strength: 'weak'
    }
  }

  // الحد الأدنى للطول
  if (password.length < 8) {
    errors.push('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
  }

  // الحد الأقصى للطول (لمنع DoS)
  if (password.length > 128) {
    errors.push('كلمة المرور طويلة جداً (الحد الأقصى 128 حرف)')
  }

  // يحتوي على أحرف
  if (!/[a-zA-Z]/.test(password)) {
    errors.push('كلمة المرور يجب أن تحتوي على أحرف')
  }

  // يحتوي على أرقام
  if (!/[0-9]/.test(password)) {
    errors.push('كلمة المرور يجب أن تحتوي على أرقام')
  }

  // قياس القوة
  let strengthScore = 0
  if (password.length >= 8) strengthScore++
  if (password.length >= 12) strengthScore++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strengthScore++
  if (/[0-9]/.test(password)) strengthScore++
  if (/[^a-zA-Z0-9]/.test(password)) strengthScore++ // رموز خاصة

  if (strengthScore >= 4) strength = 'strong'
  else if (strengthScore >= 2) strength = 'medium'
  else strength = 'weak'

  return {
    isValid: errors.length === 0,
    errors,
    strength
  }
}

/**
 * التحقق من صحة الأرقام (integers فقط)
 */
export function isValidInteger(value: any): boolean {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0
  }

  if (typeof value === 'string') {
    const num = parseInt(value, 10)
    return !isNaN(num) && num >= 0 && String(num) === value.trim()
  }

  return false
}

/**
 * التحقق من صحة التاريخ
 */
export function isValidDate(dateString: string): boolean {
  if (typeof dateString !== 'string' || !dateString) {
    return false
  }

  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date.getTime())
}

/**
 * منع SQL Injection في النصوص
 */
export function preventSQLInjection(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }

  // إزالة الكلمات المفتاحية الخطرة
  const dangerousPatterns = [
    /(\bDROP\b|\bDELETE\b|\bTRUNCATE\b|\bEXEC\b|\bEXECUTE\b)/gi,
    /(\bUNION\b.*\bSELECT\b)/gi,
    /(;|\-\-|\/\*|\*\/)/g
  ]

  let cleaned = input
  dangerousPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '')
  })

  return cleaned.trim()
}

/**
 * التحقق من طول النص
 */
export function isValidLength(
  text: string,
  min: number = 0,
  max: number = 1000
): { isValid: boolean; error?: string } {
  if (typeof text !== 'string') {
    return { isValid: false, error: 'يجب أن يكون النص من نوع string' }
  }

  const length = text.trim().length

  if (length < min) {
    return { isValid: false, error: `النص قصير جداً (الحد الأدنى ${min} حرف)` }
  }

  if (length > max) {
    return { isValid: false, error: `النص طويل جداً (الحد الأقصى ${max} حرف)` }
  }

  return { isValid: true }
}

/**
 * تنظيف array من القيم غير الصحيحة
 */
export function sanitizeArray<T>(
  arr: any[],
  validator: (item: any) => item is T
): T[] {
  if (!Array.isArray(arr)) {
    return []
  }

  return arr.filter(validator)
}

/**
 * التحقق من صحة enum value
 */
export function isValidEnum<T extends string>(
  value: any,
  validValues: readonly T[]
): value is T {
  return typeof value === 'string' && validValues.includes(value as T)
}

/**
 * منع Path Traversal في أسماء الملفات
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== 'string') {
    return ''
  }

  // إزالة path separators
  let cleaned = filename.replace(/[\/\\]/g, '')

  // إزالة الأحرف الخطرة
  cleaned = cleaned.replace(/[^a-zA-Z0-9._-]/g, '')

  // إزالة .. للحماية من directory traversal
  cleaned = cleaned.replace(/\.\./g, '')

  // تحديد الطول
  if (cleaned.length > 255) {
    cleaned = cleaned.substring(0, 255)
  }

  return cleaned
}

/**
 * التحقق من صحة URL
 */
export function isValidURL(url: string): boolean {
  if (typeof url !== 'string' || !url) {
    return false
  }

  try {
    const parsed = new URL(url)
    // السماح فقط بـ http و https
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * تنظيف object من القيم الخطرة
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: any,
  allowedKeys: (keyof T)[]
): Partial<T> {
  if (typeof obj !== 'object' || obj === null) {
    return {}
  }

  const sanitized: Partial<T> = {}

  for (const key of allowedKeys) {
    if (key in obj) {
      const value = obj[key]

      // تنظيف النصوص
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value) as any
      } else {
        sanitized[key] = value
      }
    }
  }

  return sanitized
}
