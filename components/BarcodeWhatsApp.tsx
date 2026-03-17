'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import Toast from './Toast'
import { sendWhatsAppMessage } from '../lib/whatsappHelper'

interface BarcodeWhatsAppProps {
  memberNumber: number
  memberName: string
  memberPhone: string
}

export default function BarcodeWhatsApp({ memberNumber, memberName, memberPhone }: BarcodeWhatsAppProps) {
  const { t, direction } = useLanguage()
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [barcodeImage, setBarcodeImage] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState('') // ✅ يتم جلب القيمة من الإعدادات
  const [showWebsite, setShowWebsite] = useState(false) // ✅ البداية false عشان ميظهرش لحد ما نجيب الإعدادات

  // جلب إعدادات الموقع
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
        // في حالة الخطأ، نتأكد إنه ميظهرش
        setShowWebsite(false)
      }
    }
    fetchWebsiteSettings()
  }, [])

  // توليد الباركود عن طريق API
  const handleGenerateBarcode = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: memberNumber.toString() }),
      })

      const data = await res.json()
      if (data.barcode) {
        setBarcodeImage(data.barcode)
        setShowBarcodeModal(true)
        // Auto-download to Downloads folder
        const a = document.createElement('a')
        a.href = data.barcode
        a.download = `barcode-${memberNumber}.png`
        a.click()
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
    a.download = `barcode-${memberNumber}.png`
    a.click()
  }

  const handleSendBarcode = async () => {
    if (!barcodeImage) {
      setToast({ message: t('barcode.mustGenerateFirst'), type: 'warning' })
      return
    }

    // إنشاء الرسالة النصية
    const baseMessage = t('barcode.whatsappMessage', { memberNumber: memberNumber.toString(), memberName })

    // إضافة الشروط والأحكام
    const termsAndConditions = `\n\n━━━━━━━━━━━━━━━━━━━━\n*شروط وأحكام*\n━━━━━━━━━━━━━━━━━━━━\nالساده الاعضاء حرصا منا على تقديم خدمه افضل وحفاظا على سير النظام العام للمكان بشكل مرضى يرجى الالتزام بالتعليمات الاتيه :\n\n١- الاشتراك لا يرد الا خلال ٢٤ ساعه بعد خصم قيمه الحصه\n٢- لا يجوز التمرين بخلاف الزى الرياضى\n٣- ممنوع اصطحاب الاطفال او الماكولات داخل الجيم\n٤- الاداره غير مسئوله عن المتعلقات الشخصيه`

    // إضافة رابط الموقع إذا كان مفعلاً
    const websiteSection = showWebsite && websiteUrl ? `\n\n🌐 *الموقع الإلكتروني:*\n${websiteUrl}` : ''

    const caption = baseMessage + termsAndConditions + websiteSection

    setLoading(true)

    try {
      // ✅ Method 1: Check if running in Electron
      if (typeof window !== 'undefined' && (window as any).electron?.whatsapp) {
        console.log('📱 Using Electron WhatsApp integration for barcode')

        const result = await (window as any).electron.whatsapp.sendImage(
          memberPhone,
          barcodeImage,
          caption
        )

        if (result.success) {
          setToast({ message: '✅ تم إرسال الباركود بنجاح على الواتساب', type: 'success' })
        } else {
          console.error('WhatsApp send failed:', result.error)
          setToast({ message: `فشل إرسال الباركود: ${result.error}`, type: 'error' })
        }
        return
      }

      // ✅ Method 2: Check if WhatsApp Backend is ready (Browser mode)
      console.log('🌐 Running in browser - checking WhatsApp backend status...')

      const statusResponse = await fetch('/api/whatsapp/status')
      if (statusResponse.ok) {
        const status = await statusResponse.json()

        if (status.isReady) {
          // ✅ WhatsApp متصل - إرسال الصورة عبر API
          console.log('✅ WhatsApp backend is ready - sending image via API')

          const sendResponse = await fetch('/api/whatsapp/send-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: memberPhone,
              imageBase64: barcodeImage,
              caption: caption
            })
          })

          const sendResult = await sendResponse.json()

          if (sendResult.success) {
            setToast({ message: '✅ تم إرسال الباركود بنجاح على الواتساب', type: 'success' })
          } else {
            setToast({ message: `فشل إرسال الباركود: ${sendResult.error}`, type: 'error' })
          }
          return
        }
      }

      // ⚠️ Fallback: WhatsApp غير متصل - استخدام الطريقة القديمة
      console.log('⚠️ WhatsApp not ready - using fallback method (download + wa.me link)')
      setToast({ message: '⚠️ الواتساب غير متصل. جاري تحميل الصورة وفتح واتساب...', type: 'warning' })

      handleDownloadBarcode()

      setTimeout(async () => {
        const success = await sendWhatsAppMessage(memberPhone, caption, true)

        if (success) {
          setToast({ message: 'تم تحميل الصورة وفتح واتساب. يرجى إرفاق الصورة يدوياً.', type: 'info' })
        } else {
          setToast({ message: 'فشل فتح واتساب', type: 'error' })
        }
      }, 500)

    } catch (error) {
      console.error('Error sending barcode:', error)
      setToast({ message: 'حدث خطأ أثناء إرسال الباركود', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* زر عرض/إرسال الباركود */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-primary-200" dir={direction}>
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-primary-100 p-3 rounded-full">
            <span className="text-3xl">📱</span>
          </div>
          <div>
            <h3 className="text-xl font-bold">{t('barcode.membershipBarcode')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">{t('barcode.viewOrSend')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleGenerateBarcode}
            disabled={loading}
            className="bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-2"
          >
            <span>🔢</span>
            <span>{t('barcode.viewBarcode')}</span>
          </button>

        </div>
      </div>

      {/* Modal عرض الباركود */}
      {showBarcodeModal && barcodeImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowBarcodeModal(false) }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} dir={direction}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">🔢 {t('barcode.membershipBarcode')}</h3>
              <button
                onClick={() => setShowBarcodeModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none"
                type="button"
              >
                ×
              </button>
            </div>

            <div className="bg-primary-50 border-2 border-primary-200 rounded-lg p-4 mb-6 text-center dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <p className="text-sm text-primary-600 mb-2">{t('barcode.member')}</p>
              <p className="text-xl font-bold text-primary-800">{memberName}</p>
              <p className="text-3xl font-bold text-primary-600 mt-2">#{memberNumber}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 border-2 border-primary-200 rounded-lg p-6 mb-6 flex justify-center">
              <div className="relative inline-block">
                {/* Barcode */}
                <img
                  src={barcodeImage}
                  alt={`Barcode ${memberNumber}`}
                  className="max-w-full h-auto"
                  style={{ minWidth: '300px' }}
                />

                {/* Logo في نص الباركود */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border-2 border-primary-400">
                    <img
                      src="/assets/icon.png"
                      alt="Gym Logo"
                      className="w-16 h-16 object-contain"
                    />
                  </div>
                </div>
              </div>
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
                <span>{loading ? 'جاري الإرسال...' : t('barcode.downloadAndSendViaWhatsApp')}</span>
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
