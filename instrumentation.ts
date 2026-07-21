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

    // Background sync worker — drains pending receipt/expense pushes to Supabase
    // Runs every 60s. processSyncQueue is a no-op when nothing is pending or
    // when offline mode is disabled, so it's cheap to leave running.
    const { processSyncQueue } = await import('./lib/offline-sync')
    setInterval(() => {
      processSyncQueue().catch((err) =>
        console.error('[OfflineSync] worker error:', err?.message || err)
      )
    }, 60_000)

    // نسخة احتياطية يومية تلقائية للـ DB — بتتأكد كل 6 ساعات وبتاخد نسخة لو عدّى
    // يوم على آخر واحدة (رخيصة لو مش مستحقة). أول تشغيل بعد دقيقة من الإقلاع.
    // وبعد النسخة المحلية بنرفع نسخة سحابية لـ B2 (لو مفعّل ومتظبط ومستحق) —
    // بنعيد استخدام نفس الـ snapshot اللي اتعمل بدل VACUUM جديد.
    const { runDailyBackupIfDue } = await import('./lib/autoBackup')
    const { runCloudBackupIfDue } = await import('./lib/cloudBackup')
    const backupTick = async () => {
      try {
        const r = await runDailyBackupIfDue()
        if (r.backed) console.log('[autoBackup] daily backup created')
        const cloud = await runCloudBackupIfDue(r.backed ? r.path : undefined)
        if (cloud.ok) console.log('[cloudBackup] uploaded to B2:', cloud.remoteName)
        else if (cloud.reason === 'error') console.error('[cloudBackup] upload failed:', cloud.error)
      } catch (err: any) {
        console.error('[autoBackup] worker error:', err?.message || err)
      }
    }
    setTimeout(backupTick, 60_000)
    setInterval(backupTick, 6 * 60 * 60 * 1000)
  }
}
