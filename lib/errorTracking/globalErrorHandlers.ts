// ==========================================
// Global Error Handlers for Frontend
// ==========================================

/**
 * Window.onerror handler - يلتقط uncaught errors
 * Window.onunhandledrejection - يلتقط unhandled promise rejections
 */
export function setupGlobalErrorHandler(): void {
  if (typeof window === 'undefined') return

  // Uncaught errors
  window.addEventListener('error', (event) => {
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
        let errorMessage = `HTTP ${response.status}`

        try {
          const clone = response.clone()
          const data = await clone.json()
          errorMessage = data.error || data.message || errorMessage
        } catch {}

        // Send to error tracking (non-blocking)
        fetch('/api/error-tracking/log', {
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

      // Send to error tracking (non-blocking)
      fetch('/api/error-tracking/log', {
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
