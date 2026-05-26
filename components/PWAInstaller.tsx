'use client'

import { useEffect, useState } from 'react'
import { safeStorage } from '../lib/safeStorage'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)

      if (typeof window !== 'undefined' && !window.matchMedia('(display-mode: standalone)').matches) {
        setShowInstallPrompt(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    const handleAppInstalled = () => {
      setShowInstallPrompt(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    setDeferredPrompt(null)
    setShowInstallPrompt(false)
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    safeStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const dismissed = safeStorage.getItem('pwa-install-dismissed')
    if (dismissed) {
      const dismissedTime = parseInt(dismissed)
      const weekInMs = 7 * 24 * 60 * 60 * 1000
      if (Date.now() - dismissedTime < weekInMs) {
        setShowInstallPrompt(false)
      }
    }
  }, [])

  if (!showInstallPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-slideUp pointer-events-none">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl ring-1 ring-gray-200 dark:ring-gray-700 p-4 max-w-md mx-auto pointer-events-auto">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 3h8a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2zm4 16h.01" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 mb-1">ثبت التطبيق</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              احصل على تجربة أفضل مع تطبيق الموبايل - عمل بدون إنترنت، وصول أسرع!
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleInstallClick}
                className="bg-primary-500 hover:bg-primary-600 text-primary-contrast px-4 py-2 rounded-lg font-bold text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                تثبيت الآن
              </button>
              <button
                onClick={handleDismiss}
                className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-bold transition-colors duration-200"
              >
                لاحقاً
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="إغلاق"
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 flex-shrink-0"
          >
            <svg className="w-4 h-4" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
