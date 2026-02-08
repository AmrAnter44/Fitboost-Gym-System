// lib/authErrorHandler.ts - Auto clear cookies on JWT errors

/**
 * Clear all authentication cookies
 */
export function clearAuthCookies() {
  if (typeof document === 'undefined') return

  // Clear all cookies by setting them to expire
  document.cookie.split(';').forEach(cookie => {
    const cookieName = cookie.split('=')[0].trim()
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
  })

  console.log('🧹 Auth cookies cleared')
}

/**
 * Handle authentication errors from API responses
 * Automatically clears cookies if JWT is invalid
 */
export async function handleAuthError(response: Response) {
  if (response.status === 401) {
    try {
      const data = await response.json()

      // Check if server indicates we should clear cookies
      if (data.clearCookies) {
        clearAuthCookies()
        console.log('🔄 Redirecting to login after clearing cookies...')

        // Small delay to ensure cookies are cleared
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            window.location.href = '/login'
          }, 100)
        }
      }
    } catch (error) {
      // If JSON parsing fails, just clear cookies anyway for 401
      clearAuthCookies()
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.location.href = '/login'
        }, 100)
      }
    }
  }
}

/**
 * Enhanced fetch wrapper that automatically handles auth errors
 */
export async function fetchWithAuthHandler(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const response = await fetch(url, options)

  // Auto-handle auth errors
  if (response.status === 401) {
    await handleAuthError(response.clone())
  }

  return response
}
