'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface ServiceSettings {
  nutritionEnabled: boolean
  physiotherapyEnabled: boolean
  groupClassEnabled: boolean
  spaEnabled: boolean
  inBodyEnabled: boolean
  pointsEnabled: boolean
  pointsPerCheckIn: number
  pointsPerInvitation: number
  pointsPerEGPSpent: number
  pointsValueInEGP: number
}

interface ServiceSettingsContextType {
  settings: ServiceSettings
  loading: boolean
  refetch: () => Promise<void>
}

const ServiceSettingsContext = createContext<ServiceSettingsContextType | undefined>(undefined)

export function ServiceSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ServiceSettings>({
    nutritionEnabled: true,
    physiotherapyEnabled: true,
    groupClassEnabled: true,
    spaEnabled: true,
    inBodyEnabled: true,
    pointsEnabled: true,
    pointsPerCheckIn: 1,
    pointsPerInvitation: 2,
    pointsPerEGPSpent: 0.1,
    pointsValueInEGP: 0.1
  })
  const [loading, setLoading] = useState(true)

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/services')
      if (response.ok) {
        const data = await response.json()
        setSettings({
          nutritionEnabled: data.nutritionEnabled,
          physiotherapyEnabled: data.physiotherapyEnabled,
          groupClassEnabled: data.groupClassEnabled,
          spaEnabled: data.spaEnabled,
          inBodyEnabled: data.inBodyEnabled,
          pointsEnabled: data.pointsEnabled,
          pointsPerCheckIn: data.pointsPerCheckIn,
          pointsPerInvitation: data.pointsPerInvitation,
          pointsPerEGPSpent: data.pointsPerEGPSpent,
          pointsValueInEGP: data.pointsValueInEGP
        })
      }
    } catch (error) {
      console.error('Error fetching service settings:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  return (
    <ServiceSettingsContext.Provider value={{ settings, loading, refetch: fetchSettings }}>
      {children}
    </ServiceSettingsContext.Provider>
  )
}

export function useServiceSettings() {
  const context = useContext(ServiceSettingsContext)
  if (!context) {
    throw new Error('useServiceSettings must be used within ServiceSettingsProvider')
  }
  return context
}
