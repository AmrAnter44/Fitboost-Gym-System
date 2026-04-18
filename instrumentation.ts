// ==========================================
// Next.js Instrumentation - Server-side Error Tracking
// ==========================================

export async function register() {
  // Only run on Node.js runtime (server-side)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logBackendError } = await import('./lib/errorTracking/errorTrackingService')

    // Catch uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('[Instrumentation] Uncaught Exception:', error)

      logBackendError({
        error,
        endpoint: 'process/uncaughtException',
        method: 'SYSTEM',
        statusCode: 500,
        additionalContext: {
          type: 'uncaught_exception',
          processUptime: process.uptime(),
        },
      }).catch(() => {
        // Ignore logging errors to prevent infinite loops
      })
    })

    // Catch unhandled promise rejections
    process.on('unhandledRejection', (reason: any) => {
      console.error('[Instrumentation] Unhandled Rejection:', reason)

      const error = reason instanceof Error ? reason : new Error(String(reason))

      logBackendError({
        error,
        endpoint: 'process/unhandledRejection',
        method: 'SYSTEM',
        statusCode: 500,
        additionalContext: {
          type: 'unhandled_rejection',
          processUptime: process.uptime(),
        },
      }).catch(() => {
        // Ignore logging errors to prevent infinite loops
      })
    })

  }
}
