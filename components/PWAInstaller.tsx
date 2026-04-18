'use client'

import { useEffect, useState } from 'react'
import { safeStorage } from '../lib/safeStorage'

export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // next-pwa handles service worker registration automatically
    // نحن فقط نتعامل مع install prompt

    // معالجة حدث التثبيت
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)

      // التحقق من أن التطبيق غير مثبت بالفعل
      if (typeof window !== 'undefined' && !window.matchMedia('(display-mode: standalone)').matches) {
        setShowInstallPrompt(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // التحقق من التثبيت الناجح
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
    // إخفاء لمدة أسبوع
    safeStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  // عدم إظهار الرسالة إذا تم رفضها مؤخراً
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
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-slideUp">
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl shadow-2xl p-4 text-white max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <div className="text-3xl">📱</div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">ثبت التطبيق</h3>
            <p className="text-sm text-primary-100 mb-3">
              احصل على تجربة أفضل مع تطبيق الموبايل - عمل بدون إنترنت، وصول أسرع!
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleInstallClick}
                className="bg-white dark:bg-gray-800 text-primary-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-primary-50 transition-colors"
              >
                تثبيت الآن
              </button>
              <button
                onClick={handleDismiss}
                className="text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-600 transition-colors"
              >
                لاحقاً
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white hover:text-primary-200 text-xl leading-none"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
