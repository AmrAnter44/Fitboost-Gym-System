'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useUpdate } from '@/contexts/UpdateContext'

interface UpdateInfo {
  version: string
  releaseNotes?: string
  releaseDate?: string
}

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

  // Get current version dynamically from Electron
  const [currentVersion, setCurrentVersion] = useState('...')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const electron = (window as any).electron
    if (electron?.getAppVersion) {
      electron.getAppVersion().then((v: string) => setCurrentVersion(v)).catch(() => setCurrentVersion('unknown'))
    }
  }, [])

  // Setup electron update listeners
  useEffect(() => {
    if (typeof window === 'undefined') return

    const electron = (window as any).electron
    if (!electron?.isElectron) return

    // Listen for update available
    electron.onUpdateAvailable?.((info: UpdateInfo) => {
      console.log('✅ Update available:', info)
      setUpdateInfo(info)
      setUpdateAvailable(true)
      setGlobalUpdateAvailable(true)
      setIsChecking(false)
    })

    // Listen for no update
    electron.onUpdateNotAvailable?.((info: UpdateInfo) => {
      console.log('ℹ️ No updates available')
      setIsUpToDate(true)
      setGlobalUpdateAvailable(false)
      setIsChecking(false)
      setTimeout(() => setIsUpToDate(false), 4000)
    })

    // Listen for update error
    electron.onUpdateError?.((err: any) => {
      console.error('❌ Update error:', err)
      setError(err.message || 'فشل التحقق من التحديثات')
      setIsChecking(false)
      setIsDownloading(false)
      setTimeout(() => setError(null), 5000)
    })

    // Listen for download progress
    electron.onDownloadProgress?.((progress: any) => {
      console.log('📥 Download progress:', progress.percent)
      setDownloadProgress(Math.round(progress.percent))
    })

    // Listen for update downloaded
    electron.onUpdateDownloaded?.((info: UpdateInfo) => {
      console.log('✅ Update downloaded:', info)
      setUpdateDownloaded(true)
      setIsDownloading(false)
      setUpdateAvailable(false)
    })

    // Cleanup listeners
    return () => {
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

    try {
      await electron.installUpdate?.()
    } catch (err: any) {
      console.error('Error installing update:', err)
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

  return (
    <>
      {/* Error notification */}
      {error && (
        <div
          className="fixed top-4 right-4 z-[10000] bg-gradient-to-br from-red-500 to-red-600 text-white p-5 rounded-xl shadow-2xl animate-slideDown border border-red-400"
          style={{ minWidth: '380px', maxWidth: '420px' }}
          dir={direction}
        >
          <div className="flex items-start gap-3">
            <div className="bg-white dark:bg-gray-800/20 rounded-full p-2 backdrop-blur-sm">
              <span className="text-2xl">❌</span>
            </div>
            <div className="flex-1">
              <p className="font-bold mb-1 text-lg">
                {direction === 'rtl' ? 'خطأ في التحديث' : 'Update Error'}
              </p>
              <p className="text-sm opacity-90">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-white/70 hover:text-white transition-colors text-xl"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Up to date notification */}
      {isUpToDate && (
        <div
          className="fixed top-4 right-4 z-[10000] bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 rounded-xl shadow-2xl animate-slideDown border border-emerald-400"
          style={{ minWidth: '380px', maxWidth: '420px' }}
          dir={direction}
        >
          <div className="flex items-start gap-3">
            <div className="bg-white dark:bg-gray-800/20 rounded-full p-2 backdrop-blur-sm">
              <span className="text-3xl">✨</span>
            </div>
            <div className="flex-1">
              <p className="font-bold mb-1 text-xl">
                {direction === 'rtl' ? 'أنت تستخدم أحدث إصدار! 🎉' : 'You\'re up to date! 🎉'}
              </p>
            </div>
            <button
              onClick={() => setIsUpToDate(false)}
              className="text-white/70 hover:text-white transition-colors text-xl"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Update available notification */}
      {updateAvailable && updateInfo && !isDownloading && (
        <div
          className="fixed top-4 right-4 z-[10000] bg-gradient-to-br from-green-500 to-green-600 text-white p-5 rounded-xl shadow-2xl animate-slideDown border border-green-400"
          style={{ minWidth: '400px', maxWidth: '450px' }}
          dir={direction}
        >
          <div className="flex items-start gap-3">
            <div className="bg-white dark:bg-gray-800/20 rounded-full p-2 backdrop-blur-sm">
              <span className="text-3xl">🎉</span>
            </div>
            <div className="flex-1">
              <p className="font-bold mb-1 text-xl">
                {direction === 'rtl' ? 'تحديث جديد متاح!' : 'New Update Available!'}
              </p>

              {/* Release Date */}
              {updateInfo.releaseDate && (
                <p className="text-xs opacity-90 mb-3">
                  📅 {formatDate(updateInfo.releaseDate)}
                </p>
              )}

              {/* Release Notes Preview */}
              {updateInfo.releaseNotes && (
                <div className="bg-white dark:bg-gray-800/10 rounded-lg p-2 mb-3 max-h-20 overflow-y-auto text-xs opacity-90">
                  {updateInfo.releaseNotes.split('\n').slice(0, 3).join('\n')}
                  {updateInfo.releaseNotes.split('\n').length > 3 && '...'}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadUpdate}
                  className="flex-1 bg-white dark:bg-gray-800 text-green-600 px-4 py-2.5 rounded-lg font-bold hover:bg-green-50 hover:shadow-lg transition-all transform hover:scale-105"
                >
                  <span className="flex items-center justify-center gap-2">
                    📥
                    {direction === 'rtl' ? 'تحميل التحديث' : 'Download Update'}
                  </span>
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2.5 rounded-lg font-bold bg-white/20 hover:bg-white dark:bg-gray-800/30 transition-colors"
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

      {/* Downloading progress notification */}
      {isDownloading && (
        <div
          className="fixed top-4 right-4 z-[10000] bg-gradient-to-br from-primary-500 to-primary-600 text-white p-5 rounded-xl shadow-2xl animate-slideDown border border-primary-400"
          style={{ minWidth: '400px', maxWidth: '450px' }}
          dir={direction}
        >
          <div className="flex items-start gap-3">
            <div className="bg-white dark:bg-gray-800/20 rounded-full p-2 backdrop-blur-sm">
              <span className="text-3xl animate-spin">⏳</span>
            </div>
            <div className="flex-1">
              <p className="font-bold mb-2 text-xl">
                {direction === 'rtl' ? 'جاري تحميل التحديث...' : 'Downloading Update...'}
              </p>

              {/* Progress bar */}
              <div className="bg-white dark:bg-gray-800/20 rounded-full h-3 mb-2 overflow-hidden">
                <div
                  className="bg-white dark:bg-gray-800 h-full transition-all duration-300 rounded-full"
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

      {/* Update downloaded - ready to install */}
      {updateDownloaded && (
        <div
          className="fixed top-4 right-4 z-[10000] bg-gradient-to-br from-primary-500 to-primary-600 text-white p-5 rounded-xl shadow-2xl animate-slideDown border border-primary-400"
          style={{ minWidth: '400px', maxWidth: '450px' }}
          dir={direction}
        >
          <div className="flex items-start gap-3">
            <div className="bg-white dark:bg-gray-800/20 rounded-full p-2 backdrop-blur-sm">
              <span className="text-3xl">✅</span>
            </div>
            <div className="flex-1">
              <p className="font-bold mb-2 text-xl">
                {direction === 'rtl' ? 'التحديث جاهز للتثبيت!' : 'Update Ready to Install!'}
              </p>

              <p className="text-sm opacity-90 mb-3">
                {direction === 'rtl'
                  ? 'تم تحميل التحديث بنجاح. سيتم تثبيته عند إغلاق التطبيق.'
                  : 'Update downloaded successfully. It will be installed when you close the app.'}
              </p>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleInstallUpdate}
                  className="flex-1 bg-white dark:bg-gray-800 text-primary-600 px-4 py-2.5 rounded-lg font-bold hover:bg-primary-50 hover:shadow-lg transition-all transform hover:scale-105"
                >
                  <span className="flex items-center justify-center gap-2">
                    🔄
                    {direction === 'rtl' ? 'إعادة التشغيل الآن' : 'Restart Now'}
                  </span>
                </button>
                <button
                  onClick={() => setUpdateDownloaded(false)}
                  className="px-4 py-2.5 rounded-lg font-bold bg-white/20 hover:bg-white dark:bg-gray-800/30 transition-colors"
                >
                  {direction === 'rtl' ? 'لاحقاً' : 'Later'}
                </button>
              </div>
            </div>
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
