'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'
import Paymentmethodselector from './Paymentmethodselector'
import type { PaymentMethod } from '../lib/paymentHelpers'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Member {
  id: string
  memberNumber: string
  name: string
  phone: string
  subscriptionPrice: number
  freePTSessions: number
  inBodyScans: number
  invitations: number
  remainingFreezeDays: number
  remainingAmount: number
  points?: number
  isFrozen: boolean
  profileImage?: string
  notes?: string
  startDate?: string | Date
  expiryDate?: string | Date
  isActive: boolean
  createdAt: string
}

interface Offer {
  id: string
  name: string
  duration: number
  price: number
  freePTSessions: number
  inBodyScans: number
  invitations: number
  icon: string
  upgradeEligibilityDays?: number | null
  upgradePoints?: number
}

interface UpgradeFormProps {
  member: Member
  onSuccess: () => void
  onClose: () => void
}

export default function UpgradeForm({ member, onSuccess, onClose }: UpgradeFormProps) {
  const { t, direction } = useLanguage()
  const { settings } = useServiceSettings()
  const [offers, setOffers] = useState<Offer[]>([])
  const [selectedOfferId, setSelectedOfferId] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<string | PaymentMethod[]>('cash')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [remainingAmount, setRemainingAmount] = useState('0')
  const [remainingDueDate, setRemainingDueDate] = useState('')
  const [customPrice, setCustomPrice] = useState<string>('')

  useEffect(() => {
    fetchOffers()
    fetchCurrentUser()
  }, [])

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()

        if (data.user && data.user.name) {
          setCurrentUser(data.user)
        } else {
          console.error('User data missing name:', data)
          setError('خطأ: بيانات المستخدم غير كاملة. يرجى تسجيل الدخول مرة أخرى.')
        }
      } else {
        console.error('Failed to fetch user. Status:', response.status)
        setError('خطأ: لم يتم العثور على بيانات المستخدم المسجل. يرجى تسجيل الدخول مرة أخرى.')
      }
    } catch (error) {
      console.error('Error fetching current user:', error)
      setError('خطأ في الاتصال: تعذر جلب بيانات المستخدم. تأكد من اتصالك بالإنترنت.')
    }
  }

  const fetchOffers = async () => {
    try {
      const response = await fetch('/api/offers?activeOnly=true')
      const data = await response.json()
      setOffers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching offers:', error)
      setError(t('upgrade.errors.fetchOffersFailed'))
    }
  }

  const calculateDaysBetween = (date1: string | Date, date2: string | Date): number => {
    const d1 = new Date(date1)
    const d2 = new Date(date2)
    const diffTime = Math.abs(d2.getTime() - d1.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const isUpgradeEligible = (offer: Offer): boolean => {
    if (!member.startDate || !member.expiryDate) return false

    const isAdminOrOwner = currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER'
    if (isAdminOrOwner) {
      return true
    }

    const currentDuration = calculateDaysBetween(member.startDate, member.expiryDate)

    if (offer.duration <= currentDuration) return false

    if (offer.price <= member.subscriptionPrice) return false

    if (offer.upgradeEligibilityDays !== null && offer.upgradeEligibilityDays !== undefined) {
      const daysSinceStart = calculateDaysBetween(member.startDate, new Date())
      if (daysSinceStart > offer.upgradeEligibilityDays) return false
    }

    return true
  }

  const eligibleOffers = offers.filter(offer => isUpgradeEligible(offer))

  const isExpired = member.expiryDate && new Date(member.expiryDate) < new Date()

  const calculateUpgradeAmount = (newPrice: number): number => {
    const cp = customPrice !== '' ? parseFloat(customPrice) : null
    if (cp != null && !isNaN(cp)) return cp
    if (isExpired) return newPrice
    return newPrice - member.subscriptionPrice
  }

  const calculateNewExpiryDate = (offerDuration: number): Date => {
    const newExpiry = new Date(member.startDate)
    newExpiry.setDate(newExpiry.getDate() + offerDuration)
    return newExpiry
  }

  const selectedOffer = offers.find(o => o.id === selectedOfferId)

  const handleUpgrade = async () => {
    if (!selectedOfferId) {
      setError(t('upgrade.errors.selectPackage'))
      return
    }

    if (!currentUser || !currentUser.name) {
      setError('يرجى تسجيل الدخول أولاً')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/members/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          newOfferId: selectedOfferId,
          paymentMethod,
          staffName: currentUser.name,
          remainingAmount: parseInt(remainingAmount) || 0,
          remainingDueDate: remainingDueDate || null,
          ...(customPrice !== '' && !isNaN(parseFloat(customPrice)) ? { customPrice: parseFloat(customPrice) } : {})
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('upgrade.upgradeFailed'))
      }

      onSuccess()
    } catch (error: any) {
      console.error('Upgrade error:', error)
      setError(error.message || t('upgrade.upgradeFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg ring-1 ring-gray-200 dark:ring-gray-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8" dir={direction}>
        <div className="flex justify-between items-center mb-6">
          <h2 id="upgrade-title" className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg className="w-7 h-7 text-orange-500" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            </svg>
            <span>{t('upgrade.title')}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-300 rounded-lg p-1 transition-colors duration-200"
            aria-label={t('common.close') || 'Close'}
          >
            <svg className="w-6 h-6" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">{t('upgrade.currentPackage')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-400">{t('offers.price')}</p>
              <p className="font-bold text-lg text-gray-900 dark:text-gray-100">{member.subscriptionPrice} {t('members.egp')}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">{t('offers.ptSessions')}</p>
              <p className="font-bold text-lg text-gray-900 dark:text-gray-100">{member.freePTSessions}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">{t('offers.inBody')}</p>
              <p className="font-bold text-lg text-gray-900 dark:text-gray-100">{member.inBodyScans}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">{t('offers.invitations')}</p>
              <p className="font-bold text-lg text-gray-900 dark:text-gray-100">{member.invitations}</p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">{t('upgrade.selectPackage')}</h3>

          {eligibleOffers.length === 0 ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-200 dark:ring-yellow-900/50 text-yellow-800 dark:text-yellow-200 px-6 py-8 rounded-xl text-center">
              <svg className="w-12 h-12 mx-auto mb-3 text-yellow-500" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="font-bold mb-2">{t('upgrade.noEligiblePackages')}</p>
              <p className="text-sm">{t('upgrade.noEligiblePackagesDescription')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eligibleOffers.map((offer) => {
                const upgradeAmount = calculateUpgradeAmount(offer.price)
                const newExpiry = calculateNewExpiryDate(offer.duration)
                const isSelected = selectedOfferId === offer.id

                return (
                  <button
                    key={offer.id}
                    type="button"
                    onClick={() => setSelectedOfferId(offer.id)}
                    className={`p-4 rounded-xl ring-1 text-start transition-colors duration-200 ${
                      isSelected
                        ? 'ring-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-sm'
                        : 'ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-800 hover:ring-orange-300 dark:hover:ring-orange-700'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-7 h-7 text-orange-500" {...stroke}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                        <div>
                          <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100">{offer.name}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{offer.duration} {t('offers.days')}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <svg className="w-6 h-6 text-orange-500" {...stroke}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">{t('offers.price')}:</span>
                        <span className="font-bold text-orange-600 dark:text-orange-400">{offer.price} {t('members.egp')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">{t('upgrade.upgradeCost')}:</span>
                        <span className="font-bold text-green-600 dark:text-green-400">+{upgradeAmount} {t('members.egp')}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-200 dark:border-gray-700">
                        <span>PT: {offer.freePTSessions}</span>
                        <span>InBody: {offer.inBodyScans}</span>
                        <span>{t('offers.invitations')}: {offer.invitations}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {selectedOffer && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-primary-200 dark:ring-primary-900/50 p-5 mb-6">
            <h3 className="text-lg font-bold text-primary-800 dark:text-primary-200 mb-4">{t('upgrade.comparison')}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-primary-700 dark:text-primary-300 font-bold mb-2">{t('upgrade.currentPackage')}</p>
                <div className="space-y-1 text-gray-700 dark:text-gray-300">
                  <p>{t('offers.price')}: {member.subscriptionPrice} {t('members.egp')}</p>
                  <p>PT: {member.freePTSessions}</p>
                  <p>InBody: {member.inBodyScans}</p>
                  <p>{t('offers.invitations')}: {member.invitations}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('members.expiryDate')}: {new Date(member.expiryDate).toLocaleDateString('ar-EG')}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-green-700 dark:text-green-400 font-bold mb-2">{t('upgrade.newPackage')}</p>
                <div className="space-y-1 text-gray-700 dark:text-gray-300">
                  <p>{t('offers.price')}: {selectedOffer.price} {t('members.egp')}</p>
                  <p>PT: {selectedOffer.freePTSessions}</p>
                  <p>InBody: {selectedOffer.inBodyScans}</p>
                  <p>{t('offers.invitations')}: {selectedOffer.invitations}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {t('members.expiryDate')}: {calculateNewExpiryDate(selectedOffer.duration).toLocaleDateString('ar-EG')}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-primary-200 dark:border-primary-900/50 space-y-3">
              <div className="flex items-center gap-3">
                <label htmlFor="upgrade-custom-price" className="text-primary-800 dark:text-primary-200 font-bold flex-1">
                  {t('upgrade.youWillPay')}:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="upgrade-custom-price"
                    type="number"
                    min="0"
                    value={customPrice}
                    onChange={e => setCustomPrice(e.target.value)}
                    placeholder={String(calculateUpgradeAmount(selectedOffer.price))}
                    className="w-32 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('members.egp')}</span>
                  {customPrice !== '' && (
                    <button
                      type="button"
                      onClick={() => setCustomPrice('')}
                      className="text-gray-400 hover:text-red-500 transition-colors duration-200"
                      aria-label={t('common.clear') || 'Clear'}
                    >
                      <svg className="w-4 h-4" {...stroke}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isExpired
                    ? (direction === 'rtl' ? 'اشتراك منتهي - السعر الكامل' : 'Expired subscription — full price')
                    : (direction === 'rtl' ? 'فرق السعر من الباكدج الحالي' : 'Price difference')}
                </span>
                <span className={`text-xl font-bold ${customPrice !== '' ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                  {calculateUpgradeAmount(selectedOffer.price)} {t('members.egp')}
                </span>
              </div>
            </div>
          </div>
        )}

        {selectedOffer && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-300 dark:ring-yellow-900/50 rounded-xl p-4 mb-6">
            <p className="text-yellow-800 dark:text-yellow-200 font-bold text-sm flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span>{t('upgrade.warningTitle')}</span>
            </p>
            <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
              {t('upgrade.warningMessage')}
            </p>
          </div>
        )}

        {selectedOffer && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {t('members.paymentMethod')} *
              </label>
              <Paymentmethodselector
                value={paymentMethod}
                onChange={setPaymentMethod}
                allowMultiple={true}
                totalAmount={selectedOffer ? calculateUpgradeAmount(selectedOffer.price) - (parseInt(remainingAmount) || 0) : 0}
                memberPoints={member.points || 0}
                pointsValueInEGP={settings.pointsValueInEGP}
                pointsEnabled={settings.pointsEnabled}
              />
            </div>

            {settings.remainingEnabled && (
              <>
                <div>
                  <label htmlFor="upgrade-remaining-amount" className="block text-sm font-bold text-orange-700 dark:text-orange-400 mb-1.5">
                    {direction === 'rtl' ? 'باقي على العضو (جنيه)' : 'Remaining Balance (EGP)'}
                  </label>
                  <input
                    id="upgrade-remaining-amount"
                    type="number"
                    min="0"
                    value={remainingAmount}
                    onChange={(e) => setRemainingAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200"
                    placeholder="0"
                  />
                  {parseInt(remainingAmount) > 0 && selectedOffer && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                      {direction === 'rtl' ? 'المدفوع:' : 'Paid:'} {calculateUpgradeAmount(selectedOffer.price) - (parseInt(remainingAmount) || 0)} {direction === 'rtl' ? 'جنيه' : 'EGP'}
                    </p>
                  )}
                </div>

                {parseInt(remainingAmount) > 0 && (
                  <div>
                    <label htmlFor="upgrade-remaining-due" className="block text-sm font-bold text-orange-700 dark:text-orange-400 mb-1.5">
                      {direction === 'rtl' ? 'موعد سداد الباقي' : 'Due Date'}
                    </label>
                    <input
                      id="upgrade-remaining-due"
                      type="date"
                      value={remainingDueDate}
                      onChange={(e) => setRemainingDueDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200"
                    />
                  </div>
                )}
              </>
            )}

            {currentUser ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-primary-200 dark:ring-primary-900/50 p-4">
                <p className="text-sm text-primary-700 dark:text-primary-300 mb-1 flex items-center gap-1.5">
                  <svg className="w-4 h-4" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  <span>{t('members.staffName')}:</span>
                </p>
                <p className="font-bold text-primary-900 dark:text-primary-100 text-lg">
                  {currentUser.name}
                </p>
              </div>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 ring-1 ring-red-300 dark:ring-red-900/50 rounded-lg p-4">
                <p className="text-sm text-red-700 dark:text-red-300 mb-2 font-bold flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <span>تحذير: لم يتم تحميل بيانات المستخدم المسجل</span>
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mb-3">
                  لن يتم تسجيل اسم الموظف في الإيصال. يرجى إعادة المحاولة أو تسجيل الدخول مرة أخرى.
                </p>
                <button
                  type="button"
                  onClick={fetchCurrentUser}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors duration-200"
                >
                  إعادة المحاولة
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleUpgrade}
            disabled={loading || !selectedOfferId || !currentUser}
            className="flex-1 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span>{t('upgrade.upgrading')}...</span>
            ) : (
              <span>{t('upgrade.confirmUpgrade')}</span>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
