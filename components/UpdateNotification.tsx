'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useUpdate } from '@/contexts/UpdateContext'

interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseNotes?: string
}

interface DownloadProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export default function UpdateNotification() {
  const { t, direction } = useLanguage()
  const { setUpdateAvailable: setGlobalUpdateAvailable } = useUpdate()
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isElectron, setIsElectron] = useState(false)
  const [progressInfo, setProgressInfo] = useState<DownloadProgress | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isUpToDate, setIsUpToDate] = useState(false)

  useEffect(() => {
    // التحقق من بيئة Electron
    const electron = (window as any).electron
    if (electron?.isElectron) {
      setIsElectron(true)
      setupUpdateListeners(electron)
    }

    return () => {
      // تنظيف المستمعين
      electron?.offUpdateListeners?.()
    }
  }, [])

  const setupUpdateListeners = (electron: any) => {
    // عند توفر تحديث جديد
    electron.onUpdateAvailable?.((info: UpdateInfo) => {
      console.log('🔄 Update available:', info)
      setUpdateInfo(info)
      setUpdateAvailable(true)
      setGlobalUpdateAvailable(true) // ✅ تحديث الـ context للـ badge
      setDownloadProgress(0)
      setIsChecking(false)
      setIsUpToDate(false)
    })

    // عند عدم وجود تحديثات
    electron.onUpdateNotAvailable?.((info: UpdateInfo) => {
      console.log('✅ App is up to date:', info)
      setUpdateInfo(info)
      setIsUpToDate(true)
      setIsChecking(false)
      setGlobalUpdateAvailable(false) // ✅ إخفاء الـ badge
      // إخفاء التنبيه بعد 4 ثواني
      setTimeout(() => setIsUpToDate(false), 4000)
    })

    // عند تحميل التحديث
    electron.onUpdateDownloaded?.((info: UpdateInfo) => {
      console.log('✅ Update downloaded:', info)
      setUpdateDownloaded(true)
      setDownloadProgress(100)
      setIsChecking(false)
      // الـ badge يظل ظاهر لحد ما يثبت التحديث
    })

    // نسبة التحميل
    electron.onDownloadProgress?.((progress: DownloadProgress) => {
      console.log(`📥 Download progress: ${progress.percent.toFixed(2)}%`)
      setDownloadProgress(progress.percent)
      setProgressInfo(progress)
    })

    // عند حدوث خطأ
    electron.onUpdateError?.((errorInfo: { message: string }) => {
      console.error('❌ Update error:', errorInfo)
      setError(errorInfo.message)
      setTimeout(() => setError(null), 5000)
    })
  }

  const handleInstallUpdate = () => {
    const electron = (window as any).electron
    electron?.quitAndInstall?.()
  }

  const handleCheckForUpdates = async () => {
    setIsChecking(true)
    const electron = (window as any).electron
    electron?.checkForUpdates?.()

    // إخفاء loading بعد 3 ثواني
    setTimeout(() => setIsChecking(false), 3000)
  }

  const handleDismiss = () => {
    setUpdateAvailable(false)
    setUpdateDownloaded(false)
    setUpdateInfo(null)
    setProgressInfo(null)
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatSpeed = (bytesPerSecond: number) => {
    return formatBytes(bytesPerSecond) + '/s'
  }

  if (!isElectron) return null

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
            <div className="bg-white/20 rounded-full p-2 backdrop-blur-sm">
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
            <div className="bg-white/20 rounded-full p-2 backdrop-blur-sm">
              <span className="text-3xl">✨</span>
            </div>
            <div className="flex-1">
              <p className="font-bold mb-1 text-xl">
                {direction === 'rtl' ? 'أنت تستخدم أحدث إصدار! 🎉' : 'You\'re up to date! 🎉'}
              </p>
              <p className="text-sm opacity-90">
                {direction === 'rtl'
                  ? `النسخة ${updateInfo?.version || '1.0.0'} هي أحدث إصدار متاح`
                  : `Version ${updateInfo?.version || '1.0.0'} is the latest available`}
              </p>
              <p className="text-xs opacity-75 mt-2">
                {direction === 'rtl'
                  ? 'سيتم التحقق من التحديثات تلقائياً كل 6 ساعات'
                  : 'Updates are checked automatically every 6 hours'}
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

      {/* Update downloading notification */}
      {updateAvailable && !updateDownloaded && (
        <div
          className="fixed top-4 right-4 z-[10000] bg-gradient-to-br from-blue-500 to-blue-600 text-white p-5 rounded-xl shadow-2xl animate-slideDown border border-blue-400"
          style={{ minWidth: '380px', maxWidth: '420px' }}
          dir={direction}
        >
          <div className="flex items-start gap-3">
            <div className="bg-white/20 rounded-full p-2 backdrop-blur-sm">
              <span className="text-2xl">🔄</span>
            </div>
            <div className="flex-1">
              <p className="font-bold mb-1 text-lg">
                {direction === 'rtl' ? 'تحديث جديد متاح!' : 'New Update Available!'}
              </p>
              <p className="text-sm opacity-90 mb-3">
                {direction === 'rtl' ? 'النسخة' : 'Version'} {updateInfo?.version}
              </p>

              {/* Progress bar */}
              <div className="w-full bg-white/20 rounded-full h-4 mb-2 overflow-hidden backdrop-blur-sm">
                <div
                  className="bg-gradient-to-r from-white to-blue-100 h-4 rounded-full transition-all duration-300 flex items-center justify-center shadow-sm"
                  style={{ width: `${downloadProgress}%` }}
                >
                  {downloadProgress > 15 && (
                    <span className="text-xs font-bold text-blue-600 px-2">
                      {downloadProgress.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Download info */}
              <div className="flex justify-between items-center text-xs opacity-85">
                <span>
                  {direction === 'rtl' ? 'جاري التحميل...' : 'Downloading...'}
                </span>
                {progressInfo && (
                  <span className="font-mono">
                    {formatBytes(progressInfo.transferred)} / {formatBytes(progressInfo.total)}
                    {progressInfo.bytesPerSecond > 0 && (
                      <span className="ml-2 opacity-75">
                        ({formatSpeed(progressInfo.bytesPerSecond)})
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/70 hover:text-white transition-colors text-xl"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Update ready to install notification */}
      {updateDownloaded && (
        <div
          className="fixed top-4 right-4 z-[10000] bg-gradient-to-br from-green-500 to-green-600 text-white p-5 rounded-xl shadow-2xl animate-slideDown border border-green-400"
          style={{ minWidth: '380px', maxWidth: '420px' }}
          dir={direction}
        >
          <div className="flex items-start gap-3">
            <div className="bg-white/20 rounded-full p-2 backdrop-blur-sm">
              <span className="text-3xl">✅</span>
            </div>
            <div className="flex-1">
              <p className="font-bold mb-1 text-xl">
                {direction === 'rtl' ? 'التحديث جاهز! 🎉' : 'Update Ready! 🎉'}
              </p>
              <p className="text-sm opacity-90 mb-4">
                {direction === 'rtl'
                  ? `النسخة ${updateInfo?.version} تم تحميلها بنجاح`
                  : `Version ${updateInfo?.version} downloaded successfully`}
              </p>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleInstallUpdate}
                  className="flex-1 bg-white text-green-600 px-4 py-2.5 rounded-lg font-bold hover:bg-green-50 hover:shadow-lg transition-all transform hover:scale-105"
                >
                  <span className="flex items-center justify-center gap-2">
                    🔄
                    {direction === 'rtl' ? 'إعادة تشغيل وتثبيت' : 'Restart & Install'}
                  </span>
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2.5 rounded-lg font-bold bg-white/20 hover:bg-white/30 transition-colors"
                >
                  {direction === 'rtl' ? 'لاحقاً' : 'Later'}
                </button>
              </div>

              <p className="text-xs opacity-75 mt-3 text-center">
                {direction === 'rtl'
                  ? 'سيتم التثبيت عند إعادة تشغيل البرنامج'
                  : 'Update will install when app restarts'}
              </p>
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
