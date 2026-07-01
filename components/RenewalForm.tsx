'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import PaymentMethodSelector from './Paymentmethodselector'
import ReceiptSuccessModal from './ReceiptSuccessModal'
import { calculateDaysBetween, formatDateYMD } from '../lib/dateFormatter'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '@/contexts/LanguageContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'
import type { PaymentMethod } from '../lib/paymentHelpers'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Member {
  id: string
  memberNumber: string
  name: string
  phone: string
  inBodyScans: number
  invitations: number
  freePTSessions?: number
  subscriptionPrice: number
  remainingAmount: number
  remainingFreezeDays?: number
  points?: number
  notes?: string
  isActive: boolean
  startDate?: string
  expiryDate?: string
  createdAt: string
}

interface Receipt {
  receiptNumber: number
  amount: number
  paymentMethod: string
  createdAt: string
  itemDetails: {
    memberNumber?: string
    memberName?: string
    subscriptionPrice?: number
    paidAmount?: number
    remainingAmount?: number
    freePTSessions?: number
    inBodyScans?: number
    invitations?: number
    startDate?: string
    expiryDate?: string
    subscriptionDays?: number
    staffName?: string
    [key: string]: any
  }
}

interface RenewalFormProps {
  member: Member
  onSuccess: (receipt?: Receipt) => void
  onClose: () => void
}

export default function RenewalForm({ member, onSuccess, onClose }: RenewalFormProps) {
  const { user } = usePermissions()
  const { t, direction } = useLanguage()
  const { settings } = useServiceSettings()
  const queryClient = useQueryClient()
  const [subscriptionPrice, setSubscriptionPrice] = useState('')
  const [freePTSessions, setFreePTSessions] = useState('0')
  const [freeNutritionSessions, setFreeNutritionSessions] = useState('0')
  const [freePhysioSessions, setFreePhysioSessions] = useState('0')
  const [freeGroupClassSessions, setFreeGroupClassSessions] = useState('0')
  const [inBodyScans, setInBodyScans] = useState('0')
  const [invitations, setInvitations] = useState('0')
  const [freezeDays, setFreezeDays] = useState('0')
  const [startDate, setStartDate] = useState(formatDateYMD(new Date()))
  const [expiryDate, setExpiryDate] = useState('')
  const [notes, setNotes] = useState(member.notes || '')
  const [source, setSource] = useState((member as any).source || '') // مصدر العضو (يتحدّث عند التجديد)
  const [paymentMethod, setPaymentMethod] = useState<string | PaymentMethod[]>('cash')
  const [staffName, setStaffName] = useState(user?.name || '')
  const [remainingAmount, setRemainingAmount] = useState('0')
  const [remainingDueDate, setRemainingDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [offers, setOffers] = useState<any[]>([])
  const [successMessage, setSuccessMessage] = useState('')
  const [createdReceipt, setCreatedReceipt] = useState<any>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  //  وضع المزايا: false = تجميع (افتراضي، عادل للعميل) | true = ريست (يبتدي من الصفر)
  const [resetBenefits, setResetBenefits] = useState(false)

  //  حساب الأيام المتبقية في الاشتراك القديم (لو لسه فيه)
  // لما العضو يجدد قبل ما اشتراكه ينتهي، الأيام دي بتتضاف على مدة الاشتراك الجديد
  const remainingDaysFromOldSub = (() => {
    if (!member.expiryDate) return 0
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const oldExpiry = new Date(member.expiryDate); oldExpiry.setHours(0, 0, 0, 0)
    const diff = Math.ceil((oldExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff)
  })()

  useEffect(() => {
    if (user && !staffName) {
      setStaffName(user.name)
    }
  }, [user])

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const response = await fetch('/api/offers?activeOnly=true')
        const data = await response.json()
        if (Array.isArray(data)) {
          setOffers(data)
        } else {
          setOffers([])
        }
      } catch (error) {
        console.error('Error fetching offers:', error)
        setOffers([])
      }
    }

    fetchOffers()
  }, [])

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0
    return calculateDaysBetween(start, end)
  }

  const calculateExpiryFromMonths = (months: number) => {
    if (!startDate) return

    const start = new Date(startDate)
    const expiry = new Date(start)
    expiry.setMonth(expiry.getMonth() + months)
    //  ضيف الأيام المتبقية من الاشتراك القديم
    if (remainingDaysFromOldSub > 0) {
      expiry.setDate(expiry.getDate() + remainingDaysFromOldSub)
    }

    setExpiryDate(formatDateYMD(expiry))
  }

  const applyOffer = (offer: any) => {
    const start = startDate || formatDateYMD(new Date())
    const expiry = new Date(start)
    //  ضيف مدة الباقة + الأيام المتبقية من الاشتراك القديم
    expiry.setDate(expiry.getDate() + offer.duration + remainingDaysFromOldSub)

    setSubscriptionPrice(offer.price.toString())
    setFreePTSessions(offer.freePTSessions.toString())
    setFreeNutritionSessions((offer.freeNutritionSessions || 0).toString())
    setFreePhysioSessions((offer.freePhysioSessions || 0).toString())
    setFreeGroupClassSessions((offer.freeGroupClassSessions || 0).toString())
    setInBodyScans(offer.inBodyScans.toString())
    setInvitations(offer.invitations.toString())
    setFreezeDays(offer.freezeDays.toString())
    setStartDate(start)
    setExpiryDate(formatDateYMD(expiry))
    setSelectedOfferId(offer.id)

    setSuccessMessage(t('renewal.offerApplied', { offerName: offer.name }))
    setTimeout(() => setSuccessMessage(''), 2000)
  }

  const handleRenewal = async () => {
    if (!subscriptionPrice || parseInt(subscriptionPrice) <= 0) {
      setError(t('renewal.errors.invalidPrice'))
      return
    }

    if (!startDate || !expiryDate) {
      setError(t('renewal.errors.missingDates'))
      return
    }

    if (new Date(expiryDate) <= new Date(startDate)) {
      setError(t('renewal.errors.invalidDateRange'))
      return
    }

    setLoading(true)
    setError('')

    try {

      const response = await fetch('/api/members/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          subscriptionPrice: parseInt(subscriptionPrice),
          remainingAmount: parseInt(remainingAmount) || 0,
          remainingDueDate: remainingDueDate || null,
          freePTSessions: parseInt(freePTSessions) || 0,
          freeNutritionSessions: parseInt(freeNutritionSessions) || 0,
          freePhysioSessions: parseInt(freePhysioSessions) || 0,
          freeGroupClassSessions: parseInt(freeGroupClassSessions) || 0,
          inBodyScans: parseInt(inBodyScans) || 0,
          invitations: parseInt(invitations) || 0,
          remainingFreezeDays: parseInt(freezeDays) || 0,
          startDate,
          expiryDate,
          notes,
          source: source || null,
          paymentMethod,
          staffName: user?.name || '',
          offerId: selectedOfferId,
          //  وضع المزايا: لو true → الـ API يـ reset، لو false → بيجمع القديم + الجديد
          resetBenefits,
        })
      })

      if (response.ok) {
        const data = await response.json()


        if (data.receipt) {
          queryClient.invalidateQueries({ queryKey: ['receipts'] })
          try {
            const receiptResponse = await fetch(`/api/receipts/${data.receipt.id}`)
            if (receiptResponse.ok) {
              const receiptData = await receiptResponse.json()
              setCreatedReceipt(receiptData)
              setShowSuccessModal(true)
            } else {
              onSuccess(data.receipt)
            }
          } catch (err) {
            console.error('Error fetching receipt:', err)
            onSuccess(data.receipt)
          }
        } else {
          onSuccess()
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || t('renewal.errors.renewalFailed'))
      }
    } catch (error) {
      console.error('Error in renewal:', error)
      setError(t('renewal.errors.unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  const duration = calculateDays(startDate, expiryDate)
  const totalAmount = subscriptionPrice ? parseInt(subscriptionPrice) : 0
  //  لو resetBenefits ON، الـ total = اللي بيجي مع الباقة فقط
  //  لو OFF (default)، الـ total = القديم + اللي بيجي مع الباقة
  const totalSessions = resetBenefits
    ? (parseInt(freePTSessions) || 0)
    : (member.freePTSessions || 0) + (parseInt(freePTSessions) || 0)

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="renewal-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg ring-1 ring-gray-200 dark:ring-gray-700 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir={direction}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h3 id="renewal-title" className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg className="w-7 h-7 text-primary-500" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>{t('renewal.title')}</span>
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-300 rounded-lg p-1 transition-colors duration-200"
            type="button"
            aria-label={t('renewal.cancel')}
          >
            <svg className="w-6 h-6" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
        {successMessage && (
          <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 p-3 rounded-lg text-center font-medium text-sm mb-4">
            {successMessage}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-primary-200 dark:ring-primary-900/50 p-5 mb-4">
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-primary-800 dark:text-primary-300">
            <svg className="w-6 h-6" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            <span>{t('renewal.availableOffers')}</span>
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">{t('renewal.selectOfferToAutoFill')}</p>

          {!Array.isArray(offers) || offers.length === 0 ? (
            <div className="text-center py-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl ring-1 ring-dashed ring-gray-300 dark:ring-gray-600">
              <p className="text-gray-500 dark:text-gray-400 text-xs">{t('renewal.noOffersAvailable')}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('renewal.adminCanAddOffers')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {offers.map(offer => (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => applyOffer(offer)}
                  className="bg-white dark:bg-gray-800 ring-1 ring-primary-300 dark:ring-primary-900/50 hover:ring-primary-500 dark:hover:ring-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl p-3 transition-colors duration-200"
                >
                  <svg className="w-7 h-7 mx-auto mb-1 text-primary-600 dark:text-primary-400" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                  <div className="font-bold text-primary-800 dark:text-primary-200 mb-1 text-sm">{offer.name}</div>
                  <div className="text-xl font-bold text-green-600 dark:text-green-400 mb-1">{offer.price} {t('renewal.currency')}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                    <div>PT: {offer.freePTSessions}</div>
                    <div>InBody: {offer.inBodyScans}</div>
                    <div>{t('renewal.invitations')}: {offer.invitations}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className={`mt-3 bg-primary-50 dark:bg-primary-900/20 p-2 rounded ${direction === 'rtl' ? 'border-e-4' : 'border-s-4'} border-primary-500 dark:border-primary-700`}>
            <p className="text-xs text-primary-800 dark:text-primary-300">
              <strong>{t('renewal.note')}:</strong> {t('renewal.noteCanEditAfterOffer')}
            </p>
          </div>
        </div>

        <div className={`bg-primary-50 dark:bg-primary-900/20 border-primary-500 dark:border-primary-700 p-3 rounded-lg mb-4 ${direction === 'rtl' ? 'border-e-4' : 'border-s-4'}`}>
          <h4 className="font-bold text-primary-900 dark:text-primary-200 mb-2 text-sm">{t('renewal.memberInfo')}</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <p className="text-primary-800 dark:text-primary-300">
              <strong>{t('renewal.name')}:</strong> {member.name}
            </p>
            <p className="text-primary-800 dark:text-primary-300">
              <strong>{t('renewal.memberNumber')}:</strong> #{member.memberNumber}
            </p>
            <p className="text-primary-800 dark:text-primary-300">
              <strong>{t('renewal.currentPT')}:</strong> {member.freePTSessions || 0}
            </p>
            <p className="text-primary-800 dark:text-primary-300">
              <strong>{t('renewal.currentInBody')}:</strong> {member.inBodyScans || 0}
            </p>
            <p className="text-primary-800 dark:text-primary-300">
              <strong>{t('renewal.currentInvitations')}:</strong> {member.invitations || 0}
            </p>
            <p className="text-primary-800 dark:text-primary-300">
              <strong>{t('renewal.currentFreezeDays')}:</strong> {member.remainingFreezeDays || 0}
            </p>
            {member.expiryDate && (
              <p className="text-primary-800 dark:text-primary-300">
                <strong>{t('renewal.previousExpiry')}:</strong> {formatDateYMD(member.expiryDate)}
              </p>
            )}
          </div>
        </div>

        {/*  ملاحظة بالأيام المتبقية من الاشتراك القديم — لو فيه */}
        {remainingDaysFromOldSub > 0 && (
          <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-700 flex items-start gap-2">
            <span className="text-xl shrink-0">⏰</span>
            <div className="text-sm">
              <div className="font-bold text-amber-800 dark:text-amber-200">
                {direction === 'rtl'
                  ? `العضو لسه عنده ${remainingDaysFromOldSub} يوم في الاشتراك القديم`
                  : `Member still has ${remainingDaysFromOldSub} days left from the old subscription`}
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {direction === 'rtl'
                  ? 'الأيام دي هتتضاف تلقائياً لمدة الاشتراك الجديد لما تختار باقة أو شهر.'
                  : 'These days will be auto-added to the new subscription period when you pick a package or month.'}
              </div>
            </div>
          </div>
        )}

        {/*  Toggle: وضع المزايا (تجميع / ريست) */}
        <div className="mt-3 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-200 dark:ring-indigo-700">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={resetBenefits}
              onChange={(e) => setResetBenefits(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <div className="flex-1 text-sm">
              <div className="font-bold text-indigo-900 dark:text-indigo-100 flex items-center gap-2 flex-wrap">
                🔁 {direction === 'rtl' ? 'ريست للمزايا (ابدأ من جديد)' : 'Reset benefits (start fresh)'}
                {!resetBenefits && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                    {direction === 'rtl' ? 'تجميع مفعّل' : 'Accumulating'}
                  </span>
                )}
                {resetBenefits && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                    {direction === 'rtl' ? 'ريست مفعّل' : 'Reset on'}
                  </span>
                )}
              </div>
              <div className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                {direction === 'rtl'
                  ? resetBenefits
                    ? '⚠️ المزايا القديمة (حصص PT، تغذية، علاج طبيعي، جروب كلاس، InBody، دعوات، أيام التجميد) هتتمسح ويبتدي العضو بالمزايا الجديدة من الباقة فقط.'
                    : '✅ المزايا الفاضلة من الاشتراك القديم هتتجمع مع مزايا الباقة الجديدة (عادل للعميل اللي دفع ولم يستخدم).'
                  : resetBenefits
                    ? '⚠️ Old benefits (PT/Nutrition/Physio/Group Class sessions, InBody scans, invitations, freeze days) will be wiped. Member starts with only the new package benefits.'
                    : '✅ Unused benefits from the old subscription will be added to the new package benefits (fair to the member who paid).'}
              </div>
            </div>
          </label>
        </div>

        {error && (
          <div className={`bg-red-50 dark:bg-red-900/20 ${direction === 'rtl' ? 'border-e-4' : 'border-s-4'} border-red-500 dark:border-red-700 p-3 rounded-lg mb-3`}>
            <p className="text-red-700 dark:text-red-300 font-medium text-sm flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span>{error}</span>
            </p>
          </div>
        )}

        <form id="renewal-form" onSubmit={(e) => { e.preventDefault(); handleRenewal(); }} className="space-y-3">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
            <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2 text-sm">
              <svg className="w-5 h-5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
              <span>{t('renewal.renewalDetails')}</span>
            </h4>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label htmlFor="renewal-subscription-price" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('renewal.subscriptionPrice')} <span className="text-red-600">*</span>
                </label>
                <input
                  id="renewal-subscription-price"
                  type="number"
                  value={subscriptionPrice}
                  onChange={(e) => setSubscriptionPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  placeholder={t('renewal.subscriptionPricePlaceholder')}
                  min="0"
                  required
                />
              </div>

              {settings.remainingEnabled && (
                <div>
                  <label htmlFor="renewal-remaining-amount" className="block text-sm font-bold text-orange-700 dark:text-orange-400 mb-1.5">
                    {direction === 'rtl' ? 'باقي على العضو (جنيه)' : 'Remaining Balance (EGP)'}
                  </label>
                  <input
                    id="renewal-remaining-amount"
                    type="number"
                    value={remainingAmount}
                    onChange={(e) => setRemainingAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200"
                    placeholder="0"
                    min="0"
                  />
                  {parseInt(remainingAmount) > 0 && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                      {direction === 'rtl' ? 'المدفوع:' : 'Paid:'} {(parseInt(subscriptionPrice) || 0) - (parseInt(remainingAmount) || 0)} {direction === 'rtl' ? 'جنيه' : 'EGP'}
                    </p>
                  )}
                </div>
              )}

              {settings.remainingEnabled && parseInt(remainingAmount) > 0 && (
                <div>
                  <label htmlFor="renewal-remaining-due" className="block text-sm font-bold text-orange-700 dark:text-orange-400 mb-1.5">
                    {direction === 'rtl' ? 'موعد سداد الباقي' : 'Due Date'}
                  </label>
                  <input
                    id="renewal-remaining-due"
                    type="date"
                    value={remainingDueDate}
                    onChange={(e) => setRemainingDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200"
                  />
                </div>
              )}

              <div>
                <label htmlFor="renewal-staff-name" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('renewal.staffName')} <span className="text-red-600">*</span>
                </label>
                <input
                  id="renewal-staff-name"
                  type="text"
                  required
                  value={staffName}
                  readOnly
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-not-allowed"
                  placeholder={t('renewal.staffNamePlaceholder')}
                />
              </div>
            </div>
          </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
            <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2 text-sm">
              <svg className="w-5 h-5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span>{t('renewal.subscriptionPeriod')}</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label htmlFor="renewal-start-date" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('renewal.startDate')} <span className="text-red-600">*</span> <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">{t('renewal.dateFormat')}</span>
                </label>
                <input
                  id="renewal-start-date"
                  type="text"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 font-mono"
                  placeholder={t('renewal.startDatePlaceholder')}
                  pattern="\d{4}-\d{2}-\d{2}"
                  required
                />
              </div>

              <div>
                <label htmlFor="renewal-expiry-date" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('renewal.expiryDate')} <span className="text-red-600">*</span> <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">{t('renewal.dateFormat')}</span>
                </label>
                <input
                  id="renewal-expiry-date"
                  type="text"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 font-mono"
                  placeholder={t('renewal.expiryDatePlaceholder')}
                  pattern="\d{4}-\d{2}-\d{2}"
                  required
                />
              </div>
            </div>

            <div className="mb-3">
              <p className="text-xs font-bold mb-2 text-gray-700 dark:text-gray-300">{t('renewal.quickAdd')}:</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 6, 9, 12].map(months => (
                  <button
                    key={months}
                    type="button"
                    onClick={() => calculateExpiryFromMonths(months)}
                    className="px-2.5 py-1 bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 dark:hover:bg-primary-800/40 text-primary-800 dark:text-primary-300 rounded-lg text-xs font-bold transition-colors duration-200"
                  >
                    + {months} {months === 1 ? t('renewal.month') : t('renewal.months')}
                  </button>
                ))}
              </div>
            </div>

            {duration > 0 && expiryDate && (
              <div className="bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-900/50 rounded-lg p-2">
                <p className="text-xs text-primary-800 dark:text-primary-300 flex items-center gap-2">
                  <svg className="w-4 h-4" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    <strong>{t('renewal.subscriptionDuration')}:</strong> {duration} {t('renewal.days')}
                    {duration >= 30 &&
                      ` (${Math.floor(duration / 30)} ${Math.floor(duration / 30) === 1 ? t('renewal.month') : t('renewal.months')})`
                    }
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
            <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2 text-sm">
              <svg className="w-5 h-5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
              <span>{t('renewal.paymentMethod')}</span>
            </h4>
            <PaymentMethodSelector
              value={paymentMethod}
              onChange={setPaymentMethod}
              allowMultiple={true}
              totalAmount={Math.max((parseInt(subscriptionPrice) || 0) - (parseInt(remainingAmount) || 0), 0)}
              memberPoints={member.points || 0}
              pointsValueInEGP={settings.pointsValueInEGP}
              pointsEnabled={settings.pointsEnabled}
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
            <label htmlFor="renewal-source" className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
              <svg className="w-4 h-4" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
              <span>{t('members.form.sourceRequired') || 'المصدر'}</span>
            </label>
            <select
              id="renewal-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
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
              <option value="renewal_no_followup">{t('members.form.sourceRenewalNoFollowup')}</option>
              {source && !['walk-in','call-in','suggestion','facebook','instagram','tiktok','chatgpt','website','friend_referral','renewal_no_followup'].includes(source) && (
                <option value={source}>{source}</option>
              )}
            </select>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
            <label htmlFor="renewal-notes" className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
              <svg className="w-4 h-4" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              <span>{t('renewal.notes')}</span>
            </label>
            <textarea
              id="renewal-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
              rows={3}
              placeholder={t('renewal.notesPlaceholder')}
            />
          </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-yellow-200 dark:ring-yellow-900/50 p-5">
            <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2 text-sm">
              <svg className="w-5 h-5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <span>{t('renewal.summary')}</span>
            </h4>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="text-center bg-gray-50 dark:bg-gray-900/40 rounded-lg p-2">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('renewal.currentSessions')}</p>
                <p className="font-bold text-lg text-gray-900 dark:text-gray-100">{member.freePTSessions || 0}</p>
              </div>
              <div className="text-center bg-gray-50 dark:bg-gray-900/40 rounded-lg p-2">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('renewal.newSessions')}</p>
                <p className="font-bold text-lg text-green-600 dark:text-green-400">+{parseInt(freePTSessions) || 0}</p>
              </div>
              <div className="text-center bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('renewal.totalAfterRenewal')}</p>
                <p className="font-bold text-lg text-orange-600 dark:text-orange-400">{totalSessions}</p>
              </div>
              <div className="text-center bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('renewal.subscriptionPrice')}</p>
                <p className="font-bold text-lg text-green-600 dark:text-green-400">{subscriptionPrice || 0} {t('renewal.currency')}</p>
              </div>
            </div>
          </div>
        </form>
        </div>

        <div className="flex gap-3 bg-white dark:bg-gray-800 p-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            form="renewal-form"
            disabled={loading || duration <= 0}
            className="flex-1 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" {...stroke}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" />
                  <path className="opacity-75" d="M4 12a8 8 0 018-8" strokeLinecap="round" />
                </svg>
                <span>{t('renewal.renewing')}</span>
              </span>
            ) : (
              t('renewal.confirmRenewal')
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-6 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-bold transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {t('renewal.cancel')}
          </button>
        </div>
      </div>

      <ReceiptSuccessModal
        receipt={createdReceipt}
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false)
          if (createdReceipt) {
            onSuccess(createdReceipt)
          } else {
            onSuccess()
          }
        }}
      />
    </div>
  )
}
