// ==========================================
// Frontend Error Logging Endpoint
// ==========================================

import { NextResponse } from 'next/server'
import { logFrontendError } from '@/lib/errorTracking/errorTrackingService'

export const dynamic = 'force-dynamic'

/**
 * POST /api/error-tracking/log
 *
 * Endpoint لتسجيل أخطاء Frontend
 *
 * يُستخدم من:
 * - Error Boundary Components
 * - Global error handlers (window.onerror, unhandledrejection)
 * - Fetch error tracking
 * - Manual error logging من Frontend
 *
 * Request Body:
 * ```json
 * {
 *   "message": "Error message",
 *   "stack": "Stack trace",
 *   "componentStack": "React component stack (optional)",
 *   "url": "https://...",
 *   "userAgent": "Mozilla/...",
 *   "additionalContext": {...}
 * }
 * ```
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const {
      message,
      stack,
      componentStack,
      url,
      userAgent,
      additionalContext,
    } = body

    // Validation
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Build error object
    const error = new Error(message)
    if (stack) {
      error.stack = stack
    }

    // Prepare additional context
    const context: Record<string, any> = {
      ...(additionalContext || {}),
      url: url || 'unknown',
      source: 'frontend_api',
    }

    // Add component stack if available (from Error Boundary)
    if (componentStack) {
      context.componentStack = componentStack
    }

    // Extract browser info from user agent
    const browserInfo = userAgent
      ? {
          userAgent,
          platform:
            typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
          language:
            typeof navigator !== 'undefined' ? navigator.language : 'unknown',
        }
      : undefined

    // Add browser info to context if available
    if (browserInfo) {
      context.browserInfo = browserInfo
    }

    // Log to error tracking system (non-blocking)
    logFrontendError({
      message,
      error,
      url,
      userAgent,
      additionalContext: context,
    }).catch((err) => {
      // Log to console but don't fail the request
      console.error('[ErrorTracking] Failed to log frontend error:', err)
    })

    // Return success immediately (non-blocking logging)
    return NextResponse.json(
      { success: true, message: 'Error logged successfully' },
      { status: 200 }
    )
  } catch (error: any) {
    // If the endpoint itself fails, log to console
    console.error('[ErrorTracking] Endpoint error:', error)

    // Still return success to prevent frontend errors from cascading
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to log error, but request completed',
      },
      { status: 200 }
    )
  }
}

/**
 * GET /api/error-tracking/log
 *
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Error tracking endpoint is active',
    timestamp: new Date().toISOString(),
  })
}
