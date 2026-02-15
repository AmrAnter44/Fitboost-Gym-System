'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ReceiptToPrint } from '../components/ReceiptToPrint'
import PaymentMethodSelector from './Paymentmethodselector'
import { formatDateYMD, calculateRemainingDays } from '../lib/dateFormatter'
import ImageUpload from '../components/ImageUpload'
import BarcodeWhatsApp from '../components/BarcodeWhatsApp'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import type { PaymentMethod } from '../lib/paymentHelpers'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'

interface Member {
  id: string
  memberNumber: number
  name: string
  phone: string
  profileImage?: string | null
  inBodyScans: number
  invitations: number
  freePTSessions?: number
  remainingFreezeDays: number
  subscriptionPrice: number
  remainingAmount: number
  points?: number
  notes?: string
  isActive: boolean
  startDate?: string
  expiryDate?: string
  createdAt: string
}

export default function MemberDetailPage() {
  const params = useParams()
  const router = useRouter()
  const memberId = params.id as string
  const { t, locale } = useLanguage()
  const toast = useToast()
  const { settings } = useServiceSettings()

  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<any>(null)

  const [paymentData, setPaymentData] = useState<{
    amount: number
    paymentMethod: string | PaymentMethod[]
    notes: string
  }>({
    amount: 0,
    paymentMethod: 'cash',
    notes: ''
  })

  const [freezeData, setFreezeData] = useState({
    days: 0,
    reason: ''
  })

  const [editData, setEditData] = useState({
    name: '',
    phone: '',
    subscriptionPrice: 0,
    startDate: '',
    expiryDate: '',
    inBodyScans: 0,
    invitations: 0,
    freePTSessions: 0,
    remainingFreezeDays: 0,
    notes: ''
  })

  const [activeModal, setActiveModal] = useState<string | null>(null)

  const fetchMember = async () => {
    try {
      const response = await fetch('/api/members')
      const members = await response.json()
      const foundMember = members.find((m: Member) => m.id === memberId)
      
      if (foundMember) {
        setMember(foundMember)
      } else {
        toast.error(t('memberDetails.memberNotFound'))
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error(t('memberDetails.errorLoadingData'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMember()
  }, [memberId])

  const handlePayment = async () => {
    if (!member || paymentData.amount <= 0) {
      toast.error(t('memberDetails.paymentModal.enterValidAmount'))
      return
    }

    if (paymentData.amount > member.remainingAmount) {
      toast.error(t('memberDetails.paymentModal.amountExceedsRemaining'))
      return
    }

    setLoading(true)

    try {
      const newRemaining = member.remainingAmount - paymentData.amount

      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          remainingAmount: newRemaining
        })
      })

      if (response.ok) {
        const receiptResponse = await fetch('/api/receipts/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: member.id,
            amount: paymentData.amount,
            paymentMethod: paymentData.paymentMethod,
            notes: paymentData.notes
          })
        })

        if (receiptResponse.ok) {
          const receipt = await receiptResponse.json()
          setReceiptData({
            receiptNumber: receipt.receiptNumber,
            type: 'Payment',
            amount: receipt.amount,
            details: JSON.parse(receipt.itemDetails),
            date: new Date(receipt.createdAt),
            paymentMethod: paymentData.paymentMethod
          })
          setShowReceipt(true)
        }

        toast.success(t('memberDetails.paymentModal.paymentSuccess'))

        setPaymentData({ amount: 0, paymentMethod: 'cash', notes: '' })
        setActiveModal(null)
        fetchMember()
      } else {
        toast.error(t('memberDetails.paymentModal.paymentFailed'))
      }
    } catch (error) {
      console.error(error)
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleUseInBody = async () => {
    if (!member || member.inBodyScans <= 0) {
      toast.error(t('memberDetails.noInBodySessionsRemaining'))
      return
    }

    if (!confirm(t('memberDetails.confirmUseInBody'))) return

    setLoading(true)
    try {
      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          inBodyScans: member.inBodyScans - 1
        })
      })

      if (response.ok) {
        toast.success(t('memberDetails.inBodyUsed'))
        fetchMember()
      }
    } catch (error) {
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleUseInvitation = async () => {
    if (!member || member.invitations <= 0) {
      toast.error(t('memberDetails.noInvitationsRemaining'))
      return
    }

    if (!confirm(t('memberDetails.confirmUseInvitation'))) return

    setLoading(true)
    try {
      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          invitations: member.invitations - 1
        })
      })

      if (response.ok) {
        toast.success(t('memberDetails.invitationUsed'))
        fetchMember()
      }
    } catch (error) {
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleUseFreePT = async () => {
    if (!member || member.freePTSessions <= 0) {
      toast.error(t('memberDetails.noFreePTRemaining'))
      return
    }

    if (!confirm(t('memberDetails.confirmUseFreePT'))) return

    setLoading(true)
    try {
      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          freePTSessions: member.freePTSessions - 1
        })
      })

      if (response.ok) {
        toast.success(t('memberDetails.freePTUsed'))
        fetchMember()
      }
    } catch (error) {
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleFreeze = async () => {
    if (!member || !member.expiryDate || freezeData.days <= 0) {
      toast.error(t('memberDetails.freezeModal.enterValidDays'))
      return
    }

    // التحقق من رصيد الفريز الكافي
    if (freezeData.days > member.remainingFreezeDays) {
      toast.error(`رصيد الفريز غير كافٍ. المتاح: ${member.remainingFreezeDays} يوم، المطلوب: ${freezeData.days} يوم`)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/members/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          freezeDays: freezeData.days
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(`تم تجميد الاشتراك لمدة ${freezeData.days} يوم بنجاح`)

        setFreezeData({ days: 0, reason: '' })
        setActiveModal(null)
        fetchMember()
      } else {
        toast.error(result.error || 'فشل التجميد')
      }
    } catch (error) {
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async () => {
    if (!member || !editData.name || !editData.phone) {
      toast.error('يرجى إدخال الاسم ورقم الهاتف')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          name: editData.name,
          phone: editData.phone,
          subscriptionPrice: parseInt(editData.subscriptionPrice.toString()),
          startDate: editData.startDate,
          expiryDate: editData.expiryDate,
          inBodyScans: parseInt(editData.inBodyScans.toString()),
          invitations: parseInt(editData.invitations.toString()),
          freePTSessions: parseInt(editData.freePTSessions.toString()),
          remainingFreezeDays: parseInt(editData.remainingFreezeDays.toString()),
          notes: editData.notes
        })
      })

      if (response.ok) {
        toast.success('تم تحديث البيانات بنجاح!')
        setActiveModal(null)
        fetchMember()
      } else {
        toast.error('فشل تحديث البيانات')
      }
    } catch (error) {
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  if (loading && !member) {
    return (
      <div className="container mx-auto p-6 text-center" dir="rtl">
        <div className="text-6xl mb-4">⏳</div>
        <p className="text-xl">{t('memberDetails.loading')}</p>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="container mx-auto p-6 text-center" dir="rtl">
        <div className="text-6xl mb-4">❌</div>
        <p className="text-xl mb-4">{t('memberDetails.memberNotFound')}</p>
        <button
          onClick={() => router.push('/members')}
          className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
        >
          {t('memberDetails.backToMembers')}
        </button>
      </div>
    )
  }

  const isExpired = member.expiryDate ? new Date(member.expiryDate) < new Date() : false
  const daysRemaining = calculateRemainingDays(member.expiryDate)

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">👤 {t('memberDetails.title')}</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">{t('memberDetails.subtitle')}</p>
        </div>
        <button
          onClick={() => router.push('/members')}
          className="bg-gray-200 text-gray-700 dark:text-gray-200 px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-300 text-sm sm:text-base w-full sm:w-auto"
        >
          ← {t('memberDetails.back')}
        </button>
      </div>

      <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-6 pb-6 border-b border-white border-opacity-20">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-white dark:bg-gray-800 bg-opacity-20 flex-shrink-0">
            {member.profileImage ? (
              <img
                src={member.profileImage}
                alt={member.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                <svg className="w-12 h-12 sm:w-16 sm:h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-right">
            <p className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">{t('memberDetails.membershipNumber')}</p>
            <p className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-4">#{member.memberNumber}</p>
            <p className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">{t('memberDetails.memberName')}</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold">{member.name}</p>
          </div>

          <div className="text-center sm:text-left">
            <p className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">{t('memberDetails.phoneNumber')}</p>
            <p className="text-lg sm:text-xl md:text-2xl font-mono">{member.phone}</p>
          </div>

          {(member as any).backupPhone && (
            <div className="text-center sm:text-left">
              <p className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">{t('memberDetails.backupPhone')}</p>
              <p className="text-lg sm:text-xl md:text-2xl font-mono">{(member as any).backupPhone}</p>
            </div>
          )}

          {(member as any).nationalId && (
            <div className="text-center sm:text-left">
              <p className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">{t('memberDetails.nationalId')}</p>
              <p className="text-lg sm:text-xl md:text-2xl font-mono">{(member as any).nationalId}</p>
            </div>
          )}

          {(member as any).birthDate && (
            <div className="text-center sm:text-left">
              <p className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">{t('memberDetails.birthDate')}</p>
              <p className="text-lg sm:text-xl md:text-2xl font-mono">
                {new Date((member as any).birthDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
              </p>
            </div>
          )}

          {(member as any).source && (
            <div className="text-center sm:text-left">
              <p className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">{t('memberDetails.memberSource')}</p>
              <p className="text-lg sm:text-xl md:text-2xl">
                {(() => {
                  const sourcesAr: { [key: string]: string } = {
                    'facebook': 'فيسبوك',
                    'instagram': 'انستجرام',
                    'tiktok': 'تيك توك',
                    'google_maps': 'خرائط جوجل',
                    'friend_referral': 'إحالة من صديق'
                  }
                  const sourcesEn: { [key: string]: string } = {
                    'facebook': 'Facebook',
                    'instagram': 'Instagram',
                    'tiktok': 'TikTok',
                    'google_maps': 'Google Maps',
                    'friend_referral': 'Friend Referral'
                  }
                  const sources = locale === 'ar' ? sourcesAr : sourcesEn
                  return sources[(member as any).source] || (member as any).source
                })()}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
          <div className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm opacity-90">{t('memberDetails.status')}</p>
            <p className="text-base sm:text-lg font-bold">
              {member.isActive && !isExpired ? `✅ ${t('memberDetails.active')}` : `❌ ${t('memberDetails.expired')}`}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm opacity-90">{t('memberDetails.expiryDate')}</p>
            <p className="text-sm sm:text-base md:text-lg font-mono">
              {formatDateYMD(member.expiryDate)}
            </p>
            {daysRemaining !== null && daysRemaining > 0 && (
              <p className="text-xs opacity-75 mt-1">{t('memberDetails.daysRemaining', { days: daysRemaining.toString() })}</p>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm opacity-90">❄️ أيام الفريز</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-cyan-300">{member.remainingFreezeDays}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm opacity-90">{t('memberDetails.subscriptionPrice')}</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold">{member.subscriptionPrice} {t('members.egp')}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm opacity-90">{t('memberDetails.remainingAmount')}</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-300">{member.remainingAmount} {t('members.egp')}</p>
          </div>
        </div>
      </div>

      {/* ✅ إضافة Barcode WhatsApp Component */}
      <div className="mb-6">
        <BarcodeWhatsApp
          memberNumber={member.memberNumber}
          memberName={member.name}
          memberPhone={member.phone}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="bg-primary-100 p-2 sm:p-3 rounded-full">
              <span className="text-2xl sm:text-3xl">📷</span>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold">{t('memberDetails.editImage')}</h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{t('memberDetails.editMemberImage')}</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('edit-image')}
            disabled={loading}
            className="w-full bg-primary-600 text-white py-2.5 sm:py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-sm sm:text-base"
          >
            📷 {t('memberDetails.editImage')}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="bg-primary-100 p-2 sm:p-3 rounded-full">
              <span className="text-2xl sm:text-3xl">✏️</span>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold">تعديل البيانات</h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">تعديل جميع بيانات العضو</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditData({
                name: member.name,
                phone: member.phone,
                subscriptionPrice: member.subscriptionPrice,
                startDate: formatDateYMD(member.startDate),
                expiryDate: formatDateYMD(member.expiryDate),
                inBodyScans: member.inBodyScans,
                invitations: member.invitations,
                freePTSessions: member.freePTSessions || 0,
                remainingFreezeDays: member.remainingFreezeDays,
                notes: member.notes || ''
              })
              setActiveModal('edit')
            }}
            disabled={loading}
            className="w-full bg-primary-600 text-white py-2.5 sm:py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-sm sm:text-base"
          >
            ✏️ تعديل البيانات
          </button>
        </div>
      </div>

      {activeModal === 'edit-image' && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null)
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">📷 {t('memberDetails.editMemberImage')}</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none"
                type="button"
              >
                ×
              </button>
            </div>

            <ImageUpload
              currentImage={member.profileImage}
              onImageChange={async (url) => {
                try {
                  const response = await fetch('/api/members', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      id: member.id,
                      profileImage: url
                    })
                  })

                  if (response.ok) {
                    toast.success(t('memberDetails.imageUpdatedSuccessfully'))
                    setActiveModal(null)
                    fetchMember()
                  }
                } catch (error) {
                  toast.error(t('memberDetails.failedToUpdateImage'))
                }
              }}
              disabled={loading}
            />

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full mt-4 bg-gray-200 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border-r-4 border-green-500">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">InBody</p>
              <p className="text-3xl sm:text-4xl font-bold text-green-600">{member.inBodyScans}</p>
            </div>
            <div className="text-4xl sm:text-5xl">⚖️</div>
          </div>
          <button
            onClick={handleUseInBody}
            disabled={member.inBodyScans <= 0 || loading}
            className="w-full bg-green-600 text-white py-2 sm:py-2.5 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            استخدام حصة
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border-r-4 border-primary-500">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">الدعوات</p>
              <p className="text-3xl sm:text-4xl font-bold text-primary-600">{member.invitations}</p>
            </div>
            <div className="text-4xl sm:text-5xl">🎟️</div>
          </div>
          <button
            onClick={handleUseInvitation}
            disabled={member.invitations <= 0 || loading}
            className="w-full bg-primary-600 text-white py-2 sm:py-2.5 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            استخدام دعوة
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border-r-4 border-orange-500">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">حصص PT مجانية</p>
              <p className="text-3xl sm:text-4xl font-bold text-orange-600">{member.freePTSessions}</p>
            </div>
            <div className="text-4xl sm:text-5xl">💪</div>
          </div>
          <button
            onClick={handleUseFreePT}
            disabled={member.freePTSessions <= 0 || loading}
            className="w-full bg-orange-600 text-white py-2 sm:py-2.5 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            استخدام حصة
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border-r-4 border-cyan-500">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">أيام الفريز</p>
              <p className="text-3xl sm:text-4xl font-bold text-cyan-600">{member.remainingFreezeDays}</p>
            </div>
            <div className="text-4xl sm:text-5xl">❄️</div>
          </div>
          <button
            onClick={() => setActiveModal('freeze')}
            disabled={!member.expiryDate || loading || member.remainingFreezeDays <= 0}
            className="w-full bg-cyan-600 text-white py-2 sm:py-2.5 rounded-lg hover:bg-cyan-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            تجميد الاشتراك
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 mb-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="bg-green-100 p-2 sm:p-3 rounded-full">
            <span className="text-2xl sm:text-3xl">💰</span>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold">دفع المبلغ المتبقي</h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">المتبقي: {member.remainingAmount} ج.م</p>
          </div>
        </div>
        <button
          onClick={() => setActiveModal('payment')}
          disabled={member.remainingAmount <= 0 || loading}
          className="w-full bg-green-600 text-white py-2.5 sm:py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-sm sm:text-base"
        >
          دفع مبلغ
        </button>
      </div>

      {activeModal === 'payment' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">💰 دفع المبلغ المتبقي</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl"
              >
                ×
              </button>
            </div>

            <div className="bg-yellow-50 border-r-4 border-yellow-500 p-4 rounded-lg mb-6">
              <p className="font-bold text-yellow-800">
                المبلغ المتبقي: {member.remainingAmount} ج.م
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  المبلغ المدفوع <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                  max={member.remainingAmount}
                  className="w-full px-4 py-3 border-2 rounded-lg text-xl"
                  placeholder="0"
                />
              </div>

              <div className="bg-gradient-to-br from-green-50 to-primary-50 border-2 border-green-200 rounded-xl p-5">
                <PaymentMethodSelector
                  value={paymentData.paymentMethod}
                  onChange={(method) => setPaymentData({ ...paymentData, paymentMethod: method })}
                  allowMultiple={true}
                  totalAmount={paymentData.amount}
                  required
                  memberPoints={member.points || 0}
                  pointsValueInEGP={settings.pointsValueInEGP}
                  pointsEnabled={settings.pointsEnabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">ملاحظات</label>
                <textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  className="w-full px-4 py-3 border-2 rounded-lg"
                  rows={3}
                  placeholder="ملاحظات إضافية..."
                />
              </div>

              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                <div className="flex justify-between text-lg">
                  <span>المتبقي بعد الدفع:</span>
                  <span className="font-bold text-green-600">
                    {(member.remainingAmount - paymentData.amount).toFixed(0)} ج.م
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handlePayment}
                  disabled={loading || paymentData.amount <= 0}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-bold"
                >
                  {loading ? 'جاري المعالجة...' : '✅ تأكيد الدفع'}
                </button>
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-6 bg-gray-200 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'freeze' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">❄️ تجميد الاشتراك</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl"
              >
                ×
              </button>
            </div>

            <div className="bg-cyan-50 border-r-4 border-cyan-500 p-4 rounded-lg mb-4">
              <p className="text-sm text-cyan-800 mb-2">
                ❄️ أيام الفريز المتاحة: <strong className="text-xl">{member.remainingFreezeDays} يوم</strong>
              </p>
              <p className="text-xs text-cyan-600">يمكنك استخدام أيام الفريز على دفعات</p>
            </div>

            <div className="bg-primary-50 border-r-4 border-primary-500 p-4 rounded-lg mb-6">
              <p className="text-sm text-primary-800 mb-2">
                تاريخ الانتهاء الحالي: <strong>{formatDateYMD(member.expiryDate)}</strong>
              </p>
              {daysRemaining !== null && (
                <p className="text-sm text-primary-800">
                  الأيام المتبقية: <strong>{daysRemaining > 0 ? daysRemaining : 0} يوم</strong>
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  عدد أيام التجميد <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={freezeData.days}
                  onChange={(e) => setFreezeData({ ...freezeData, days: parseInt(e.target.value) || 0 })}
                  min="1"
                  max={member.remainingFreezeDays}
                  className="w-full px-4 py-3 border-2 rounded-lg text-xl"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  يمكنك تجميد حتى {member.remainingFreezeDays} يوم
                </p>
              </div>

              {freezeData.days > 0 && member.expiryDate && (
                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                  <p className="text-sm text-green-800 mb-2">
                    📅 التاريخ الجديد للانتهاء:
                  </p>
                  <p className="text-xl font-bold text-green-600">
                    {formatDateYMD(new Date(new Date(member.expiryDate).getTime() + freezeData.days * 24 * 60 * 60 * 1000))}
                  </p>
                  <div className="mt-3 pt-3 border-t border-green-300">
                    <p className="text-xs text-green-700">
                      ✅ سيتم تجميد الاشتراك لمدة {freezeData.days} يوم
                    </p>
                    <p className="text-xs text-green-700">
                      ❄️ الرصيد المتبقي: {member.remainingFreezeDays - freezeData.days} يوم
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleFreeze}
                  disabled={loading || freezeData.days <= 0 || freezeData.days > member.remainingFreezeDays}
                  className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 font-bold"
                >
                  {loading ? 'جاري المعالجة...' : '✅ تأكيد التجميد'}
                </button>
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-6 bg-gray-200 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'edit' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-1">
          <div className="bg-white dark:bg-gray-800 rounded shadow-2xl max-w-[99vw] w-full p-1.5">
            <div className="flex justify-between items-center mb-0.5 bg-white dark:bg-gray-800 pb-0.5 border-b">
              <h3 className="text-xs font-bold">✏️ #{member.memberNumber}</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-lg leading-none">×</button>
            </div>

            <div className="grid grid-cols-5 md:grid-cols-10 gap-1">
              <div>
                <label className="block text-[8px] mb-0">الاسم</label>
                <input type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full px-1 py-0.5 border rounded text-[10px]" />
              </div>

              <div>
                <label className="block text-[8px] mb-0">الهاتف</label>
                <input type="text" value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="w-full px-1 py-0.5 border rounded text-[10px]" />
              </div>

              <div>
                <label className="block text-[8px] mb-0">السعر</label>
                <input type="number" value={editData.subscriptionPrice} onChange={(e) => setEditData({ ...editData, subscriptionPrice: parseInt(e.target.value) || 0 })}
                  className="w-full px-1 py-0.5 border rounded text-[10px]" min="0" />
              </div>

              <div>
                <label className="block text-[8px] mb-0">البداية</label>
                <input type="date" value={editData.startDate} onChange={(e) => setEditData({ ...editData, startDate: e.target.value })}
                  className="w-full px-1 py-0.5 border rounded text-[10px]" />
              </div>

              <div>
                <label className="block text-[8px] mb-0">الانتهاء</label>
                <input type="date" value={editData.expiryDate} onChange={(e) => setEditData({ ...editData, expiryDate: e.target.value })}
                  className="w-full px-1 py-0.5 border rounded text-[10px]" />
              </div>

              <div>
                <label className="block text-[8px] mb-0">❄️ فريز</label>
                <input type="number" value={editData.remainingFreezeDays} onChange={(e) => setEditData({ ...editData, remainingFreezeDays: parseInt(e.target.value) || 0 })}
                  className="w-full px-1 py-0.5 border rounded text-[10px]" min="0" />
              </div>

              <div>
                <label className="block text-[8px] mb-0">⚖️ InBody</label>
                <input type="number" value={editData.inBodyScans} onChange={(e) => setEditData({ ...editData, inBodyScans: parseInt(e.target.value) || 0 })}
                  className="w-full px-1 py-0.5 border rounded text-[10px]" min="0" />
              </div>

              <div>
                <label className="block text-[8px] mb-0">🎟️ دعوات</label>
                <input type="number" value={editData.invitations} onChange={(e) => setEditData({ ...editData, invitations: parseInt(e.target.value) || 0 })}
                  className="w-full px-1 py-0.5 border rounded text-[10px]" min="0" />
              </div>

              <div>
                <label className="block text-[8px] mb-0">💪 PT</label>
                <input type="number" value={editData.freePTSessions} onChange={(e) => setEditData({ ...editData, freePTSessions: parseInt(e.target.value) || 0 })}
                  className="w-full px-1 py-0.5 border rounded text-[10px]" min="0" />
              </div>

              <div>
                <label className="block text-[8px] mb-0">📝 ملاحظات</label>
                <input type="text" value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  className="w-full px-1 py-0.5 border rounded text-[10px]" />
              </div>
            </div>

            <div className="flex gap-1 mt-1 pt-1 border-t bg-white dark:bg-gray-800">
              <button onClick={handleEdit} disabled={loading || !editData.name || !editData.phone}
                className="flex-1 bg-primary-600 text-white py-1 rounded hover:bg-primary-700 disabled:bg-gray-400 font-bold text-[10px]">
                {loading ? 'حفظ...' : '✅ حفظ'}
              </button>
              <button onClick={() => setActiveModal(null)} className="px-2 bg-gray-200 text-gray-700 dark:text-gray-200 py-1 rounded hover:bg-gray-300 text-[10px]">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {showReceipt && receiptData && (
        <ReceiptToPrint
          receiptNumber={receiptData.receiptNumber}
          type={receiptData.type}
          amount={receiptData.amount}
          details={receiptData.details}
          date={receiptData.date}
          paymentMethod={receiptData.paymentMethod}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  )
}