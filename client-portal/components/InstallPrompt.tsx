'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // تحقق إذا كان التطبيق مثبت فعلاً
    const isInStandaloneMode = () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://')

    setIsStandalone(isInStandaloneMode())

    // تحقق إذا كان iOS
    const checkIsIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase()
      return /iphone|ipad|ipod/.test(userAgent)
    }
    setIsIOS(checkIsIOS())

    // التعامل مع beforeinstallprompt event (Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)

      // تحقق إذا المستخدم رفض التثبيت قبل كده
      const dismissed = localStorage.getItem('pwa-install-dismissed')
      const dismissedDate = dismissed ? new Date(dismissed) : null
      const daysSinceDismissal = dismissedDate
        ? (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)
        : 999

      // أظهر البرومبت فقط إذا مضى 7 أيام على الرفض أو لم يرفض من قبل
      if (!dismissed || daysSinceDismissal > 7) {
        setTimeout(() => setShowInstallPrompt(true), 3000) // أظهر بعد 3 ثواني
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // تحقق إذا كان iOS و مش مثبت - يظهر دائماً من البراوزر
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
      console.log('User accepted the install prompt')
    } else {
      console.log('User dismissed the install prompt')
      localStorage.setItem('pwa-install-dismissed', new Date().toISOString())
    }

    setDeferredPrompt(null)
    setShowInstallPrompt(false)
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    // لا نحفظ رفض iOS - يظهر في كل مرة من البراوزر
    if (!isIOS) {
      localStorage.setItem('pwa-install-dismissed', new Date().toISOString())
    }
  }

  // لا تظهر إذا التطبيق مثبت فعلاً
  if (isStandalone || !showInstallPrompt) {
    return null
  }

  return (
    <>
      {/* Android Install Prompt */}
      {deferredPrompt && !isIOS && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-2xl animate-slide-up">
          <div className="max-w-md mx-auto">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-12 h-12 bg-white rounded-xl p-2 shadow-lg">
                <img src="/icons/icon-96x96.png" alt="X Gym" className="w-full h-full" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold mb-1">ثبت X Gym</h3>
                <p className="text-sm text-primary-100 mb-3">
                  ثبت التطبيق للوصول السريع من الشاشة الرئيسية
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleInstallClick}
                    className="flex-1 bg-white text-primary-600 px-4 py-2 rounded-lg font-bold hover:bg-primary-50 transition"
                  >
                    تثبيت 📲
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-4 py-2 text-white hover:bg-primary-800 rounded-lg transition"
                  >
                    لاحقاً
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* iOS Install Instructions */}
      {isIOS && !deferredPrompt && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-2xl animate-slide-up">
          <div className="max-w-md mx-auto">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-12 h-12 bg-white rounded-xl p-2 shadow-lg">
                <img src="/icons/icon-96x96.png" alt="X Gym" className="w-full h-full" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold mb-1">ثبت X Gym</h3>
                <div className="text-sm text-primary-100 space-y-2 mb-3">
                  <p>لتثبيت التطبيق على iPhone:</p>
                  <ol className="list-decimal list-inside space-y-1 mr-2">
                    <li>اضغط على <span className="inline-flex items-center px-1.5 py-0.5 bg-white/20 rounded">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                      </svg>
                    </span> في شريط المتصفح</li>
                    <li>اختر "إضافة إلى الشاشة الرئيسية"</li>
                    <li>اضغط "إضافة"</li>
                  </ol>
                </div>
                <button
                  onClick={handleDismiss}
                  className="w-full bg-white text-primary-600 px-4 py-2 rounded-lg font-bold hover:bg-primary-50 transition"
                >
                  فهمت ✓
                </button>
              </div>
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
