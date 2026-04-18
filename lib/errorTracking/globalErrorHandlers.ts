// ==========================================
// Global Error Handlers for Frontend
// ==========================================

// ✅ Rate limiting & deduplication
const errorCache = new Set<string>()
const MAX_ERRORS_PER_MINUTE = 20
let errorCount = 0
let lastResetTime = Date.now()

function shouldLogError(errorKey: string): boolean {
  // ✅ تجاهل أخطاء WhatsApp/libsignal المعروفة (Bad MAC errors)
  const ignoredErrors = [
    'Bad MAC',
    'libsignal',
    'Session error',
    'Failed to decrypt message',
    'SessionCipher',
    'verifyMAC'
  ]

  if (ignoredErrors.some(ignored => errorKey.includes(ignored))) {
    return false
  }

  // Reset counter every minute
  const now = Date.now()
  if (now - lastResetTime > 60000) {
    errorCount = 0
    errorCache.clear()
    lastResetTime = now
  }

  // Rate limit check
  if (errorCount >= MAX_ERRORS_PER_MINUTE) {
    return false
  }

  // Deduplication check (same error within 60 seconds)
  if (errorCache.has(errorKey)) {
    return false
  }

  // Allow logging
  errorCache.add(errorKey)
  errorCount++

  // Remove from cache after 60 seconds
  setTimeout(() => errorCache.delete(errorKey), 60000)

  return true
}

/**
 * قمع console.error للأخطاء المعروفة (مثل Bad MAC من WhatsApp)
 */
function setupConsoleErrorFilter(): void {
  if (typeof window === 'undefined') return

  const originalConsoleError = console.error

  console.error = (...args: any[]) => {
    const message = args.join(' ')

    // ✅ تجاهل أخطاء WhatsApp/libsignal المعروفة
    const ignoredPatterns = [
      'Bad MAC',
      'Session error',
      'Failed to decrypt message',
      'libsignal/src/session_cipher',
      'libsignal/src/crypto'
    ]

    if (ignoredPatterns.some(pattern => message.includes(pattern))) {
      return // لا تطبع الخطأ
    }

    // طباعة الأخطاء الأخرى
    originalConsoleError.apply(console, args)
  }
}

/**
 * Window.onerror handler - يلتقط uncaught errors
 * Window.onunhandledrejection - يلتقط unhandled promise rejections
 */
export function setupGlobalErrorHandler(): void {
  if (typeof window === 'undefined') return

  // ✅ قمع أخطاء console.error المعروفة
  setupConsoleErrorFilter()

  // Uncaught errors
  window.addEventListener('error', (event) => {
    const errorKey = `error:${event.message}:${event.filename}:${event.lineno}`

    if (!shouldLogError(errorKey)) {
      return
    }

    // Send to error tracking API
    fetch('/api/error-tracking/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: event.message || 'Unknown error',
        stack: event.error?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        additionalContext: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          type: 'uncaught_error'
        }
      })
    }).catch(err => {
      console.error('[ErrorTracking] Failed to log error:', err)
    })
  })

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const errorKey = `rejection:${String(event.reason)}`

    if (!shouldLogError(errorKey)) {
      return
    }

    fetch('/api/error-tracking/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        additionalContext: {
          type: 'unhandledrejection',
          reason: String(event.reason)
        }
      })
    }).catch(err => {
      console.error('[ErrorTracking] Failed to log rejection:', err)
    })
  })
}

/**
 * Fetch wrapper - يلتقط API errors من Frontend
 *
 * ⚠️ ملاحظة: هذا يُوصّل window.fetch لتتبع جميع الأخطاء
 */
export function setupFetchErrorTracking(): void {
  if (typeof window === 'undefined') return

  const originalFetch = window.fetch

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    try {
      const response = await originalFetch(...args)

      // Log failed requests (4xx, 5xx)
      if (!response.ok) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url

        // ✅ CRITICAL: استثناء error-tracking API من الـ tracking لتجنب infinite loops
        if (url.includes('/api/error-tracking/log')) {
          return response
        }

        const errorKey = `api:${url}:${response.status}`

        if (!shouldLogError(errorKey)) {
          return response
        }

        let errorMessage = `HTTP ${response.status}`

        try {
          const clone = response.clone()
          const data = await clone.json()
          errorMessage = data.error || data.message || errorMessage
        } catch {}

        // Send to error tracking (non-blocking)
        originalFetch('/api/error-tracking/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `API Error: ${errorMessage}`,
            url: window.location.href,
            userAgent: navigator.userAgent,
            additionalContext: {
              apiUrl: url,
              statusCode: response.status,
              method: args[1]?.method || 'GET',
              type: 'api_error'
            }
          })
        }).catch(() => {
          // Ignore logging errors
        })
      }

      return response
    } catch (error: any) {
      // Network error
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url

      // ✅ CRITICAL: استثناء error-tracking API من الـ tracking
      if (url.includes('/api/error-tracking/log')) {
        throw error
      }

      const errorKey = `network:${url}:${error.message}`

      if (!shouldLogError(errorKey)) {
        throw error
      }

      // Send to error tracking (non-blocking) - use originalFetch to avoid recursion
      originalFetch('/api/error-tracking/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Network Error: ${error.message}`,
          stack: error.stack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          additionalContext: {
            apiUrl: url,
            method: args[1]?.method || 'GET',
            type: 'network_error'
          }
        })
      }).catch(() => {
        // Ignore logging errors
      })

      throw error
    }
  }
}
