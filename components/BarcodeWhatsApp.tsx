'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import Toast from './Toast'
import { sendWhatsAppMessage } from '../lib/whatsappHelper'

interface BarcodeWhatsAppProps {
  memberNumber: number
  memberName: string
  memberPhone: string
}

type SendStep = 'idle' | 'generating' | 'ready' | 'sending' | 'success' | 'error'

export default function BarcodeWhatsApp({ memberNumber, memberName, memberPhone }: BarcodeWhatsAppProps) {
  const { t, direction } = useLanguage()
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [barcodeImage, setBarcodeImage] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [showWebsite, setShowWebsite] = useState(false)

  // Progress popup state
  const [sendStep, setSendStep] = useState<SendStep>('idle')
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [progressError, setProgressError] = useState('')
  const [previewImage, setPreviewImage] = useState('')

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
        setShowWebsite(false)
      }
    }
    fetchWebsiteSettings()
  }, [])

  // توليد الباركود عن طريق API
  const generateBarcodeImage = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: memberNumber.toString() }),
      })

      const data = await res.json()
      if (data.barcode) {
        setBarcodeImage(data.barcode)
        return data.barcode
      }
      return null
    } catch (error) {
      console.error('Error generating barcode:', error)
      return null
    }
  }, [memberNumber])

  // التحقق من صحة الصورة
  const verifyImage = useCallback((imageData: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img.width > 0 && img.height > 0)
      img.onerror = () => resolve(false)
      img.src = imageData
    })
  }, [])

  // بناء رسالة الواتساب
  const buildCaption = useCallback(() => {
    const baseMessage = t('barcode.whatsappMessage', { memberNumber: memberNumber.toString(), memberName })
    const termsAndConditions = `\n\n━━━━━━━━━━━━━━━━━━━━\n*شروط وأحكام*\n━━━━━━━━━━━━━━━━━━━━\nالساده الاعضاء حرصا منا على تقديم خدمه افضل وحفاظا على سير النظام العام للمكان بشكل مرضى يرجى الالتزام بالتعليمات الاتيه :\n\n١- الاشتراك لا يرد الا خلال ٢٤ ساعه بعد خصم قيمه الحصه\n٢- لا يجوز التمرين بخلاف الزى الرياضى\n٣- ممنوع اصطحاب الاطفال او الماكولات داخل الجيم\n٤- الاداره غير مسئوله عن المتعلقات الشخصيه`
    const websiteSection = showWebsite && websiteUrl ? `\n\n🌐 *الموقع الإلكتروني:*\n${websiteUrl}` : ''
    return baseMessage + termsAndConditions + websiteSection
  }, [t, memberNumber, memberName, showWebsite, websiteUrl])

  // عرض الباركود فقط (بدون إرسال)
  const handleGenerateBarcode = async () => {
    setLoading(true)
    try {
      const barcode = await generateBarcodeImage()
      if (barcode) {
        setShowBarcodeModal(true)
        // Auto-download
        const a = document.createElement('a')
        a.href = barcode
        a.download = `barcode-${memberNumber}.png`
        a.click()
      } else {
        setToast({ message: t('barcode.errorGenerating'), type: 'error' })
      }
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

  // Step 1: توليد الصورة وعرضها في الـ popup
  const handleSendBarcode = useCallback(async () => {
    setShowProgressModal(true)
    setProgressError('')
    setPreviewImage('')
    setSendStep('generating')

    let imageData = barcodeImage
    if (!imageData) {
      imageData = (await generateBarcodeImage()) || ''
    }

    if (!imageData) {
      setSendStep('error')
      setProgressError('فشل إنشاء صورة الباركود')
      return
    }

    // التحقق من صحة الصورة
    const isValid = await verifyImage(imageData)
    if (!isValid) {
      imageData = (await generateBarcodeImage()) || ''
      if (!imageData || !(await verifyImage(imageData))) {
        setSendStep('error')
        setProgressError('الصورة غير صالحة للإرسال')
        return
      }
    }

    // الصورة جاهزة - عرضها للتأكيد
    setPreviewImage(imageData)
    setSendStep('ready')
  }, [barcodeImage, generateBarcodeImage, verifyImage])

  // Step 2: إرسال بعد التأكيد
  const handleConfirmSend = useCallback(async () => {
    setSendStep('sending')
    const caption = buildCaption()
    const imageData = previewImage

    const MAX_RETRIES = 3
    let lastError = ''

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const sendResponse = await fetch('/api/whatsapp/send-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: memberPhone,
            imageBase64: imageData,
            caption
          })
        })

        const sendResult = await sendResponse.json()

        if (sendResult.success) {
          setSendStep('success')
          setTimeout(() => {
            setShowProgressModal(false)
            setSendStep('idle')
            setShowBarcodeModal(false)
          }, 2000)
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

    // كل المحاولات فشلت - Fallback
    console.error(`[BarcodeWhatsApp] All ${MAX_RETRIES} attempts failed: ${lastError}`)
    handleDownloadBarcode()

    setTimeout(async () => {
      await sendWhatsAppMessage(memberPhone, caption, true)
    }, 500)

    setSendStep('error')
    setProgressError('فشل الإرسال التلقائي. تم تحميل الصورة وفتح واتساب - أرفق الصورة يدوياً')
  }, [previewImage, buildCaption, memberPhone, handleDownloadBarcode])

  // إعادة المحاولة
  const handleRetry = () => {
    setSendStep('idle')
    setProgressError('')
    setPreviewImage('')
    setBarcodeImage('')
    handleSendBarcode()
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
            disabled={loading || showProgressModal}
            className="bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-2"
          >
            <span>🔢</span>
            <span>{t('barcode.viewBarcode')}</span>
          </button>

          <button
            onClick={handleSendBarcode}
            disabled={loading || showProgressModal}
            className="bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-2"
          >
            <span>📲</span>
            <span>إرسال واتساب</span>
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
                <img
                  src={barcodeImage}
                  alt={`Barcode ${memberNumber}`}
                  className="max-w-full h-auto"
                  style={{ minWidth: '300px' }}
                />
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
                onClick={handleSendBarcode}
                disabled={showProgressModal}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-2"
              >
                <span>📲</span>
                <span>{t('barcode.downloadAndSendViaWhatsApp')}</span>
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

      {/* Progress Modal */}
      {showProgressModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4"
          style={{ zIndex: 10001 }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6" dir="rtl">

            {/* === حالة التوليد === */}
            {sendStep === 'generating' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-1">جاري إنشاء صورة الباركود...</h3>
                <p className="text-sm text-gray-500">يرجى الانتظار</p>
              </div>
            )}

            {/* === الصورة جاهزة - تأكيد الإرسال === */}
            {sendStep === 'ready' && previewImage && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold shrink-0">✓</div>
                  <h3 className="text-lg font-bold text-green-700 dark:text-green-400">الصورة جاهزة للإرسال</h3>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 border-2 border-green-300 dark:border-green-600 rounded-xl p-4 mb-4 flex justify-center">
                  <img
                    src={previewImage}
                    alt="Barcode Preview"
                    className="max-w-full h-auto"
                    style={{ maxHeight: '180px' }}
                  />
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-4">
                  سيتم إرسال الباركود إلى <span className="font-bold">{memberPhone}</span>
                </p>

                <div className="space-y-2">
                  <button
                    onClick={handleConfirmSend}
                    className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold flex items-center justify-center gap-2 text-lg"
                  >
                    <span>📲</span>
                    <span>إرسال عبر واتساب</span>
                  </button>
                  <button
                    onClick={() => { setShowProgressModal(false); setSendStep('idle') }}
                    className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold"
                  >
                    إلغاء
                  </button>
                </div>
              </>
            )}

            {/* === جاري الإرسال === */}
            {sendStep === 'sending' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-1">جاري الإرسال عبر واتساب...</h3>
                <p className="text-sm text-gray-500">يرجى الانتظار</p>

                {previewImage && (
                  <div className="mt-4 opacity-50">
                    <img src={previewImage} alt="Sending..." className="max-h-24 mx-auto rounded" />
                  </div>
                )}
              </div>
            )}

            {/* === تم الإرسال بنجاح === */}
            {sendStep === 'success' && (
              <div className="text-center py-6">
                <div className="text-5xl mb-3">✅</div>
                <h3 className="text-xl font-bold text-green-700 dark:text-green-400 mb-2">تم الإرسال بنجاح!</h3>
                <p className="text-sm text-gray-500 mb-1">تم إنشاء الصورة وإرسالها عبر واتساب</p>

                {previewImage && (
                  <div className="mt-3 mb-4">
                    <img src={previewImage} alt="Sent" className="max-h-24 mx-auto rounded border-2 border-green-300" />
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 mb-4">
                  <span className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">✓</span>
                  <span className="text-sm font-medium">الصورة جاهزة</span>
                  <span className="mx-1">—</span>
                  <span className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">✓</span>
                  <span className="text-sm font-medium">تم الإرسال</span>
                </div>

                <button
                  onClick={() => { setShowProgressModal(false); setSendStep('idle'); setShowBarcodeModal(false) }}
                  className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold"
                >
                  تم
                </button>
              </div>
            )}

            {/* === خطأ === */}
            {sendStep === 'error' && (
              <div className="text-center py-6">
                <div className="text-5xl mb-3">❌</div>
                <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-3">فشل العملية</h3>

                {progressError && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                    <p className="text-sm text-red-700 dark:text-red-300">{progressError}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <button
                    onClick={handleRetry}
                    className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-bold flex items-center justify-center gap-2"
                  >
                    <span>🔄</span>
                    <span>إعادة المحاولة</span>
                  </button>
                  <button
                    onClick={() => { setShowProgressModal(false); setSendStep('idle') }}
                    className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
