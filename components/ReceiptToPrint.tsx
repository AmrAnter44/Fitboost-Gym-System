'use client'

import React, { useState, useEffect } from 'react'
import { printReceiptFromData } from '../lib/printSystem'
import Toast from './Toast'
import { useLanguage } from '../contexts/LanguageContext'
import { normalizePaymentMethod, isMultiPayment, getPaymentMethodLabel } from '../lib/paymentHelpers'

interface ReceiptProps {
  receiptNumber: number
  type: string
  amount: number
  details: any
  date: Date
  paymentMethod?: string
  onClose: () => void
}

export function ReceiptToPrint({ receiptNumber, type, amount, details, date, paymentMethod, onClose }: ReceiptProps) {
  const { t } = useLanguage()
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState('') // ✅ يتم جلب القيمة من الإعدادات
  const [showWebsite, setShowWebsite] = useState(false) // ✅ البداية false عشان ميظهرش لحد ما نجيب الإعدادات
  const [receiptTerms, setReceiptTerms] = useState('الساده الاعضاء حرصا منا على تقديم خدمه افضل وحفاظا على سير النظام العام للمكان بشكل مرضى يرجى الالتزام بالتعليمات الاتيه :\n\n١- الاشتراك لا يرد الا خلال ٢٤ ساعه بعد خصم قيمه الحصه\n٢- لا يجوز التمرين بخلاف الزى الرياضى\n٣- ممنوع اصطحاب الاطفال او الماكولات داخل الجيم\n٤- الاداره غير مسئوله عن المتعلقات الشخصيه')
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  // جلب إعدادات الموقع والإيصال
  useEffect(() => {
    const fetchWebsiteSettings = async () => {
      try {
        const response = await fetch('/api/settings/services')
        if (response.ok) {
          const data = await response.json()
          console.log('📋 Receipt Settings Fetched:', {
            websiteUrl: data.websiteUrl,
            showWebsiteOnReceipts: data.showWebsiteOnReceipts,
            receiptTerms: data.receiptTerms ? `${data.receiptTerms.substring(0, 50)}...` : 'NOT FOUND',
            hasReceiptTerms: !!data.receiptTerms
          })
          if (data.websiteUrl) {
            setWebsiteUrl(data.websiteUrl)
          }
          if (typeof data.showWebsiteOnReceipts === 'boolean') {
            setShowWebsite(data.showWebsiteOnReceipts)
          }
          if (data.receiptTerms) {
            setReceiptTerms(data.receiptTerms)
            console.log('✅ Receipt terms loaded successfully')
          } else {
            console.warn('⚠️ No receiptTerms found in settings - using default')
          }
        }
      } catch (error) {
        console.error('Error fetching website settings:', error)
        // في حالة الخطأ، نستخدم القيم الافتراضية
        setShowWebsite(false)
      } finally {
        setSettingsLoaded(true)
      }
    }
    fetchWebsiteSettings()
  }, [])

  // عرض Toast عند إنشاء الإيصال
  useEffect(() => {
    setToast({
      message: t('receipt.created', { number: receiptNumber.toString() }),
      type: 'success'
    })
  }, [])

  const handlePrint = () => {
    printReceiptFromData(
      receiptNumber,
      type,
      amount,
      details,
      date,
      paymentMethod || details.paymentMethod || 'cash',
      { printOnly: true }
    )
  }

  const prepareReceiptMessage = () => {
    const receiptDate = new Date(date)
    const formattedDate = receiptDate.toLocaleDateString('ar-EG')
    const formattedTime = receiptDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })

    let message = `━━━━━━━━━━━━━━━━━━━━\n`
    message += `*ايصال رقم #${receiptNumber}*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`

    // تحويل نوع الإيصال إلى اسم عربي
    const getReceiptTypeName = (type: string): string => {
      const typeMap: Record<string, string> = {
        // Membership
        'Member': 'اشتراك عضوية',
        'عضوية': 'اشتراك عضوية',
        'تجديد عضويه': 'تجديد عضوية',
        'membershipRenewal': 'تجديد عضوية',
        'ترقية باكدج': 'ترقية باكدج',

        // PT
        'PT': 'تدريب شخصي',
        'اشتراك برايفت': 'تدريب شخصي',
        'تجديد برايفت': 'تجديد تدريب شخصي',
        'newPT': 'تدريب شخصي',
        'ptRenewal': 'تجديد تدريب شخصي',
        'ptDayUse': 'تدريب شخصي يومي',

        // Nutrition
        'newNutrition': 'تغذية',
        'nutritionRenewal': 'تجديد تغذية',
        'nutritionDayUse': 'تغذية يومي',

        // Physiotherapy
        'newPhysiotherapy': 'علاج طبيعي',
        'physiotherapyRenewal': 'تجديد علاج طبيعي',
        'physiotherapyDayUse': 'علاج طبيعي يومي',

        // Group Class
        'newGroupClass': 'حصص جماعية',
        'groupClassRenewal': 'تجديد حصص جماعية',
        'groupClassDayUse': 'حصص جماعية يومي',

        // Other
        'DayUse': 'استخدام يومي',
        'يوم استخدام': 'استخدام يومي',
        'Expense': 'مصروف',
        'inBody': 'InBody',
        'تأجير لوجر': 'تأجير لوجر',
        'lockerRental': 'تأجير لوجر'
      }

      return typeMap[type] || type
    }

    const typeName = getReceiptTypeName(type)
    message += `*النوع:* ${typeName}\n\n`

    if (details.memberNumber) {
      message += `*رقم العضو:* ${details.memberNumber}\n`
    }
    if (details.memberName || details.clientName || details.name) {
      message += `*الاسم:* ${details.memberName || details.clientName || details.name}\n`
    }
    if (details.phone || details.memberPhone || details.clientPhone) {
      message += `*الهاتف:* ${details.phone || details.memberPhone || details.clientPhone}\n`
    }
    message += `\n`

    // تفاصيل الاشتراك - لجميع أنواع العضوية
    const membershipTypes = ['Member', 'عضوية', 'تجديد عضويه', 'membershipRenewal', 'ترقية باكدج']
    if (membershipTypes.includes(type) && details.subscriptionDays) {
      message += `━━━━━━━━━━━━━━━━━━━━\n`
      message += `*تفاصيل الاشتراك*\n`
      message += `━━━━━━━━━━━━━━━━━━━━\n`
      if (details.startDate) {
        message += `- من: ${new Date(details.startDate).toLocaleDateString('ar-EG')}\n`
      }
      if (details.expiryDate) {
        message += `- الى: ${new Date(details.expiryDate).toLocaleDateString('ar-EG')}\n`
      }
      message += `- المدة: ${details.subscriptionDays} يوم\n`

      const extras = []
      if (details.freePTSessions > 0) extras.push(`${details.freePTSessions} جلسة PT`)
      if (details.inBodyScans > 0) extras.push(`${details.inBodyScans} InBody`)
      if (details.invitations > 0) extras.push(`${details.invitations} دعوة`)
      if (extras.length > 0) {
        message += `*هدايا:* ${extras.join(' + ')}\n`
      }
      message += `\n`
    }

    // تفاصيل التدريب - لجميع أنواع PT
    const ptTypes = ['PT', 'اشتراك برايفت', 'تجديد برايفت', 'newPT', 'ptRenewal', 'ptDayUse']
    if (ptTypes.includes(type) || type.includes('برايفت')) {
      message += `━━━━━━━━━━━━━━━━━━━━\n`
      message += `*تفاصيل التدريب*\n`
      message += `━━━━━━━━━━━━━━━━━━━━\n`
      if (details.ptNumber) {
        message += `- رقم PT: ${details.ptNumber}\n`
      }
      if (details.sessions || details.sessionsPurchased) {
        message += `- عدد الجلسات: ${details.sessions || details.sessionsPurchased}\n`
      }
      if (details.pricePerSession) {
        message += `- سعر الجلسة: ${details.pricePerSession} ج.م\n`
      }
      if (details.coachName) {
        message += `- الكوتش: ${details.coachName}\n`
      }
      if (details.startDate && details.expiryDate) {
        message += `- من: ${new Date(details.startDate).toLocaleDateString('ar-EG')}\n`
        message += `- الى: ${new Date(details.expiryDate).toLocaleDateString('ar-EG')}\n`
      }
      if (details.oldRemainingAmount && details.oldRemainingAmount > 0) {
        message += `- المبلغ المتبقي المرتجع: ${details.oldRemainingAmount} ج.م\n`
      }
      message += `\n`
    }

    // تفاصيل التغذية - لجميع أنواع Nutrition
    const nutritionTypes = ['newNutrition', 'nutritionRenewal', 'nutritionDayUse']
    if (nutritionTypes.includes(type)) {
      message += `━━━━━━━━━━━━━━━━━━━━\n`
      message += `*تفاصيل التغذية*\n`
      message += `━━━━━━━━━━━━━━━━━━━━\n`
      if (details.sessions || details.sessionsPurchased) {
        message += `- عدد الجلسات: ${details.sessions || details.sessionsPurchased}\n`
      }
      if (details.nutritionistName || details.specialistName) {
        message += `- الاخصائي: ${details.nutritionistName || details.specialistName}\n`
      }
      if (details.pricePerSession) {
        message += `- سعر الجلسة: ${details.pricePerSession} ج.م\n`
      }
      if (details.startDate && details.expiryDate) {
        message += `- من: ${new Date(details.startDate).toLocaleDateString('ar-EG')}\n`
        message += `- الى: ${new Date(details.expiryDate).toLocaleDateString('ar-EG')}\n`
      }
      message += `\n`
    }

    // تفاصيل العلاج الطبيعي - لجميع أنواع Physiotherapy
    const physioTypes = ['newPhysiotherapy', 'physiotherapyRenewal', 'physiotherapyDayUse']
    if (physioTypes.includes(type)) {
      message += `━━━━━━━━━━━━━━━━━━━━\n`
      message += `*تفاصيل العلاج الطبيعي*\n`
      message += `━━━━━━━━━━━━━━━━━━━━\n`
      if (details.sessions || details.sessionsPurchased) {
        message += `- عدد الجلسات: ${details.sessions || details.sessionsPurchased}\n`
      }
      if (details.therapistName || details.specialistName) {
        message += `- الاخصائي: ${details.therapistName || details.specialistName}\n`
      }
      if (details.pricePerSession) {
        message += `- سعر الجلسة: ${details.pricePerSession} ج.م\n`
      }
      if (details.startDate && details.expiryDate) {
        message += `- من: ${new Date(details.startDate).toLocaleDateString('ar-EG')}\n`
        message += `- الى: ${new Date(details.expiryDate).toLocaleDateString('ar-EG')}\n`
      }
      message += `\n`
    }

    // تفاصيل الحصص الجماعية - لجميع أنواع Group Class
    const groupClassTypes = ['newGroupClass', 'groupClassRenewal', 'groupClassDayUse']
    if (groupClassTypes.includes(type)) {
      message += `━━━━━━━━━━━━━━━━━━━━\n`
      message += `*تفاصيل الحصص الجماعية*\n`
      message += `━━━━━━━━━━━━━━━━━━━━\n`
      if (details.sessions || details.sessionsPurchased) {
        message += `- عدد الجلسات: ${details.sessions || details.sessionsPurchased}\n`
      }
      if (details.instructorName || details.specialistName) {
        message += `- المدرب: ${details.instructorName || details.specialistName}\n`
      }
      if (details.pricePerSession) {
        message += `- سعر الجلسة: ${details.pricePerSession} ج.م\n`
      }
      if (details.startDate && details.expiryDate) {
        message += `- من: ${new Date(details.startDate).toLocaleDateString('ar-EG')}\n`
        message += `- الى: ${new Date(details.expiryDate).toLocaleDateString('ar-EG')}\n`
      }
      message += `\n`
    }

    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `*التفاصيل المالية*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`

    if (details.subscriptionPrice > 0) {
      message += `- سعر الاشتراك: ${details.subscriptionPrice} ج.م\n`
    }
    if (details.totalPrice > 0 && type === 'PT') {
      message += `- الاجمالي: ${details.totalPrice} ج.م\n`
    }

    message += `*المدفوع:* ${amount} ج.م\n`

    if (details.remainingAmount > 0) {
      message += `*المتبقي:* ${details.remainingAmount} ج.م\n`
    }

    // ✅ طريقة الدفع (واحدة أو متعددة)
    const pmValue = paymentMethod || details.paymentMethod
    const isMulti = isMultiPayment(pmValue)
    if (isMulti) {
      const normalized = normalizePaymentMethod(pmValue, amount)
      message += `*طريقة الدفع:* متعددة\n`
      normalized.methods.forEach(m => {
        message += `  - ${getPaymentMethodLabel(m.method, 'ar')}: ${m.amount.toFixed(2)} ج.م\n`
      })
    } else {
      const paymentName = getPaymentMethodLabel(pmValue, 'ar')
      message += `*طريقة الدفع:* ${paymentName}\n`
    }
    message += `\n`

    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `*التاريخ:* ${formattedDate}\n`
    message += `*الوقت:* ${formattedTime}\n`
    if (details.staffName) {
      message += `*الموظف:* ${details.staffName}\n`
    }
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`

    message += `شكرا لثقتكم بنا\n`
    message += `نتمنى لكم تجربة رائعة\n\n`

    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `*شروط وأحكام*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    console.log('📝 Using receipt terms:', receiptTerms.substring(0, 100) + '...')
    message += `${receiptTerms}\n\n`

    // عرض الموقع الإلكتروني فقط إذا كان مفعلاً
    if (showWebsite && websiteUrl) {
      message += `*الموقع الإلكتروني:*\n`
      message += `${websiteUrl}\n\n`
    }

    return message
  }

  const handleSendWhatsApp = async () => {
    if (!phone || phone.trim().length < 10) {
      setToast({ message: 'يرجى إدخال رقم هاتف صحيح', type: 'warning' })
      return
    }

    setSending(true)

    const receiptMessage = prepareReceiptMessage()

    try {
      const sendResult = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message: receiptMessage })
      })

      const sendData = await sendResult.json()

      if (sendData.success) {
        setToast({ message: '✅ تم إرسال الإيصال بنجاح على الواتساب', type: 'success' })
        setShowWhatsAppModal(false)
        setPhone('')
      } else {
        const errorMessage = sendData.error || 'فشل إرسال الرسالة'
        if (errorMessage.includes('not ready') || errorMessage.includes('not initialized') || errorMessage.includes('QR code')) {
          setToast({ message: '❌ الواتساب غير متصل. افتح الإعدادات → الواتساب لمسح QR code', type: 'error' })
        } else {
          setToast({ message: `❌ ${errorMessage}`, type: 'error' })
        }
      }
    } catch (err) {
      console.error('WhatsApp send error:', err)
      setToast({ message: '❌ حدث خطأ أثناء الإرسال', type: 'error' })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 no-print">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">إيصال الدفع</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl font-light transition"
            >
              ×
            </button>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
            <div className="text-center text-gray-600 dark:text-gray-300">
              <div className="text-5xl mb-3">📄</div>
              <p className="font-medium">إيصال رقم <span className="text-primary-600">#{receiptNumber}</span></p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handlePrint}
              className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-medium text-lg shadow-md hover:shadow-lg"
            >
              🖨️ طباعة
            </button>
            <button
              onClick={() => {
                // تعبئة رقم الهاتف تلقائياً إذا كان موجود
                const phoneNumber = details.phone || details.memberPhone || details.clientPhone
                if (phoneNumber) {
                  setPhone(phoneNumber)
                }
                setShowWhatsAppModal(true)
              }}
              className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-medium text-lg shadow-md hover:shadow-lg"
            >
              📲 إرسال عبر واتساب
            </button>
            <button
              onClick={onClose}
              className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-6 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium"
            >
              إغلاق
            </button>
          </div>

          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
            <p>💡 يمكنك طباعة الإيصال أو إرساله عبر واتساب</p>
          </div>
        </div>
      </div>

      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 10000 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowWhatsAppModal(false)
              setPhone('')
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <span className="text-4xl">📱</span>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">إرسال تفاصيل الإيصال</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">إيصال #{receiptNumber}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowWhatsAppModal(false)
                  setPhone('')
                }}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">📞 رقم الهاتف *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-lg"
                dir="ltr"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSendWhatsApp}
                disabled={sending || !phone || phone.trim().length < 10}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2 font-medium"
              >
                {sending ? <>⏳ جاري الإرسال...</> : <>📲 إرسال عبر واتساب</>}
              </button>

              <button
                onClick={() => {
                  setShowWhatsAppModal(false)
                  setPhone('')
                }}
                disabled={sending}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}