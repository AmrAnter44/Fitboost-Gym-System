'use client'

import { useEffect, useRef, useState } from 'react'
import { useDeviceSettings } from '../contexts/DeviceSettingsContext'
import { useSearch } from '../contexts/SearchContext'

interface KeystrokeData {
  key: string
  timestamp: number
}

// التحقق من أننا في Electron
const isElectron = () => {
  if (typeof window === 'undefined') return false
  // Check both window.electron.isElectron and userAgent
  return !!(window as any).electron?.isElectron ||
         navigator.userAgent.toLowerCase().includes('electron')
}

export default function BarcodeInputDetector() {
  const { openSearch } = useSearch()
  const { autoScanEnabled, selectedScanner } = useDeviceSettings()
  const keystrokeBuffer = useRef<KeystrokeData[]>([])
  const clearTimeoutRef = useRef<NodeJS.Timeout>()
  const [isElectronApp, setIsElectronApp] = useState(false)

  // التحقق من البيئة عند التحميل
  useEffect(() => {
    setIsElectronApp(isElectron())
  }, [])

  // استخدام native barcode detection في Electron
  useEffect(() => {
    if (!isElectronApp || !autoScanEnabled) return

    const isBarcodeScanner = selectedScanner === 'keyboard-wedge-scanner'
    if (!isBarcodeScanner) return

    console.log('🔍 Setting up Electron native barcode detection...')

    // تفعيل الباركود في Electron main process
    ;(window as any).electron?.enableBarcodeScanner?.(true)

    // الاستماع للأحداث من main process
    const handleBarcodeFromElectron = (barcode: string) => {
      console.log('🔍 Barcode received from Electron main process:', barcode)
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

  useEffect(() => {
    if (!autoScanEnabled) return

    // ✅ FIX: Recognize ANY selected device (except cameras) as a barcode scanner
    // This allows users to select actual HID devices from the list, not just the default option
    const isBarcodeScanner = selectedScanner &&
                             selectedScanner !== 'none' &&
                             !selectedScanner.startsWith('videoinput')

    // ✅ FIX: Don't skip DOM events in Electron - run them in parallel as safety net
    // Removed early return to enable device isolation

    const handleKeyDown = (event: KeyboardEvent) => {
      // التحقق: هل نحن في Electron وتم اختيار barcode scanner؟
      const shouldInterceptInput = isElectronApp && isBarcodeScanner

      // ✅ FIX: In Electron with barcode scanner, intercept ALL keyboard events
      // EXCEPT when user is intentionally typing in the search modal
      if (shouldInterceptInput) {
        const target = event.target as HTMLElement

        // Allow typing ONLY in the search modal's input fields
        const isSearchModalInput = target.closest('[data-search-modal]')

        if (!isSearchModalInput) {
          // ✅ Prevent barcode keypresses from reaching other inputs
          event.preventDefault()
          event.stopPropagation()
          console.log('🔒 Barcode input blocked from:', target.tagName)
        }
      } else {
        // Original logic: skip if focused on input (for non-Electron or non-barcode scenarios)
        const target = event.target as HTMLElement
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return
        }
      }

      const now = Date.now()

      // مسح المؤقت القديم
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current)
      }

      // إذا كان Enter، تحقق من أن لدينا باركود صالح
      if (event.key === 'Enter') {
        const buffer = keystrokeBuffer.current

        // التحقق: هل لدينا 6+ أحرف؟
        if (buffer.length >= 6) {
          // Relax timing for Electron (150ms instead of 100ms)
          const timeDiffThreshold = isElectronApp ? 150 : 100

          // التحقق: هل تم كتابتها بسرعة؟
          let isRapid = true
          for (let i = 1; i < buffer.length; i++) {
            const timeDiff = buffer[i].timestamp - buffer[i - 1].timestamp
            if (timeDiff > timeDiffThreshold) {
              isRapid = false
              break
            }
          }

          // Relax time limit for Electron (800ms instead of 500ms)
          const totalTime = buffer[buffer.length - 1].timestamp - buffer[0].timestamp
          const timeLimitThreshold = isElectronApp ? 800 : 500
          const isWithinTimeLimit = totalTime < timeLimitThreshold

          if (isRapid && isWithinTimeLimit) {
            // استخراج القيمة
            const barcodeValue = buffer.map((k) => k.key).join('')

            console.log('🔍 Barcode detected:', barcodeValue)
            console.log('📱 Environment:', {
              isElectronApp,
              shouldInterceptInput,
              userAgent: navigator.userAgent
            })
            console.log('⏱️ Timing:', {
              totalTime,
              charCount: buffer.length,
              avgTimeBetween: buffer.length > 1 ? totalTime / (buffer.length - 1) : 0,
              thresholds: { timeDiffThreshold, timeLimitThreshold }
            })

            // Log to Electron main process if available
            if ((window as any).electron?.logKeyboardEvent) {
              (window as any).electron.logKeyboardEvent({
                type: 'barcode-detected',
                value: barcodeValue,
                charCount: buffer.length,
                totalTime,
                isElectronApp
              })
            }

            console.log('🔓 Opening search modal...')

            // منع السلوك الافتراضي
            event.preventDefault()
            event.stopPropagation()

            // فتح modal البحث مع القيمة
            try {
              openSearch(barcodeValue)
              console.log('✅ Search modal opened successfully')
            } catch (error) {
              console.error('❌ Error opening search modal:', error)
            }
          }
        }

        // مسح الـ buffer
        keystrokeBuffer.current = []
        return
      }

      // إضافة الحرف إلى الـ buffer
      // نتجاهل المفاتيح الخاصة
      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        // منع الكتابة في Electron فقط إذا كان barcode scanner مختار والتركيز على input
        if (shouldInterceptInput) {
          const target = event.target as HTMLElement
          if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
          ) {
            event.preventDefault()
            event.stopPropagation()
          }
        }

        keystrokeBuffer.current.push({
          key: event.key,
          timestamp: now
        })

        // تعيين مؤقت لمسح الـ buffer بعد 500ms من عدم النشاط
        clearTimeoutRef.current = setTimeout(() => {
          keystrokeBuffer.current = []
        }, 500)
      }
    }

    // Check focus in Electron
    if (isElectronApp && document.hasFocus && !document.hasFocus()) {
      console.log('⚠️ Document not focused in Electron - keyboard events may not work')
    }

    // ✅ FIX: Use capture phase to intercept events before they reach inputs
    document.addEventListener('keydown', handleKeyDown, true)

    // التنظيف
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current)
      }
    }
  }, [autoScanEnabled, openSearch, selectedScanner, isElectronApp])

  // هذا المكون لا يعرض شيء
  return null
}
