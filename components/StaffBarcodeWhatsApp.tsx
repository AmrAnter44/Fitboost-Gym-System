'use client'

import { useState, useEffect } from 'react'
import Toast from './Toast'
import { sendWhatsAppMessage } from '../lib/whatsappHelper'
import { useLanguage } from '../contexts/LanguageContext'

interface StaffBarcodeWhatsAppProps {
  staffCode: string
  staffName: string
  staffPhone: string
}

export default function StaffBarcodeWhatsApp({ staffCode, staffName, staffPhone }: StaffBarcodeWhatsAppProps) {
  const { t } = useLanguage()
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [barcodeImage, setBarcodeImage] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [showWebsite, setShowWebsite] = useState(false)

  useEffect(() => {
    const fetchWebsiteSettings = async () => {
      try {
        const response = await fetch('/api/settings/services')
        if (response.ok) {
          const data = await response.json()
          if (data.websiteUrl) {
            setWebsiteUrl(data.websiteUrl)
          }
          if (typeof data.showWebsiteOnReceipts === 'boolean') {
            setShowWebsite(data.showWebsiteOnReceipts)
          }
        }
      } catch (error) {
        console.error('Error fetching website settings:', error)
        setShowWebsite(false)
      }
    }
    fetchWebsiteSettings()
  }, [])

  // 🔧 استخراج الرقم من staffCode بشكل آمن (يمنع NaN)
  const getNumericCode = (code: string | null | undefined): number | null => {
    if (!code) return null
    const digitsOnly = String(code).replace(/\D/g, '')
    if (!digitsOnly) return null
    const parsed = parseInt(digitsOnly, 10)
    return Number.isFinite(parsed) ? parsed : null
  }

  // توليد الباركود عن طريق API
  const handleGenerateBarcode = async () => {
    const numericCode = getNumericCode(staffCode)
    if (numericCode === null) {
      setToast({ message: t('barcode.staff.invalidStaffCode'), type: 'error' })
      return
    }

    setLoading(true)
    try {
      const barcodeText = (100000000 + numericCode).toString()

      const res = await fetch('/api/barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: barcodeText }),
      })

      const data = await res.json()
      if (data.barcode) {
        setBarcodeImage(data.barcode)
        setShowBarcodeModal(true)
      } else {
        setToast({ message: t('barcode.errorGenerating'), type: 'error' })
      }
    } catch (error) {
      console.error('Error generating barcode:', error)
      setToast({ message: t('barcode.errorGenerating'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadBarcode = () => {
    if (!barcodeImage) return
    const a = document.createElement('a')
    a.href = barcodeImage
    a.download = `barcode-staff-${staffCode}.png`
    a.click()
  }

  const handleSendBarcode = async () => {
    if (!barcodeImage) {
      setToast({ message: t('barcode.mustGenerateFirst'), type: 'warning' })
      return
    }

    const safeCode = String(staffCode || '')
    const displayCode = safeCode.toLowerCase().startsWith('s')
      ? safeCode.toUpperCase()
      : `S${safeCode}`

    const websiteSection = showWebsite && websiteUrl ? `\n\n${t('barcode.staff.websiteSection')}\n${websiteUrl}` : ''
    const caption = `${t('barcode.staff.whatsappCaption', { code: displayCode, name: staffName })}${websiteSection}`

    setLoading(true)

    try {
      const MAX_RETRIES = 3
      let lastError = ''

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const sendResponse = await fetch('/api/whatsapp/send-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: staffPhone,
              imageBase64: barcodeImage,
              caption: caption
            })
          })

          const sendResult = await sendResponse.json()

          if (sendResult.success) {
            setToast({ message: t('barcode.staff.sentSuccess'), type: 'success' })
            return
          }

          lastError = sendResult.error || 'Unknown error'
        } catch (err) {
          lastError = (err as Error).message
        }

        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 2000))
        }
      }

      console.error(`[StaffBarcodeWhatsApp] All ${MAX_RETRIES} attempts failed. Last error: ${lastError}`)
      setToast({ message: t('barcode.staff.sendFailedFallback'), type: 'warning' })
      handleDownloadBarcode()

      setTimeout(async () => {
        const success = await sendWhatsAppMessage(staffPhone, caption, true)
        if (success) {
          setToast({ message: t('barcode.staff.openedAttachManually'), type: 'info' })
        } else {
          setToast({ message: t('barcode.staff.whatsappOpenFailed'), type: 'error' })
        }
      }, 500)

    } catch (error) {
      console.error('Error sending barcode:', error)
      setToast({ message: t('barcode.staff.sendError'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const safeStaffCode = String(staffCode || '')
  const displayCodeTop = safeStaffCode.toLowerCase().startsWith('s')
    ? safeStaffCode.toUpperCase()
    : `S${safeStaffCode}`

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex gap-2">
        <button
          onClick={handleGenerateBarcode}
          disabled={loading}
          className="bg-primary-600 text-white px-3 py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 text-sm flex items-center gap-1"
          title={t('barcode.staff.viewStaffBarcode')}
        >
          🔢
        </button>

        <button
          onClick={handleSendBarcode}
          disabled={loading}
          className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm flex items-center gap-1"
          title={t('barcode.staff.sendStaffBarcode')}
        >
          📲
        </button>
      </div>

      {showBarcodeModal && barcodeImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowBarcodeModal(false) }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">{t('barcode.staff.staffBarcode')}</h3>
              <button
                onClick={() => setShowBarcodeModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none"
                type="button"
              >
                ×
              </button>
            </div>

            <div className="bg-primary-50 border-2 border-primary-200 rounded-lg p-4 mb-6 text-center dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <p className="text-sm text-primary-600 mb-2">{t('barcode.staff.staffLabel')}</p>
              <p className="text-xl font-bold text-primary-800">{staffName}</p>
              <p className="text-3xl font-bold text-primary-600 mt-2">
                #{displayCodeTop}
              </p>
            </div>

            <div className="flex justify-center mb-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border-2 border-primary-400">
                <img
                  src="/assets/icon.png"
                  alt="Gym Logo"
                  className="w-16 h-16 object-contain"
                />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border-2 border-primary-200 rounded-lg p-6 mb-6 flex justify-center">
              <img
                src={barcodeImage}
                alt={`Barcode ${displayCodeTop}`}
                className="max-w-full h-auto"
                style={{ minWidth: '300px' }}
              />
            </div>

            <div className="space-y-3">
              <button
                onClick={handleDownloadBarcode}
                className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-bold flex items-center justify-center gap-2"
              >
                <span>💾</span>
                <span>{t('barcode.downloadImage')}</span>
              </button>

              <button
                onClick={async () => {
                  await handleSendBarcode()
                  setShowBarcodeModal(false)
                }}
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-2"
              >
                <span>📲</span>
                <span>{loading ? t('barcode.staff.sending') : t('barcode.staff.sendViaWhatsApp')}</span>
              </button>

              <button
                onClick={() => setShowBarcodeModal(false)}
                className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold"
              >
                {t('barcode.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
