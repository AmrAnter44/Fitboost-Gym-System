'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWAInstallContextType {
  canInstall: boolean          // متصفح يدعم التثبيت المباشر وفيه prompt جاهز
  isStandalone: boolean        // التطبيق متثبّت/شغّال كـ standalone بالفعل
  isIOS: boolean               // iPhone/iPad — التثبيت بيتعمل يدوي من زر المشاركة
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

const PWAInstallContext = createContext<PWAInstallContextType | undefined>(undefined)

//  بنمسك حدث beforeinstallprompt على مستوى التطبيق كله (بيتفجّر مرة واحدة عند الفتح)
//  عشان أي زرار (زي زرار الإعدادات) يقدر يستدعي التثبيت في أي وقت.
export function PWAInstallProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    setIsStandalone(standalone)
    setIsIOS(/iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()))

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setDeferred(null)

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferred) return 'unavailable'
    try {
      deferred.prompt()
      const { outcome } = await deferred.userChoice
      setDeferred(null)
      return outcome
    } catch {
      return 'unavailable'
    }
  }, [deferred])

  return (
    <PWAInstallContext.Provider value={{ canInstall: !!deferred, isStandalone, isIOS, promptInstall }}>
      {children}
    </PWAInstallContext.Provider>
  )
}

export function usePWAInstall(): PWAInstallContextType {
  const ctx = useContext(PWAInstallContext)
  if (!ctx) {
    return { canInstall: false, isStandalone: false, isIOS: false, promptInstall: async () => 'unavailable' }
  }
  return ctx
}
