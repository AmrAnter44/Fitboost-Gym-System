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
    try {
      const response = await fetch('/api/license/status', {
        cache: 'no-store'
      })

      if (response.ok) {
        const data = await response.json()
        setIsValid(data.isValid)
        setLastChecked(data.lastChecked ? new Date(data.lastChecked) : null)
      } else {
        console.error('License status check failed:', response.statusText)
        // On error, default to valid to avoid false lockouts
        setIsValid(true)
      }
    } catch (error) {
      console.error('Error checking license:', error)
      // On error, default to valid to avoid false lockouts
      setIsValid(true)
    } finally {
      setIsLoading(false)
    }
  }

  // Check license on mount
  useEffect(() => {
    checkLicense()
  }, [])

  // Poll license status every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      checkLicense()
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <LicenseContext.Provider value={{ isValid, isLoading, lastChecked }}>
      {children}
    </LicenseContext.Provider>
  )
}
