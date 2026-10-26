// lib/publicImageUrl.ts
// 📱 صور الأعضاء للأبلكيشن — الصور الجديدة بتتخزن كمسار على جهاز الجيم ("/uploads/members/x.jpg")،
// والأبلكيشن مش على نفس الدومين، فالمسار ده لوحده مبيفتحش عنده (الصور القديمة كانت base64 فكانت بتظهر).
// هنا بنحوّل المسار للينك كامل على نفس الدومين اللي الأبلكيشن كلّمنا منه (التونل / الدومين).

export function absoluteImageUrl(request: Request, value: string | null | undefined): string | null {
  if (!value) return null
  if (/^(https?:|data:)/i.test(value)) return value

  const h = request.headers
  const host = (h.get('x-forwarded-host') || h.get('host') || '').split(',')[0].trim()
  if (!host) return value
  const isLocal = /^(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.)/.test(host)
  const proto = (h.get('x-forwarded-proto') || (isLocal ? 'http' : 'https')).split(',')[0].trim()
  const origin = `${proto}://${host}`

  //  مسار كامل على الجهاز (نسخ ديسكتوب قديمة) → نوصله عن طريق serve-image
  if (/^[A-Za-z]:[\/]/.test(value) || value.startsWith('\\')) {
    return `${origin}/api/serve-image?path=${encodeURIComponent(value)}`
  }
  return `${origin}${value.startsWith('/') ? '' : '/'}${value}`
}
