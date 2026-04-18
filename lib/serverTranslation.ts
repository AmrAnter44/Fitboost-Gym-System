import arMessages from '../messages/ar.json'
import enMessages from '../messages/en.json'

type Messages = typeof arMessages

/**
 * Get locale from request headers or cookies
 */
export function getLocaleFromRequest(request: Request): 'ar' | 'en' {
  // Try to get locale from Accept-Language header
  const acceptLanguage = request.headers.get('accept-language')

  // Try to get locale from cookie
  const cookieHeader = request.headers.get('cookie')
  if (cookieHeader) {
    const localeCookie = cookieHeader.split(';').find(c => c.trim().startsWith('locale='))
    if (localeCookie) {
      const locale = localeCookie.split('=')[1]?.trim()
      if (locale === 'en' || locale === 'ar') {
        return locale
      }
    }
  }

  // Default to Arabic
  return 'ar'
}

/**
 * Server-side translation function
 */
export function getServerTranslation(locale: 'ar' | 'en' = 'ar') {
  const messages: Messages = locale === 'ar' ? arMessages : enMessages

  return function t(key: string, params?: Record<string, string>): string {
    const keys = key.split('.')
    let value: any = messages

    for (const k of keys) {
      value = value?.[k]
    }

    if (typeof value !== 'string') {
      return key
    }

    // Replace parameters
    if (params) {
      Object.entries(params).forEach(([param, val]) => {
        value = value.replace(`{${param}}`, val)
      })
    }

    return value
  }
}
