'use client'

import { useState, useEffect } from 'react'
import Toast from './Toast'
import { sendWhatsAppMessage } from '../lib/whatsappHelper'
import { useLanguage } from '../contexts/LanguageContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

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

  const iconBarcode = (
    <svg {...stroke} className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14"/>
    </svg>
  )
  const iconBarcodeLg = (
    <svg {...stroke} className="w-6 h-6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14"/>
    </svg>
  )
  const iconWhatsApp = (
    <svg {...stroke} className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  )
  const iconWhatsAppLg = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  )
  const iconDownload = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
    </svg>
  )
  const iconClose = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  )

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex gap-2">
        <button
          onClick={handleGenerateBarcode}
          disabled={loading}
          aria-label={t('barcode.staff.viewStaffBarcode')}
          className="bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-3 py-2 rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed text-sm flex items-center gap-1"
          title={t('barcode.staff.viewStaffBarcode')}
        >
          {iconBarcode}
        </button>

        <button
          onClick={handleSendBarcode}
          disabled={loading}
          aria-label={t('barcode.staff.sendStaffBarcode')}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed text-sm flex items-center gap-1"
          title={t('barcode.staff.sendStaffBarcode')}
        >
          {iconWhatsApp}
        </button>
      </div>

      {showBarcodeModal && barcodeImage && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          style={{ zIndex: 9999 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowBarcodeModal(false) }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
                  {iconBarcodeLg}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('barcode.staff.staffBarcode')}</h3>
              </div>
              <button
                onClick={() => setShowBarcodeModal(false)}
                aria-label="إغلاق"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                type="button"
              >
                {iconClose}
              </button>
            </div>

            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 mb-6 text-center ring-1 ring-primary-200 dark:ring-primary-900/50">
              <p className="text-sm text-primary-600 dark:text-primary-400 mb-2">{t('barcode.staff.staffLabel')}</p>
              <p className="text-xl font-bold text-primary-800 dark:text-primary-200">{staffName}</p>
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400 mt-2">
                #{displayCodeTop}
              </p>
            </div>

            <div className="flex justify-center mb-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 ring-1 ring-primary-200 dark:ring-primary-900/50">
                <img
                  src="/assets/icon.png"
                  alt="Gym Logo"
                  className="w-16 h-16 object-contain"
                />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900/40 rounded-lg p-6 mb-6 flex justify-center ring-1 ring-gray-200 dark:ring-gray-700">
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
                className="w-full bg-primary-500 hover:bg-primary-600 text-primary-contrast py-3 rounded-lg transition-colors duration-200 font-bold flex items-center justify-center gap-2"
              >
                {iconDownload}
                <span>{t('barcode.downloadImage')}</span>
              </button>

              <button
                onClick={async () => {
                  await handleSendBarcode()
                  setShowBarcodeModal(false)
                }}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-2"
              >
                {iconWhatsAppLg}
                <span>{loading ? t('barcode.staff.sending') : t('barcode.staff.sendViaWhatsApp')}</span>
              </button>

              <button
                onClick={() => setShowBarcodeModal(false)}
                className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 font-bold"
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
