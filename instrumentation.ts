// ==========================================
// Next.js Instrumentation - Server-side uncaught-error logger
// ==========================================

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logError } = await import('./lib/errorLogger')

    process.on('uncaughtException', (error) => {
      console.error('[Instrumentation] Uncaught Exception:', error?.message || 'unknown')
      logError({
        error,
        endpoint: 'process/uncaughtException',
        method: 'SYSTEM',
        statusCode: 500,
        additionalContext: {
          type: 'uncaught_exception',
          processUptime: process.uptime(),
        },
      })
    })

    process.on('unhandledRejection', (reason: any) => {
      console.error('[Instrumentation] Unhandled Rejection:', reason?.message || String(reason))
      const error = reason instanceof Error ? reason : new Error(String(reason))
      logError({
        error,
        endpoint: 'process/unhandledRejection',
        method: 'SYSTEM',
        statusCode: 500,
        additionalContext: {
          type: 'unhandled_rejection',
          processUptime: process.uptime(),
        },
      })
    })
  }
}
