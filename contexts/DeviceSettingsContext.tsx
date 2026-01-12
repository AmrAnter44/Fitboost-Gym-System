'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface DeviceFingerprint {
  vendorId?: string
  productId?: string
  manufacturer?: string
  product?: string
  deviceName?: string
}

interface DeviceSettings {
  selectedScanner?: string
  selectedScannerFingerprint?: DeviceFingerprint // For matching devices even if ID changes
  autoScanEnabled: boolean
  strictMode: boolean // عزل كامل - كل الكتابة من الجهاز تروح للـ SearchModal فقط
}

interface DeviceSettingsContextType {
  selectedScanner?: string
  selectedScannerFingerprint?: DeviceFingerprint
  autoScanEnabled: boolean
  strictMode: boolean
  setSelectedScanner: (deviceId: string | undefined, fingerprint?: DeviceFingerprint) => void
  setAutoScanEnabled: (enabled: boolean) => void
  setStrictMode: (enabled: boolean) => void
}

const DeviceSettingsContext = createContext<DeviceSettingsContextType | undefined>(undefined)

const STORAGE_KEY = 'gym-device-settings'

export function DeviceSettingsProvider({ children }: { children: ReactNode }) {
  const [selectedScanner, setSelectedScannerState] = useState<string | undefined>(undefined)
  const [selectedScannerFingerprint, setSelectedScannerFingerprintState] = useState<DeviceFingerprint | undefined>(undefined)
  const [autoScanEnabled, setAutoScanEnabledState] = useState<boolean>(true)
  const [strictMode, setStrictModeState] = useState<boolean>(true) // العزل الكامل مفعّل افتراضياً

  useEffect(() => {
    // جلب الإعدادات المحفوظة من localStorage
    const savedSettings = localStorage.getItem(STORAGE_KEY)
    if (savedSettings) {
      try {
        const settings: DeviceSettings = JSON.parse(savedSettings)
        if (settings.selectedScanner) {
          setSelectedScannerState(settings.selectedScanner)
        }
        if (settings.selectedScannerFingerprint) {
          setSelectedScannerFingerprintState(settings.selectedScannerFingerprint)
        }
        if (settings.autoScanEnabled !== undefined) {
          setAutoScanEnabledState(settings.autoScanEnabled)
        }
        if (settings.strictMode !== undefined) {
          setStrictModeState(settings.strictMode)
        }
      } catch (error) {
        console.error('Error parsing device settings:', error)
      }
    }
  }, [])

  const setSelectedScanner = (deviceId: string | undefined, fingerprint?: DeviceFingerprint) => {
    setSelectedScannerState(deviceId)
    setSelectedScannerFingerprintState(fingerprint)

    // حفظ في localStorage
    const savedSettings = localStorage.getItem(STORAGE_KEY)
    const settings: DeviceSettings = savedSettings ? JSON.parse(savedSettings) : {}
    settings.selectedScanner = deviceId
    settings.selectedScannerFingerprint = fingerprint
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))

    console.log('✅ Device saved:', { deviceId, fingerprint })
  }

  const setAutoScanEnabled = (enabled: boolean) => {
    setAutoScanEnabledState(enabled)

    // حفظ في localStorage
    const savedSettings = localStorage.getItem(STORAGE_KEY)
    const settings: DeviceSettings = savedSettings ? JSON.parse(savedSettings) : {}
    settings.autoScanEnabled = enabled
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }

  const setStrictMode = (enabled: boolean) => {
    setStrictModeState(enabled)

    // حفظ في localStorage
    const savedSettings = localStorage.getItem(STORAGE_KEY)
    const settings: DeviceSettings = savedSettings ? JSON.parse(savedSettings) : {}
    settings.strictMode = enabled
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }

  return (
    <DeviceSettingsContext.Provider
      value={{
        selectedScanner,
        selectedScannerFingerprint,
        autoScanEnabled,
        strictMode,
        setSelectedScanner,
        setAutoScanEnabled,
        setStrictMode
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
