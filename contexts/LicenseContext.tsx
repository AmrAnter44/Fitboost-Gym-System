'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface LicenseContextType {
  isValid: boolean
  isLoading: boolean
  lastChecked: Date | null
}

const LicenseContext = createContext<LicenseContextType>({
  isValid: true,
  isLoading: true,
  lastChecked: null
})

export function useLicense() {
  return useContext(LicenseContext)
}

interface LicenseProviderProps {
  children: ReactNode
}

export function LicenseProvider({ children }: LicenseProviderProps) {
  const [isValid, setIsValid] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  // Function to check license status (client-side, reads from cache)
  const checkLicense = async () => {
    console.log('🎨 [LicenseContext] ===== CLIENT CHECK START =====')
    console.log('🎨 [LicenseContext] Timestamp:', new Date().toISOString())

    try {
      const response = await fetch('/api/license/status', {
        cache: 'no-store'
      })

      console.log('🎨 [LicenseContext] Response status:', response.status, response.statusText)

      if (response.ok) {
        const data = await response.json()
        console.log('🎨 [LicenseContext] Response data:', data)
        console.log('🎨 [LicenseContext] Setting isValid =', data.isValid)

        setIsValid(data.isValid)
        setLastChecked(data.lastChecked ? new Date(data.lastChecked) : null)

        console.log('🎨 [LicenseContext] State updated. isValid:', data.isValid)
      } else {
        console.error('❌ [LicenseContext] License status check failed:', response.statusText)
        console.error('❌ [LicenseContext] Defaulting to isValid: true (failsafe)')
        // On error, default to valid to avoid false lockouts
        setIsValid(true)
      }
    } catch (error) {
      console.error('❌ [LicenseContext] Error checking license:', error)
      console.error('❌ [LicenseContext] Defaulting to isValid: true (failsafe)')
      // On error, default to valid to avoid false lockouts
      setIsValid(true)
    } finally {
      setIsLoading(false)
      console.log('🎨 [LicenseContext] ===== CLIENT CHECK END =====')
    }
  }

  // Check license on mount
  useEffect(() => {
    checkLicense()
  }, [])

  // Poll license status every 24 hours
  useEffect(() => {
    const interval = setInterval(() => {
      checkLicense()
    }, 24 * 60 * 60 * 1000) // 24 hours

    return () => clearInterval(interval)
  }, [])

  return (
    <LicenseContext.Provider value={{ isValid, isLoading, lastChecked }}>
      {children}
    </LicenseContext.Provider>
  )
}
