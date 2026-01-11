'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'

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
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isElectron, setIsElectron] = useState(false)

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
      setDownloadProgress(0)
    })

    // عند تحميل التحديث
    electron.onUpdateDownloaded?.((info: UpdateInfo) => {
      console.log('✅ Update downloaded:', info)
      setUpdateDownloaded(true)
      setDownloadProgress(100)
    })

    // نسبة التحميل
    electron.onDownloadProgress?.((progress: DownloadProgress) => {
      console.log(`📥 Download progress: ${progress.percent.toFixed(2)}%`)
      setDownloadProgress(progress.percent)
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

  const handleDismiss = () => {
    setUpdateAvailable(false)
    setUpdateDownloaded(false)
    setUpdateInfo(null)
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (!isElectron) return null

  return (
    <>
      {/* Error notification */}
      {error && (
        <div
          className="fixed top-4 right-4 z-[10000] bg-red-500 text-white p-4 rounded-lg shadow-xl animate-slideDown"
          dir={direction}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">❌</span>
            <div className="flex-1">
              <p className="font-bold mb-1">
                {direction === 'rtl' ? 'خطأ في التحديث' : 'Update Error'}
              </p>
              <p className="text-sm opacity-90">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Update downloading notification */}
      {updateAvailable && !updateDownloaded && (
        <div
          className="fixed top-4 right-4 z-[10000] bg-blue-500 text-white p-4 rounded-lg shadow-xl animate-slideDown"
          style={{ minWidth: '320px' }}
          dir={direction}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔄</span>
            <div className="flex-1">
              <p className="font-bold mb-1">
                {direction === 'rtl' ? 'تحديث جديد متاح!' : 'New Update Available!'}
              </p>
              <p className="text-sm opacity-90 mb-2">
                {direction === 'rtl' ? 'النسخة' : 'Version'} {updateInfo?.version}
              </p>

              {/* Progress bar */}
              <div className="w-full bg-white/30 rounded-full h-3 mb-2 overflow-hidden">
                <div
                  className="bg-white h-3 rounded-full transition-all duration-300 flex items-center justify-center"
                  style={{ width: `${downloadProgress}%` }}
                >
                  {downloadProgress > 10 && (
                    <span className="text-xs font-bold text-blue-500">
                      {downloadProgress.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs opacity-75">
                {direction === 'rtl'
                  ? 'جاري تحميل التحديث...'
                  : 'Downloading update...'}
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Update ready to install notification */}
      {updateDownloaded && (
        <div
          className="fixed top-4 right-4 z-[10000] bg-green-500 text-white p-4 rounded-lg shadow-xl animate-slideDown"
          style={{ minWidth: '320px' }}
          dir={direction}
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl">✅</span>
            <div className="flex-1">
              <p className="font-bold mb-1 text-lg">
                {direction === 'rtl' ? 'التحديث جاهز!' : 'Update Ready!'}
              </p>
              <p className="text-sm opacity-90 mb-3">
                {direction === 'rtl'
                  ? `النسخة ${updateInfo?.version} جاهزة للتثبيت`
                  : `Version ${updateInfo?.version} ready to install`}
              </p>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleInstallUpdate}
                  className="flex-1 bg-white text-green-600 px-4 py-2 rounded-lg font-bold hover:bg-green-50 transition-colors"
                >
                  {direction === 'rtl' ? 'إعادة تشغيل وتثبيت' : 'Restart & Install'}
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2 rounded-lg font-bold bg-white/20 hover:bg-white/30 transition-colors"
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
