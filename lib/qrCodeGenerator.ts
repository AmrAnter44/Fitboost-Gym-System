// lib/qrCodeGenerator.ts - توليد QR codes آمنة للحصص

import crypto from 'crypto'

/**
 * توليد QR code قوي وآمن
 * يتكون من 16 حرف عشوائي + 16 رقم عشوائي = 32 حرف إجمالاً
 * استخدام crypto.randomBytes لضمان العشوائية الآمنة
 */
export function generateSecureQRCode(): string {
  // توليد 16 حرف عشوائي (حروف كبيرة وصغيرة)
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  let letterPart = ''
  const letterBytes = crypto.randomBytes(16)
  for (let i = 0; i < 16; i++) {
    letterPart += letters[letterBytes[i] % letters.length]
  }

  // توليد 16 رقم عشوائي
  let numberPart = ''
  const numberBytes = crypto.randomBytes(16)
  for (let i = 0; i < 16; i++) {
    numberPart += (numberBytes[i] % 10).toString()
  }

  // دمج الحروف والأرقام بشكل عشوائي
  const combined = letterPart + numberPart
  const shuffled = shuffleString(combined)

  return shuffled
}

/**
 * خلط النص بشكل عشوائي آمن
 */
function shuffleString(str: string): string {
  const arr = str.split('')
  const randomBytes = crypto.randomBytes(arr.length)

  // Fisher-Yates shuffle مع crypto.randomBytes
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomBytes[i] % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }

  return arr.join('')
}

/**
 * التحقق من قوة QR code
 */
export function validateQRCodeStrength(qrCode: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (qrCode.length !== 32) {
    errors.push('يجب أن يكون طول QR Code 32 حرف')
  }

  const letterCount = (qrCode.match(/[a-zA-Z]/g) || []).length
  const numberCount = (qrCode.match(/[0-9]/g) || []).length

  if (letterCount < 16) {
    errors.push('يجب أن يحتوي على 16 حرف على الأقل')
  }

  if (numberCount < 16) {
    errors.push('يجب أن يحتوي على 16 رقم على الأقل')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * توليد QR code مع ضمان عدم التكرار
 */
export async function generateUniqueQRCode(
  checkExists: (qrCode: string) => Promise<boolean>
): Promise<string> {
  let attempts = 0
  const maxAttempts = 10

  while (attempts < maxAttempts) {
    const qrCode = generateSecureQRCode()

    // التحقق من عدم وجوده في قاعدة البيانات
    const exists = await checkExists(qrCode)

    if (!exists) {
      return qrCode
    }

    attempts++
  }

  throw new Error('فشل توليد QR code فريد بعد عدة محاولات')
}

/**
 * تنسيق QR code للعرض (إضافة شرطات للقراءة)
 * مثال: AbC123DeF456 -> AbC1-23De-F456
 */
export function formatQRCodeForDisplay(qrCode: string): string {
  if (qrCode.length !== 32) return qrCode

  // تقسيم إلى مجموعات من 4 أحرف
  return qrCode.match(/.{1,4}/g)?.join('-') || qrCode
}
