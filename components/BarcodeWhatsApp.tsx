'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import Toast from './Toast'
import { sendWhatsAppMessage } from '../lib/whatsappHelper'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface BarcodeWhatsAppProps {
  memberNumber: string
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
  const [receiptTerms, setReceiptTerms] = useState('')

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
          if (data.receiptTerms) {
            setReceiptTerms(data.receiptTerms)
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
    //  الشروط المخصصة من الإعدادات، ولو فاضية نستخدم النص الافتراضي
    const termsBody = receiptTerms || 'الساده الاعضاء حرصا منا على تقديم خدمه افضل وحفاظا على سير النظام العام للمكان بشكل مرضى يرجى الالتزام بالتعليمات الاتيه :\n\n١- الاشتراك لا يرد الا خلال ٢٤ ساعه بعد خصم قيمه الحصه\n٢- لا يجوز التمرين بخلاف الزى الرياضى\n٣- ممنوع اصطحاب الاطفال او الماكولات داخل الجيم\n٤- الاداره غير مسئوله عن المتعلقات الشخصيه'
    const termsAndConditions = `\n\n━━━━━━━━━━━━━━━━━━━━\n*شروط وأحكام*\n━━━━━━━━━━━━━━━━━━━━\n${termsBody}`
    const websiteSection = showWebsite && websiteUrl ? `\n\n🌐 *الموقع الإلكتروني:*\n${websiteUrl}` : ''
    return baseMessage + termsAndConditions + websiteSection
  }, [t, memberNumber, memberName, showWebsite, websiteUrl, receiptTerms])

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

  const iconBarcode = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14"/>
    </svg>
  )
  const iconBarcodeLg = (
    <svg {...stroke} className="w-6 h-6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14"/>
    </svg>
  )
  const iconWhatsApp = (
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
  const iconCheck = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7"/>
    </svg>
  )
  const iconCheckLg = (
    <svg {...stroke} className="w-7 h-7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7"/>
    </svg>
  )
  const iconError = (
    <svg {...stroke} className="w-7 h-7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M9 9l6 6M15 9l-6 6"/>
    </svg>
  )
  const iconRetry = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15.5-6.5L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.5L3 16M3 21v-5h5"/>
    </svg>
  )

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* زر عرض/إرسال الباركود */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5" dir={direction}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
            {iconBarcodeLg}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('barcode.membershipBarcode')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('barcode.viewOrSend')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleGenerateBarcode}
            disabled={loading || showProgressModal}
            className="bg-primary-500 hover:bg-primary-600 text-primary-contrast py-2.5 rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-2"
          >
            {iconBarcode}
            <span>{t('barcode.viewBarcode')}</span>
          </button>

          <button
            onClick={handleSendBarcode}
            disabled={loading || showProgressModal}
            className="bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-2"
          >
            {iconWhatsApp}
            <span>إرسال واتساب</span>
          </button>
        </div>
      </div>

      {/* Modal عرض الباركود */}
      {showBarcodeModal && barcodeImage && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          style={{ zIndex: 9999 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowBarcodeModal(false) }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} dir={direction}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
                  {iconBarcodeLg}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('barcode.membershipBarcode')}</h3>
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
              <p className="text-sm text-primary-600 dark:text-primary-400 mb-2">{t('barcode.member')}</p>
              <p className="text-xl font-bold text-primary-800 dark:text-primary-200">{memberName}</p>
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400 mt-2">#{memberNumber}</p>
            </div>

            <div className="bg-white dark:bg-gray-900/40 rounded-lg p-6 mb-6 flex justify-center ring-1 ring-gray-200 dark:ring-gray-700">
              <div className="relative inline-block">
                <img
                  src={barcodeImage}
                  alt={`Barcode ${memberNumber}`}
                  className="max-w-full h-auto"
                  style={{ minWidth: '300px' }}
                />
                <div className="absolute top-1/2 start-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 ring-1 ring-primary-200 dark:ring-primary-900/50">
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
                className="w-full bg-primary-500 hover:bg-primary-600 text-primary-contrast py-3 rounded-lg transition-colors duration-200 font-bold flex items-center justify-center gap-2"
              >
                {iconDownload}
                <span>{t('barcode.downloadImage')}</span>
              </button>

              <button
                onClick={handleSendBarcode}
                disabled={showProgressModal}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-2"
              >
                {iconWhatsApp}
                <span>{t('barcode.downloadAndSendViaWhatsApp')}</span>
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

      {/* Progress Modal */}
      {showProgressModal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          style={{ zIndex: 10001 }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-sm w-full p-6" dir="rtl">

            {/* === حالة التوليد === */}
            {sendStep === 'generating' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">جاري إنشاء صورة الباركود...</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">يرجى الانتظار</p>
              </div>
            )}

            {/* === الصورة جاهزة - تأكيد الإرسال === */}
            {sendStep === 'ready' && previewImage && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center shrink-0">
                    {iconCheck}
                  </div>
                  <h3 className="text-lg font-bold text-green-700 dark:text-green-400">الصورة جاهزة للإرسال</h3>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl p-4 mb-4 flex justify-center ring-1 ring-green-300 dark:ring-green-700">
                  <img
                    src={previewImage}
                    alt="Barcode Preview"
                    className="max-w-full h-auto"
                    style={{ maxHeight: '180px' }}
                  />
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                  سيتم إرسال الباركود إلى <span className="font-bold">{memberPhone}</span>
                </p>

                <div className="space-y-2">
                  <button
                    onClick={handleConfirmSend}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg transition-colors duration-200 font-bold flex items-center justify-center gap-2 text-lg"
                  >
                    {iconWhatsApp}
                    <span>إرسال عبر واتساب</span>
                  </button>
                  <button
                    onClick={() => { setShowProgressModal(false); setSendStep('idle') }}
                    className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 font-bold"
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
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">جاري الإرسال عبر واتساب...</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">يرجى الانتظار</p>

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
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center">
                  {iconCheckLg}
                </div>
                <h3 className="text-xl font-bold text-green-700 dark:text-green-400 mb-2">تم الإرسال بنجاح!</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">تم إنشاء الصورة وإرسالها عبر واتساب</p>

                {previewImage && (
                  <div className="mt-3 mb-4">
                    <img src={previewImage} alt="Sent" className="max-h-24 mx-auto rounded ring-1 ring-green-300 dark:ring-green-700" />
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 mb-4">
                  <span className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center">
                    <svg {...stroke} className="w-3 h-3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                  </span>
                  <span className="text-sm font-medium">الصورة جاهزة</span>
                  <span className="mx-1">—</span>
                  <span className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center">
                    <svg {...stroke} className="w-3 h-3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                  </span>
                  <span className="text-sm font-medium">تم الإرسال</span>
                </div>

                <button
                  onClick={() => { setShowProgressModal(false); setSendStep('idle'); setShowBarcodeModal(false) }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg transition-colors duration-200 font-bold"
                >
                  تم
                </button>
              </div>
            )}

            {/* === خطأ === */}
            {sendStep === 'error' && (
              <div className="text-center py-6">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 flex items-center justify-center">
                  {iconError}
                </div>
                <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-3">فشل العملية</h3>

                {progressError && (
                  <div className="bg-red-50 dark:bg-red-900/30 ring-1 ring-red-200 dark:ring-red-900/50 rounded-lg p-3 mb-4">
                    <p className="text-sm text-red-700 dark:text-red-300">{progressError}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <button
                    onClick={handleRetry}
                    className="w-full bg-primary-500 hover:bg-primary-600 text-primary-contrast py-3 rounded-lg transition-colors duration-200 font-bold flex items-center justify-center gap-2"
                  >
                    {iconRetry}
                    <span>إعادة المحاولة</span>
                  </button>
                  <button
                    onClick={() => { setShowProgressModal(false); setSendStep('idle') }}
                    className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 font-bold"
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
