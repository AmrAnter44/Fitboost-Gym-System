'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ReceiptToPrint } from '../components/ReceiptToPrint'
import PaymentMethodSelector from './Paymentmethodselector'
import { formatDateYMD, calculateRemainingDays } from '../lib/dateFormatter'
import ImageUpload from '../components/ImageUpload'
import BarcodeWhatsApp from '../components/BarcodeWhatsApp'
import { LoadingScreen } from '../components/Spinner'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import type { PaymentMethod } from '../lib/paymentHelpers'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Member {
  id: string
  memberNumber: string
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
  const queryClient = useQueryClient()

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
      const response = await fetch('/api/members/pay-remaining', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          amount: paymentData.amount,
          paymentMethod: paymentData.paymentMethod,
          notes: paymentData.notes,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        if (data.receipt) {
          setReceiptData({
            receiptNumber: data.receipt.receiptNumber,
            type: 'Payment',
            amount: data.receipt.amount,
            details: JSON.parse(data.receipt.itemDetails),
            date: new Date(data.receipt.createdAt),
            paymentMethod: paymentData.paymentMethod,
          })
          setShowReceipt(true)
          queryClient.invalidateQueries({ queryKey: ['receipts'] })
        }

        toast.success(t('memberDetails.paymentModal.paymentSuccess'))
        setPaymentData({ amount: 0, paymentMethod: 'cash', notes: '' })
        setActiveModal(null)
        fetchMember()
      } else {
        toast.error(data.error || t('memberDetails.paymentModal.paymentFailed'))
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
    return <LoadingScreen message={t('memberDetails.loading')} />
  }

  if (!member) {
    return (
      <div className="container mx-auto p-6 text-center" dir="rtl">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
          <svg className="w-8 h-8" {...stroke}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-xl mb-4 text-gray-900 dark:text-gray-100">{t('memberDetails.memberNotFound')}</p>
        <button
          onClick={() => router.push('/members')}
          className="bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-6 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('memberDetails.title')}</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{t('memberDetails.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/members')}
          className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 sm:px-6 py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 text-sm sm:text-base w-full sm:w-auto justify-center font-bold"
        >
          <svg className="w-4 h-4" {...stroke}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
          {t('memberDetails.back')}
        </button>
      </div>

      <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-primary-contrast rounded-2xl shadow-lg ring-1 ring-primary-700/20 p-4 sm:p-6 md:p-8 mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-6 pb-6 border-b border-gray-900/15">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden ring-2 ring-white/70 shadow-md bg-white/20 flex-shrink-0">
            {member.profileImage ? (
              <img
                src={member.profileImage}
                alt={member.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-900/80">
                <svg className="w-12 h-12 sm:w-16 sm:h-16" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-start">
            <p className="text-xs sm:text-sm opacity-80 mb-1 sm:mb-2">{t('memberDetails.membershipNumber')}</p>
            <p className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-4">#{member.memberNumber}</p>
            <p className="text-xs sm:text-sm opacity-80 mb-1 sm:mb-2">{t('memberDetails.memberName')}</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold">{member.name}</p>
          </div>

          <div className="text-center sm:text-end">
            <p className="text-xs sm:text-sm opacity-80 mb-1 sm:mb-2">{t('memberDetails.phoneNumber')}</p>
            <p className="text-lg sm:text-xl md:text-2xl font-mono">{member.phone}</p>
          </div>

          {(member as any).backupPhone && (
            <div className="text-center sm:text-end">
              <p className="text-xs sm:text-sm opacity-80 mb-1 sm:mb-2">{t('memberDetails.backupPhone')}</p>
              <p className="text-lg sm:text-xl md:text-2xl font-mono">{(member as any).backupPhone}</p>
            </div>
          )}

          {(member as any).nationalId && (
            <div className="text-center sm:text-end">
              <p className="text-xs sm:text-sm opacity-80 mb-1 sm:mb-2">{t('memberDetails.nationalId')}</p>
              <p className="text-lg sm:text-xl md:text-2xl font-mono">{(member as any).nationalId}</p>
            </div>
          )}

          {(member as any).birthDate && (
            <div className="text-center sm:text-end">
              <p className="text-xs sm:text-sm opacity-80 mb-1 sm:mb-2">{t('memberDetails.birthDate')}</p>
              <p className="text-lg sm:text-xl md:text-2xl font-mono">
                {new Date((member as any).birthDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
              </p>
            </div>
          )}

          {(member as any).source && (
            <div className="text-center sm:text-end">
              <p className="text-xs sm:text-sm opacity-80 mb-1 sm:mb-2">{t('memberDetails.memberSource')}</p>
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
          <div className="bg-white/20 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm opacity-80">{t('memberDetails.status')}</p>
            <p className="text-base sm:text-lg font-bold inline-flex items-center gap-1.5 mt-1">
              {member.isActive && !isExpired ? (
                <>
                  <svg className="w-4 h-4" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('memberDetails.active')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('memberDetails.expired')}
                </>
              )}
            </p>
          </div>
          <div className="bg-white/20 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm opacity-80">{t('memberDetails.expiryDate')}</p>
            <p className="text-sm sm:text-base md:text-lg font-mono">
              {formatDateYMD(member.expiryDate)}
            </p>
            {daysRemaining !== null && daysRemaining > 0 && (
              <p className="text-xs opacity-75 mt-1">{t('memberDetails.daysRemaining', { days: daysRemaining.toString() })}</p>
            )}
          </div>
          <div className="bg-white/20 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm opacity-80 inline-flex items-center gap-1">
              <svg className="w-3.5 h-3.5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M5.636 18.364L18.364 5.636" />
              </svg>
              أيام الفريز
            </p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold">{member.remainingFreezeDays}</p>
          </div>
          <div className="bg-white/20 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm opacity-80">{t('memberDetails.subscriptionPrice')}</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold">{member.subscriptionPrice} {t('members.egp')}</p>
          </div>
          <div className="bg-white/20 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm opacity-80">{t('memberDetails.remainingAmount')}</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold">{member.remainingAmount} {t('members.egp')}</p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <BarcodeWhatsApp
          memberNumber={member.memberNumber}
          memberName={member.name}
          memberPhone={member.phone}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">{t('memberDetails.editImage')}</h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{t('memberDetails.editMemberImage')}</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('edit-image')}
            disabled={loading}
            className="w-full bg-primary-500 hover:bg-primary-600 text-primary-contrast py-2.5 sm:py-3 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed font-bold text-sm sm:text-base transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            {t('memberDetails.editImage')}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">تعديل البيانات</h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">تعديل جميع بيانات العضو</p>
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
            className="w-full bg-primary-500 hover:bg-primary-600 text-primary-contrast py-2.5 sm:py-3 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed font-bold text-sm sm:text-base transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            تعديل البيانات
          </button>
        </div>
      </div>

      {activeModal === 'edit-image' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-image-title"
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null)
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 id="edit-image-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('memberDetails.editMemberImage')}</h3>
              <button
                onClick={() => setActiveModal(null)}
                aria-label={t('common.close')}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200"
                type="button"
              >
                <svg className="w-6 h-6" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
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
              className="w-full mt-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 font-bold"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm font-bold uppercase tracking-wider">InBody</p>
              <p className="text-3xl sm:text-4xl font-bold text-green-600 dark:text-green-400">{member.inBodyScans}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
          </div>
          <button
            onClick={handleUseInBody}
            disabled={member.inBodyScans <= 0 || loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 sm:py-2.5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed text-sm sm:text-base font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            استخدام حصة
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm font-bold uppercase tracking-wider">الدعوات</p>
              <p className="text-3xl sm:text-4xl font-bold text-primary-700 dark:text-primary-400">{member.invitations}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
          </div>
          <button
            onClick={handleUseInvitation}
            disabled={member.invitations <= 0 || loading}
            className="w-full bg-primary-500 hover:bg-primary-600 text-primary-contrast py-2 sm:py-2.5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed text-sm sm:text-base font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            استخدام دعوة
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm font-bold uppercase tracking-wider">حصص PT مجانية</p>
              <p className="text-3xl sm:text-4xl font-bold text-orange-600 dark:text-orange-400">{member.freePTSessions}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <button
            onClick={handleUseFreePT}
            disabled={member.freePTSessions <= 0 || loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 sm:py-2.5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed text-sm sm:text-base font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            استخدام حصة
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm font-bold uppercase tracking-wider">أيام الفريز</p>
              <p className="text-3xl sm:text-4xl font-bold text-cyan-600 dark:text-cyan-400">{member.remainingFreezeDays}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M5.636 18.364L18.364 5.636" />
              </svg>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('freeze')}
            disabled={!member.expiryDate || loading || member.remainingFreezeDays <= 0}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2 sm:py-2.5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed text-sm sm:text-base font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            تجميد الاشتراك
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">دفع المبلغ المتبقي</h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">المتبقي: {member.remainingAmount} ج.م</p>
          </div>
        </div>
        <button
          onClick={() => setActiveModal('payment')}
          disabled={member.remainingAmount <= 0 || loading}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 sm:py-3 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed font-bold text-sm sm:text-base transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
        >
          دفع مبلغ
        </button>
      </div>

      {activeModal === 'payment' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-title"
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 id="payment-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100 inline-flex items-center gap-2">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                دفع المبلغ المتبقي
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                aria-label="إغلاق"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200"
              >
                <svg className="w-6 h-6" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 p-4 rounded-lg mb-6">
              <p className="font-bold text-amber-800 dark:text-amber-300">
                المبلغ المتبقي: {member.remainingAmount} ج.م
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  المبلغ المدفوع <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                  max={member.remainingAmount}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xl placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  placeholder="0"
                />
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 rounded-xl p-5">
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
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">ملاحظات</label>
                <textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  rows={3}
                  placeholder="ملاحظات إضافية..."
                />
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 rounded-lg p-4">
                <div className="flex justify-between text-lg text-gray-700 dark:text-gray-200">
                  <span>المتبقي بعد الدفع:</span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    {(member.remainingAmount - paymentData.amount).toFixed(0)} ج.م
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handlePayment}
                  disabled={loading || paymentData.amount <= 0}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                >
                  {loading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" {...stroke}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      جاري المعالجة...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" {...stroke}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      تأكيد الدفع
                    </>
                  )}
                </button>
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-6 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 font-bold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'freeze' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="freeze-title"
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 id="freeze-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100 inline-flex items-center gap-2">
                <svg className="w-6 h-6 text-cyan-600 dark:text-cyan-400" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M5.636 18.364L18.364 5.636" />
                </svg>
                تجميد الاشتراك
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                aria-label="إغلاق"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200"
              >
                <svg className="w-6 h-6" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-cyan-50 dark:bg-cyan-900/20 ring-1 ring-cyan-200 dark:ring-cyan-900/50 p-4 rounded-lg mb-4">
              <p className="text-sm text-cyan-800 dark:text-cyan-200 mb-2 inline-flex items-center gap-1.5">
                <svg className="w-4 h-4" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M5.636 18.364L18.364 5.636" />
                </svg>
                أيام الفريز المتاحة: <strong className="text-xl">{member.remainingFreezeDays} يوم</strong>
              </p>
              <p className="text-xs text-cyan-700 dark:text-cyan-400">يمكنك استخدام أيام الفريز على دفعات</p>
            </div>

            <div className="bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-900/50 p-4 rounded-lg mb-6">
              <p className="text-sm text-primary-800 dark:text-primary-200 mb-2">
                تاريخ الانتهاء الحالي: <strong>{formatDateYMD(member.expiryDate)}</strong>
              </p>
              {daysRemaining !== null && (
                <p className="text-sm text-primary-800 dark:text-primary-200">
                  الأيام المتبقية: <strong>{daysRemaining > 0 ? daysRemaining : 0} يوم</strong>
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  عدد أيام التجميد <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={freezeData.days}
                  onChange={(e) => setFreezeData({ ...freezeData, days: parseInt(e.target.value) || 0 })}
                  min="1"
                  max={member.remainingFreezeDays}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xl placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  placeholder="0"
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  يمكنك تجميد حتى {member.remainingFreezeDays} يوم
                </p>
              </div>

              {freezeData.days > 0 && member.expiryDate && (
                <div className="bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 rounded-lg p-4">
                  <p className="text-sm text-green-800 dark:text-green-200 mb-2 inline-flex items-center gap-1.5">
                    <svg className="w-4 h-4" {...stroke}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    التاريخ الجديد للانتهاء:
                  </p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatDateYMD(new Date(new Date(member.expiryDate).getTime() + freezeData.days * 24 * 60 * 60 * 1000))}
                  </p>
                  <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-900/50 space-y-1">
                    <p className="text-xs text-green-700 dark:text-green-300 inline-flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" {...stroke}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      سيتم تجميد الاشتراك لمدة {freezeData.days} يوم
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 inline-flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" {...stroke}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M5.636 18.364L18.364 5.636" />
                      </svg>
                      الرصيد المتبقي: {member.remainingFreezeDays - freezeData.days} يوم
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleFreeze}
                  disabled={loading || freezeData.days <= 0 || freezeData.days > member.remainingFreezeDays}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast py-3 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                >
                  {loading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" {...stroke}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      جاري المعالجة...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" {...stroke}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      تأكيد التجميد
                    </>
                  )}
                </button>
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-6 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 font-bold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'edit' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-member-title"
          className="fixed inset-0 z-[10000] flex items-center justify-center p-1 bg-slate-950/60 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-gray-800 rounded-md shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-[99vw] w-full p-1.5">
            <div className="flex justify-between items-center mb-0.5 bg-white dark:bg-gray-800 pb-0.5 border-b border-gray-200 dark:border-gray-700">
              <h3 id="edit-member-title" className="text-xs font-bold text-gray-900 dark:text-gray-100">#{member.memberNumber}</h3>
              <button
                onClick={() => setActiveModal(null)}
                aria-label="إغلاق"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200"
              >
                <svg className="w-4 h-4" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-5 md:grid-cols-10 gap-1">
              <div>
                <label className="block text-[8px] mb-0 text-gray-700 dark:text-gray-300 font-bold">الاسم</label>
                <input type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-[10px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>

              <div>
                <label className="block text-[8px] mb-0 text-gray-700 dark:text-gray-300 font-bold">الهاتف</label>
                <input type="text" value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="w-full px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-[10px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>

              <div>
                <label className="block text-[8px] mb-0 text-gray-700 dark:text-gray-300 font-bold">السعر</label>
                <input type="number" value={editData.subscriptionPrice} onChange={(e) => setEditData({ ...editData, subscriptionPrice: parseInt(e.target.value) || 0 })}
                  className="w-full px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-[10px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500" min="0" />
              </div>

              <div>
                <label className="block text-[8px] mb-0 text-gray-700 dark:text-gray-300 font-bold">البداية</label>
                <input type="date" value={editData.startDate} onChange={(e) => setEditData({ ...editData, startDate: e.target.value })}
                  className="w-full px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-[10px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>

              <div>
                <label className="block text-[8px] mb-0 text-gray-700 dark:text-gray-300 font-bold">الانتهاء</label>
                <input type="date" value={editData.expiryDate} onChange={(e) => setEditData({ ...editData, expiryDate: e.target.value })}
                  className="w-full px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-[10px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>

              <div>
                <label className="block text-[8px] mb-0 text-gray-700 dark:text-gray-300 font-bold">فريز</label>
                <input type="number" value={editData.remainingFreezeDays} onChange={(e) => setEditData({ ...editData, remainingFreezeDays: parseInt(e.target.value) || 0 })}
                  className="w-full px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-[10px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500" min="0" />
              </div>

              <div>
                <label className="block text-[8px] mb-0 text-gray-700 dark:text-gray-300 font-bold">InBody</label>
                <input type="number" value={editData.inBodyScans} onChange={(e) => setEditData({ ...editData, inBodyScans: parseInt(e.target.value) || 0 })}
                  className="w-full px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-[10px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500" min="0" />
              </div>

              <div>
                <label className="block text-[8px] mb-0 text-gray-700 dark:text-gray-300 font-bold">دعوات</label>
                <input type="number" value={editData.invitations} onChange={(e) => setEditData({ ...editData, invitations: parseInt(e.target.value) || 0 })}
                  className="w-full px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-[10px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500" min="0" />
              </div>

              <div>
                <label className="block text-[8px] mb-0 text-gray-700 dark:text-gray-300 font-bold">PT</label>
                <input type="number" value={editData.freePTSessions} onChange={(e) => setEditData({ ...editData, freePTSessions: parseInt(e.target.value) || 0 })}
                  className="w-full px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-[10px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500" min="0" />
              </div>

              <div>
                <label className="block text-[8px] mb-0 text-gray-700 dark:text-gray-300 font-bold">ملاحظات</label>
                <input type="text" value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  className="w-full px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-[10px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
            </div>

            <div className="flex gap-1 mt-1 pt-1 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <button onClick={handleEdit} disabled={loading || !editData.name || !editData.phone}
                className="flex-1 bg-primary-500 hover:bg-primary-600 text-primary-contrast py-1 rounded disabled:opacity-60 disabled:cursor-not-allowed font-bold text-[10px] transition-colors duration-200">
                {loading ? 'حفظ...' : 'حفظ'}
              </button>
              <button onClick={() => setActiveModal(null)} className="px-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-[10px] font-bold transition-colors duration-200">
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
