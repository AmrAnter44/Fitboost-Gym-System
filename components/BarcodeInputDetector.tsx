'use client'

import { useEffect, useState } from 'react'
import { useDeviceSettings } from '../contexts/DeviceSettingsContext'
import { useSearch } from '../contexts/SearchContext'

// التحقق من أننا في Electron
const isElectron = () => {
  if (typeof window === 'undefined') return false
  // Check both window.electron.isElectron and userAgent
  return !!(window as any).electron?.isElectron ||
         navigator.userAgent.toLowerCase().includes('electron')
}

export default function BarcodeInputDetector() {
  const { openSearch } = useSearch()
  const { autoScanEnabled, selectedScanner, selectedScannerFingerprint, strictMode } = useDeviceSettings()
  const [isElectronApp, setIsElectronApp] = useState(false)

  // التحقق من البيئة عند التحميل
  useEffect(() => {
    setIsElectronApp(isElectron())
  }, [])

  // Send device name and strict mode to Electron on load
  useEffect(() => {
    if (!isElectronApp) return

    // Send selected scanner to Electron
    if (typeof window !== 'undefined' && (window as any).electron?.setCurrentDeviceName) {
      const deviceName = selectedScannerFingerprint?.deviceName || selectedScanner || 'Unknown Device'
      ;(window as any).electron.setCurrentDeviceName(deviceName)
    }

    // Send strict mode to Electron
    if (typeof window !== 'undefined' && (window as any).electron?.setStrictMode) {
      ;(window as any).electron.setStrictMode(strictMode)
    }
  }, [isElectronApp, strictMode, selectedScanner, selectedScannerFingerprint])

  // Track if SearchModal is open and notify Electron
  useEffect(() => {
    if (!isElectronApp) return

    // Listen for SearchModal open/close events
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      const isInSearchModal = target?.hasAttribute?.('data-search-input') ||
                              target?.closest?.('[data-search-input]')

      if (typeof window !== 'undefined' && (window as any).electron?.setSearchModalActive) {
        ;(window as any).electron.setSearchModalActive(isInSearchModal)
      }
    }

    const handleFocusOut = (e: FocusEvent) => {
      const relatedTarget = e.relatedTarget as HTMLElement
      const isStillInSearchModal = relatedTarget?.hasAttribute?.('data-search-input') ||
                                    relatedTarget?.closest?.('[data-search-input]')

      if (!isStillInSearchModal && typeof window !== 'undefined' && (window as any).electron?.setSearchModalActive) {
        ;(window as any).electron.setSearchModalActive(false)
      }
    }

    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [isElectronApp])

  // Use native barcode detection in Electron only
  useEffect(() => {
    if (!isElectronApp || !autoScanEnabled) return

    // Any selected device is treated as a barcode scanner
    if (!selectedScanner) return


    // تفعيل الباركود في Electron main process
    ;(window as any).electron?.enableBarcodeScanner?.(true)

    // الاستماع للأحداث من main process
    const handleBarcodeFromElectron = (barcode: string) => {

      // Skip on login page
      const isLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login'
      if (isLoginPage) {
        return
      }

      // Open SearchModal directly with the barcode

      try {
        openSearch(barcode)
      } catch (error) {
        console.error('Error opening search modal:', error)
      }
    }

    ;(window as any).electron?.onBarcodeDetected?.(handleBarcodeFromElectron)

    // التنظيف
    return () => {
      ;(window as any).electron?.enableBarcodeScanner?.(false)
      ;(window as any).electron?.offBarcodeDetected?.()
    }
  }, [isElectronApp, autoScanEnabled, selectedScanner, openSearch])

  // هذا المكون لا يعرض شيء
  return null
}
