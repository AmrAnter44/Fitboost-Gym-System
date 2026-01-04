'use client'

import { useState, useEffect } from 'react'
import { calculateDaysBetween, formatDateYMD, formatDurationInMonths } from '../lib/dateFormatter'
import PaymentMethodSelector from './Paymentmethodselector'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '../contexts/LanguageContext'

interface Staff {
  id: string
  name: string
  phone?: string
  position?: string
  isActive: boolean
}

interface PTSession {
  ptNumber: number
  clientName: string
  phone: string
  sessionsPurchased: number
  sessionsRemaining: number
  coachName: string
  pricePerSession: number
  startDate?: string
  expiryDate?: string
}

interface PTRenewalFormProps {
  session: PTSession
  onSuccess: () => void
  onClose: () => void
}

export default function PTRenewalForm({ session, onSuccess, onClose }: PTRenewalFormProps) {
  const { user } = usePermissions()
  const { t, direction } = useLanguage()
  const [coaches, setCoaches] = useState<Staff[]>([])
  const [coachesLoading, setCoachesLoading] = useState(true)

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

  const [formData, setFormData] = useState({
    phone: session.phone,
    sessionsPurchased: 0,
    coachName: session.coachName,
    totalPrice: 0,
    startDate: getDefaultStartDate(),
    expiryDate: '',
    paymentMethod: 'cash',
    staffName: user?.name || '',
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchCoaches()
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
      const activeCoaches = data.filter(
        (staff) => staff.isActive && staff.position?.toLowerCase().includes('مدرب')
      )
      setCoaches(activeCoaches)
    } catch (error) {
      console.error('Error fetching coaches:', error)
    } finally {
      setCoachesLoading(false)
    }
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
    setMessage('')

    if (formData.startDate && formData.expiryDate) {
      const start = new Date(formData.startDate)
      const end = new Date(formData.expiryDate)

      if (end <= start) {
        setMessage(`❌ ${t('pt.renewal.dateError')}`)
        setLoading(false)
        return
      }
    }

    try {
      const response = await fetch('/api/pt/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ptNumber: session.ptNumber,
          ...formData,
          staffName: user?.name || ''
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setMessage(`✅ ${t('pt.renewal.successMessage')}`)

        if (result.receipt) {
          try {
            const receiptsResponse = await fetch(`/api/receipts?ptNumber=${session.ptNumber}`)
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
        setMessage(`❌ ${result.error || t('pt.renewal.failureMessage')}`)
      }
    } catch (error) {
      console.error(error)
      setMessage(`❌ ${t('pt.renewal.connectionError')}`)
    } finally {
      setLoading(false)
    }
  }

  const duration = calculateDuration()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir={direction}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold mb-1">🔄 {t('pt.renewal.title')}</h2>
              <p className="text-green-100 text-sm">{t('pt.renewal.subtitle')}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center transition"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="bg-green-50 border-l-4 border-r-4 border-green-500 p-3 rounded-lg mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-gray-600">{t('pt.renewal.ptNumber')}</p>
                <p className="text-xl font-bold text-green-600">#{session.ptNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">{t('pt.renewal.clientName')}</p>
                <p className="text-base font-bold">{session.clientName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">{t('pt.renewal.currentCoach')}</p>
                <p className="text-base">{session.coachName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">{t('pt.renewal.currentRemainingSessions')}</p>
                <p className="text-xl font-bold text-orange-600">{session.sessionsRemaining}</p>
              </div>
            </div>

            {session.expiryDate && (
              <div className="mt-2 pt-2 border-t border-green-200">
                <p className="text-xs text-gray-600 inline-block">{t('pt.renewal.currentExpiryDate')}: </p>
                <p className="text-sm font-mono inline-block ml-2">{formatDateYMD(session.expiryDate)}</p>
              </div>
            )}
          </div>

          {message && (
            <div className={`mb-3 p-3 rounded-lg text-sm ${message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
              <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                <span>📋</span>
                <span>{t('pt.renewal.renewalData')}</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    {t('pt.phoneNumber')}
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border-2 rounded-lg text-sm"
                    placeholder={t('pt.phonePlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    {t('pt.renewal.newSessionsCount')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.sessionsPurchased}
                    onChange={(e) => setFormData({ ...formData, sessionsPurchased: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border-2 rounded-lg text-sm"
                    placeholder={t('pt.sessionsPlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    {t('pt.coachName')} <span className="text-red-600">*</span>
                  </label>
                  {coachesLoading ? (
                    <div className="w-full px-3 py-2 border-2 rounded-lg bg-gray-50 text-gray-500 text-sm">
                      {t('pt.loadingCoaches')}
                    </div>
                  ) : coaches.length === 0 ? (
                    <div className="space-y-1">
                      <input
                        type="text"
                        required
                        value={formData.coachName}
                        onChange={(e) => setFormData({ ...formData, coachName: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm"
                        placeholder={t('pt.coachNamePlaceholder')}
                      />
                      <p className="text-xs text-amber-600">
                        ⚠️ {t('pt.noActiveCoaches')}
                      </p>
                    </div>
                  ) : (
                    <select
                      required
                      value={formData.coachName}
                      onChange={(e) => setFormData({ ...formData, coachName: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg bg-white text-sm"
                    >
                      <option value="">{t('pt.selectCoach')}</option>
                      {coaches.map((coach) => (
                        <option key={coach.id} value={coach.name}>
                          {coach.name} {coach.phone && `(${coach.phone})`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    {t('pt.renewal.totalPrice')} <span className="text-red-600">*</span>
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
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
                <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                  <span>📅</span>
                  <span>{t('pt.renewal.newSubscriptionPeriod')}</span>
                </h3>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      {t('pt.startDate')} <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3 py-2 border-2 rounded-lg font-mono text-sm"
                      placeholder={t('pt.startDatePlaceholder')}
                      pattern="\d{4}-\d{2}-\d{2}"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      {t('pt.expiryDate')} <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full px-3 py-2 border-2 rounded-lg font-mono text-sm"
                      placeholder={t('pt.expiryDatePlaceholder')}
                      pattern="\d{4}-\d{2}-\d{2}"
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-xs font-medium mb-2">⚡ {t('pt.quickAdd')}</p>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 6, 9, 12].map(months => (
                      <button
                        key={months}
                        type="button"
                        onClick={() => calculateExpiryFromMonths(months)}
                        className="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg text-xs transition font-medium"
                      >
                        + {months} {months === 1 ? t('pt.month') : t('pt.months')}
                      </button>
                    ))}
                  </div>
                </div>

                {duration !== null && formData.expiryDate && (
                  <div className="bg-white border-2 border-purple-300 rounded-lg p-2">
                    {duration > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">⏱️</span>
                        <div>
                          <p className="font-bold text-purple-800 text-xs">{t('pt.renewal.subscriptionDuration')}</p>
                          <p className="text-base font-mono">
                            {formatDurationInMonths(duration)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-red-600 flex items-center gap-2 text-xs">
                        <span>❌</span>
                        <span>{t('pt.renewal.dateError')}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-4">
                  <PaymentMethodSelector
                    value={formData.paymentMethod}
                    onChange={(method) => setFormData({ ...formData, paymentMethod: method })}
                    required
                  />
                </div>

                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl p-4">
                  <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                    <span>📊</span>
                    <span>{t('pt.renewal.summary')}</span>
                  </h3>

                  <div className="space-y-2">
                    <div className="bg-blue-50 border-l-4 border-r-4 border-blue-400 p-2 rounded">
                      <p className="text-xs text-blue-800">
                        ⚠️ {t('pt.renewal.replacementWarning', {
                          sessionsRemaining: session.sessionsRemaining.toString()
                        })}
                      </p>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{t('pt.renewal.newSessionsLabel')}</span>
                      <span className="font-bold text-green-600">{formData.sessionsPurchased} {t('pt.session')}</span>
                    </div>
                    <div className="bg-green-100 border-l-4 border-r-4 border-green-500 p-2 rounded">
                      <div className="flex justify-between">
                        <span className="font-bold text-gray-800 text-sm">{t('pt.renewal.paidAmount')}</span>
                        <span className="font-bold text-green-600 text-base">{formData.totalPrice} {t('pt.egp')}</span>
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
                {loading ? t('pt.renewal.renewing') : t('pt.renewal.renewButton')}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 bg-gray-200 text-gray-700 py-2.5 rounded-lg hover:bg-gray-300 transition font-medium text-base"
              >
                {t('pt.cancelButton')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}