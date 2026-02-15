'use client'

import { useState, useEffect } from 'react'
import { calculateDaysBetween, formatDateYMD, formatDurationInMonths } from '../lib/dateFormatter'
import PaymentMethodSelector from './Paymentmethodselector'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'
import type { PaymentMethod } from '../lib/paymentHelpers'

interface Staff {
  id: string
  name: string
  phone?: string
  position?: string
  isActive: boolean
}

interface NutritionSession {
  nutritionNumber: number
  clientName: string
  phone: string
  sessionsPurchased: number
  sessionsRemaining: number
  nutritionistName: string
  pricePerSession: number
  startDate?: string
  expiryDate?: string
}

interface NutritionRenewalFormProps {
  session: NutritionSession
  onSuccess: () => void
  onClose: () => void
}

export default function NutritionRenewalForm({ session, onSuccess, onClose }: NutritionRenewalFormProps) {
  const { user } = usePermissions()
  const { t, direction } = useLanguage()
  const toast = useToast()
  const { settings } = useServiceSettings()
  const [memberPoints, setMemberPoints] = useState(0)
  const [memberNumber, setMemberNumber] = useState<number | null>(null)
  const [nutritionists, setNutritionists] = useState<Staff[]>([])
  const [coachesLoading, setCoachesLoading] = useState(true)
  const [packages, setPackages] = useState<any[]>([])
  const [successMessage, setSuccessMessage] = useState('')

  const getDefaultStartDate = () => {
    if (session.expiryDate) {
      const expiry = new Date(session.expiryDate)
      const today = new Date()

      return expiry < today
        ? formatDateYMD(today)
        : formatDateYMD(expiry)
    }
    return formatDateYMD(new Date())
  }

  const [formData, setFormData] = useState<{
    phone: string
    sessionsPurchased: number
    nutritionistName: string
    totalPrice: number
    startDate: string
    expiryDate: string
    paymentMethod: string | PaymentMethod[]
    staffName: string
  }>({
    phone: session.phone,
    sessionsPurchased: 0,
    nutritionistName: session.nutritionistName,
    totalPrice: 0,
    startDate: getDefaultStartDate(),
    expiryDate: '',
    paymentMethod: 'cash',
    staffName: user?.name || '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchMemberPoints = async () => {
      try {
        const response = await fetch(`/api/members?phone=${encodeURIComponent(session.phone)}`)
        if (response.ok) {
          const members = await response.json()
          if (members.length > 0) {
            setMemberPoints(members[0].points || 0)
            setMemberNumber(members[0].memberNumber || null)
          }
        }
      } catch (error) {
        console.error('Error fetching member points:', error)
      }
    }

    if (session.phone) {
      fetchMemberPoints()
    }
  }, [session.phone])

  useEffect(() => {
    fetchCoaches()
    fetchPackages()
  }, [])

  useEffect(() => {
    if (user && !formData.staffName) {
      setFormData(prev => ({ ...prev, staffName: user.name }))
    }
  }, [user])

  const fetchCoaches = async () => {
    try {
      const response = await fetch('/api/staff')
      const data: Staff[] = await response.json()
      const activeNutritionists = data.filter(
        (staff) => staff.isActive && staff.position?.toLowerCase().includes('تغذية')
      )
      setNutritionists(activeNutritionists)
    } catch (error) {
      console.error('Error fetching coaches:', error)
    } finally {
      setCoachesLoading(false)
    }
  }

  const fetchPackages = async () => {
    try {
      const response = await fetch('/api/packages?serviceType=Nutrition')
      const data = await response.json()
      if (Array.isArray(data)) {
        setPackages(data)
      } else {
        console.warn('Received data is not an array:', data)
        setPackages([])
      }
    } catch (error) {
      console.error('Error fetching packages:', error)
      setPackages([])
    }
  }

  const applyPackage = (pkg: any) => {
    setFormData(prev => ({
      ...prev,
      sessionsPurchased: pkg.sessions || 0,
      totalPrice: pkg.price || 0
    }))

    setSuccessMessage(`✅ ${t('renewal.offerApplied', { offerName: pkg.name })}`)
    setTimeout(() => setSuccessMessage(''), 2000)
  }

  const calculateDuration = () => {
    if (!formData.startDate || !formData.expiryDate) return null
    return calculateDaysBetween(formData.startDate, formData.expiryDate)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (formData.startDate && formData.expiryDate) {
      const start = new Date(formData.startDate)
      const end = new Date(formData.expiryDate)

      if (end <= start) {
        toast.error(t('nutrition.renewal.dateError'))
        setLoading(false)
        return
      }
    }

    try {
      const response = await fetch('/api/nutrition/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nutritionNumber: session.nutritionNumber,
          ...formData,
          memberNumber: memberNumber,
          staffName: user?.name || ''
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(t('nutrition.renewal.successMessage'))

        if (result.receipt) {
          try {
            const receiptsResponse = await fetch(`/api/receipts?nutritionNumber=${session.nutritionNumber}`)
            const receipts = await receiptsResponse.json()

            if (receipts.length > 0) {
              const latestReceipt = receipts[0]
              console.log('Receipt ready for print:', latestReceipt)
            }
          } catch (err) {
            console.error('Error fetching receipt:', err)
          }
        }

        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1500)
      } else {
        toast.error(result.error || t('nutrition.renewal.failureMessage'))
      }
    } catch (error) {
      console.error(error)
      toast.error(t('nutrition.renewal.connectionError'))
    } finally {
      setLoading(false)
    }
  }

  const duration = calculateDuration()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir={direction}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold mb-1">🔄 {t('nutrition.renewal.title')}</h2>
              <p className="text-green-100 text-sm">{t('nutrition.renewal.subtitle')}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white dark:bg-gray-800 hover:bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center transition"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-4">
          {successMessage && (
            <div className="bg-green-100 text-green-800 p-3 rounded-lg text-center font-medium text-sm mb-4">
              {successMessage}
            </div>
          )}

          {/* Packages Section */}
          <div className="bg-gradient-to-br from-lime-50 to-green-100 border-2 border-lime-400 rounded-xl p-4 mb-4">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-green-800">
              <span>⚡</span>
              <span>{t('packages.selectPackage')}</span>
            </h3>

            {!Array.isArray(packages) || packages.length === 0 ? (
              <div className="text-center py-4 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
                <p className="text-gray-500 dark:text-gray-400 text-xs">{t('renewal.noOffersAvailable')}</p>
                <p className="text-xs text-gray-400 mt-1">{t('renewal.adminCanAddOffers')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {packages.map(pkg => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => applyPackage(pkg)}
                    className="bg-white dark:bg-gray-800 hover:bg-lime-50 border-2 border-lime-300 hover:border-lime-500 rounded-xl p-3 transition transform hover:scale-105 hover:shadow-lg"
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">🥗</div>
                      <div className="font-bold text-gray-800 dark:text-gray-100 text-sm">{pkg.name}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        {pkg.sessions} {t('packages.sessions')}
                      </div>
                      <div className="text-lg font-bold text-green-600 mt-1">
                        {pkg.price} {t('nutrition.egp')}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-green-50 border-l-4 border-r-4 border-green-500 p-3 rounded-lg mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-300">{t('nutrition.renewal.nutritionNumber')}</p>
                <p className="text-xl font-bold text-green-600">#{session.nutritionNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-300">{t('nutrition.renewal.clientName')}</p>
                <p className="text-base font-bold">{session.clientName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-300">{t('nutrition.renewal.currentNutritionist')}</p>
                <p className="text-base">{session.nutritionistName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-300">{t('nutrition.renewal.currentSessionsRemaining')}</p>
                <p className="text-xl font-bold text-orange-600">{session.sessionsRemaining}</p>
              </div>
            </div>

            {session.expiryDate && (
              <div className="mt-2 pt-2 border-t border-green-200">
                <p className="text-xs text-gray-600 dark:text-gray-300 inline-block">{t('nutrition.renewal.currentExpiryDate')}: </p>
                <p className="text-sm font-mono inline-block ml-2">{formatDateYMD(session.expiryDate)}</p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-gradient-to-br from-green-50 to-primary-50 border-2 border-green-200 rounded-xl p-4">
              <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                <span>📋</span>
                <span>{t('nutrition.renewal.renewalData')}</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    {t('nutrition.phoneNumber')}
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border-2 rounded-lg text-sm"
                    placeholder={t('nutrition.phonePlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    {t('nutrition.renewal.newSessionsCount')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.sessionsPurchased}
                    onChange={(e) => setFormData({ ...formData, sessionsPurchased: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border-2 rounded-lg text-sm"
                    placeholder={t('nutrition.sessionsPlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    {t('nutrition.nutritionistName')} <span className="text-red-600">*</span>
                  </label>
                  {coachesLoading ? (
                    <div className="w-full px-3 py-2 border-2 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm">
                      {t('nutrition.loadingNutritionists')}
                    </div>
                  ) : nutritionists.length === 0 ? (
                    <div className="space-y-1">
                      <input
                        type="text"
                        required
                        value={formData.nutritionistName}
                        onChange={(e) => setFormData({ ...formData, nutritionistName: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                        placeholder={t('nutrition.nutritionistNamePlaceholder')}
                      />
                      <p className="text-xs text-amber-600">
                        ⚠️ {t('nutrition.noActiveNutritionists')}
                      </p>
                    </div>
                  ) : (
                    <select
                      required
                      value={formData.nutritionistName}
                      onChange={(e) => setFormData({ ...formData, nutritionistName: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                    >
                      <option value="">{t('nutrition.selectNutritionist')}</option>
                      {nutritionists.map((nutritionist) => (
                        <option key={nutritionist.id} value={nutritionist.name}>
                          {nutritionist.name} {nutritionist.phone && `(${nutritionist.phone})`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    {t('nutrition.renewal.totalAmount')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.totalPrice}
                    onChange={(e) => setFormData({ ...formData, totalPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border-2 border-green-400 rounded-lg text-sm font-bold"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-green-50 to-pink-50 border-2 border-green-200 rounded-xl p-4">
                <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                  <span>📅</span>
                  <span>{t('nutrition.renewal.newSubscriptionPeriod')}</span>
                </h3>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      {t('nutrition.startDate')} <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3 py-2 border-2 rounded-lg font-mono text-sm"
                      placeholder={t('nutrition.startDatePlaceholder')}
                      pattern="\d{4}-\d{2}-\d{2}"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      {t('nutrition.expiryDate')} <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full px-3 py-2 border-2 rounded-lg font-mono text-sm"
                      placeholder={t('nutrition.expiryDatePlaceholder')}
                      pattern="\d{4}-\d{2}-\d{2}"
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-xs font-medium mb-2">⚡ {t('nutrition.quickAdd')}</p>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 6, 9, 12].map(months => (
                      <button
                        key={months}
                        type="button"
                        onClick={() => calculateExpiryFromMonths(months)}
                        className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg text-xs transition font-medium"
                      >
                        + {months} {months === 1 ? t('nutrition.month') : t('nutrition.months')}
                      </button>
                    ))}
                  </div>
                </div>

                {duration !== null && formData.expiryDate && (
                  <div className="bg-white dark:bg-gray-800 border-2 border-green-300 rounded-lg p-2">
                    {duration > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">⏱️</span>
                        <div>
                          <p className="font-bold text-green-800 text-xs">{t('nutrition.renewal.subscriptionDuration')}</p>
                          <p className="text-base font-mono">
                            {formatDurationInMonths(duration)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-red-600 flex items-center gap-2 text-xs">
                        <span>❌</span>
                        <span>{t('nutrition.renewal.dateError')}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="bg-gradient-to-br from-green-50 to-green-50 border-2 border-green-200 rounded-xl p-4">
                  <PaymentMethodSelector
                    value={formData.paymentMethod}
                    onChange={(method) => setFormData({ ...formData, paymentMethod: method })}
                    allowMultiple={true}
                    totalAmount={formData.totalPrice}
                    memberPoints={memberPoints}
                    pointsValueInEGP={settings.pointsValueInEGP}
                    pointsEnabled={settings.pointsEnabled}
                    required
                  />
                </div>

                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl p-4">
                  <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                    <span>📊</span>
                    <span>{t('nutrition.renewal.summary')}</span>
                  </h3>

                  <div className="space-y-2">
                    <div className="bg-green-50 border-l-4 border-r-4 border-green-400 p-2 rounded">
                      <p className="text-xs text-green-800">
                        ⚠️ {t('nutrition.renewal.replacementWarning', {
                          sessionsRemaining: session.sessionsRemaining.toString()
                        })}
                      </p>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">{t('nutrition.renewal.newSessionsLabel')}</span>
                      <span className="font-bold text-green-600">{formData.sessionsPurchased} {t('nutrition.session')}</span>
                    </div>
                    <div className="bg-green-100 border-l-4 border-r-4 border-green-500 p-2 rounded">
                      <div className="flex justify-between">
                        <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">{t('nutrition.renewal.paidAmount')}</span>
                        <span className="font-bold text-green-600 text-base">{formData.totalPrice} {t('nutrition.egp')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || (duration !== null && duration <= 0)}
                className="flex-1 bg-green-600 text-white py-2.5 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition font-bold text-base"
              >
                {loading ? t('nutrition.renewal.renewing') : t('nutrition.renewal.renewButton')}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 bg-gray-200 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg hover:bg-gray-300 transition font-medium text-base"
              >
                {t('nutrition.cancelButton')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
