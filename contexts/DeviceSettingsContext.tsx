'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface DeviceSettings {
  selectedScanner?: string
  autoScanEnabled: boolean
}

interface DeviceSettingsContextType {
  selectedScanner?: string
  autoScanEnabled: boolean
  setSelectedScanner: (deviceId: string | undefined) => void
  setAutoScanEnabled: (enabled: boolean) => void
}

const DeviceSettingsContext = createContext<DeviceSettingsContextType | undefined>(undefined)

const STORAGE_KEY = 'gym-device-settings'

export function DeviceSettingsProvider({ children }: { children: ReactNode }) {
  const [selectedScanner, setSelectedScannerState] = useState<string | undefined>(undefined)
  const [autoScanEnabled, setAutoScanEnabledState] = useState<boolean>(true)

  useEffect(() => {
    // جلب الإعدادات المحفوظة من localStorage
    const savedSettings = localStorage.getItem(STORAGE_KEY)
    if (savedSettings) {
      try {
        const settings: DeviceSettings = JSON.parse(savedSettings)
        if (settings.selectedScanner) {
          setSelectedScannerState(settings.selectedScanner)
        }
        if (settings.autoScanEnabled !== undefined) {
          setAutoScanEnabledState(settings.autoScanEnabled)
        }
      } catch (error) {
        console.error('Error parsing device settings:', error)
      }
    }
  }, [])

  const setSelectedScanner = (deviceId: string | undefined) => {
    setSelectedScannerState(deviceId)

    // حفظ في localStorage
    const savedSettings = localStorage.getItem(STORAGE_KEY)
    const settings: DeviceSettings = savedSettings ? JSON.parse(savedSettings) : {}
    settings.selectedScanner = deviceId
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }

  const setAutoScanEnabled = (enabled: boolean) => {
    setAutoScanEnabledState(enabled)

    // حفظ في localStorage
    const savedSettings = localStorage.getItem(STORAGE_KEY)
    const settings: DeviceSettings = savedSettings ? JSON.parse(savedSettings) : {}
    settings.autoScanEnabled = enabled
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }

  return (
    <DeviceSettingsContext.Provider
      value={{
        selectedScanner,
        autoScanEnabled,
        setSelectedScanner,
        setAutoScanEnabled
      }}
    >
      {children}
    </DeviceSettingsContext.Provider>
  )
}

export function useDeviceSettings() {
  const context = useContext(DeviceSettingsContext)
  if (!context) {
    throw new Error('useDeviceSettings must be used within DeviceSettingsProvider')
  }
  return context
}
