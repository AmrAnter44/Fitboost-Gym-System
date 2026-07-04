'use client'

import { useState, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import PaymentMethodSelector from '../components/Paymentmethodselector'
import CoachSelector from './CoachSelector'
import SalesStaffSelector from './SalesStaffSelector'
import ImageUpload from './ImageUpload'
import { calculateDaysBetween, formatDateYMD } from '../lib/dateFormatter'
// ReceiptToPrint popup — يظهر بعد إنشاء العضو بدل الطباعة التلقائية
// المستخدم بيختار من البوب اب: يطبع، يرسل واتساب، أو يغلق
import { ReceiptToPrint } from './ReceiptToPrint'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'
import type { PaymentMethod } from '../lib/paymentHelpers'
import { serializePaymentMethods } from '../lib/paymentHelpers'
import { COUNTRIES, DEFAULT_COUNTRY, composeStoredPhone } from '../lib/countryCodes'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface MemberFormProps {
  onSuccess: () => void
  onCancel?: () => void // إغلاق/إلغاء الفورم (يُستدعى عند الضغط على Escape)
  customCreatedAt?: Date | null
  prefillData?: { // بيانات مسبقة للتعبئة (مثل: من الزوار)
    name?: string
    phone?: string
    salesStaffId?: string // موظف السيلز المسؤول عن هذا الليد
  }
}

export default function MemberForm({ onSuccess, onCancel, customCreatedAt, prefillData }: MemberFormProps) {
  const { user } = usePermissions()
  // كل المستخدمين يقدروا يعدلوا التواريخ في فورم إضافة العضو
  const canEditDates = true
  const { t, direction } = useLanguage()
  const toast = useToast()
  const { settings } = useServiceSettings()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  // كود الدولة للرقم الأساسي والاحتياطي (الافتراضي مصر)
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY.code)
  const [backupCountryCode, setBackupCountryCode] = useState(DEFAULT_COUNTRY.code)
  const [nextMemberNumber, setNextMemberNumber] = useState<string | null>(null)
  // ReceiptToPrint popup state
  const [receiptPopup, setReceiptPopup] = useState<null | {
    receiptNumber: number
    amount: number
    details: any
    date: Date
    paymentMethod?: string
  }>(null)
  const [nextReceiptNumber, setNextReceiptNumber] = useState<number | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [idCardFrontPreview, setIdCardFrontPreview] = useState<string>('')
  const [idCardBackPreview, setIdCardBackPreview] = useState<string>('')
  const [offers, setOffers] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Referral validation states
  const [referrerInfo, setReferrerInfo] = useState<{ name: string; memberNumber: string } | null>(null)
  const [referrerLoading, setReferrerLoading] = useState(false)
  const [referrerError, setReferrerError] = useState<string | null>(null)

  // FollowUp lookup by phone — يعرض اسم السيلز الموكّل من المتابعة
  // salesStaffId: null + salesStaffName: string → سيلز اسمه موجود في المتابعة بس مش مربوط بـ Staff record
  // salesStaffId: string → match كامل وبيتعمل auto-assign
  // salesStaffId: null + salesStaffName: null → الزائر موجود في المتابعات بس مش معيّن لسيلز
  const [matchedFollowUp, setMatchedFollowUp] = useState<{
    salesStaffId: string | null
    salesStaffName: string | null
    visitorName: string | null
  } | null>(null)

  const [formData, setFormData] = useState({
    memberNumber: '',
    name: '',
    phone: '',
    backupPhone: '',
    email: '',
    nationalId: '',
    birthDate: '',
    source: '',
    profileImage: '',
    idCardFront: '',
    idCardBack: '',
    inBodyScans: 0,
    invitations: 0,
    freePTSessions: 0,
    freeNutritionSessions: 0,
    freePhysioSessions: 0,
    freeGroupClassSessions: 0,
    freeMoreSessions: 0,
    freePoolSessions: 0,
    freePadelSessions: 0,
    freeAssessmentSessions: 0,
    remainingFreezeDays: 0,
    subscriptionPrice: 0,
    remainingAmount: 0,
    remainingDueDate: '',
    notes: '',
    startDate: formatDateYMD(new Date()),
    expiryDate: '',
    paymentMethod: 'cash' as string | PaymentMethod[],
    staffName: user?.name || '',
    isOther: false,
    skipReceipt: false, // خيار عدم إنشاء إيصال
    coachId: null as string | null, // ‍ معرف الكوتش
    salesStaffId: null as string | null, // موظف السيلز
    ptCommissionAmount: null as number | null, // عمولة الكوتش من الباقة (null = استخدام الافتراضي من الإعدادات)
    referralMemberNumber: '', // رقم العضو المُحيل
    allowedCheckInStart: '', // ساعة بداية الدخول المسموح بها
    allowedCheckInEnd: '', // ساعة نهاية الدخول المسموح بها
    offerId: null as string | null // معرف الباقة المطبَّقة
  })

  // مدة الباقة المُطبَّقة (للحساب التلقائي للتاريخ النهاية لما البداية تتغير)
  const [appliedOfferDuration, setAppliedOfferDuration] = useState<number | null>(null)
  // سعر الباقة الأصلي + الحد الأدنى (للتحقق من الخصم)
  const [appliedOfferPrice, setAppliedOfferPrice] = useState<number | null>(null)
  const [appliedOfferMinPrice, setAppliedOfferMinPrice] = useState<number | null>(null)
  // الخصم اللي حطه الـ user (للأكونتات اللي مش OWNER/ADMIN)
  const [discount, setDiscount] = useState<number>(0)
  const isPrivilegedUser = user?.role === 'OWNER' || user?.role === 'ADMIN'

  // إغلاق الفورم عند الضغط على Escape (نفس نمط ReceiptDetailModal)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  useEffect(() => {
    const fetchNextNumber = async () => {
      try {
        const response = await fetch('/api/members/next-number')
        const data = await response.json()


        if (data.nextNumber !== undefined && data.nextNumber !== null) {
          const nextStr = String(data.nextNumber)
          setNextMemberNumber(nextStr)
          setFormData(prev => ({ ...prev, memberNumber: nextStr }))
        } else {
          setNextMemberNumber('1001')
          setFormData(prev => ({ ...prev, memberNumber: '1001' }))
        }
      } catch (error) {
        console.error(' خطأ في جلب رقم العضوية:', error)
        setNextMemberNumber('1001')
        setFormData(prev => ({ ...prev, memberNumber: '1001' }))
        toast.warning(t('members.form.errorFetchingNumber'))
      }
    }

    const fetchNextReceiptNumber = async () => {
      try {
        const response = await fetch('/api/receipts/next-number')
        const data = await response.json()
        if (data.nextNumber !== undefined && data.nextNumber !== null) {
          setNextReceiptNumber(data.nextNumber)
        }
      } catch (error) {
        console.error(' خطأ في جلب رقم الإيصال:', error)
      }
    }

    const fetchOffers = async () => {
      try {
        const response = await fetch('/api/offers?activeOnly=true')
        const data = await response.json()
        // التأكد من أن البيانات array
        if (Array.isArray(data)) {
          setOffers(data)
        } else {
          setOffers([])
        }
      } catch (error) {
        console.error(' خطأ في جلب العروض:', error)
        setOffers([])
      }
    }

    fetchNextNumber()
    fetchNextReceiptNumber()
    fetchOffers()
  }, [])

  // تعبئة البيانات من prefillData (مثل: من صفحة الزوار)
  useEffect(() => {
    if (prefillData) {
      setFormData(prev => ({
        ...prev,
        ...(prefillData.name && { name: prefillData.name }),
        ...(prefillData.phone && { phone: prefillData.phone }),
        ...(prefillData.salesStaffId && { salesStaffId: prefillData.salesStaffId })
      }))
    }
  }, [prefillData])

  useEffect(() => {
    if (user && !formData.staffName) {
      setFormData(prev => ({ ...prev, staffName: user.name }))
    }
  }, [user])

  // FollowUp lookup by phone — debounced
  // لما المستخدم يكتب رقم تليفون موجود في المتابعات، نعرض اسم السيلز الموكّل
  // عشان الريسبشن يفتكر يحطه ويتأكد إنه ما يتغيّرش بالغلط.
  useEffect(() => {
    const phone = formData.phone.trim()
    if (phone.length < 10) {
      setMatchedFollowUp(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/followups/by-phone?phone=${encodeURIComponent(phone)}`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (data.found) {
          setMatchedFollowUp({
            salesStaffId: data.salesStaffId || null,
            salesStaffName: data.salesStaffName || null,
            visitorName: data.visitorName
          })
          // force-apply — لو لاقينا staff ID مربوط، نخلي السيلز هو ده.
          // لو الاسم بس موجود (legacy) من غير ID، نسيب اليوزر يختار يدوياً
          // لأننا مش متأكدين أي Staff record المقصود.
          if (data.salesStaffId) {
            setFormData(prev => ({ ...prev, salesStaffId: data.salesStaffId }))
          }
        } else {
          setMatchedFollowUp(null)
        }
      } catch {
        // silent — lookup is a hint, not blocking
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [formData.phone])

  // Validate referral member number
  useEffect(() => {
    const validateReferrer = async () => {
      const memberNumber = formData.referralMemberNumber.trim()

      // Reset states if empty
      if (!memberNumber) {
        setReferrerInfo(null)
        setReferrerError(null)
        setReferrerLoading(false)
        return
      }

      setReferrerLoading(true)
      setReferrerError(null)

      try {
        const response = await fetch(`/api/members?memberNumber=${memberNumber}`)
        const data = await response.json()

        if (response.ok && data.length > 0) {
          const member = data[0]
          setReferrerInfo({ name: member.name, memberNumber: member.memberNumber })
          setReferrerError(null)
        } else {
          setReferrerInfo(null)
          setReferrerError(t('members.referrerNotFound') || 'رقم العضو غير موجود')
        }
      } catch (error) {
        console.error('Error validating referrer:', error)
        setReferrerInfo(null)
        setReferrerError(t('members.referrerValidationError') || 'خطأ في التحقق من رقم العضو')
      } finally {
        setReferrerLoading(false)
      }
    }

    // Debounce the validation
    const timeoutId = setTimeout(validateReferrer, 500)
    return () => clearTimeout(timeoutId)
  }, [formData.referralMemberNumber, t])

  const handleOtherChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      isOther: checked,
      memberNumber: checked ? '' : (nextMemberNumber?.toString() || '')
    }))
  }

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          // تصغير الصورة إذا كانت كبيرة جداً
          const maxDimension = 1200
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension
              width = maxDimension
            } else {
              width = (width / height) * maxDimension
              height = maxDimension
            }
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)

          // ضغط الصورة بجودة 0.7
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const reader = new FileReader()
                reader.readAsDataURL(blob)
                reader.onloadend = () => {
                  resolve(reader.result as string)
                }
              } else {
                reject(new Error('فشل ضغط الصورة'))
              }
            },
            'image/jpeg',
            0.7
          )
        }
        img.onerror = () => reject(new Error('فشل تحميل الصورة'))
      }
      reader.onerror = () => reject(new Error('فشل قراءة الملف'))
    })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error(t('members.form.selectImageOnly'))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('members.form.imageSizeTooLarge'))
      return
    }

    try {
      toast.info(t('members.form.compressingImage'))
      const compressedBase64 = await compressImage(file)
      setImagePreview(compressedBase64)
      setFormData(prev => ({ ...prev, profileImage: compressedBase64 }))
    } catch (error) {
      console.error('خطأ في ضغط الصورة:', error)
      toast.error(t('members.form.imageCompressionFailed'))
    }
  }

  const removeImage = () => {
    setImagePreview('')
    setFormData(prev => ({ ...prev, profileImage: '' }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const calculateExpiryFromMonths = (months: number) => {
    if (!formData.startDate) return

    const start = new Date(formData.startDate)
    const expiry = new Date(start)
    expiry.setMonth(expiry.getMonth() + months)

    setFormData(prev => ({
      ...prev,
      expiryDate: formatDateYMD(expiry)
    }))
  }

  // لو الـ user اختار باقة، نـحدّث تاريخ النهاية تلقائياً لما البداية تتغير
  // (الـ expiry بقى read-only في الـ UI لو فيه باقة مطبَّقة)
  useEffect(() => {
    if (appliedOfferDuration === null || !formData.startDate) return
    const start = new Date(formData.startDate)
    const expiry = new Date(start)
    expiry.setDate(expiry.getDate() + appliedOfferDuration)
    const newExpiry = formatDateYMD(expiry)
    if (newExpiry !== formData.expiryDate) {
      setFormData(prev => ({ ...prev, expiryDate: newExpiry }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.startDate, appliedOfferDuration])

  // للموظفين العاديين: لما الخصم يتغير، نحدّث subscriptionPrice = offerPrice - discount
  useEffect(() => {
    if (isPrivilegedUser || appliedOfferPrice === null) return
    const newPrice = Math.max(0, appliedOfferPrice - discount)
    if (newPrice !== formData.subscriptionPrice) {
      setFormData(prev => ({ ...prev, subscriptionPrice: newPrice }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discount, appliedOfferPrice, isPrivilegedUser])

  const calculateDuration = () => {
    if (!formData.startDate || !formData.expiryDate) return null
    return calculateDaysBetween(formData.startDate, formData.expiryDate)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (formData.startDate && formData.expiryDate) {
      const start = new Date(formData.startDate)
      const end = new Date(formData.expiryDate)

      if (end <= start) {
        toast.error(t('members.form.expiryMustBeAfterStart'))
        setLoading(false)
        return
      }
    }

    // 🚫 المصدر إجباري
    if (!formData.source || formData.source.trim() === '') {
      toast.error(t('members.form.sourceRequiredError'))
      setLoading(false)
      return
    }

    const cleanedData = {
      ...formData,
      // تركيب الرقم المخزّن حسب كود الدولة المختار
      // مصر → يفضل زي ما هو (01...)، غير كده → +<code><رقم>
      phone: composeStoredPhone(formData.phone, countryCode),
      backupPhone: composeStoredPhone(formData.backupPhone, backupCountryCode),
      isOther: formData.isOther,
      memberNumber: formData.isOther
        ? null
        : (formData.memberNumber ? String(formData.memberNumber).trim() : (nextMemberNumber != null ? String(nextMemberNumber) : null)),
      inBodyScans: parseInt(formData.inBodyScans.toString()),
      invitations: parseInt(formData.invitations.toString()),
      freePTSessions: parseInt(formData.freePTSessions.toString()),
      freeNutritionSessions: parseInt(formData.freeNutritionSessions.toString()),
      freePhysioSessions: parseInt(formData.freePhysioSessions.toString()),
      freeGroupClassSessions: parseInt(formData.freeGroupClassSessions.toString()),
      freeMoreSessions: parseInt(formData.freeMoreSessions.toString()),
      freePoolSessions: parseInt(formData.freePoolSessions.toString()),
      freePadelSessions: parseInt(formData.freePadelSessions.toString()),
      freeAssessmentSessions: parseInt(formData.freeAssessmentSessions.toString()),
      remainingFreezeDays: parseInt(formData.remainingFreezeDays.toString()),
      subscriptionPrice: parseInt(formData.subscriptionPrice.toString()),
      // الخصم (يظهر في الإيصال) — السعر الأصلي للباقة قبل الخصم
      discount: !isPrivilegedUser && discount > 0 ? discount : 0,
      originalPrice: !isPrivilegedUser && discount > 0 && appliedOfferPrice !== null ? appliedOfferPrice : null,
      remainingAmount: formData.remainingAmount || 0,
      remainingDueDate: formData.remainingDueDate || null,
      staffName: user?.name || '',
      customCreatedAt: customCreatedAt ? customCreatedAt.toISOString() : null,
      coachId: formData.coachId, // ‍ إرسال معرف الكوتش
      salesStaffId: formData.salesStaffId || null, // موظف السيلز
      ptCommissionAmount: formData.ptCommissionAmount, // عمولة الباقة (null أو رقم)
      referralMemberNumber: formData.referralMemberNumber, // رقم العضو المُحيل
      allowedCheckInStart: formData.allowedCheckInStart || null, // ساعات الدخول
      allowedCheckInEnd: formData.allowedCheckInEnd || null
    }

    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedData),
      })

      const data = await response.json()

      if (response.ok) {
        if (formData.skipReceipt) {
          toast.success(t('members.form.memberAddedWithoutReceipt'))
        } else {
          toast.success(t('members.form.memberAddedSuccessfully'))
        }

        if (data.receipt) {
          queryClient.invalidateQueries({ queryKey: ['receipts'] })

          // بدل الطباعة التلقائية → نظهر popup فيه أزرار طباعة + واتساب
          const subscriptionDays = formData.startDate && formData.expiryDate
            ? calculateDaysBetween(formData.startDate, formData.expiryDate)
            : null

          const paymentMethodStr = typeof formData.paymentMethod === 'string'
            ? formData.paymentMethod
            : serializePaymentMethods(formData.paymentMethod)

          const receiptDetails = {
            memberNumber: data.member.memberNumber,
            memberName: data.member.name,
            phone: data.member.phone,
            startDate: formData.startDate,
            expiryDate: formData.expiryDate,
            subscriptionDays: subscriptionDays,
            subscriptionPrice: cleanedData.subscriptionPrice,
            paidAmount: cleanedData.subscriptionPrice - (formData.remainingAmount || 0),
            remainingAmount: formData.remainingAmount || 0,
            inBodyScans: cleanedData.inBodyScans,
            invitations: cleanedData.invitations,
            freePTSessions: cleanedData.freePTSessions,
            paymentMethod: paymentMethodStr,
            staffName: formData.staffName
          }

          setReceiptPopup({
            receiptNumber: data.receipt.receiptNumber,
            amount: cleanedData.subscriptionPrice - (formData.remainingAmount || 0),
            details: receiptDetails,
            date: new Date(data.receipt.createdAt),
            paymentMethod: paymentMethodStr,
          })
        }

        // تحديث رقم الإيصال التالي
        const receiptResponse = await fetch('/api/receipts/next-number')
        const receiptData = await receiptResponse.json()
        if (receiptData.nextNumber) {
          setNextReceiptNumber(receiptData.nextNumber)
        }

        // لو في إيصال، الـ onSuccess هيتنادي لما المستخدم يقفل الـ popup
        // (عشان مفيش race بين إغلاق الفورم وظهور الـ popup)
        // لو مفيش إيصال (skipReceipt)، نستدعي onSuccess على طول
        if (!data.receipt) {
          setTimeout(() => {
            onSuccess()
          }, 2000)
        }
      } else {
        toast.error(data.error || t('common.error'))
      }
    } catch (error) {
      toast.error(t('members.form.errorConnection'))
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const duration = calculateDuration()
  const paidAmount = formData.subscriptionPrice

  // دالة تطبيق العرض
  const applyOffer = (offer: any) => {
    const startDate = formData.startDate || formatDateYMD(new Date())
    const expiryDate = new Date(startDate)
    expiryDate.setDate(expiryDate.getDate() + offer.duration)

    // نخزّن الـ duration والسعر الأصلي والحد الأدنى عشان الـ expiry والخصم يتحدّثوا
    setAppliedOfferDuration(offer.duration)
    setAppliedOfferPrice(offer.price)
    setAppliedOfferMinPrice(offer.minPrice ?? null)
    setDiscount(0) // إعادة الخصم لـ 0 عند تطبيق باقة جديدة

    setFormData(prev => ({
      ...prev,
      subscriptionPrice: offer.price,
      freePTSessions: offer.freePTSessions,
      freeNutritionSessions: offer.freeNutritionSessions || 0,
      freePhysioSessions: offer.freePhysioSessions || 0,
      freeGroupClassSessions: offer.freeGroupClassSessions || 0,
      freeMoreSessions: offer.freeMoreSessions || 0,
      freePoolSessions: offer.freePoolSessions || 0,
      freePadelSessions: offer.freePadelSessions || 0,
      freeAssessmentSessions: offer.freeAssessmentSessions || 0,
      inBodyScans: offer.inBodyScans,
      invitations: offer.invitations,
      remainingFreezeDays: offer.freezeDays,
      ptCommissionAmount: offer.ptCommission || null, // حفظ عمولة الباقة
      allowedCheckInStart: offer.allowedCheckInStart || '', // نسخ ساعات الدخول من العرض
      allowedCheckInEnd: offer.allowedCheckInEnd || '',
      offerId: offer.id, // تخزين الباقة على العضو
      startDate,
      expiryDate: formatDateYMD(expiryDate)
    }))

    toast.success(t('members.form.offerApplied', { offerName: offer.name }))
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-3" dir={direction}>
      {/* قسم العروض */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-primary-200 dark:ring-primary-900/40 p-5">
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-primary-800 dark:text-primary-200">
          <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 10h14a1 1 0 011 1v9a1 1 0 01-1 1H5a1 1 0 01-1-1v-9a1 1 0 011-1z"/></svg>
          <span>{t('members.form.availableOffers')}</span>
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('members.form.selectOfferToAutoFill')}</p>

        {!Array.isArray(offers) || offers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center bg-gray-50 dark:bg-gray-900/40 rounded-xl ring-1 ring-dashed ring-gray-300 dark:ring-gray-600">
            <svg className="w-10 h-10 text-gray-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
            <p className="text-gray-600 dark:text-gray-300 font-bold mt-2 text-sm">{t('members.form.noOffersAvailable')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('members.form.adminCanAddOffers')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {offers.map(offer => (
              <button
                key={offer.id}
                type="button"
                onClick={() => applyOffer(offer)}
                className="bg-white dark:bg-gray-800 ring-1 ring-primary-200 dark:ring-primary-900/40 hover:ring-primary-500 dark:hover:ring-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-xl p-3 transition-colors duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <div className="flex justify-center mb-1 text-primary-600 dark:text-primary-400">
                  <svg className="w-6 h-6" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12v9H4v-9m16-4H4v4h16V8zM12 8v13M12 8a2.5 2.5 0 11-2.5-2.5A2.5 2.5 0 0112 8zm0 0a2.5 2.5 0 102.5-2.5A2.5 2.5 0 0012 8z"/></svg>
                </div>
                <div className="font-bold text-primary-800 dark:text-primary-200 mb-1 text-sm">{offer.name}</div>
                <div className="text-xl font-bold text-green-600 dark:text-green-400">{offer.price} {t('members.egp')}</div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 bg-primary-50 dark:bg-primary-900/30 border-s-4 border-primary-500 dark:border-primary-700 p-2 rounded">
          <p className="text-xs text-primary-800 dark:text-primary-300 flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span><strong>{t('members.notes')}:</strong> {t('members.form.noteCanEditAfterOffer')}</span>
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          <span>{t('members.form.basicInformation')}</span>
        </h3>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
              {t('members.membershipNumber')} {!formData.isOther && '*'}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isOther}
                onChange={(e) => handleOtherChange(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('members.form.otherNoNumber')}</span>
            </label>
          </div>

          {formData.isOther ? (
            <div className="w-full px-3 py-2 ring-1 ring-dashed ring-gray-300 dark:ring-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-center">
              {t('members.form.noMembershipNumber')}
            </div>
          ) : (
            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              required={!formData.isOther}
              value={formData.memberNumber}
              onChange={(e) => setFormData({ ...formData, memberNumber: e.target.value.replace(/\D/g, '') })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
              placeholder="مثال: 01001"
              disabled={formData.isOther}
            />
          )}

          {!formData.isOther && nextMemberNumber && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              {t('members.form.suggestedNextNumber', { number: nextMemberNumber.toString() })}
            </p>
          )}
        </div>


        {nextReceiptNumber && (
          <div className="bg-green-50 dark:bg-green-900/30 ring-1 ring-green-200 dark:ring-green-900/50 rounded-lg p-2 mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h4m6-4V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3-2 3 2 3-2 3 2v-4"/></svg>
              <div>
                <p className="text-xs font-bold text-green-800 dark:text-green-300">{t('members.form.nextReceiptNumber')}</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">#{nextReceiptNumber}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('members.form.nameRequired')}</label>
            <input
              type="text"
              required
              autoFocus
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
              placeholder="أحمد محمد"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('members.form.phoneRequired')}</label>
            <div className="flex gap-2" dir="ltr">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="shrink-0 px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 cursor-pointer"
                title={direction === 'rtl' ? 'كود الدولة' : 'Country code'}
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} +{c.dial}</option>
                ))}
              </select>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                placeholder={countryCode === 'EG' ? '01234567890' : '512345678'}
                dir="ltr"
              />
            </div>
            {/* لو الرقم متطابق مع متابعة، نعرض رسالة مختلفة حسب الحالة */}
            {matchedFollowUp && (() => {
              const canOverride = user?.role === 'OWNER' || user?.role === 'ADMIN'
              const hasStaffId = !!matchedFollowUp.salesStaffId
              const hasStaffName = !!matchedFollowUp.salesStaffName

              const ClipboardIcon = (
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              )
              const LockIcon = (
                <svg className="w-3.5 h-3.5 inline-block mx-1" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              )

              // الحالة ١: لقينا staff ID مربوط → auto-assign
              if (hasStaffId && hasStaffName) {
                return (
                  <div className="mt-2 bg-amber-50 dark:bg-amber-900/30 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-lg px-3 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                    {ClipboardIcon}
                    <span>
                      {direction === 'rtl'
                        ? canOverride
                          ? <>المتابع للزائر ده: <strong>{matchedFollowUp.salesStaffName}</strong> — تقدر تغيّره لو محتاج</>
                          : <>السيلز هيترصد للموظف اللي كان بيتابع: <strong>{matchedFollowUp.salesStaffName}</strong>{LockIcon}</>
                        : canOverride
                          ? <>Following up with this visitor: <strong>{matchedFollowUp.salesStaffName}</strong> — you can change it if needed</>
                          : <>Sale will be credited to: <strong>{matchedFollowUp.salesStaffName}</strong>{LockIcon}</>}
                      {matchedFollowUp.visitorName && (
                        <span className="text-amber-600 dark:text-amber-400 mx-1">({matchedFollowUp.visitorName})</span>
                      )}
                    </span>
                  </div>
                )
              }

              // الحالة ٢: لقينا اسم سيلز بس مش مربوط بـ Staff record → اعرض الاسم وخلّي اليوزر يختار
              if (!hasStaffId && hasStaffName) {
                return (
                  <div className="mt-2 bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-900/50 rounded-lg px-3 py-2 text-xs text-blue-800 dark:text-blue-200 flex items-start gap-2">
                    {ClipboardIcon}
                    <span>
                      {direction === 'rtl'
                        ? <>الزائر ده كان بيتابع مع: <strong>{matchedFollowUp.salesStaffName}</strong> — اختر السيلز من القايمة تحت</>
                        : <>This visitor was being followed up by: <strong>{matchedFollowUp.salesStaffName}</strong> — please pick the sales rep below</>}
                      {matchedFollowUp.visitorName && (
                        <span className="text-blue-600 dark:text-blue-400 mx-1">({matchedFollowUp.visitorName})</span>
                      )}
                    </span>
                  </div>
                )
              }

              // الحالة ٣: الزائر موجود في المتابعات بس مفيش سيلز معيّن
              if (!hasStaffId && !hasStaffName && matchedFollowUp.visitorName) {
                return (
                  <div className="mt-2 bg-gray-50 dark:bg-gray-700/50 ring-1 ring-gray-200 dark:ring-gray-600 rounded-lg px-3 py-2 text-xs text-gray-700 dark:text-gray-300 flex items-start gap-2">
                    {ClipboardIcon}
                    <span>
                      {direction === 'rtl'
                        ? <>الزائر ده موجود في المتابعات: <strong>{matchedFollowUp.visitorName}</strong> — لكن مش معيّن لسيلز</>
                        : <>Visitor found in follow-ups: <strong>{matchedFollowUp.visitorName}</strong> — but not assigned to a sales rep</>}
                    </span>
                  </div>
                )
              }

              return null
            })()}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('members.form.backupPhoneOptional')}</label>
            <div className="flex gap-2" dir="ltr">
              <select
                value={backupCountryCode}
                onChange={(e) => setBackupCountryCode(e.target.value)}
                className="shrink-0 px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 cursor-pointer"
                title={direction === 'rtl' ? 'كود الدولة' : 'Country code'}
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} +{c.dial}</option>
                ))}
              </select>
              <input
                type="tel"
                value={formData.backupPhone}
                onChange={(e) => setFormData({ ...formData, backupPhone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                placeholder={backupCountryCode === 'EG' ? '01234567890' : '512345678'}
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{direction === 'rtl' ? 'البريد الإلكتروني (اختياري)' : 'Email (optional)'}</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
              placeholder="example@email.com"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('members.form.nationalIdOptional')}</label>
            <input
              type="text"
              value={formData.nationalId}
              onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
              placeholder="29512345678901"
              dir="ltr"
              maxLength={14}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('members.form.birthDateOptional')}</label>
            <input
              type="date"
              value={formData.birthDate}
              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              {t('members.form.sourceRequired')} <span className="text-red-500">*</span>
            </label>
            {/* select أنيق — chevron مخصص، focus ناعم بدون ring أحمر */}
            <div className="relative">
              <select
                required
                value={formData.source}
                onChange={(e) => {
                  const next = e.target.value
                  setFormData({
                    ...formData,
                    source: next,
                    ...(next !== 'friend_referral' ? { referralMemberNumber: '' } : {}),
                  })
                }}
                className="w-full appearance-none ps-3 pe-10 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 text-gray-900 dark:text-gray-100 text-sm font-medium shadow-inner hover:bg-white dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:border-blue-400 dark:focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all duration-200 cursor-pointer"
              >
                <option value="">{t('members.form.selectSource')}</option>
                <option value="walk-in">{t('members.form.sourceWalkIn')}</option>
                <option value="call-in">{t('members.form.sourceCallIn')}</option>
                <option value="suggestion">{t('members.form.sourceSuggestion')}</option>
                <option value="facebook">{t('members.form.sourceFacebook')}</option>
                <option value="instagram">{t('members.form.sourceInstagram')}</option>
                <option value="tiktok">{t('members.form.sourceTiktok')}</option>
                <option value="chatgpt">{t('members.form.sourceChatGPT')}</option>
                <option value="website">{t('members.form.sourceWebsite')}</option>
                <option value="friend_referral">{t('members.form.sourceFriendReferral')}</option>
                {/* احتفظ بالقيمة القديمة لو العضو متسجّل قبل كده بـ source غير موجود في القائمة الجديدة */}
                {formData.source && !['walk-in','call-in','suggestion','facebook','instagram','tiktok','chatgpt','website','friend_referral'].includes(formData.source) && (
                  <option value={formData.source}>{formData.source}</option>
                )}
              </select>
              {/* chevron container بـ background صغير عشان يبان أنيق */}
              <div className="absolute end-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-white dark:bg-gray-600 shadow-sm flex items-center justify-center pointer-events-none">
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </div>
            </div>

            {/* 👥 حقل ID اللي جاب العضو — يظهر تحت لما friend_referral مختار */}
            {formData.source === 'friend_referral' && (
              <div className="mt-2">
                <div className="relative">
                  <input
                    type="text"
                    value={formData.referralMemberNumber}
                    onChange={(e) => setFormData({ ...formData, referralMemberNumber: e.target.value })}
                    className={`w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm shadow-sm focus:outline-none focus:ring-2 transition-colors duration-200 font-mono ${
                      referrerInfo
                        ? 'border-green-500 dark:border-green-600 focus:ring-green-500'
                        : referrerError
                        ? 'border-red-500 dark:border-red-600 focus:ring-red-500'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-primary-500'
                    }`}
                    placeholder={`👥 ${t('members.referralMemberNumberPlaceholder')}`}
                    dir="ltr"
                  />
                  {referrerLoading && (
                    <div className="absolute end-3 top-1/2 -translate-y-1/2">
                      <svg className="animate-spin h-4 w-4 text-primary-500" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    </div>
                  )}
                </div>

                {referrerInfo && (
                  <p className="mt-1.5 text-xs font-bold text-green-700 dark:text-green-400 inline-flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    <span>{referrerInfo.name} (#{referrerInfo.memberNumber})</span>
                    {settings?.pointsEnabled && (settings?.pointsPerReferral ?? 0) > 0 && (
                      <span className="text-gray-500 dark:text-gray-400 font-normal ms-1">
                        — {t('members.referrerWillReceive')} {settings.pointsPerReferral} {t('members.pointsLabel')}
                      </span>
                    )}
                  </p>
                )}
                {referrerError && formData.referralMemberNumber.trim() !== '' && (
                  <p className="mt-1.5 text-xs font-bold text-red-700 dark:text-red-400 inline-flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    {referrerError}
                  </p>
                )}
                {!referrerInfo && !referrerError && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                    {settings?.pointsEnabled && (settings?.pointsPerReferral ?? 0) > 0
                      ? `${t('members.referralMemberNumberHelp')} (${settings.pointsPerReferral} ${t('members.pointsLabel')})`
                      : t('members.form.referrerIdHelp')}
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('members.form.staffNameRequired')}</label>
            <input
              type="text"
              required
              value={formData.staffName}
              readOnly
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-not-allowed text-sm"
              placeholder="محمد علي"
            />
          </div>
        </div>
      </div>

      {/* 🏋️ اختيار الكوتش — يظهر دايماً (مش مرتبط بـ PT Commission) */}
      <CoachSelector
        value={formData.coachId}
        onChange={(coachId) => setFormData({ ...formData, coachId })}
        required={false}
      />

      {/* اختيار موظف السيلز — مقفول لغير OWNER/ADMIN لما الرقم متطابق مع متابعة
              autoSelectLeastLoaded: لما الفورم يفتح من غير سيلز مسبق، يختار الأقل تحميلاً تلقائياً */}
      <SalesStaffSelector
        value={formData.salesStaffId}
        onChange={(salesStaffId) => setFormData({ ...formData, salesStaffId })}
        autoSelectLeastLoaded
        locked={
          matchedFollowUp && !(user?.role === 'OWNER' || user?.role === 'ADMIN')
            ? { reason: `${direction === 'rtl' ? 'الموظف اللي كان بيتابع المتابعة' : 'The sales rep already following up'}: ${matchedFollowUp.salesStaffName}` }
            : undefined
        }
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
        <ImageUpload
          currentImage={imagePreview || null}
          onImageChange={(imageUrl) => {
            if (imageUrl) {
              setImagePreview(imageUrl)
              setFormData(prev => ({ ...prev, profileImage: imageUrl }))
            } else {
              setImagePreview('')
              setFormData(prev => ({ ...prev, profileImage: '' }))
            }
          }}
        />
      </div>

      {/* صور البطاقة الشخصية / الباسبور */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2zm10 4a3 3 0 11-6 0 3 3 0 016 0zm5-4h-2a1 1 0 110-2h2a1 1 0 110 2z"/></svg>
          <span>{t('members.form.idCardImagesOptional')}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* الوجه الأمامي */}
          <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 p-3">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0v4m0-4l-2-2m2 2l2-2"/></svg>
              <span className="font-bold text-sm text-gray-700 dark:text-gray-300">{t('members.form.idCardFront')}</span>
            </div>
            <ImageUpload
              currentImage={idCardFrontPreview || null}
              onImageChange={(imageUrl) => {
                if (imageUrl) {
                  setIdCardFrontPreview(imageUrl)
                  setFormData(prev => ({ ...prev, idCardFront: imageUrl }))
                } else {
                  setIdCardFrontPreview('')
                  setFormData(prev => ({ ...prev, idCardFront: '' }))
                }
              }}
              variant="idCard"
            />
          </div>

          {/* الوجه الخلفي */}
          <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 p-3">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              <span className="font-bold text-sm text-gray-700 dark:text-gray-300">{t('members.form.idCardBack')}</span>
            </div>
            <ImageUpload
              currentImage={idCardBackPreview || null}
              onImageChange={(imageUrl) => {
                if (imageUrl) {
                  setIdCardBackPreview(imageUrl)
                  setFormData(prev => ({ ...prev, idCardBack: imageUrl }))
                } else {
                  setIdCardBackPreview('')
                  setFormData(prev => ({ ...prev, idCardBack: '' }))
                }
              }}
              variant="idCard"
            />
          </div>
        </div>

        {/* ملاحظة */}
        <div className="mt-3 bg-gray-50 dark:bg-gray-900/40 border-s-4 border-gray-300 dark:border-gray-600 p-2 rounded">
          <p className="text-xs text-gray-600 dark:text-gray-400">{t('members.form.idCardNote')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          <span>{t('members.form.subscriptionPeriod')}</span>
        </h3>

        <div className="grid grid-cols-1 gap-3 mb-3">
          <div>
            <label className="flex items-center text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 gap-1">
              {t('members.startDate')} <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(yyyy-mm-dd)</span>
              {!canEditDates && <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                readOnly={!canEditDates}
                className={`flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 ${!canEditDates ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-70' : ''}`}
                placeholder="2025-11-18"
                pattern="\d{4}-\d{2}-\d{2}"
              />
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                disabled={!canEditDates}
                className={`px-3 py-2 text-white rounded-lg transition-colors duration-200 text-sm font-bold ${canEditDates ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer' : 'bg-gray-400 cursor-not-allowed opacity-60'}`}
                style={{ colorScheme: 'dark', width: '45px' }}
                title={canEditDates ? t('members.form.selectDate') : (direction === 'rtl' ? 'صلاحية الأدمن فقط' : 'Admin only')}
                aria-label={t('members.form.selectDate')}
              />
            </div>
          </div>

          <div>
            <label className="flex items-center text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 gap-1">
              {t('members.expiryDate')} <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(yyyy-mm-dd)</span>
              {(!canEditDates || appliedOfferDuration !== null) && <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>}
            </label>
            <div className="flex gap-2">
              {/* لو الـ user مختار باقة، الـ expiry بيتحسب تلقائياً من start + duration ومش قابل للتعديل */}
              <input
                type="text"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                readOnly={!canEditDates || appliedOfferDuration !== null}
                className={`flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 ${(!canEditDates || appliedOfferDuration !== null) ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-70' : ''}`}
                placeholder="2025-12-18"
                pattern="\d{4}-\d{2}-\d{2}"
              />
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                disabled={!canEditDates || appliedOfferDuration !== null}
                className={`px-3 py-2 text-white rounded-lg transition-colors duration-200 text-sm font-bold ${(canEditDates && appliedOfferDuration === null) ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer' : 'bg-gray-400 cursor-not-allowed opacity-60'}`}
                style={{ colorScheme: 'dark', width: '45px' }}
                title={canEditDates ? (appliedOfferDuration !== null ? (direction === 'rtl' ? 'بيتحسب تلقائياً من تاريخ البداية + مدة الباقة' : 'Auto-computed') : t('members.form.selectDate')) : (direction === 'rtl' ? 'صلاحية الأدمن فقط' : 'Admin only')}
                aria-label={t('members.form.selectDate')}
              />
            </div>
            {appliedOfferDuration !== null && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                {direction === 'rtl'
                  ? `بيتحسب تلقائياً (${appliedOfferDuration} يوم من تاريخ البداية). غيّر الباقة لو محتاج فترة مختلفة.`
                  : `Auto-computed (${appliedOfferDuration} days from start). Change package if you need a different duration.`}
              </p>
            )}
          </div>
        </div>

        {!canEditDates && (
          <div className="mb-2 p-2 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            <span>{direction === 'rtl' ? 'التواريخ بيتم تحديدها تلقائياً من العرض المختار — للتعديل اليدوي لازم صلاحية الأدمن.' : 'Dates are auto-set from the selected offer — admin permission required for manual editing.'}</span>
          </div>
        )}

        {canEditDates && (
          <div className="mb-2">
            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
              <svg className="w-4 h-4 text-amber-500 dark:text-amber-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              {t('members.form.quickAdd')}:
            </p>
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3, 6, 9, 12].map(months => (
                <button
                  key={months}
                  type="button"
                  onClick={() => calculateExpiryFromMonths(months)}
                  className="px-2.5 py-1 bg-primary-100 dark:bg-primary-900/40 hover:bg-primary-200 dark:hover:bg-primary-800/50 text-primary-800 dark:text-primary-300 rounded-lg text-xs font-bold transition-colors duration-200"
                >
                  + {months} {months === 1 ? t('members.form.month') : t('members.form.months')}
                </button>
              ))}
            </div>
          </div>
        )}

        {duration !== null && (
          <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 p-2">
            <p className="text-xs flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6m0 13l-3-3m3 3l3-3m6 3V10m0 9l3-3m-3 3l-3-3"/></svg>
              <span className="font-bold text-gray-700 dark:text-gray-300">{t('members.form.subscriptionDuration')}: </span>
              <span className="font-bold text-primary-600 dark:text-primary-400">
                {duration} {t('members.form.daysSingle')}
                {duration >= 30 && ` (${Math.floor(duration / 30)} ${Math.floor(duration / 30) === 1 ? t('members.form.month') : t('members.form.months')})`}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Additional Services section - Hidden as per user request */}
      {/* <div className="bg-green-50 dark:bg-green-900/30 ring-1 ring-green-200 dark:ring-green-700 rounded-lg p-3">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <span></span>
          <span>{t('members.form.additionalServices')}</span>
        </h3>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5"> InBody</label>
            <input
              type="number"
              min="0"
              value={formData.inBodyScans}
              onChange={(e) => setFormData({ ...formData, inBodyScans: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5"> {t('members.invitations')}</label>
            <input
              type="number"
              min="0"
              value={formData.invitations}
              onChange={(e) => setFormData({ ...formData, invitations: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5"> {t('members.freePTSessions')}</label>
            <input
              type="number"
              min="0"
              value={formData.freePTSessions}
              onChange={(e) => setFormData({ ...formData, freePTSessions: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5"> أيام الفريز</label>
            <input
              type="number"
              min="0"
              value={formData.remainingFreezeDays}
              onChange={(e) => setFormData({ ...formData, remainingFreezeDays: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>
        </div>
      </div> */}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>{t('members.form.financialInformation')}</span>
        </h3>

        {isPrivilegedUser ? (
          /* OWNER/ADMIN: حقل السعر مفتوح بالكامل */
          <div className="mb-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('members.form.subscriptionPriceRequired')}</label>
            <input
              type="number"
              required
              min="0"
              value={formData.subscriptionPrice}
              onChange={(e) => setFormData({ ...formData, subscriptionPrice: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
              placeholder="0"
            />
          </div>
        ) : (
          /* ريسبشن وغيرهم: السعر مقفول، يقدر يحط خصم فقط في الحد المسموح */
          <div className="mb-2 space-y-2">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {direction === 'rtl' ? 'سعر الباقة' : 'Package Price'}
              </label>
              <input
                type="number"
                value={appliedOfferPrice ?? formData.subscriptionPrice}
                readOnly
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="flex items-center text-sm font-bold text-orange-700 dark:text-orange-400 mb-1.5 gap-1.5 flex-wrap">
                <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
                <span>{direction === 'rtl' ? 'خصم (جنيه)' : 'Discount (EGP)'}</span>
                {appliedOfferMinPrice !== null && appliedOfferPrice !== null && (
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 mx-1">
                    {direction === 'rtl'
                      ? `الحد الأقصى للخصم: ${appliedOfferPrice - appliedOfferMinPrice}`
                      : `Max discount: ${appliedOfferPrice - appliedOfferMinPrice}`}
                  </span>
                )}
              </label>
              <input
                type="number"
                min="0"
                max={appliedOfferPrice !== null && appliedOfferMinPrice !== null ? appliedOfferPrice - appliedOfferMinPrice : undefined}
                value={discount}
                onChange={(e) => {
                  let v = parseInt(e.target.value) || 0
                  if (v < 0) v = 0
                  // كلامب لو الـ user كتب أكتر من المسموح (نخلي الـ field يعرض الحد الأقصى)
                  if (appliedOfferPrice !== null && appliedOfferMinPrice !== null) {
                    const maxDiscount = appliedOfferPrice - appliedOfferMinPrice
                    if (v > maxDiscount) v = maxDiscount
                  } else if (appliedOfferPrice !== null && v > appliedOfferPrice) {
                    v = appliedOfferPrice
                  }
                  setDiscount(v)
                }}
                disabled={appliedOfferPrice === null}
                className="w-full px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition-colors duration-200"
                placeholder="0"
              />
              {appliedOfferPrice !== null && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {direction === 'rtl' ? 'الصافي بعد الخصم' : 'Net after discount'}: <strong className="text-green-700 dark:text-green-400">{formData.subscriptionPrice}</strong> {direction === 'rtl' ? 'جنيه' : 'EGP'}
                </p>
              )}
              {appliedOfferPrice === null && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  {direction === 'rtl' ? 'اختار باقة الأول عشان تقدر تطبّق خصم' : 'Pick a package first to apply a discount'}
                </p>
              )}
            </div>
          </div>
        )}

        {settings.remainingEnabled && (
          <div className="mb-2 space-y-2">
            <div>
              <label className="flex items-center text-sm font-bold text-orange-700 dark:text-orange-400 mb-1.5 gap-1.5">
                <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {direction === 'rtl' ? 'باقي على العضو (جنيه)' : 'Remaining Balance (EGP)'}
              </label>
              <input
                type="number"
                min="0"
                value={formData.remainingAmount}
                onChange={(e) => setFormData({ ...formData, remainingAmount: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors duration-200"
                placeholder="0"
              />
            </div>
            {(formData.remainingAmount || 0) > 0 && (
              <div>
                <label className="flex items-center text-sm font-bold text-orange-700 dark:text-orange-400 mb-1.5 gap-1.5">
                  <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  {direction === 'rtl' ? 'موعد سداد الباقي' : 'Due Date'}
                </label>
                <input
                  type="date"
                  value={formData.remainingDueDate}
                  onChange={(e) => setFormData({ ...formData, remainingDueDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors duration-200"
                />
              </div>
            )}
          </div>
        )}

        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 p-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('members.form.paidAmount')}:</span>
            <span className="font-bold text-green-600 dark:text-green-400">
              {paidAmount - (settings.remainingEnabled ? (formData.remainingAmount || 0) : 0)} {t('members.egp')}
            </span>
          </div>
          {settings.remainingEnabled && (formData.remainingAmount || 0) > 0 && (
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{direction === 'rtl' ? 'الباقي:' : 'Remaining:'}</span>
              <span className="font-bold text-orange-600 dark:text-orange-400">{formData.remainingAmount} {t('members.egp')}</span>
            </div>
          )}
        </div>

        <div className="mt-3">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('members.paymentMethod')}</label>
          <PaymentMethodSelector
            value={formData.paymentMethod}
            onChange={(method) => setFormData({
              ...formData,
              paymentMethod: method
            })}
            allowMultiple={true}
            totalAmount={paidAmount - (settings.remainingEnabled ? (formData.remainingAmount || 0) : 0)}
            memberPoints={0}
            pointsValueInEGP={settings.pointsValueInEGP}
            pointsEnabled={settings.pointsEnabled}
          />
        </div>

        {/* خيار عدم إنشاء إيصال */}
        <div className="mt-3">
          <label className="flex items-center gap-2 cursor-pointer bg-amber-50 dark:bg-amber-900/30 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-lg p-2">
            <input
              type="checkbox"
              checked={formData.skipReceipt}
              onChange={(e) => setFormData({ ...formData, skipReceipt: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
            />
            <svg className="w-4 h-4 text-amber-700 dark:text-amber-300" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
              {t('members.form.skipReceiptAdminOnly')}
            </span>
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
        <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
          <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          {t('members.notes')}
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
          rows={2}
          placeholder={`${t('members.notes')}...`}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold py-3 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              <span>{t('members.form.saving')}</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              <span>{t('members.form.saveMember')}</span>
            </>
          )}
        </button>
      </div>

      <div className="bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-200 dark:ring-primary-900/50 rounded-lg p-3 text-center">
        <p className="text-xs text-primary-800 dark:text-primary-300 flex items-center justify-center gap-1.5">
          <svg className="w-4 h-4 flex-shrink-0" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h4m6-4V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3-2 3 2 3-2 3 2v-4"/></svg>
          <span><strong>{t('members.notes')}:</strong> {direction === 'rtl'
            ? 'بعد الحفظ هيظهر إيصال — اختار "طباعة" أو "إرسال واتساب" أو اقفله'
            : 'After saving, a receipt popup appears — choose Print, WhatsApp, or close it'}</span>
        </p>
      </div>
    </form>

    {/* Receipt popup — يظهر بعد إنشاء عضو + إيصال بدل الطباعة التلقائية */}
    {receiptPopup && (
      <ReceiptToPrint
        receiptNumber={receiptPopup.receiptNumber}
        type="Member"
        amount={receiptPopup.amount}
        details={receiptPopup.details}
        date={receiptPopup.date}
        paymentMethod={receiptPopup.paymentMethod}
        onClose={() => {
          setReceiptPopup(null)
          onSuccess()
        }}
      />
    )}
    </>
  )
}
