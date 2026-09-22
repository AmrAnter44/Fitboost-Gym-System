'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface LicenseContextType {
  isValid: boolean
  message: string
  lastChecked: Date | null
  isChecking: boolean
  checkLicense: () => Promise<void>
}

const LicenseContext = createContext<LicenseContextType>({
  isValid: true,
  message: '',
  lastChecked: null,
  isChecking: false,
  checkLicense: async () => {}
})

export const useLicense = () => useContext(LicenseContext)

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [isValid, setIsValid] = useState(true)
  const [message, setMessage] = useState('')
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  // دالة فحص الترخيص
  const checkLicense = async () => {
    if (isChecking) return

    setIsChecking(true)
    try {
      const response = await fetch('/api/license/validate', {
        method: 'POST',
        cache: 'no-store'
      })

      if (response.ok) {
        const data = await response.json()
        setIsValid(data.valid)
        setMessage(data.message)
        setLastChecked(new Date())
      } else {
        // في حالة فشل الـ API، لا تغيّر الـ status (استخدم الـ cached)
        // فقط حدّث الرسالة
        setMessage('يعمل في وضع عدم الاتصال (Offline Mode)')
      }
    } catch (error: any) {
      // في حالة network error، لا تغيّر isValid
      // السيستم يفضل شغال بالـ cached status
      const errorMessage = error?.message || ''
      const isNetworkError =
        errorMessage.includes('fetch') ||
        errorMessage.includes('network') ||
        errorMessage.includes('Failed to fetch')

      if (isNetworkError) {
        // Network error - يفضل شغال بدون تغيير الـ status
        setMessage('يعمل في وضع عدم الاتصال (Offline Mode)')
      } else {
        // خطأ آخر - اطبعه في الـ console
        console.error('License check error:', error)
        setMessage('خطأ في التحقق من الترخيص')
      }
    } finally {
      setIsChecking(false)
    }
  }

  //  التطبيق بيستخدم تبويبات iframe — كل تبويب بيحمّل LicenseProvider.
  //  عشان منعملش N استدعاءات متزامنة (بتعلّق لما النت يقطع)، بنعمل التحقق التلقائي
  //  في النافذة الرئيسية بس (top window)، زي LicenseLockedScreen بالظبط.
  const isTopWindow = typeof window === 'undefined' || window.self === window.top

  // فحص أولي عند التحميل — النافذة الرئيسية بس
  useEffect(() => {
    if (!isTopWindow) return
    checkLicense()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // فحص تلقائي كل 8 ساعات — النافذة الرئيسية بس
  useEffect(() => {
    if (!isTopWindow) return
    const EIGHT_HOURS = 8 * 60 * 60 * 1000 // 8 ساعات بالميلي ثانية

    const interval = setInterval(() => {
      // Automatic license check (silent - no console logs)
      checkLicense()
    }, EIGHT_HOURS)

    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <LicenseContext.Provider
      value={{
        isValid,
        message,
        lastChecked,
        isChecking,
        checkLicense
      }}
    >
      {children}
    </LicenseContext.Provider>
  )
}
