'use client'

import { useEffect, useRef } from 'react'
import { useDeviceSettings } from '../contexts/DeviceSettingsContext'
import { useSearch } from '../contexts/SearchContext'

interface KeystrokeData {
  key: string
  timestamp: number
}

export default function BarcodeInputDetector() {
  const { openSearch } = useSearch()
  const { autoScanEnabled } = useDeviceSettings()
  const keystrokeBuffer = useRef<KeystrokeData[]>([])
  const clearTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!autoScanEnabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // تجاهل إذا كان التركيز على حقل إدخال
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
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
          // التحقق: هل تم كتابتها بسرعة؟ (كل حرف في أقل من 100ms من السابق)
          let isRapid = true
          for (let i = 1; i < buffer.length; i++) {
            const timeDiff = buffer[i].timestamp - buffer[i - 1].timestamp
            if (timeDiff > 100) {
              isRapid = false
              break
            }
          }

          // التحقق: هل المدة الإجمالية أقل من 500ms؟
          const totalTime = buffer[buffer.length - 1].timestamp - buffer[0].timestamp
          const isWithinTimeLimit = totalTime < 500

          if (isRapid && isWithinTimeLimit) {
            // استخراج القيمة
            const barcodeValue = buffer.map((k) => k.key).join('')

            console.log('🔍 Barcode detected:', barcodeValue)

            // فتح modal البحث مع القيمة
            openSearch(barcodeValue)

            // منع السلوك الافتراضي
            event.preventDefault()
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

    // إضافة المستمع
    document.addEventListener('keydown', handleKeyDown)

    // التنظيف
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current)
      }
    }
  }, [autoScanEnabled, openSearch])

  // هذا المكون لا يعرض شيء
  return null
}
