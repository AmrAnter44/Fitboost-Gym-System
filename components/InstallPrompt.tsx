'use client'

import { useState, useEffect } from 'react'
import { safeStorage } from '../lib/safeStorage'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const isInStandaloneMode = () => {
      if (typeof window === 'undefined' || typeof document === 'undefined') return false
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes('android-app://')
      )
    }

    setIsStandalone(isInStandaloneMode())

    const checkIsIOS = () => {
      if (typeof window === 'undefined') return false
      const userAgent = window.navigator.userAgent.toLowerCase()
      return /iphone|ipad|ipod/.test(userAgent)
    }
    setIsIOS(checkIsIOS())

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)

      const dismissed = safeStorage.getItem('pwa-install-dismissed')
      const dismissedDate = dismissed ? new Date(dismissed) : null
      const daysSinceDismissal = dismissedDate
        ? (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)
        : 999

      if (!dismissed || daysSinceDismissal > 7) {
        setTimeout(() => setShowInstallPrompt(true), 3000)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    if (checkIsIOS() && !isInStandaloneMode()) {
      setTimeout(() => setShowInstallPrompt(true), 2000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
    } else {
      safeStorage.setItem('pwa-install-dismissed', new Date().toISOString())
    }

    setDeferredPrompt(null)
    setShowInstallPrompt(false)
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    if (!isIOS) {
      safeStorage.setItem('pwa-install-dismissed', new Date().toISOString())
    }
  }

  if (isStandalone || !showInstallPrompt) {
    return null
  }

  return (
    <>
      {deferredPrompt && !isIOS && (
        <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-primary-600 dark:bg-primary-700 text-primary-contrast shadow-2xl animate-slide-up" role="dialog" aria-modal="false" aria-labelledby="install-prompt-android-title">
          <div className="max-w-md mx-auto">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-12 h-12 bg-white dark:bg-gray-800 rounded-xl p-2 shadow-sm">
                <img src="/icon-192x192.png" alt="Gym System" className="w-full h-full" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="install-prompt-android-title" className="text-lg font-bold mb-1">ثبت Gym System</h3>
                <p className="text-sm text-primary-100 mb-3">
                  ثبت التطبيق للوصول السريع من الشاشة الرئيسية
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    autoFocus
                    className="flex-1 bg-white text-primary-700 px-4 py-2 rounded-lg font-bold hover:bg-primary-50 transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600"
                  >
                    <span>تثبيت</span>
                    <svg className="w-5 h-5" {...stroke}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="px-4 py-2 text-white hover:bg-primary-800 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600"
                  >
                    لاحقاً
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="إغلاق"
                className="text-white/80 hover:text-white p-1 rounded-md transition-colors duration-200"
              >
                <svg className="w-5 h-5" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {isIOS && !deferredPrompt && (
        <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-primary-600 dark:bg-primary-700 text-primary-contrast shadow-2xl animate-slide-up" role="dialog" aria-modal="false" aria-labelledby="install-prompt-ios-title">
          <div className="max-w-md mx-auto">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-12 h-12 bg-white dark:bg-gray-800 rounded-xl p-2 shadow-sm">
                <img src="/icon-192x192.png" alt="Gym System" className="w-full h-full" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="install-prompt-ios-title" className="text-lg font-bold mb-2">ثبت التطبيق على iPhone</h3>
                <div className="text-sm text-primary-100 space-y-2 mb-3">
                  <p className="font-bold">لتثبيت التطبيق:</p>
                  <ol className="list-decimal list-inside space-y-1.5 ms-2">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5">1.</span>
                      <span>اضغط على زر المشاركة
                        <svg className="inline w-5 h-5 mx-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z"/>
                        </svg>
                      </span>
                    </li>
                    <li>اختر "إضافة إلى الشاشة الرئيسية"</li>
                    <li>اضغط "إضافة"</li>
                  </ol>
                </div>
                <button
                  type="button"
                  onClick={handleDismiss}
                  autoFocus
                  className="w-full bg-white text-primary-700 px-4 py-2 rounded-lg font-bold hover:bg-primary-50 transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600"
                >
                  <span>فهمت</span>
                  <svg className="w-4 h-4" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </button>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="إغلاق"
                className="text-white/80 hover:text-white p-1 rounded-md transition-colors duration-200"
              >
                <svg className="w-5 h-5" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  )
}
