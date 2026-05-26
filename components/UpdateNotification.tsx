'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useUpdate } from '@/contexts/UpdateContext'

interface UpdateInfo {
  version: string
  releaseNotes?: string
  releaseDate?: string
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

export default function UpdateNotification() {
  const { direction } = useLanguage()
  const { setUpdateAvailable: setGlobalUpdateAvailable } = useUpdate()
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [isUpToDate, setIsUpToDate] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)

  const [currentVersion, setCurrentVersion] = useState('...')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const electron = (window as any).electron
    if (electron?.getAppVersion) {
      electron.getAppVersion().then((v: string) => setCurrentVersion(v)).catch(() => setCurrentVersion('unknown'))
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const electron = (window as any).electron
    if (!electron?.isElectron) return

    electron.onUpdateAvailable?.((info: UpdateInfo) => {
      setUpdateInfo(info)
      setUpdateAvailable(true)
      setGlobalUpdateAvailable(true)
      setIsChecking(false)
    })

    electron.onUpdateNotAvailable?.((info: UpdateInfo) => {
      setIsUpToDate(true)
      setGlobalUpdateAvailable(false)
      setIsChecking(false)
      setTimeout(() => setIsUpToDate(false), 4000)
    })

    electron.onUpdateError?.((err: any) => {
      console.error('Update error:', err)
      setError(err.message || 'فشل التحقق من التحديثات')
      setIsChecking(false)
      setIsDownloading(false)
      setTimeout(() => setError(null), 5000)
    })

    electron.onDownloadProgress?.((progress: any) => {
      setDownloadProgress(Math.round(progress.percent))
    })

    electron.onUpdateDownloaded?.((info: UpdateInfo) => {
      setUpdateDownloaded(true)
      setIsDownloading(false)
      setUpdateAvailable(false)
    })

    const checkTimer = setTimeout(() => {
      electron.checkForUpdates?.().catch((err: any) =>
        console.warn('Update check failed:', err)
      )
    }, 4000)

    return () => {
      clearTimeout(checkTimer)
      electron.offUpdateListeners?.()
    }
  }, [setGlobalUpdateAvailable])

  const handleCheckForUpdates = async () => {
    if (typeof window === 'undefined') return

    const electron = (window as any).electron
    if (!electron?.isElectron) {
      setError('التحديثات متاحة فقط في تطبيق Electron')
      setTimeout(() => setError(null), 3000)
      return
    }

    setIsChecking(true)
    setError(null)
    setUpdateInfo(null)
    setUpdateAvailable(false)

    try {
      const result = await electron.checkForUpdates?.()
      if (result?.error) {
        throw new Error(result.error)
      }
    } catch (err: any) {
      console.error('Error checking for updates:', err)
      setError(err.message || 'فشل التحقق من التحديثات')
      setIsChecking(false)
      setTimeout(() => setError(null), 5000)
    }
  }

  const handleDownloadUpdate = async () => {
    if (typeof window === 'undefined') return

    const electron = (window as any).electron
    if (!electron?.isElectron) return

    setIsDownloading(true)
    setDownloadProgress(0)
    setError(null)

    try {
      const result = await electron.downloadUpdate?.()
      if (result?.error) {
        throw new Error(result.error)
      }
    } catch (err: any) {
      console.error('Error downloading update:', err)
      setError(err.message || 'فشل تحميل التحديث')
      setIsDownloading(false)
      setTimeout(() => setError(null), 5000)
    }
  }

  const handleInstallUpdate = async () => {
    if (typeof window === 'undefined') return

    const electron = (window as any).electron
    if (!electron?.isElectron) return

    setIsInstalling(true)
    setUpdateDownloaded(false)

    await new Promise((r) => setTimeout(r, 5000))

    try {
      await electron.installUpdate?.()
    } catch (err: any) {
      console.error('Error installing update:', err)
      setIsInstalling(false)
      setError(err.message || 'فشل تثبيت التحديث')
      setTimeout(() => setError(null), 5000)
    }
  }

  const handleDismiss = () => {
    setUpdateAvailable(false)
    setUpdateInfo(null)
    setGlobalUpdateAvailable(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const closeIcon = (
    <svg className="w-5 h-5" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )

  return (
    <>
      {error && (
        <div
          className="fixed top-4 end-4 z-[10000] bg-red-600 dark:bg-red-700 text-white p-5 rounded-xl shadow-2xl ring-1 ring-red-500/40 animate-slideDown"
          style={{ minWidth: '380px', maxWidth: '420px' }}
          dir={direction}
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <div className="bg-white/15 rounded-lg p-2 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-bold mb-1 text-lg">
                {direction === 'rtl' ? 'خطأ في التحديث' : 'Update Error'}
              </p>
              <p className="text-sm opacity-90">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="إغلاق"
              className="text-white/80 hover:text-white p-1 rounded-md transition-colors duration-200"
            >
              {closeIcon}
            </button>
          </div>
        </div>
      )}

      {isUpToDate && (
        <div
          className="fixed top-4 end-4 z-[10000] bg-emerald-600 dark:bg-emerald-700 text-white p-5 rounded-xl shadow-2xl ring-1 ring-emerald-500/40 animate-slideDown"
          style={{ minWidth: '380px', maxWidth: '420px' }}
          dir={direction}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <div className="bg-white/15 rounded-lg p-2 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-bold mb-1 text-xl">
                {direction === 'rtl' ? 'أنت تستخدم أحدث إصدار!' : "You're up to date!"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsUpToDate(false)}
              aria-label="إغلاق"
              className="text-white/80 hover:text-white p-1 rounded-md transition-colors duration-200"
            >
              {closeIcon}
            </button>
          </div>
        </div>
      )}

      {updateAvailable && updateInfo && !isDownloading && (
        <div
          className="fixed top-4 end-4 z-[10000] bg-emerald-600 dark:bg-emerald-700 text-white p-5 rounded-xl shadow-2xl ring-1 ring-emerald-500/40 animate-slideDown"
          style={{ minWidth: '400px', maxWidth: '450px' }}
          dir={direction}
          role="dialog"
          aria-modal="false"
          aria-labelledby="update-available-title"
        >
          <div className="flex items-start gap-3">
            <div className="bg-white/15 rounded-lg p-2 flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </div>
            <div className="flex-1">
              <p id="update-available-title" className="font-bold mb-1 text-xl">
                {direction === 'rtl' ? 'تحديث جديد متاح!' : 'New Update Available!'}
              </p>

              {updateInfo.releaseDate && (
                <p className="text-xs opacity-90 mb-3 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  <span>{formatDate(updateInfo.releaseDate)}</span>
                </p>
              )}

              {updateInfo.releaseNotes && (
                <div className="bg-white/10 rounded-lg p-2 mb-3 max-h-20 overflow-y-auto text-xs opacity-90">
                  {updateInfo.releaseNotes.split('\n').slice(0, 3).join('\n')}
                  {updateInfo.releaseNotes.split('\n').length > 3 && '...'}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDownloadUpdate}
                  autoFocus
                  className="flex-1 bg-white text-emerald-700 px-4 py-2.5 rounded-lg font-bold hover:bg-emerald-50 transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-600"
                >
                  <svg className="w-5 h-5" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  <span>{direction === 'rtl' ? 'تحميل التحديث' : 'Download Update'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-4 py-2.5 rounded-lg font-bold bg-white/15 hover:bg-white/25 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-600"
                >
                  {direction === 'rtl' ? 'لاحقاً' : 'Later'}
                </button>
              </div>

              <p className="text-xs opacity-75 mt-2 text-center">
                {direction === 'rtl'
                  ? 'سيتم تحميل التحديث وتثبيته تلقائياً'
                  : 'Update will be downloaded and installed automatically'}
              </p>
            </div>
          </div>
        </div>
      )}

      {isDownloading && (
        <div
          className="fixed top-4 end-4 z-[10000] bg-primary-600 dark:bg-primary-700 text-primary-contrast p-5 rounded-xl shadow-2xl ring-1 ring-primary-500/40 animate-slideDown"
          style={{ minWidth: '400px', maxWidth: '450px' }}
          dir={direction}
          role="status"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <div className="bg-white/15 rounded-lg p-2 flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 animate-spin" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-bold mb-2 text-xl">
                {direction === 'rtl' ? 'جاري تحميل التحديث...' : 'Downloading Update...'}
              </p>

              <div className="bg-white/15 rounded-full h-3 mb-2 overflow-hidden">
                <div
                  className="bg-white h-full transition-[width] duration-300 rounded-full"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>

              <p className="text-sm opacity-90 text-center">
                {downloadProgress}%
              </p>

              <p className="text-xs opacity-75 mt-2 text-center">
                {direction === 'rtl'
                  ? 'سيتم تثبيت التحديث بعد اكتمال التحميل'
                  : 'Update will be installed after download completes'}
              </p>
            </div>
          </div>
        </div>
      )}

      {updateDownloaded && (
        <div
          className="fixed top-4 end-4 z-[10000] bg-primary-600 dark:bg-primary-700 text-primary-contrast p-5 rounded-xl shadow-2xl ring-1 ring-primary-500/40 animate-slideDown"
          style={{ minWidth: '400px', maxWidth: '450px' }}
          dir={direction}
          role="dialog"
          aria-modal="false"
          aria-labelledby="update-downloaded-title"
        >
          <div className="flex items-start gap-3">
            <div className="bg-white/15 rounded-lg p-2 flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p id="update-downloaded-title" className="font-bold mb-2 text-xl">
                {direction === 'rtl' ? 'التحديث جاهز للتثبيت!' : 'Update Ready to Install!'}
              </p>

              <p className="text-sm opacity-90 mb-3">
                {direction === 'rtl'
                  ? 'تم تحميل التحديث بنجاح. سيتم تثبيته عند إغلاق التطبيق.'
                  : 'Update downloaded successfully. It will be installed when you close the app.'}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleInstallUpdate}
                  autoFocus
                  className="flex-1 bg-white text-primary-700 px-4 py-2.5 rounded-lg font-bold hover:bg-primary-50 transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600"
                >
                  <svg className="w-5 h-5" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06" />
                  </svg>
                  <span>{direction === 'rtl' ? 'إعادة التشغيل الآن' : 'Restart Now'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUpdateDownloaded(false)}
                  className="px-4 py-2.5 rounded-lg font-bold bg-white/15 hover:bg-white/25 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600"
                >
                  {direction === 'rtl' ? 'لاحقاً' : 'Later'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isInstalling && (
        <div
          className="fixed inset-0 z-[99999] bg-primary-700 dark:bg-primary-800 flex items-center justify-center"
          dir={direction}
          role="alert"
          aria-busy="true"
          aria-live="assertive"
        >
          <div className="text-center text-white px-6 max-w-lg">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/15 flex items-center justify-center animate-pulse">
              <svg className="w-12 h-12 animate-spin" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold mb-3">
              {direction === 'rtl' ? 'جاري تثبيت التحديث...' : 'Installing update...'}
            </h2>
            <p className="text-lg opacity-90 mb-6">
              {direction === 'rtl'
                ? 'التطبيق هيقفل ويفتح تاني تلقائياً خلال لحظات'
                : 'The app will close and reopen automatically in a moment'}
            </p>
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-3 h-3 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-3 h-3 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-sm opacity-75 mt-4 flex items-center justify-center gap-1.5">
              <svg className="w-4 h-4" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
              </svg>
              <span>{direction === 'rtl'
                ? 'متقفلش التطبيق ولا الجهاز خلال التثبيت'
                : 'Do not close the app or shut down the device during installation'}</span>
            </p>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </>
  )
}
