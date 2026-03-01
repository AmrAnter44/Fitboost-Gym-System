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
        setIsValid(false)
        setMessage('فشل التحقق من الترخيص')
      }
    } catch (error) {
      console.error('License check error:', error)
      setIsValid(false)
      setMessage('خطأ في الاتصال')
    } finally {
      setIsChecking(false)
    }
  }

  // فحص أولي عند التحميل
  useEffect(() => {
    checkLicense()
  }, [])

  // فحص تلقائي كل 8 ساعات
  useEffect(() => {
    const EIGHT_HOURS = 8 * 60 * 60 * 1000 // 8 ساعات بالميلي ثانية

    const interval = setInterval(() => {
      console.log('🔍 Automatic license check (every 8 hours)')
      checkLicense()
    }, EIGHT_HOURS)

    return () => clearInterval(interval)
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
