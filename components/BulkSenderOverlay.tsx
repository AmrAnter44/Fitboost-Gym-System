'use client'

//  BulkSenderOverlay — الكرة العائمة + مودال التقدّم + مودال التقرير
//  بيتعرض على مستوى التطبيق (جوه ClientLayout) عشان يفضل ظاهر في كل الصفحات أثناء الإرسال.
//  الـ JSX منقول كما هو من app/followups/page.tsx بس مصدر البيانات بقى useBulkSender().

import { useLanguage } from '../contexts/LanguageContext'
import { useBulkSender } from '../contexts/BulkSenderContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

export default function BulkSenderOverlay() {
  const { t, direction } = useLanguage()
  const {
    running,
    paused,
    minimized,
    progress,
    report,
    config,
    messageCount,
    pause,
    resume,
    stop,
    setMinimized,
    dismissReport,
    retryFailed,
  } = useBulkSender()

  const delayMax = config?.delayMax ?? 0
  const batchBreakMax = config?.batchBreakMax ?? 0

  return (
    <>
      {/*  Smart Bulk Script - Floating Ball (minimized)
           - responsive: موبايل (bottom-start) + ديسك توب (نفس المكان لكن أكبر)
           - الإرسال شغّال على refs ومستمر بدون أي تأثير على الأداء
           - الـ progress بيتحدّث live حتى وهو minimized */}
      {running && minimized && (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="fixed bottom-4 start-4 sm:bottom-6 sm:start-6 z-[9999] group"
          aria-label={direction === 'rtl' ? 'فتح الإرسال الذكي' : 'Open smart sending'}
          title={direction === 'rtl'
            ? `${progress.current} / ${progress.total} — ${paused ? 'متوقف' : 'شغّال'}`
            : `${progress.current} / ${progress.total} — ${paused ? 'paused' : 'running'}`}
        >
          {/*  Glow ring متحرك (animate-pulse) لو الإرسال شغّال */}
          {!paused && (
            <span className="absolute inset-0 rounded-full bg-purple-400 dark:bg-purple-500 opacity-40 blur-md animate-pulse pointer-events-none" />
          )}
          <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full shadow-2xl ring-4 ring-white dark:ring-gray-800 flex flex-col items-center justify-center text-white transition-transform hover:scale-110 active:scale-95 ${
            paused
              ? 'bg-gradient-to-br from-amber-500 to-orange-600'
              : 'bg-gradient-to-br from-purple-500 via-fuchsia-500 to-indigo-600'
          }`}>
            {/*  Progress ring حوالين الكورة */}
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
              <circle
                cx="50" cy="50" r="46"
                fill="none"
                stroke="white"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 46}`}
                strokeDashoffset={`${2 * Math.PI * 46 * (1 - progress.current / Math.max(progress.total, 1))}`}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            {/*  Center content — الأيقونة أو إيموجي + العدد */}
            <span className="relative text-[10px] sm:text-xs font-black leading-none mb-0.5">
              {paused ? '⏸' : '📨'}
            </span>
            <span className="relative text-[10px] sm:text-xs font-black leading-none tabular-nums">
              {progress.current}/{progress.total}
            </span>
          </div>
          {/*  Success/fail badge — يظهر فوق الكورة */}
          {(progress.successCount > 0 || progress.failCount > 0) && (
            <div className="absolute -top-2 -end-2 flex gap-1 pointer-events-none">
              {progress.successCount > 0 && (
                <span className="bg-green-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-md">
                  ✓{progress.successCount}
                </span>
              )}
              {progress.failCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-md">
                  ✕{progress.failCount}
                </span>
              )}
            </div>
          )}
        </button>
      )}

      {/* Smart Bulk Script - Progress Modal — مخفي لما يكون minimized */}
      {running && !minimized && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-script-progress-title"
          aria-busy="true"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in relative">
            {/*  زرار minimize في الـ top-end */}
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="absolute top-3 end-3 w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 flex items-center justify-center transition-colors"
              aria-label={direction === 'rtl' ? 'تصغير' : 'Minimize'}
              title={direction === 'rtl' ? 'تصغير (الإرسال هيكمل)' : 'Minimize (sending continues)'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5" />
              </svg>
            </button>
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 mx-auto mb-3 flex items-center justify-center">
                {paused ? (
                  <svg className="w-7 h-7" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                ) : (
                  <svg className="w-7 h-7" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                )}
              </div>
              <h2 id="bulk-script-progress-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {paused ? t('followups.bulkScript.paused') : t('followups.bulkScript.smartSending')}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {progress.current} / {progress.total}
              </p>
            </div>

            {/* Main Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>{t('followups.bulkScript.overallProgress')}</span>
                <span>{Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-[width] duration-500 ease-out"
                  style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Countdown Bar */}
            {progress.countdown > 0 && !paused && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1 items-center">
                  <span className="inline-flex items-center gap-1">
                    {progress.countdown > delayMax ? (
                      <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h14a4 4 0 010 8h-1M3 10v8a2 2 0 002 2h11a2 2 0 002-2"/></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    )}
                    {progress.countdown > delayMax ? t('followups.bulkScript.batchBreakLabel') : t('followups.bulkScript.nextMessageIn')}
                  </span>
                  <span>{progress.countdown > 60 ? `${Math.ceil(progress.countdown / 60)} ${t('followups.bulkScript.minutes')}` : `${progress.countdown} ${t('followups.bulkScript.seconds')}`}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-[width] duration-1000 ease-linear ${progress.countdown > delayMax ? 'bg-gradient-to-r from-blue-400 to-purple-400' : 'bg-gradient-to-r from-amber-400 to-orange-400'}`}
                    style={{ width: `${(progress.countdown / (progress.countdown > delayMax ? batchBreakMax : delayMax)) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Current Info */}
            {progress.currentName && (
              <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 mb-4 space-y-1 text-sm">
                <p className="text-primary-600 dark:text-primary-400 inline-flex items-center gap-1.5 flex-wrap">
                  <svg className="w-4 h-4 shrink-0" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                  <span>{t('followups.bulkScript.sendingTo')} <span className="font-bold">{progress.currentName}</span></span>
                </p>
                <p className="text-purple-600 dark:text-purple-400 inline-flex items-center gap-1.5 flex-wrap">
                  <svg className="w-4 h-4 shrink-0" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  <span>{t('followups.bulkScript.messageTextOf').replace('{current}', String(progress.currentMsgIndex)).replace('{total}', String(messageCount))}</span>
                </p>
              </div>
            )}

            {/* Success/Fail Counters */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 inline-flex items-center gap-1">
                  <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  {progress.successCount}
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">{t('followups.bulkScript.success')}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 inline-flex items-center gap-1">
                  <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  {progress.failCount}
                </p>
                <p className="text-xs text-red-700 dark:text-red-300">{t('followups.bulkScript.fail')}</p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => { paused ? resume() : pause() }}
                className={`flex-1 px-4 py-3 rounded-lg font-bold transition-colors duration-200 inline-flex items-center justify-center gap-2 ${
                  paused
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-white'
                }`}
              >
                {paused ? (
                  <>
                    <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/></svg>
                    {t('followups.bulkScript.resume')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6"/></svg>
                    {t('followups.bulkScript.pause')}
                  </>
                )}
              </button>
              <button
                onClick={() => stop()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-bold transition-colors duration-200 inline-flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                {t('followups.bulkScript.stopPermanent')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Bulk Script - Report Modal */}
      {report && !running && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
          onClick={() => dismissReport()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-script-report-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={`p-5 rounded-t-2xl ${report.failed.length === 0 ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-purple-600 to-indigo-600'} text-white`}>
              <h2 id="bulk-script-report-title" className="text-xl font-bold inline-flex items-center gap-2">
                <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6m0 13l-3-3m3 3l3-3m6 3V10m0 9l3-3m-3 3l-3-3"/></svg>
                {t('followups.bulkScript.reportTitle')}
              </h2>
              <p className="text-sm opacity-90 mt-1">{t('followups.bulkScript.reportSubtitle')}</p>
            </div>

            <div className="p-5 space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400 inline-flex items-center gap-1.5">
                    <svg className="w-6 h-6" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    {report.success.length}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">{t('followups.bulkScript.sentSuccessfully')}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400 inline-flex items-center gap-1.5">
                    <svg className="w-6 h-6" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    {report.failed.length}
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">{t('followups.bulkScript.sendFailed')}</p>
                </div>
              </div>

              {/* Failed List */}
              {report.failed.length > 0 && (
                <div>
                  <h3 className="font-bold text-red-600 dark:text-red-400 mb-2 text-sm">{t('followups.bulkScript.failedNumbers')}</h3>
                  <div className="bg-red-50 dark:bg-red-900/10 rounded-lg divide-y divide-red-100 dark:divide-red-900/40 max-h-48 overflow-y-auto">
                    {report.failed.map((item, idx) => (
                      <div key={idx} className="px-3 py-2 text-sm flex justify-between items-center">
                        <div>
                          <span className="font-bold text-gray-800 dark:text-gray-200">{item.name}</span>
                          <span className="text-gray-500 dark:text-gray-400 ms-2">{item.phone}</span>
                        </div>
                        <span className="text-xs text-red-500 dark:text-red-400">{item.error}</span>
                      </div>
                    ))}
                  </div>

                  {/* Retry Button */}
                  <button
                    onClick={() => { retryFailed() }}
                    className="w-full mt-3 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-bold transition-colors duration-200 inline-flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    {t('followups.bulkScript.retryFailed')} ({report.failed.length})
                  </button>
                </div>
              )}

              {/* Close */}
              <button
                onClick={() => dismissReport()}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-bold transition-colors duration-200"
              >
                {t('followups.bulkScript.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
