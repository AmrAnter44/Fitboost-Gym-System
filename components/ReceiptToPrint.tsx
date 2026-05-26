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
  const [websiteUrl, setWebsiteUrl] = useState('') // يتم جلب القيمة من الإعدادات
  const [showWebsite, setShowWebsite] = useState(false) // البداية false عشان ميظهرش لحد ما نجيب الإعدادات
  const [receiptTerms, setReceiptTerms] = useState('الساده الاعضاء حرصا منا على تقديم خدمه افضل وحفاظا على سير النظام العام للمكان بشكل مرضى يرجى الالتزام بالتعليمات الاتيه :\n\n١- الاشتراك لا يرد الا خلال ٢٤ ساعه بعد خصم قيمه الحصه\n٢- لا يجوز التمرين بخلاف الزى الرياضى\n٣- ممنوع اصطحاب الاطفال او الماكولات داخل الجيم\n٤- الاداره غير مسئوله عن المتعلقات الشخصيه')
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  // جلب إعدادات الموقع والإيصال
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
          } else {
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
        'membershipTransfer': 'نقل عضوية',
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

    // تفاصيل نقل العضوية
    if (type === 'membershipTransfer' || type === 'نقل عضوية') {
      message += `━━━━━━━━━━━━━━━━━━━━\n`
      message += `*تفاصيل نقل العضوية*\n`
      message += `━━━━━━━━━━━━━━━━━━━━\n`
      if (details.kind === 'membershipTransferIdentity') {
        // تغيير ملكية على نفس الـ record
        message += `- العضوية: #${details.memberNumber || '—'}\n`
        if (details.previousOwner?.name) {
          message += `- المالك السابق: ${details.previousOwner.name}\n`
          if (details.previousOwner.phone) {
            message += ` ${details.previousOwner.phone}\n`
          }
        }
        if (details.newOwner?.name) {
          message += `- المالك الجديد: ${details.newOwner.name}\n`
          if (details.newOwner.phone) {
            message += ` ${details.newOwner.phone}\n`
          }
        }
        message += `- الأيام المتبقية: ${details.remainingDays || 0} يوم\n`
        if (details.expiryDate) {
          message += `- ينتهي في: ${new Date(details.expiryDate).toLocaleDateString('ar-EG')}\n`
        }
      } else {
        // نقل لعضو موجود
        if (details.fromMember?.name) {
          message += `- من: ${details.fromMember.name} (#${details.fromMember.memberNumber || '—'})\n`
        }
        if (details.toMember?.name) {
          message += `- إلى: ${details.toMember.name} (#${details.toMember.memberNumber || '—'})\n`
          if (details.toMember.phone) {
            message += ` ${details.toMember.phone}\n`
          }
        }
        message += `- الأيام المنقولة: ${details.transferredDays || 0} يوم\n`
        if (details.toNewExpiryDate) {
          message += `- تاريخ الانتهاء الجديد: ${new Date(details.toNewExpiryDate).toLocaleDateString('ar-EG')}\n`
        }
      }
      if (details.transferFee != null) {
        message += `- رسوم النقل: ${details.transferFee} ج.م\n`
      }
      message += `\n`
    }

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

    if (details.discount && details.discount > 0 && details.originalPrice) {
      message += `- السعر الأصلي: ${details.originalPrice} ج.م\n`
      message += `- الخصم: ${details.discount} ج.م\n`
    }
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

    // طريقة الدفع (واحدة أو متعددة)
    const pmValue = paymentMethod || details.paymentMethod
    const isMulti = isMultiPayment(pmValue)
    if (isMulti) {
      const normalized = normalizePaymentMethod(pmValue, amount)
      message += `*طريقة الدفع:* متعددة\n`
      normalized.methods.forEach(m => {
        message += ` - ${getPaymentMethodLabel(m.method, 'ar')}: ${m.amount.toFixed(2)} ج.م\n`
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
    if (details.salesPersonName) {
      message += `*السيلز:* ${details.salesPersonName}\n`
    }
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`

    message += `شكرا لثقتكم بنا\n`
    message += `نتمنى لكم تجربة رائعة\n\n`

    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `*شروط وأحكام*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
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
        setToast({ message: ' تم إرسال الإيصال بنجاح على الواتساب', type: 'success' })
        setShowWhatsAppModal(false)
        setPhone('')
      } else {
        const errorMessage = sendData.error || 'فشل إرسال الرسالة'
        if (errorMessage.includes('not ready') || errorMessage.includes('not initialized') || errorMessage.includes('QR code')) {
          setToast({ message: ' الواتساب غير متصل. افتح الإعدادات → الواتساب لمسح QR code', type: 'error' })
        } else {
          setToast({ message: ` ${errorMessage}`, type: 'error' })
        }
      }
    } catch (err) {
      console.error('WhatsApp send error:', err)
      setToast({ message: ' حدث خطأ أثناء الإرسال', type: 'error' })
    } finally {
      setSending(false)
    }
  }

  const iconClose = (
    <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  )
  const iconPrinter = (
    <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/>
    </svg>
  )
  const iconWhatsApp = (
    <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  )
  const iconReceipt = (
    <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-7 h-7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12h6m-6 4h6M9 8h6M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-2.5-1.5L14 21l-2.5-1.5L9 21l-2.5-1.5L5 21Z"/>
    </svg>
  )
  const iconPhone = (
    <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"/>
    </svg>
  )
  const iconSpinner = (
    <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5 animate-spin" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm no-print">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">إيصال الدفع</h3>
            <button
              onClick={onClose}
              aria-label="إغلاق"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              {iconClose}
            </button>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 mb-6 ring-1 ring-gray-200 dark:ring-gray-700">
            <div className="flex flex-col items-center text-gray-600 dark:text-gray-400">
              <div className="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center mb-3">
                {iconReceipt}
              </div>
              <p className="font-medium">إيصال رقم <span className="text-primary-600 dark:text-primary-400 font-bold">#{receiptNumber}</span></p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handlePrint}
              className="w-full bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-6 py-3 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {iconPrinter}
              <span>طباعة</span>
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
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {iconWhatsApp}
              <span>إرسال عبر واتساب</span>
            </button>
            <button
              onClick={onClose}
              className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-6 py-3 rounded-lg transition-colors duration-200 font-medium"
            >
              إغلاق
            </button>
          </div>

          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
            <p>يمكنك طباعة الإيصال أو إرساله عبر واتساب</p>
          </div>
        </div>
      </div>

      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          style={{ zIndex: 10000 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowWhatsAppModal(false)
              setPhone('')
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center">
                  {iconWhatsApp}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">إرسال تفاصيل الإيصال</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">إيصال #{receiptNumber}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowWhatsAppModal(false)
                  setPhone('')
                }}
                aria-label="إغلاق"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                {iconClose}
              </button>
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {iconPhone}
                <span>رقم الهاتف *</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 font-mono text-lg"
                dir="ltr"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSendWhatsApp}
                disabled={sending || !phone || phone.trim().length < 10}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
              >
                {sending ? (
                  <>{iconSpinner}<span>جاري الإرسال...</span></>
                ) : (
                  <>{iconWhatsApp}<span>إرسال عبر واتساب</span></>
                )}
              </button>

              <button
                onClick={() => {
                  setShowWhatsAppModal(false)
                  setPhone('')
                }}
                disabled={sending}
                className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
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