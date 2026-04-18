'use client'

// ==========================================
// Error Tracking Provider
// ==========================================

import { useEffect, ReactNode } from 'react'
import {
  setupGlobalErrorHandler,
  setupFetchErrorTracking,
} from '@/lib/errorTracking/globalErrorHandlers'
import { ErrorTrackingBoundary } from './ErrorTrackingBoundary'

interface ErrorTrackingProviderProps {
  children: ReactNode
}

/**
 * Error Tracking Provider - يفعّل نظام تتبع الأخطاء
 *
 * الوظائف:
 * 1. Setup global error handlers (window.onerror, unhandledrejection)
 * 2. Setup fetch error tracking (يوصّل window.fetch)
 * 3. Wraps app في Error Boundary
 *
 * يُضاف في ClientLayout
 */
export function ErrorTrackingProvider({ children }: ErrorTrackingProviderProps) {
  useEffect(() => {
    // تفعيل global error handlers
    setupGlobalErrorHandler()
    setupFetchErrorTracking()
  }, [])

  return (
    <ErrorTrackingBoundary showDetails={process.env.NODE_ENV === 'development'}>
      {children}
    </ErrorTrackingBoundary>
  )
}

export default ErrorTrackingProvider
