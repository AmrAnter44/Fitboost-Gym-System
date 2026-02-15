'use client'

import { useState, useRef, useEffect } from 'react'
import PaymentMethodSelector from '../components/Paymentmethodselector'
import CoachSelector from './CoachSelector'
import ImageUpload from './ImageUpload'
import { calculateDaysBetween, formatDateYMD } from '../lib/dateFormatter'
import { printReceiptFromData } from '../lib/printSystem'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'
import type { PaymentMethod } from '../lib/paymentHelpers'
import { serializePaymentMethods } from '../lib/paymentHelpers'

interface MemberFormProps {
  onSuccess: () => void
  customCreatedAt?: Date | null
}

export default function MemberForm({ onSuccess, customCreatedAt }: MemberFormProps) {
  const { user } = usePermissions()
  const { t, direction } = useLanguage()
  const toast = useToast()
  const { settings } = useServiceSettings()
  const [loading, setLoading] = useState(false)
  const [nextMemberNumber, setNextMemberNumber] = useState<number | null>(null)
  const [nextReceiptNumber, setNextReceiptNumber] = useState<number | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [idCardFrontPreview, setIdCardFrontPreview] = useState<string>('')
  const [idCardBackPreview, setIdCardBackPreview] = useState<string>('')
  const [offers, setOffers] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    memberNumber: '',
    name: '',
    phone: '',
    backupPhone: '',
    nationalId: '',
    birthDate: '',
    source: '',
    profileImage: '',
    idCardFront: '',
    idCardBack: '',
    inBodyScans: 0,
    invitations: 0,
    freePTSessions: 0,
    remainingFreezeDays: 0,
    subscriptionPrice: 0,
    notes: '',
    startDate: formatDateYMD(new Date()),
    expiryDate: '',
    paymentMethod: 'cash' as string | PaymentMethod[],
    staffName: user?.name || '',
    isOther: false,
    skipReceipt: false,  // ✅ خيار عدم إنشاء إيصال
    coachId: null as string | null  // 👨‍🏫 معرف الكوتش
  })

  useEffect(() => {
    const fetchNextNumber = async () => {
      try {
        const response = await fetch('/api/members/next-number')
        const data = await response.json()

        console.log('📊 استجابة API:', data)

        if (data.nextNumber !== undefined && data.nextNumber !== null) {
          setNextMemberNumber(data.nextNumber)
          setFormData(prev => ({ ...prev, memberNumber: data.nextNumber.toString() }))
        } else {
          console.warn('⚠️ لم يتم إرجاع nextNumber، استخدام 1001')
          setNextMemberNumber(1001)
          setFormData(prev => ({ ...prev, memberNumber: '1001' }))
        }
      } catch (error) {
        console.error('❌ خطأ في جلب رقم العضوية:', error)
        setNextMemberNumber(1001)
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
        console.error('❌ خطأ في جلب رقم الإيصال:', error)
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
          console.warn('⚠️ البيانات المستلمة ليست array:', data)
          setOffers([])
        }
      } catch (error) {
        console.error('❌ خطأ في جلب العروض:', error)
        setOffers([])
      }
    }

    fetchNextNumber()
    fetchNextReceiptNumber()
    fetchOffers()
  }, [])

  useEffect(() => {
    if (user && !formData.staffName) {
      setFormData(prev => ({ ...prev, staffName: user.name }))
    }
  }, [user])

  const handleOtherChange = (checked: boolean) => {
    console.log('🔄 تغيير Other:', checked)
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

    const cleanedData = {
      ...formData,
      isOther: formData.isOther,
      memberNumber: formData.isOther
        ? null
        : (formData.memberNumber ? parseInt(formData.memberNumber) : nextMemberNumber),
      inBodyScans: parseInt(formData.inBodyScans.toString()),
      invitations: parseInt(formData.invitations.toString()),
      freePTSessions: parseInt(formData.freePTSessions.toString()),
      remainingFreezeDays: parseInt(formData.remainingFreezeDays.toString()),
      subscriptionPrice: parseInt(formData.subscriptionPrice.toString()),
      staffName: user?.name || '',
      customCreatedAt: customCreatedAt ? customCreatedAt.toISOString() : null,
      coachId: formData.coachId  // 👨‍🏫 إرسال معرف الكوتش
    }

    console.log('📤 إرسال البيانات:', {
      isOther: cleanedData.isOther,
      memberNumber: cleanedData.memberNumber,
      coachId: cleanedData.coachId  // 👨‍🏫 معرف الكوتش
    })

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
          console.log('🖨️ طباعة الإيصال باستخدام النظام الموحد...')
          
          setTimeout(() => {
            const subscriptionDays = formData.startDate && formData.expiryDate
              ? calculateDaysBetween(formData.startDate, formData.expiryDate)
              : null

            const paidAmount = cleanedData.subscriptionPrice

            // تحويل paymentMethod إلى string للطباعة
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
              paidAmount: paidAmount,
              remainingAmount: 0,
              inBodyScans: cleanedData.inBodyScans,
              invitations: cleanedData.invitations,
              freePTSessions: cleanedData.freePTSessions,
              paymentMethod: paymentMethodStr,
              staffName: formData.staffName
            }

            printReceiptFromData(
              data.receipt.receiptNumber,
              'Member',
              cleanedData.subscriptionPrice,
              receiptDetails,
              new Date(data.receipt.createdAt),
              paymentMethodStr
            )
          }, 500)
        }
        
        // تحديث رقم الإيصال التالي
        const receiptResponse = await fetch('/api/receipts/next-number')
        const receiptData = await receiptResponse.json()
        if (receiptData.nextNumber) {
          setNextReceiptNumber(receiptData.nextNumber)
        }

        setTimeout(() => {
          onSuccess()
        }, 2000)
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

    setFormData(prev => ({
      ...prev,
      subscriptionPrice: offer.price,
      freePTSessions: offer.freePTSessions,
      inBodyScans: offer.inBodyScans,
      invitations: offer.invitations,
      remainingFreezeDays: offer.freezeDays,
      startDate,
      expiryDate: formatDateYMD(expiryDate)
    }))

    toast.success(t('members.form.offerApplied', { offerName: offer.name }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" dir={direction}>
      {/* قسم العروض */}
      <div className="bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/30 dark:to-primary-900/30 border-2 border-primary-200 dark:border-primary-700 rounded-xl p-4">
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-primary-800 dark:text-primary-200">
          <span>🎁</span>
          <span>{t('members.form.availableOffers')}</span>
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">{t('members.form.selectOfferToAutoFill')}</p>

        {!Array.isArray(offers) || offers.length === 0 ? (
          <div className="text-center py-4 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
            <p className="text-gray-500 dark:text-gray-400 text-xs">{t('members.form.noOffersAvailable')}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('members.form.adminCanAddOffers')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {offers.map(offer => (
              <button
                key={offer.id}
                type="button"
                onClick={() => applyOffer(offer)}
                className="bg-white dark:bg-gray-800 border-2 border-primary-300 dark:border-primary-700 hover:border-primary-500 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-xl p-3 transition transform hover:scale-105 hover:shadow-lg group"
              >
                <div className="text-2xl mb-1">{offer.icon}</div>
                <div className="font-bold text-primary-800 dark:text-primary-200 mb-1 text-sm">{offer.name}</div>
                <div className="text-xl font-bold text-green-600 dark:text-green-400 mb-1">{offer.price} ج.م</div>
                <div className="text-xs text-gray-600 dark:text-gray-300 space-y-0.5">
                  <div>💪 {offer.freePTSessions} PT</div>
                  <div>⚖️ {offer.inBodyScans} InBody</div>
                  <div>🎟️ {offer.invitations} دعوات</div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 bg-primary-100 dark:bg-primary-900/30 border-r-4 border-primary-500 dark:border-primary-700 p-2 rounded">
          <p className="text-xs text-primary-800 dark:text-primary-300">
            <strong>💡 {t('members.notes')}:</strong> {t('members.form.noteCanEditAfterOffer')}
          </p>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-lg p-3">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <span>👤</span>
          <span>{t('members.form.basicInformation')}</span>
        </h3>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium">
              {t('members.membershipNumber')} {!formData.isOther && '*'}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isOther}
                onChange={(e) => handleOtherChange(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{t('members.form.otherNoNumber')}</span>
            </label>
          </div>

          {formData.isOther ? (
            <div className="w-full px-3 py-2 border-2 border-dashed rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-center">
              {t('members.form.noMembershipNumber')}
            </div>
          ) : (
            <input
              type="number"
              required={!formData.isOther}
              value={formData.memberNumber}
              onChange={(e) => setFormData({ ...formData, memberNumber: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              placeholder="مثال: 1001"
              disabled={formData.isOther}
            />
          )}

          {!formData.isOther && nextMemberNumber && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              💡 {t('members.form.suggestedNextNumber', { number: nextMemberNumber.toString() })}
            </p>
          )}
        </div>

        {nextReceiptNumber && (
          <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700 rounded-lg p-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🧾</span>
              <div>
                <p className="text-xs font-medium text-green-800 dark:text-green-300">{t('members.form.nextReceiptNumber')}</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">#{nextReceiptNumber}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">{t('members.form.nameRequired')}</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
              placeholder="أحمد محمد"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">{t('members.form.phoneRequired')}</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
              placeholder="01234567890"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">{t('members.form.backupPhoneOptional')}</label>
            <input
              type="tel"
              value={formData.backupPhone}
              onChange={(e) => setFormData({ ...formData, backupPhone: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
              placeholder="01234567890"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">{t('members.form.nationalIdOptional')}</label>
            <input
              type="text"
              value={formData.nationalId}
              onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
              placeholder="29512345678901"
              dir="ltr"
              maxLength={14}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">{t('members.form.birthDateOptional')}</label>
            <input
              type="date"
              value={formData.birthDate}
              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">{t('members.form.sourceOptional')}</label>
            <select
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
            >
              <option value="">{t('members.form.selectSource')}</option>
              <option value="facebook">{t('members.form.sourceFacebook')}</option>
              <option value="instagram">{t('members.form.sourceInstagram')}</option>
              <option value="tiktok">{t('members.form.sourceTiktok')}</option>
              <option value="google_maps">{t('members.form.sourceGoogleMaps')}</option>
              <option value="friend_referral">{t('members.form.sourceFriendReferral')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">{t('members.form.staffNameRequired')}</label>
            <input
              type="text"
              required
              value={formData.staffName}
              readOnly
              className="w-full px-3 py-2 border-2 rounded-lg bg-gray-100 dark:bg-gray-700 cursor-not-allowed text-sm"
              placeholder="محمد علي"
            />
          </div>
        </div>
      </div>

      {/* 👨‍🏫 اختيار الكوتش */}
      <CoachSelector
        value={formData.coachId}
        onChange={(coachId) => setFormData({ ...formData, coachId })}
        required={false}
      />

      <div className="bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-200 dark:border-primary-700 rounded-lg p-3">
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
      <div className="bg-secondary-50 dark:bg-gray-700 border-2 border-secondary-300 dark:border-gray-600 rounded-lg p-4">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <span>🪪</span>
          <span>{t('members.form.idCardImagesOptional')}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* الوجه الأمامي */}
          <div className="bg-white dark:bg-gray-800 border-2 border-secondary-200 dark:border-gray-600 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🆔</span>
              <span className="font-bold text-sm text-secondary-800 dark:text-gray-200">{t('members.form.idCardFront')}</span>
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
          <div className="bg-white dark:bg-gray-800 border-2 border-secondary-200 dark:border-gray-600 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🔄</span>
              <span className="font-bold text-sm text-secondary-800 dark:text-gray-200">{t('members.form.idCardBack')}</span>
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
        <div className="mt-3 bg-secondary-100 dark:bg-gray-800 border-l-4 border-secondary-500 dark:border-gray-600 p-2 rounded">
          <p className="text-xs text-secondary-900 dark:text-gray-300">{t('members.form.idCardNote')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

      <div className="bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-200 dark:border-primary-700 rounded-lg p-3">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <span>📅</span>
          <span>{t('members.form.subscriptionPeriod')}</span>
        </h3>

        <div className="grid grid-cols-1 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium mb-1">
              {t('members.startDate')} <span className="text-xs text-gray-500 dark:text-gray-400">(yyyy-mm-dd)</span>
            </label>
            <input
              type="text"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm dark:bg-gray-700 dark:text-white"
              placeholder="2025-11-18"
              pattern="\d{4}-\d{2}-\d{2}"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              {t('members.expiryDate')} <span className="text-xs text-gray-500 dark:text-gray-400">(yyyy-mm-dd)</span>
            </label>
            <input
              type="text"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm dark:bg-gray-700 dark:text-white"
              placeholder="2025-12-18"
              pattern="\d{4}-\d{2}-\d{2}"
            />
          </div>
        </div>

        <div className="mb-2">
          <p className="text-xs font-medium mb-2">⚡ {t('members.form.quickAdd')}:</p>
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 6, 9, 12].map(months => (
              <button
                key={months}
                type="button"
                onClick={() => calculateExpiryFromMonths(months)}
                className="px-2 py-1 bg-primary-100 dark:bg-primary-900/40 hover:bg-primary-200 dark:hover:bg-primary-800/50 text-primary-800 dark:text-primary-300 rounded-lg text-xs transition"
              >
                + {months} {months === 1 ? t('members.form.month') : t('members.form.months')}
              </button>
            ))}
          </div>
        </div>

        {duration !== null && (
          <div className="bg-white dark:bg-gray-800 border-2 border-primary-300 dark:border-primary-700 rounded-lg p-2">
            <p className="text-xs">
              <span className="font-medium">📊 {t('members.form.subscriptionDuration')}: </span>
              <span className="font-bold text-primary-600 dark:text-primary-400">
                {duration} {t('members.form.daysSingle')}
                {duration >= 30 && ` (${Math.floor(duration / 30)} ${Math.floor(duration / 30) === 1 ? t('members.form.month') : t('members.form.months')})`}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700 rounded-lg p-3">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <span>🎁</span>
          <span>{t('members.form.additionalServices')}</span>
        </h3>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">⚖️ InBody</label>
            <input
              type="number"
              min="0"
              value={formData.inBodyScans}
              onChange={(e) => setFormData({ ...formData, inBodyScans: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">🎟️ {t('members.invitations')}</label>
            <input
              type="number"
              min="0"
              value={formData.invitations}
              onChange={(e) => setFormData({ ...formData, invitations: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">💪 {t('members.freePTSessions')}</label>
            <input
              type="number"
              min="0"
              value={formData.freePTSessions}
              onChange={(e) => setFormData({ ...formData, freePTSessions: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">❄️ أيام الفريز</label>
            <input
              type="number"
              min="0"
              value={formData.remainingFreezeDays}
              onChange={(e) => setFormData({ ...formData, remainingFreezeDays: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      </div>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <span>💰</span>
          <span>{t('members.form.financialInformation')}</span>
        </h3>

        <div className="mb-2">
          <label className="block text-xs font-medium mb-1">{t('members.form.subscriptionPriceRequired')}</label>
          <input
            type="number"
            required
            min="0"
            value={formData.subscriptionPrice}
            onChange={(e) => setFormData({ ...formData, subscriptionPrice: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
            placeholder="0"
          />
        </div>

        <div className="bg-white dark:bg-gray-800 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg p-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium">{t('members.form.paidAmount')}:</span>
            <span className="font-bold text-green-600 dark:text-green-400">
              {paidAmount} {t('members.egp')}
            </span>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs font-medium mb-2">{t('members.paymentMethod')}</label>
          <PaymentMethodSelector
            value={formData.paymentMethod}
            onChange={(method) => setFormData({
              ...formData,
              paymentMethod: method
            })}
            allowMultiple={true}
            totalAmount={paidAmount}
            memberPoints={0}
            pointsValueInEGP={settings.pointsValueInEGP}
            pointsEnabled={settings.pointsEnabled}
          />
        </div>

        {/* ✅ خيار عدم إنشاء إيصال */}
        <div className="mt-3">
          <label className="flex items-center gap-2 cursor-pointer bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg p-2">
            <input
              type="checkbox"
              checked={formData.skipReceipt}
              onChange={(e) => setFormData({ ...formData, skipReceipt: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-xs font-bold text-yellow-800 dark:text-yellow-300">
              🚫 {t('members.form.skipReceiptAdminOnly')}
            </span>
          </label>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-lg p-3">
        <label className="block text-xs font-medium mb-2">📝 {t('members.notes')}</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
          rows={2}
          placeholder={`${t('members.notes')}...`}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-green-600 dark:bg-green-700 text-white py-3 rounded-lg hover:bg-green-700 dark:hover:bg-green-800 disabled:bg-gray-400 font-bold transition"
        >
          {loading ? `⏳ ${t('members.form.saving')}` : `✅ ${t('members.form.saveMember')}`}
        </button>
      </div>

      <div className="bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-300 dark:border-primary-700 rounded-lg p-3 text-center">
        <p className="text-xs text-primary-800 dark:text-primary-300">
          🖨️ <strong>{t('members.notes')}:</strong> {t('members.form.receiptWillPrintAutomatically')}
        </p>
      </div>
    </form>
  )
}
