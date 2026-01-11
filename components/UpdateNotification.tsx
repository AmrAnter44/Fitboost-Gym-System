'use client'

import { useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useUpdate } from '@/contexts/UpdateContext'

interface UpdateInfo {
  latestVersion: string
  downloadUrl: string
  releaseNotes: string
  publishedAt: string
  htmlUrl: string
}

export default function UpdateNotification() {
  const { direction } = useLanguage()
  const { setUpdateAvailable: setGlobalUpdateAvailable } = useUpdate()
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isUpToDate, setIsUpToDate] = useState(false)

  // Get current version from package.json
  const currentVersion = '1.0.7'

  // Simple version comparison (major.minor.patch)
  const compareVersions = (v1: string, v2: string): number => {
    const parts1 = v1.split('.').map(Number)
    const parts2 = v2.split('.').map(Number)

    for (let i = 0; i < 3; i++) {
      if (parts1[i] > parts2[i]) return 1
      if (parts1[i] < parts2[i]) return -1
    }
    return 0
  }

  const handleCheckForUpdates = async () => {
    setIsChecking(true)
    setError(null)
    setUpdateInfo(null)

    try {
      const response = await fetch('/api/check-update')

      if (!response.ok) {
        throw new Error('فشل التحقق من التحديثات')
      }

      const data: UpdateInfo = await response.json()
      setUpdateInfo(data)

      // Compare versions
      const isNewVersion = compareVersions(data.latestVersion, currentVersion) > 0

      if (isNewVersion) {
        setUpdateAvailable(true)
        setGlobalUpdateAvailable(true)
      } else {
        setIsUpToDate(true)
        setGlobalUpdateAvailable(false)
        // إخفاء التنبيه بعد 4 ثواني
        setTimeout(() => setIsUpToDate(false), 4000)
      }
    } catch (err) {
      console.error('Error checking for updates:', err)
      setError('فشل التحقق من التحديثات. تأكد من اتصال الإنترنت.')
      setTimeout(() => setError(null), 5000)
    } finally {
      setIsChecking(false)
    }
  }

  const handleDownloadUpdate = () => {
    if (updateInfo?.htmlUrl) {
      window.open(updateInfo.htmlUrl, '_blank')
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
      {/* Floating Check Updates Button - bottom left */}
      <button
        onClick={handleCheckForUpdates}
        disabled={isChecking}
        className="fixed bottom-4 left-4 z-[9999] bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-full shadow-2xl hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        title={direction === 'rtl' ? 'التحقق من التحديثات' : 'Check for Updates'}
      >
        {isChecking ? (
          <>
            <span className="animate-spin text-lg">⏳</span>
            <span className="text-sm font-bold">
              {direction === 'rtl' ? 'جاري التحقق...' : 'Checking...'}
            </span>
          </>
        ) : (
          <>
            <span className="text-lg">🔄</span>
            <span className="text-sm font-bold">
              {direction === 'rtl' ? 'تحقق من التحديثات' : 'Check Updates'}
            </span>
          </>
        )}
      </button>

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
                  ? `النسخة ${currentVersion} هي أحدث إصدار متاح`
                  : `Version ${currentVersion} is the latest available`}
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
      {updateAvailable && updateInfo && (
        <div
          className="fixed top-4 right-4 z-[10000] bg-gradient-to-br from-green-500 to-green-600 text-white p-5 rounded-xl shadow-2xl animate-slideDown border border-green-400"
          style={{ minWidth: '400px', maxWidth: '450px' }}
          dir={direction}
        >
          <div className="flex items-start gap-3">
            <div className="bg-white/20 rounded-full p-2 backdrop-blur-sm">
              <span className="text-3xl">🎉</span>
            </div>
            <div className="flex-1">
              <p className="font-bold mb-1 text-xl">
                {direction === 'rtl' ? 'تحديث جديد متاح!' : 'New Update Available!'}
              </p>

              {/* Current vs Latest */}
              <div className="bg-white/20 rounded-lg p-3 mb-3 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs opacity-90">
                    {direction === 'rtl' ? 'الإصدار الحالي:' : 'Current:'}
                  </span>
                  <span className="font-bold">{currentVersion}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs opacity-90">
                    {direction === 'rtl' ? 'الإصدار الجديد:' : 'Latest:'}
                  </span>
                  <span className="font-bold text-yellow-200">{updateInfo.latestVersion}</span>
                </div>
              </div>

              {/* Release Date */}
              <p className="text-xs opacity-90 mb-3">
                📅 {formatDate(updateInfo.publishedAt)}
              </p>

              {/* Release Notes Preview */}
              {updateInfo.releaseNotes && (
                <div className="bg-white/10 rounded-lg p-2 mb-3 max-h-20 overflow-y-auto text-xs opacity-90">
                  {updateInfo.releaseNotes.split('\n').slice(0, 3).join('\n')}
                  {updateInfo.releaseNotes.split('\n').length > 3 && '...'}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadUpdate}
                  className="flex-1 bg-white text-green-600 px-4 py-2.5 rounded-lg font-bold hover:bg-green-50 hover:shadow-lg transition-all transform hover:scale-105"
                >
                  <span className="flex items-center justify-center gap-2">
                    📥
                    {direction === 'rtl' ? 'تحميل التحديث' : 'Download Update'}
                  </span>
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2.5 rounded-lg font-bold bg-white/20 hover:bg-white/30 transition-colors"
                >
                  {direction === 'rtl' ? 'لاحقاً' : 'Later'}
                </button>
              </div>

              <p className="text-xs opacity-75 mt-2 text-center">
                {direction === 'rtl'
                  ? 'سيتم فتح صفحة التحميل في متصفح جديد'
                  : 'Download page will open in browser'}
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
