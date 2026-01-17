'use client'

import { useState, useEffect } from 'react'
import PaymentMethodSelector from './Paymentmethodselector'
import { calculateDaysBetween, formatDateYMD } from '../lib/dateFormatter'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '@/contexts/LanguageContext'
import type { PaymentMethod } from '../lib/paymentHelpers'

interface Member {
  id: string
  memberNumber: number
  name: string
  phone: string
  inBodyScans: number
  invitations: number
  freePTSessions?: number
  subscriptionPrice: number
  remainingAmount: number
  remainingFreezeDays?: number
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
    memberNumber?: number
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
  const [subscriptionPrice, setSubscriptionPrice] = useState('')
  const [remainingAmount, setRemainingAmount] = useState('0')
  const [freePTSessions, setFreePTSessions] = useState('0')
  const [inBodyScans, setInBodyScans] = useState('0')
  const [invitations, setInvitations] = useState('0')
  const [freezeDays, setFreezeDays] = useState('0')
  const [startDate, setStartDate] = useState(formatDateYMD(new Date()))
  const [expiryDate, setExpiryDate] = useState('')
  const [notes, setNotes] = useState(member.notes || '')
  const [paymentMethod, setPaymentMethod] = useState<string | PaymentMethod[]>('cash')
  const [staffName, setStaffName] = useState(user?.name || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [offers, setOffers] = useState<any[]>([])
  const [successMessage, setSuccessMessage] = useState('')

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
          console.warn('⚠️ البيانات المستلمة ليست array:', data)
          setOffers([])
        }
      } catch (error) {
        console.error('❌ خطأ في جلب العروض:', error)
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
    
    setExpiryDate(formatDateYMD(expiry))
  }

  const calculatePaidAmount = () => {
    const price = parseInt(subscriptionPrice) || 0
    const remaining = parseInt(remainingAmount) || 0
    return price - remaining
  }

  const applyOffer = (offer: any) => {
    const start = startDate || formatDateYMD(new Date())
    const expiry = new Date(start)
    expiry.setDate(expiry.getDate() + offer.duration)

    setSubscriptionPrice(offer.price.toString())
    setFreePTSessions(offer.freePTSessions.toString())
    setInBodyScans(offer.inBodyScans.toString())
    setInvitations(offer.invitations.toString())
    setFreezeDays(offer.freezeDays.toString())
    setStartDate(start)
    setExpiryDate(formatDateYMD(expiry))

    setSuccessMessage(`✅ ${t('renewal.offerApplied', { offerName: offer.name })}`)
    setTimeout(() => setSuccessMessage(''), 2000)
  }

  const handleRenewal = async () => {
    if (!subscriptionPrice || parseInt(subscriptionPrice) <= 0) {
      setError(`⚠️ ${t('renewal.errors.invalidPrice')}`)
      return
    }

    if (!startDate || !expiryDate) {
      setError(`⚠️ ${t('renewal.errors.missingDates')}`)
      return
    }

    if (new Date(expiryDate) <= new Date(startDate)) {
      setError(`⚠️ ${t('renewal.errors.invalidDateRange')}`)
      return
    }

    setLoading(true)
    setError('')

    try {
      console.log('📄 إرسال طلب التجديد...')

      const response = await fetch('/api/members/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          subscriptionPrice: parseInt(subscriptionPrice),
          remainingAmount: parseInt(remainingAmount) || 0,
          freePTSessions: parseInt(freePTSessions) || 0,
          inBodyScans: parseInt(inBodyScans) || 0,
          invitations: parseInt(invitations) || 0,
          remainingFreezeDays: parseInt(freezeDays) || 0,
          startDate,
          expiryDate,
          notes,
          paymentMethod,
          staffName: user?.name || ''
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        console.log('✅ تم التجديد بنجاح:', data)
        
        if (data.receipt) {
          onSuccess(data.receipt)
        } else {
          onSuccess()
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || `❌ ${t('renewal.errors.renewalFailed')}`)
      }
    } catch (error) {
      console.error('❌ خطأ في التجديد:', error)
      setError(`❌ ${t('renewal.errors.unexpectedError')}`)
    } finally {
      setLoading(false)
    }
  }

  const duration = calculateDays(startDate, expiryDate)
  const totalAmount = subscriptionPrice ? parseInt(subscriptionPrice) : 0
  const totalSessions = (member.freePTSessions || 0) + (parseInt(freePTSessions) || 0)

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir={direction}
      >
        <div className="flex justify-between items-center p-4 border-b bg-white">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <span>🔄</span>
            <span>{t('renewal.title')}</span>
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            type="button"
          >
            ×
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
        {successMessage && (
          <div className="bg-green-100 text-green-800 p-3 rounded-lg text-center font-medium text-sm mb-4">
            {successMessage}
          </div>
        )}

        {/* قسم العروض */}
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-4 mb-4">
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-purple-800">
            <span>🎁</span>
            <span>{t('renewal.availableOffers')}</span>
          </h3>
          <p className="text-xs text-gray-600 mb-3">{t('renewal.selectOfferToAutoFill')}</p>

          {!Array.isArray(offers) || offers.length === 0 ? (
            <div className="text-center py-4 bg-white rounded-xl border-2 border-dashed border-gray-300">
              <p className="text-gray-500 text-xs">{t('renewal.noOffersAvailable')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('renewal.adminCanAddOffers')}</p>
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
                  <div className="text-xl font-bold text-green-600 mb-1">{offer.price} {t('renewal.currency')}</div>
                  <div className="text-xs text-gray-600 space-y-0.5">
                    <div>💪 {offer.freePTSessions} PT</div>
                    <div>⚖️ {offer.inBodyScans} InBody</div>
                    <div>🎟️ {offer.invitations} {t('renewal.invitations')}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className={`mt-3 bg-blue-100 p-2 rounded ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-blue-500`}>
            <p className="text-xs text-blue-800">
              <strong>💡 {t('renewal.note')}:</strong> {t('renewal.noteCanEditAfterOffer')}
            </p>
          </div>
        </div>

        <div className={`bg-blue-50 border-blue-500 p-3 rounded-lg mb-4 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'}`}>
          <h4 className="font-bold text-blue-900 mb-2 text-sm">{t('renewal.memberInfo')}</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <p className="text-blue-800">
              <strong>{t('renewal.name')}:</strong> {member.name}
            </p>
            <p className="text-blue-800">
              <strong>{t('renewal.memberNumber')}:</strong> #{member.memberNumber}
            </p>
            <p className="text-blue-800">
              <strong>{t('renewal.currentPT')}:</strong> {member.freePTSessions || 0}
            </p>
            <p className="text-blue-800">
              <strong>{t('renewal.currentInBody')}:</strong> {member.inBodyScans || 0}
            </p>
            <p className="text-blue-800">
              <strong>{t('renewal.currentInvitations')}:</strong> {member.invitations || 0}
            </p>
            <p className="text-blue-800">
              <strong>❄️ أيام الفريز الحالية:</strong> {member.remainingFreezeDays || 0}
            </p>
            {member.expiryDate && (
              <p className="text-blue-800">
                <strong>{t('renewal.previousExpiry')}:</strong> {formatDateYMD(member.expiryDate)}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-r-4 border-red-500 p-3 rounded-lg mb-3">
            <p className="text-red-700 font-medium text-sm">{error}</p>
          </div>
        )}

        <form id="renewal-form" onSubmit={(e) => { e.preventDefault(); handleRenewal(); }} className="space-y-3">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
              <span>💰</span>
              <span>{t('renewal.renewalDetails')}</span>
            </h4>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  {t('renewal.subscriptionPrice')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={subscriptionPrice}
                  onChange={(e) => setSubscriptionPrice(e.target.value)}
                  className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                  placeholder={t('renewal.subscriptionPricePlaceholder')}
                  min="0"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  {t('renewal.remainingAmount')}
                </label>
                <input
                  type="number"
                  value={remainingAmount}
                  onChange={(e) => setRemainingAmount(e.target.value)}
                  className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="0"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  {t('renewal.staffName')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={staffName}
                  readOnly
                  className="w-full px-3 py-2 border-2 rounded-lg bg-gray-100 cursor-not-allowed text-sm"
                  placeholder={t('renewal.staffNamePlaceholder')}
                />
              </div>
            </div>

            {subscriptionPrice && (
              <div className="mt-2 bg-green-50 border-2 border-green-300 rounded-lg p-2">
                <p className="text-xs text-green-800">
                  💵 <strong>{t('renewal.paidAmount')}:</strong> {calculatePaidAmount()} {t('renewal.currency')}
                </p>
              </div>
            )}
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
              <span>🎁</span>
              <span>{t('renewal.additionalSessions')}</span>
            </h4>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  🏋️ {t('renewal.additionalPT')}
                </label>
                <input
                  type="number"
                  value={freePTSessions}
                  onChange={(e) => setFreePTSessions(e.target.value)}
                  className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
                  placeholder="0"
                  min="0"
                />
                {parseInt(freePTSessions) > 0 && (
                  <p className="text-xs text-purple-600 mt-1">
                    ✅ {t('renewal.total')}: {(member.freePTSessions || 0) + parseInt(freePTSessions)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  ⚖️ {t('renewal.additionalInBody')}
                </label>
                <input
                  type="number"
                  value={inBodyScans}
                  onChange={(e) => setInBodyScans(e.target.value)}
                  className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
                  placeholder="0"
                  min="0"
                />
                {parseInt(inBodyScans) > 0 && (
                  <p className="text-xs text-purple-600 mt-1">
                    ✅ {t('renewal.total')}: {(member.inBodyScans || 0) + parseInt(inBodyScans)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  🎟️ {t('renewal.additionalInvitations')}
                </label>
                <input
                  type="number"
                  value={invitations}
                  onChange={(e) => setInvitations(e.target.value)}
                  className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
                  placeholder="0"
                  min="0"
                />
                {parseInt(invitations) > 0 && (
                  <p className="text-xs text-purple-600 mt-1">
                    ✅ {t('renewal.total')}: {(member.invitations || 0) + parseInt(invitations)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  ❄️ أيام الفريز الإضافية
                </label>
                <input
                  type="number"
                  value={freezeDays}
                  onChange={(e) => setFreezeDays(e.target.value)}
                  className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:border-cyan-500 text-sm"
                  placeholder="0"
                  min="0"
                />
                {parseInt(freezeDays) > 0 && (
                  <p className="text-xs text-cyan-600 mt-1">
                    ✅ الإجمالي: {(member.remainingFreezeDays || 0) + parseInt(freezeDays)} يوم
                  </p>
                )}
              </div>
            </div>
          </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
              <span>📅</span>
              <span>{t('renewal.subscriptionPeriod')}</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  {t('renewal.startDate')} <span className="text-red-600">*</span> <span className="text-xs text-gray-500">{t('renewal.dateFormat')}</span>
                </label>
                <input
                  type="text"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
                  placeholder={t('renewal.startDatePlaceholder')}
                  pattern="\d{4}-\d{2}-\d{2}"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  {t('renewal.expiryDate')} <span className="text-red-600">*</span> <span className="text-xs text-gray-500">{t('renewal.dateFormat')}</span>
                </label>
                <input
                  type="text"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
                  placeholder={t('renewal.expiryDatePlaceholder')}
                  pattern="\d{4}-\d{2}-\d{2}"
                  required
                />
              </div>
            </div>

            <div className="mb-3">
              <p className="text-xs font-medium mb-2">⚡ {t('renewal.quickAdd')}:</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 6, 9, 12].map(months => (
                  <button
                    key={months}
                    type="button"
                    onClick={() => calculateExpiryFromMonths(months)}
                    className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-xs transition font-medium"
                  >
                    + {months} {months === 1 ? t('renewal.month') : t('renewal.months')}
                  </button>
                ))}
              </div>
            </div>

            {duration > 0 && expiryDate && (
              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-2">
                <p className="text-xs text-blue-800">
                  ⏱️ <strong>{t('renewal.subscriptionDuration')}:</strong> {duration} {t('renewal.days')}
                  {duration >= 30 &&
                    ` (${Math.floor(duration / 30)} ${Math.floor(duration / 30) === 1 ? t('renewal.month') : t('renewal.months')})`
                  }
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
              <span>💳</span>
              <span>{t('renewal.paymentMethod')}</span>
            </h4>
            <PaymentMethodSelector
              value={paymentMethod}
              onChange={setPaymentMethod}
              allowMultiple={true}
              totalAmount={calculatePaidAmount()}
            />
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <label className="block text-sm font-medium mb-2">
              📝 {t('renewal.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              rows={3}
              placeholder={t('renewal.notesPlaceholder')}
            />
          </div>
          </div>

          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3">
            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
              <span>📊</span>
              <span>{t('renewal.summary')}</span>
            </h4>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="text-center bg-white rounded-lg p-2">
                <p className="text-xs text-gray-600 mb-1">{t('renewal.currentSessions')}</p>
                <p className="font-bold text-lg">{member.freePTSessions || 0}</p>
              </div>
              <div className="text-center bg-white rounded-lg p-2">
                <p className="text-xs text-gray-600 mb-1">{t('renewal.newSessions')}</p>
                <p className="font-bold text-lg text-green-600">+{parseInt(freePTSessions) || 0}</p>
              </div>
              <div className="text-center bg-orange-50 rounded-lg p-2">
                <p className="text-xs text-gray-600 mb-1">{t('renewal.totalAfterRenewal')}</p>
                <p className="font-bold text-lg text-orange-600">{totalSessions}</p>
              </div>
              <div className="text-center bg-green-100 rounded-lg p-2">
                <p className="text-xs text-gray-600 mb-1">{t('renewal.paidAmount')}</p>
                <p className="font-bold text-lg text-green-600">{calculatePaidAmount()} {t('renewal.currency')}</p>
              </div>
            </div>
          </div>
        </form>
        </div>

        <div className="flex gap-3 bg-white p-3 border-t">
          <button
            type="submit"
            form="renewal-form"
            disabled={loading || duration <= 0}
            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-400 font-bold shadow-lg transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                <span>{t('renewal.renewing')}</span>
              </span>
            ) : (
              `✅ ${t('renewal.confirmRenewal')}`
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 font-bold"
          >
            {t('renewal.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}