'use client'

// ==========================================
// Error Tracking Boundary Component
// ==========================================

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  showDetails?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * React Error Boundary مع Error Tracking
 *
 * يلتقط جميع أخطاء React components ويسجلها في نظام Error Tracking
 *
 * الاستخدام:
 * ```tsx
 * <ErrorTrackingBoundary>
 *   <YourApp />
 * </ErrorTrackingBoundary>
 * ```
 */
export class ErrorTrackingBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Update state with error details
    this.setState({
      error,
      errorInfo,
    })

    // Log error to tracking system
    this.logErrorToTracking(error, errorInfo)
  }

  async logErrorToTracking(error: Error, errorInfo: ErrorInfo) {
    try {
      const errorData = {
        message: error.message || 'React Component Error',
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
        additionalContext: {
          type: 'react_error_boundary',
          errorName: error.name,
          errorInfo: errorInfo,
        },
      }

      // Send to error tracking API (non-blocking)
      await fetch('/api/error-tracking/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData),
      }).catch((err) => {
        // Fallback: log to console if API fails
        console.error('[ErrorBoundary] Failed to log error to tracking:', err)
        console.error('[ErrorBoundary] Original error:', error)
      })
    } catch (loggingError) {
      // Prevent error logging from breaking the app
      console.error('[ErrorBoundary] Error in error logging:', loggingError)
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-3">
                <svg className="h-8 w-8 text-red-600 dark:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              حدث خطأ ما
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              عذراً، حدث خطأ غير متوقع. تم تسجيل المشكلة وسيتم حلها قريباً.
            </p>

            {/* Error details (development only) */}
            {this.props.showDetails && this.state.error && (
              <div className="mb-6 text-left bg-gray-100 dark:bg-gray-900 rounded-lg p-4 overflow-auto max-h-40">
                <p className="text-xs font-mono text-red-600 dark:text-red-400 break-all">
                  {this.state.error.toString()}
                </p>
                {this.state.error.stack && (
                  <pre className="text-xs font-mono text-gray-600 dark:text-gray-400 mt-2 overflow-auto">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              {/* Try again */}
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>حاول مرة أخرى</span>
              </button>

              {/* Reload page */}
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>إعادة تحميل الصفحة</span>
              </button>

              {/* Go home */}
              <button
                onClick={this.handleGoHome}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>العودة للرئيسية</span>
              </button>
            </div>

            {/* Help text */}
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-6">
              إذا استمرت المشكلة، يرجى التواصل مع الدعم الفني
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook-based wrapper للاستخدام في functional components
 *
 * الاستخدام:
 * ```tsx
 * function MyComponent() {
 *   return (
 *     <ErrorTrackingBoundary>
 *       <YourContent />
 *     </ErrorTrackingBoundary>
 *   )
 * }
 * ```
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorTrackingBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorTrackingBoundary>
    )
  }
}

export default ErrorTrackingBoundary
