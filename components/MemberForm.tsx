'use client'

import { useState, useRef, useEffect } from 'react'
import PaymentMethodSelector from '../components/Paymentmethodselector'
import CoachSelector from './CoachSelector'
import { calculateDaysBetween, formatDateYMD } from '../lib/dateFormatter'
import { printReceiptFromData } from '../lib/printSystem'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '../contexts/LanguageContext'

interface MemberFormProps {
  onSuccess: () => void
  customCreatedAt?: Date | null
}

export default function MemberForm({ onSuccess, customCreatedAt }: MemberFormProps) {
  const { user } = usePermissions()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [nextMemberNumber, setNextMemberNumber] = useState<number | null>(null)
  const [nextReceiptNumber, setNextReceiptNumber] = useState<number | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [offers, setOffers] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    memberNumber: '',
    name: '',
    phone: '',
    profileImage: '',
    inBodyScans: 0,
    invitations: 0,
    freePTSessions: 0,
    remainingFreezeDays: 0,
    subscriptionPrice: 0,
    notes: '',
    startDate: formatDateYMD(new Date()),
    expiryDate: '',
    paymentMethod: 'cash' as 'cash' | 'visa' | 'instapay' | 'wallet',
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
        setMessage(`⚠️ ${t('members.form.errorFetchingNumber')}`)
        setTimeout(() => setMessage(''), 3000)
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
      setMessage(`❌ ${t('members.form.selectImageOnly')}`)
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage(`❌ ${t('members.form.imageSizeTooLarge')}`)
      return
    }

    try {
      setMessage(`🔄 ${t('members.form.compressingImage')}`)
      const compressedBase64 = await compressImage(file)
      setImagePreview(compressedBase64)
      setFormData(prev => ({ ...prev, profileImage: compressedBase64 }))
      setMessage('')
    } catch (error) {
      console.error('خطأ في ضغط الصورة:', error)
      setMessage(`❌ ${t('members.form.imageCompressionFailed')}`)
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
    setMessage('')

    if (formData.startDate && formData.expiryDate) {
      const start = new Date(formData.startDate)
      const end = new Date(formData.expiryDate)

      if (end <= start) {
        setMessage(`❌ ${t('members.form.expiryMustBeAfterStart')}`)
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
          setMessage(`✅ ${t('members.form.memberAddedWithoutReceipt')}`)
        } else {
          setMessage(`✅ ${t('members.form.memberAddedSuccessfully')}`)
        }

        if (data.receipt) {
          console.log('🖨️ طباعة الإيصال باستخدام النظام الموحد...')
          
          setTimeout(() => {
            const subscriptionDays = formData.startDate && formData.expiryDate
              ? calculateDaysBetween(formData.startDate, formData.expiryDate)
              : null

            const paidAmount = cleanedData.subscriptionPrice

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
              paymentMethod: formData.paymentMethod,
              staffName: formData.staffName
            }

            printReceiptFromData(
              data.receipt.receiptNumber,
              'Member',
              cleanedData.subscriptionPrice,
              receiptDetails,
              new Date(data.receipt.createdAt),
              formData.paymentMethod
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
        setMessage(`❌ ${data.error || t('common.error')}`)
      }
    } catch (error) {
      setMessage(`❌ ${t('members.form.errorConnection')}`)
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

    setMessage(`✅ ${t('members.form.offerApplied', { offerName: offer.name })}`)
    setTimeout(() => setMessage(''), 2000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {message && (
        <div className={`p-3 rounded-lg text-center font-medium text-sm ${
          message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* قسم العروض */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-4">
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-purple-800">
          <span>🎁</span>
          <span>{t('members.form.availableOffers')}</span>
        </h3>
        <p className="text-xs text-gray-600 mb-3">{t('members.form.selectOfferToAutoFill')}</p>

        {!Array.isArray(offers) || offers.length === 0 ? (
          <div className="text-center py-4 bg-white rounded-xl border-2 border-dashed border-gray-300">
            <p className="text-gray-500 text-xs">{t('members.form.noOffersAvailable')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('members.form.adminCanAddOffers')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {offers.map(offer => (
              <button
                key={offer.id}
                type="button"
                onClick={() => applyOffer(offer)}
                className="bg-white border-2 border-purple-300 hover:border-purple-500 hover:bg-purple-50 rounded-xl p-3 transition transform hover:scale-105 hover:shadow-lg group"
              >
                <div className="text-2xl mb-1">{offer.icon}</div>
                <div className="font-bold text-purple-800 mb-1 text-sm">{offer.name}</div>
                <div className="text-xl font-bold text-green-600 mb-1">{offer.price} ج.م</div>
                <div className="text-xs text-gray-600 space-y-0.5">
                  <div>💪 {offer.freePTSessions} PT</div>
                  <div>⚖️ {offer.inBodyScans} InBody</div>
                  <div>🎟️ {offer.invitations} دعوات</div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 bg-blue-100 border-r-4 border-blue-500 p-2 rounded">
          <p className="text-xs text-blue-800">
            <strong>💡 {t('members.notes')}:</strong> {t('members.form.noteCanEditAfterOffer')}
          </p>
        </div>
      </div>

      <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-3">
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
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-xs font-medium text-gray-700">{t('members.form.otherNoNumber')}</span>
            </label>
          </div>

          {formData.isOther ? (
            <div className="w-full px-3 py-2 border-2 border-dashed rounded-lg bg-gray-100 text-gray-500 text-center">
              {t('members.form.noMembershipNumber')}
            </div>
          ) : (
            <input
              type="number"
              required={!formData.isOther}
              value={formData.memberNumber}
              onChange={(e) => setFormData({ ...formData, memberNumber: e.target.value })}
              className="w-full px-3 py-2 border-2 rounded-lg"
              placeholder="مثال: 1001"
              disabled={formData.isOther}
            />
          )}

          {!formData.isOther && nextMemberNumber && (
            <p className="text-xs text-gray-500 mt-1">
              💡 {t('members.form.suggestedNextNumber', { number: nextMemberNumber.toString() })}
            </p>
          )}
        </div>

        {nextReceiptNumber && (
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🧾</span>
              <div>
                <p className="text-xs font-medium text-green-800">{t('members.form.nextReceiptNumber')}</p>
                <p className="text-xl font-bold text-green-600">#{nextReceiptNumber}</p>
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
              className="w-full px-3 py-2 border-2 rounded-lg text-sm"
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
              className="w-full px-3 py-2 border-2 rounded-lg text-sm"
              placeholder="01234567890"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">{t('members.form.staffNameRequired')}</label>
            <input
              type="text"
              required
              value={formData.staffName}
              readOnly
              className="w-full px-3 py-2 border-2 rounded-lg bg-gray-100 cursor-not-allowed text-sm"
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

      <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-3">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <span>📷</span>
          <span>{t('members.form.profilePicture')}</span>
        </h3>

        <div className="flex flex-col items-center gap-4">
          {imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-32 h-32 rounded-full object-cover border-4 border-purple-400"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="w-32 h-32 rounded-full border-4 border-dashed border-purple-300 flex items-center justify-center bg-purple-100">
              <span className="text-4xl text-purple-400">👤</span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
            id="profileImage"
          />
          
          <label
            htmlFor="profileImage"
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer transition"
          >
            {imagePreview ? `📷 ${t('members.form.changeImage')}` : `📷 ${t('members.form.uploadImage')}`}
          </label>

          <p className="text-xs text-gray-500 text-center">
            {t('members.form.imageSizeRecommendation')}<br/>
            {t('members.form.maxImageSize')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <span>📅</span>
          <span>{t('members.form.subscriptionPeriod')}</span>
        </h3>

        <div className="grid grid-cols-1 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium mb-1">
              {t('members.startDate')} <span className="text-xs text-gray-500">(yyyy-mm-dd)</span>
            </label>
            <input
              type="text"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-3 py-2 border-2 rounded-lg font-mono text-sm"
              placeholder="2025-11-18"
              pattern="\d{4}-\d{2}-\d{2}"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              {t('members.expiryDate')} <span className="text-xs text-gray-500">(yyyy-mm-dd)</span>
            </label>
            <input
              type="text"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              className="w-full px-3 py-2 border-2 rounded-lg font-mono text-sm"
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
                className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-xs transition"
              >
                + {months} {months === 1 ? t('members.form.month') : t('members.form.months')}
              </button>
            ))}
          </div>
        </div>

        {duration !== null && (
          <div className="bg-white border-2 border-blue-300 rounded-lg p-2">
            <p className="text-xs">
              <span className="font-medium">📊 {t('members.form.subscriptionDuration')}: </span>
              <span className="font-bold text-blue-600">
                {duration} {t('members.form.daysSingle')}
                {duration >= 30 && ` (${Math.floor(duration / 30)} ${Math.floor(duration / 30) === 1 ? t('members.form.month') : t('members.form.months')})`}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3">
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
              className="w-full px-3 py-2 border-2 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">🎟️ {t('members.invitations')}</label>
            <input
              type="number"
              min="0"
              value={formData.invitations}
              onChange={(e) => setFormData({ ...formData, invitations: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border-2 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">💪 {t('members.freePTSessions')}</label>
            <input
              type="number"
              min="0"
              value={formData.freePTSessions}
              onChange={(e) => setFormData({ ...formData, freePTSessions: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border-2 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">❄️ أيام الفريز</label>
            <input
              type="number"
              min="0"
              value={formData.remainingFreezeDays}
              onChange={(e) => setFormData({ ...formData, remainingFreezeDays: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border-2 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>
      </div>

      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3">
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
            className="w-full px-3 py-2 border-2 rounded-lg text-sm"
            placeholder="0"
          />
        </div>

        <div className="bg-white border-2 border-yellow-300 rounded-lg p-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium">{t('members.form.paidAmount')}:</span>
            <span className="font-bold text-green-600">
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
              paymentMethod: method as 'cash' | 'visa' | 'instapay' | 'wallet'
            })}
          />
        </div>

        {/* ✅ خيار عدم إنشاء إيصال */}
        <div className="mt-3">
          <label className="flex items-center gap-2 cursor-pointer bg-yellow-50 border-2 border-yellow-300 rounded-lg p-2">
            <input
              type="checkbox"
              checked={formData.skipReceipt}
              onChange={(e) => setFormData({ ...formData, skipReceipt: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-xs font-bold text-yellow-800">
              🚫 {t('members.form.skipReceiptAdminOnly')}
            </span>
          </label>
        </div>
      </div>

      <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-3">
        <label className="block text-xs font-medium mb-2">📝 {t('members.notes')}</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border-2 rounded-lg text-sm"
          rows={2}
          placeholder={`${t('members.notes')}...`}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-bold transition"
        >
          {loading ? `⏳ ${t('members.form.saving')}` : `✅ ${t('members.form.saveMember')}`}
        </button>
      </div>

      <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3 text-center">
        <p className="text-xs text-blue-800">
          🖨️ <strong>{t('members.notes')}:</strong> {t('members.form.receiptWillPrintAutomatically')}
        </p>
      </div>
    </form>
  )
}
