/**
 * Central constants for security, performance, and business rules.
 * استبدل Magic Numbers بقيم مسمّاة ومركزية عشان يبقى سهل تغيّرها.
 */

// ─── Security ─────────────────────────────────────────────────────────────
export const BCRYPT_ROUNDS = 12
export const JWT_EXPIRY = '7d'
export const MIN_PASSWORD_LENGTH = 12
export const MIN_JWT_SECRET_LENGTH = 32

// ─── Rate Limiting ────────────────────────────────────────────────────────
export const RATE_LIMITS = {
  LOGIN: { limit: 5, windowMs: 15 * 60 * 1000 },           // 5 محاولات / 15 دقيقة
  WHATSAPP_USER: { limit: 30, windowMs: 60 * 1000 },        // 30 رسالة / دقيقة per user
  WHATSAPP_PHONE: { limit: 5, windowMs: 60 * 1000 },        // 5 رسائل / دقيقة per phone
  GENERIC_API: { limit: 100, windowMs: 60 * 1000 },         // fallback عام
} as const

// ─── File Uploads ─────────────────────────────────────────────────────────
export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024       // 5MB
export const MIN_IMAGE_UPLOAD_BYTES = 10                    // حد أدنى لرفض ملفات فاضية
export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const

// ─── Business Rules ───────────────────────────────────────────────────────
export const MAX_RECEIPT_LOOKUP_ATTEMPTS = 100
export const MAX_FREEZE_DAYS = 365
export const MAX_SUBSCRIPTION_PRICE = 1_000_000
export const MAX_SESSION_COUNT = 1000

// ─── WhatsApp ─────────────────────────────────────────────────────────────
export const WHATSAPP_MAX_MESSAGE_LENGTH = 4096
export const WHATSAPP_PHONE_REGEX = /^\+?[0-9]{8,15}$/
export const EGYPTIAN_PHONE_REGEX = /^(010|011|012|015)[0-9]{8}$/

// ─── Validation ───────────────────────────────────────────────────────────
export const MAX_NAME_LENGTH = 100
export const MAX_NOTES_LENGTH = 2000
export const MAX_EMAIL_LENGTH = 254
export const NATIONAL_ID_REGEX = /^[0-9]{14}$/

// ─── Error Tracking ───────────────────────────────────────────────────────
export const MAX_STACK_TRACE_LENGTH = 3000
export const MAX_ERROR_MESSAGE_LENGTH = 200
