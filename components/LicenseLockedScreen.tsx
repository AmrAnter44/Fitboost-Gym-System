'use client'

import { useState } from 'react'
import { useLicense } from '../contexts/LicenseContext'

export default function LicenseLockedScreen() {
  const { isValid, isLoading } = useLicense()
  const [isChecking, setIsChecking] = useState(false)

  // Don't show anything while loading
  if (isLoading) {
    return null
  }

  // Only show lock screen if license is invalid
  if (isValid) {
    return null
  }

  // Function to manually check license
  const handleRecheck = async () => {
    setIsChecking(true)
    try {
      // Call the license status API to trigger a fresh check
      const response = await fetch('/api/license/validate', {
        method: 'POST',
        cache: 'no-store'
      })

      if (response.ok) {
        // Force page reload to refresh license state
        window.location.reload()
      }
    } catch (error) {
      console.error('Error rechecking license:', error)
    } finally {
      setTimeout(() => setIsChecking(false), 2000)
    }
  }

  // Full-screen lock overlay
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-red-900 via-red-800 to-orange-900"
      style={{ pointerEvents: 'all' }}
      dir="rtl"
    >
      <div className="text-center px-6 max-w-2xl">
        {/* Lock Icon */}
        <div className="text-9xl mb-8 animate-pulse">
          🔒
        </div>

        {/* Main Message */}
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 drop-shadow-2xl">
          النظام متوقف
        </h1>

        <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-2xl p-8 border-2 border-white border-opacity-30 shadow-2xl">
          <p className="text-2xl md:text-3xl text-white mb-4 font-semibold">
            رخصة التشغيل غير صالحة
          </p>

          <p className="text-lg md:text-xl text-red-100 mb-6">
            لا يمكن الوصول إلى وظائف النظام حالياً
          </p>

          <div className="border-t border-white border-opacity-30 pt-6 mt-6">
            <p className="text-base md:text-lg text-white mb-4">
              للحصول على المساعدة، يرجى التواصل مع الدعم الفني
            </p>

            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
              <button
                onClick={handleRecheck}
                disabled={isChecking}
                className="inline-flex items-center gap-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{isChecking ? 'جاري الفحص...' : 'إعادة الفحص'}</span>
              </button>

              <a
                href="https://wa.me/201028518754"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span>تواصل عبر واتساب</span>
              </a>
            </div>
          </div>
        </div>

        {/* Pulsing Warning */}
        <div className="mt-8 animate-bounce">
          <p className="text-xl text-yellow-300 font-bold">
            ⚠️ System Locked - Invalid License ⚠️
          </p>
        </div>
      </div>
    </div>
  )
}
