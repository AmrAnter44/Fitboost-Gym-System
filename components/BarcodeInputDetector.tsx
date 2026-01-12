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
  const { autoScanEnabled, selectedScanner, strictMode } = useDeviceSettings()
  const [isElectronApp, setIsElectronApp] = useState(false)

  // التحقق من البيئة عند التحميل
  useEffect(() => {
    setIsElectronApp(isElectron())
  }, [])

  // Send strict mode status to Electron
  useEffect(() => {
    if (!isElectronApp) return

    if (typeof window !== 'undefined' && (window as any).electron?.setStrictMode) {
      ;(window as any).electron.setStrictMode(strictMode)
      console.log('🔒 Strict mode sent to Electron:', strictMode)
    }
  }, [isElectronApp, strictMode])

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

  // ✅ استخدام native barcode detection في Electron فقط
  useEffect(() => {
    if (!isElectronApp || !autoScanEnabled) return

    // ✅ أي جهاز محدد يعتبر barcode scanner
    if (!selectedScanner) return

    console.log('🔍 Setting up Electron native barcode detection...')

    // تفعيل الباركود في Electron main process
    ;(window as any).electron?.enableBarcodeScanner?.(true)

    // الاستماع للأحداث من main process
    const handleBarcodeFromElectron = (barcode: string) => {
      console.log('🔍 Barcode received from Electron main process:', barcode)

      // ✅ استبعاد صفحة تسجيل الدخول
      const isLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login'
      if (isLoginPage) {
        console.log('⚠️ Ignoring barcode on login page')
        return
      }

      // ✅ فتح SearchModal مباشرة مع الباركود
      console.log('🔓 Opening search modal with barcode...')

      try {
        openSearch(barcode)
        console.log('✅ Search modal opened successfully')
      } catch (error) {
        console.error('❌ Error opening search modal:', error)
      }
    }

    ;(window as any).electron?.onBarcodeDetected?.(handleBarcodeFromElectron)

    // التنظيف
    return () => {
      console.log('🔍 Cleaning up Electron barcode detection...')
      ;(window as any).electron?.enableBarcodeScanner?.(false)
      ;(window as any).electron?.offBarcodeDetected?.()
    }
  }, [isElectronApp, autoScanEnabled, selectedScanner, openSearch])

  // هذا المكون لا يعرض شيء
  return null
}
