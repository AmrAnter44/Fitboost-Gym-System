'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'
import Paymentmethodselector from './Paymentmethodselector'
import type { PaymentMethod } from '../lib/paymentHelpers'

interface Member {
  id: string
  memberNumber: number
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

  useEffect(() => {
    fetchOffers()
    fetchCurrentUser()
  }, [])

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include' // ✅ إرسال الـ cookies مع الطلب
      })

      console.log('📡 Response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('✅ User data received:', data)

        if (data.user && data.user.name) {
          setCurrentUser(data.user)
          console.log('✅ Current user set:', data.user.name)
        } else {
          console.error('⚠️ User data missing name:', data)
          setError('خطأ: بيانات المستخدم غير كاملة. يرجى تسجيل الدخول مرة أخرى.')
        }
      } else {
        console.error('❌ Failed to fetch user. Status:', response.status)
        setError('خطأ: لم يتم العثور على بيانات المستخدم المسجل. يرجى تسجيل الدخول مرة أخرى.')
      }
    } catch (error) {
      console.error('❌ Error fetching current user:', error)
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

  // دالة حساب الأيام بين تاريخين
  const calculateDaysBetween = (date1: string | Date, date2: string | Date): number => {
    const d1 = new Date(date1)
    const d2 = new Date(date2)
    const diffTime = Math.abs(d2.getTime() - d1.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // فحص أهلية الترقية لعرض معين
  const isUpgradeEligible = (offer: Offer): boolean => {
    if (!member.startDate || !member.expiryDate) return false

    // ✅ Admin و Owner لهم صلاحية كاملة بدون قيود
    const isAdminOrOwner = currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER'
    if (isAdminOrOwner) {
      return true  // ✅ بدون أي قيود للأدمن والأونر
    }

    // حساب مدة الباقة الحالية
    const currentDuration = calculateDaysBetween(member.startDate, member.expiryDate)

    // ✅ عرض فقط الباقات الأطول من الباقة الحالية
    if (offer.duration <= currentDuration) return false

    // ✅ التحقق من أن السعر أكبر (اختياري - يمكن إزالته إذا كنت تريد عرض كل الباقات الأطول)
    if (offer.price <= member.subscriptionPrice) return false

    // فحص upgradeEligibilityDays إذا كان محدد
    if (offer.upgradeEligibilityDays !== null && offer.upgradeEligibilityDays !== undefined) {
      const daysSinceStart = calculateDaysBetween(member.startDate, new Date())
      if (daysSinceStart > offer.upgradeEligibilityDays) return false
    }

    return true
  }

  // الحصول على العروض المؤهلة للترقية فقط
  const eligibleOffers = offers.filter(offer => isUpgradeEligible(offer))

  // حساب مبلغ الترقية
  const calculateUpgradeAmount = (newPrice: number): number => {
    return newPrice - member.subscriptionPrice
  }

  // حساب تاريخ النهاية الجديد
  const calculateNewExpiryDate = (offerDuration: number): Date => {
    const newExpiry = new Date(member.startDate)
    newExpiry.setDate(newExpiry.getDate() + offerDuration)
    return newExpiry
  }

  // الحصول على العرض المختار
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
          staffName: currentUser.name
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
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8" dir={direction}>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <span>🚀</span>
            <span>{t('upgrade.title')}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-6 py-4 rounded-xl">
            {error}
          </div>
        )}

        {/* معلومات الباكدج الحالي */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-700 rounded-xl p-6 mb-6 border-2 border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">{t('upgrade.currentPackage')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-300">{t('offers.price')}</p>
              <p className="font-bold text-lg text-gray-800 dark:text-gray-100">{member.subscriptionPrice} {t('members.egp')}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-300">{t('offers.ptSessions')}</p>
              <p className="font-bold text-lg text-gray-800 dark:text-gray-100">{member.freePTSessions}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-300">{t('offers.inBody')}</p>
              <p className="font-bold text-lg text-gray-800 dark:text-gray-100">{member.inBodyScans}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-300">{t('offers.invitations')}</p>
              <p className="font-bold text-lg text-gray-800 dark:text-gray-100">{member.invitations}</p>
            </div>
          </div>
        </div>

        {/* اختيار الباكدج الجديد */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">{t('upgrade.selectPackage')}</h3>

          {eligibleOffers.length === 0 ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 px-6 py-8 rounded-xl text-center">
              <p className="text-4xl mb-3">⚠️</p>
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
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-lg'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/10'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-3xl">{offer.icon}</span>
                        <div>
                          <h4 className="font-bold text-lg text-gray-800 dark:text-gray-100">{offer.name}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{offer.duration} {t('offers.days')}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-orange-500 text-2xl">✓</span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-300">{t('offers.price')}:</span>
                        <span className="font-bold text-orange-600">{offer.price} {t('members.egp')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-300">{t('upgrade.upgradeCost')}:</span>
                        <span className="font-bold text-green-600">+{upgradeAmount} {t('members.egp')}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 pt-1 border-t">
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

        {/* جدول المقارنة */}
        {selectedOffer && (
          <div className="bg-primary-50 dark:bg-gray-700 border-2 border-primary-200 dark:border-gray-600 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-bold text-primary-800 dark:text-primary-200 mb-4">{t('upgrade.comparison')}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-primary-700 dark:text-primary-300 font-semibold mb-2">{t('upgrade.currentPackage')}</p>
                <div className="space-y-1 text-gray-700 dark:text-gray-200">
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
                <p className="text-green-700 dark:text-green-400 font-semibold mb-2">{t('upgrade.newPackage')}</p>
                <div className="space-y-1 text-gray-700 dark:text-gray-200">
                  <p>{t('offers.price')}: {selectedOffer.price} {t('members.egp')}</p>
                  <p>PT: {selectedOffer.freePTSessions}</p>
                  <p>InBody: {selectedOffer.inBodyScans}</p>
                  <p>{t('offers.invitations')}: {selectedOffer.invitations}</p>
                  <p className="text-xs text-green-600">
                    {t('members.expiryDate')}: {calculateNewExpiryDate(selectedOffer.duration).toLocaleDateString('ar-EG')}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-primary-300 dark:border-gray-600">
              <div className="flex justify-between items-center">
                <span className="text-primary-800 dark:text-primary-200 font-bold">{t('upgrade.youWillPay')}:</span>
                <span className="text-2xl font-bold text-green-600">
                  {calculateUpgradeAmount(selectedOffer.price)} {t('members.egp')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* تنبيه مهم */}
        {selectedOffer && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl p-4 mb-6">
            <p className="text-yellow-800 dark:text-yellow-200 font-bold text-sm">
              ⚠️ {t('upgrade.warningTitle')}
            </p>
            <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
              {t('upgrade.warningMessage')}
            </p>
          </div>
        )}

        {/* طريقة الدفع */}
        {selectedOffer && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">
                {t('members.paymentMethod')} *
              </label>
              <Paymentmethodselector
                value={paymentMethod}
                onChange={setPaymentMethod}
                allowMultiple={true}
                totalAmount={selectedOffer ? calculateUpgradeAmount(selectedOffer.price) : 0}
                memberPoints={member.points || 0}
                pointsValueInEGP={settings.pointsValueInEGP}
                pointsEnabled={settings.pointsEnabled}
              />
            </div>

            {/* عرض اسم الموظف الحالي أو تحذير */}
            {currentUser ? (
              <div className="bg-primary-50 dark:bg-gray-700 border-2 border-primary-200 dark:border-gray-600 rounded-lg p-4">
                <p className="text-sm text-primary-700 dark:text-primary-300 mb-1">
                  👨‍💼 {t('members.staffName')}:
                </p>
                <p className="font-bold text-primary-900 dark:text-primary-100 text-lg">
                  {currentUser.name}
                </p>
              </div>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-4">
                <p className="text-sm text-red-700 dark:text-red-300 mb-2 font-bold">
                  ⚠️ تحذير: لم يتم تحميل بيانات المستخدم المسجل
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mb-3">
                  لن يتم تسجيل اسم الموظف في الإيصال. يرجى إعادة المحاولة أو تسجيل الدخول مرة أخرى.
                </p>
                <button
                  type="button"
                  onClick={fetchCurrentUser}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
                >
                  🔄 إعادة المحاولة
                </button>
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleUpgrade}
            disabled={loading || !selectedOfferId || !currentUser}
            className={`flex-1 py-3 rounded-xl font-bold text-white transition-all ${
              loading || !selectedOfferId || !currentUser
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 hover:scale-105 shadow-lg'
            }`}
          >
            {loading ? (
              <span>{t('upgrade.upgrading')}...</span>
            ) : (
              <span>🚀 {t('upgrade.confirmUpgrade')}</span>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-8 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-xl font-bold hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
