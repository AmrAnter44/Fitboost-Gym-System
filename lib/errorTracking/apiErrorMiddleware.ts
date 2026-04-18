// ==========================================
// API Error Middleware
// ==========================================

import { NextResponse } from 'next/server'
import { logBackendError } from './errorTrackingService'
import { getIpAddress, getUserAgent } from '../auditLog'
import { sanitizeErrorMessage } from '../errorSanitizer'

/**
 * Wrapper لـ API routes لالتقاط كل الأخطاء تلقائياً
 *
 * الاستخدام:
 * ```typescript
 * import { withErrorTracking } from '@/lib/errorTracking/apiErrorMiddleware'
 *
 * async function handler(request: Request) {
 *   // Your code here
 *   return NextResponse.json({ data })
 * }
 *
 * export const GET = withErrorTracking(handler)
 * export const POST = withErrorTracking(handler)
 * ```
 */
export function withErrorTracking<T = any>(
  handler: (request: Request, context?: any) => Promise<NextResponse<T>>
) {
  return async (request: Request, context?: any): Promise<NextResponse<T>> => {
    const url = new URL(request.url)
    const endpoint = url.pathname
    const method = request.method

    try {
      // Execute handler
      const response = await handler(request, context)

      // Log errors (4xx, 5xx)
      if (response.status >= 400) {
        let errorMessage = 'Unknown error'
        let requestBody = null

        try {
          const clone = response.clone()
          const data = await clone.json()
          errorMessage = data.error || data.message || errorMessage
        } catch {}

        // Try to get request body (for POST/PUT/PATCH)
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
          try {
            const clone = request.clone()
            requestBody = await clone.json()
          } catch {}
        }

        // Extract user info from request (if authenticated)
        let userId, userEmail, userName, userRole, staffId
        try {
          const { verifyAuth } = await import('../auth')
          const user = await verifyAuth(request)
          if (user) {
            userId = user.userId
            userEmail = user.email
            userName = user.name
            userRole = user.role
            staffId = user.staffId
          }
        } catch {}

        // Log the error (non-blocking)
        logBackendError({
          error: new Error(errorMessage),
          endpoint,
          method,
          statusCode: response.status,
          userId,
          userEmail,
          userName,
          userRole,
          staffId,
          requestBody,
          ipAddress: getIpAddress(request),
          userAgent: getUserAgent(request)
        }).catch(err => {
          // Ignore logging errors
          console.error('[ErrorTracking] Middleware logging failed:', err)
        })
      }

      return response
    } catch (error: any) {
      // Log uncaught exception
      let requestBody = null
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        try {
          const clone = request.clone()
          requestBody = await clone.json()
        } catch {}
      }

      let userId, userEmail, userName, userRole, staffId
      try {
        const { verifyAuth } = await import('../auth')
        const user = await verifyAuth(request)
        if (user) {
          userId = user.userId
          userEmail = user.email
          userName = user.name
          userRole = user.role
          staffId = user.staffId
        }
      } catch {}

      // Log the error (non-blocking)
      logBackendError({
        error,
        endpoint,
        method,
        statusCode: 500,
        userId,
        userEmail,
        userName,
        userRole,
        staffId,
        requestBody,
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      }).catch(err => {
        // Ignore logging errors
        console.error('[ErrorTracking] Middleware logging failed:', err)
      })

      // Return safe error response
      const safeMessage = sanitizeErrorMessage(error)
      return NextResponse.json(
        { error: safeMessage },
        { status: 500 }
      ) as any
    }
  }
}
