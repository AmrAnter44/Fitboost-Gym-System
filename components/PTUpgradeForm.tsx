'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'
import { usePermissions } from '../hooks/usePermissions'
import { formatDateYMD } from '../lib/dateFormatter'
import Paymentmethodselector from './Paymentmethodselector'
import type { PaymentMethod } from '../lib/paymentHelpers'

interface PTSession {
  ptNumber: number
  clientName: string
  phone: string
  sessionsPurchased: number
  sessionsRemaining: number
  pricePerSession: number
  startDate?: string
  expiryDate?: string
}

interface Package {
  id: string
  name: string
  serviceType: string
  sessions: number
  price: number
  durationDays: number
  isActive: boolean
}

interface UpgradeReceipt {
  id?: string
  receiptNumber: number
  amount: number
  paymentMethod: string
  staffName?: string
  itemDetails: any
  createdAt: string
}

interface UpgradeResult {
  success: boolean
  upgradeFee: number
  computedUpgradeFee: number
  remainingValueFromPrevious: number
  pt: any
  receipt: UpgradeReceipt
}

interface Props {
  session: PTSession
  onClose: () => void
  onSuccess: (res: UpgradeResult) => void
}

export default function PTUpgradeForm({ session, onClose, onSuccess }: Props) {
  const { locale, direction } = useLanguage()
  const { user } = usePermissions()
  const { settings } = useServiceSettings()

  const [packages, setPackages] = useState<Package[]>([])
  const [packagesLoading, setPackagesLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<string | PaymentMethod[]>('cash')
  const [customPrice, setCustomPrice] = useState<string>('')
  const [memberPoints, setMemberPoints] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/packages?serviceType=PT')
      .then(r => r.ok ? r.json() : [])
      .then((data: Package[]) => {
        setPackages(Array.isArray(data) ? data.filter(p => p.isActive) : [])
      })
      .catch(() => setPackages([]))
      .finally(() => setPackagesLoading(false))
  }, [])

  useEffect(() => {
    if (!session.phone) return
    fetch(`/api/members?phone=${encodeURIComponent(session.phone)}`)
      .then(r => r.ok ? r.json() : [])
      .then((arr: any[]) => {
        if (arr?.length > 0) setMemberPoints(arr[0].points || 0)
      })
      .catch(() => {})
  }, [session.phone])

  const remainingValue = useMemo(
    () => (session.sessionsRemaining || 0) * (session.pricePerSession || 0),
    [session.sessionsRemaining, session.pricePerSession]
  )

  // كل الباقات النشطة بدون فلترة — السيرفر بيـ clamp الفرق إلى صفر لو الباقة أصغر
  const eligiblePackages = packages

  const selectedPackage = packages.find(p => p.id === selectedId)
  const computedFee = selectedPackage ? Math.max(0, Math.round(selectedPackage.price - remainingValue)) : 0
  const finalFee = customPrice !== '' && !isNaN(parseFloat(customPrice))
    ? Math.max(0, Math.round(parseFloat(customPrice)))
    : computedFee

  const newExpiryPreview = useMemo(() => {
    if (!selectedPackage) return null
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + (selectedPackage.durationDays || 30))
    return d
  }, [selectedPackage])

  const handleSubmit = async () => {
    setError('')
    if (!selectedId) {
      setError(locale === 'ar' ? 'اختر باقة' : 'Select a package')
      return
    }
    setLoading(true)
    try {
      const body: any = {
        ptNumber: session.ptNumber,
        newPackageId: selectedId,
        paymentMethod,
        staffName: user?.name || '',
      }
      if (customPrice !== '' && !isNaN(parseFloat(customPrice))) {
        body.customPrice = parseFloat(customPrice)
      }
      const res = await fetch('/api/pt/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      onSuccess(data)
    } catch (e: any) {
      setError(e?.message || (locale === 'ar' ? 'فشل الترقية' : 'Upgrade failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6" dir={direction}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <span>🚀</span>
            <span>{locale === 'ar' ? 'ترقية باقة PT' : 'Upgrade PT Package'}</span>
          </h2>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600 text-3xl leading-none disabled:opacity-50">×</button>
        </div>

        {error && (
          <div className="mb-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Current */}
        <div className="bg-gray-50 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600 rounded-xl p-4 mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{locale === 'ar' ? 'الاشتراك الحالي' : 'Current Subscription'}</p>
          <p className="font-bold text-lg text-gray-900 dark:text-gray-100">
            {session.clientName} <span className="text-primary-600">#{session.ptNumber}</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
            <div className="bg-white dark:bg-gray-800 rounded p-2 text-center">
              <p className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'الحصص' : 'Sessions'}</p>
              <p className="font-bold text-gray-900 dark:text-gray-100">{session.sessionsRemaining}/{session.sessionsPurchased}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded p-2 text-center">
              <p className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'سعر الحصة' : 'Per session'}</p>
              <p className="font-bold text-gray-900 dark:text-gray-100">{session.pricePerSession.toFixed(0)} {locale === 'ar' ? 'ج' : 'EGP'}</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded p-2 text-center">
              <p className="text-emerald-700 dark:text-emerald-300">{locale === 'ar' ? 'باقي مدفوع' : 'Remaining paid'}</p>
              <p className="font-bold text-emerald-700 dark:text-emerald-300">{remainingValue.toFixed(0)} {locale === 'ar' ? 'ج' : 'EGP'}</p>
            </div>
            {session.expiryDate && (
              <div className="bg-white dark:bg-gray-800 rounded p-2 text-center">
                <p className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'الانتهاء' : 'Expires'}</p>
                <p className="font-bold text-gray-900 dark:text-gray-100 font-mono">{formatDateYMD(session.expiryDate)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Packages */}
        <div className="mb-4">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-3">{locale === 'ar' ? 'اختر الباقة الجديدة' : 'Select new package'}</h3>
          {packagesLoading ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">⏳ {locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
          ) : eligiblePackages.length === 0 ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl p-4 text-yellow-800 dark:text-yellow-200 text-sm">
              ⚠️ {locale === 'ar' ? 'مفيش باقات أكبر مناسبة للترقية' : 'No eligible larger packages available'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {eligiblePackages.map(pkg => {
                const rawDiff = pkg.price - remainingValue
                const fee = Math.max(0, Math.round(rawDiff))
                const isSmaller = rawDiff < 0
                const isSelected = selectedId === pkg.id
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedId(pkg.id)}
                    className={`p-3 rounded-xl border-2 text-start transition-all ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow'
                        : 'border-gray-300 dark:border-gray-600 hover:border-orange-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-gray-100">{pkg.name}</h4>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          {pkg.sessions} {locale === 'ar' ? 'حصة' : 'sessions'} • {pkg.durationDays} {locale === 'ar' ? 'يوم' : 'days'}
                        </p>
                      </div>
                      {isSelected && <span className="text-orange-500 text-xl">✓</span>}
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-300">{locale === 'ar' ? 'السعر:' : 'Price:'}</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{pkg.price.toFixed(0)} {locale === 'ar' ? 'ج' : 'EGP'}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-gray-600 dark:text-gray-300">{locale === 'ar' ? 'فرق السعر:' : 'Diff:'}</span>
                      <span className={`font-bold ${isSmaller ? 'text-gray-500' : 'text-orange-600'}`}>
                        {isSmaller
                          ? (locale === 'ar' ? 'بدون فرق' : 'No diff')
                          : `+${fee} ${locale === 'ar' ? 'ج' : 'EGP'}`}
                      </span>
                    </div>
                    {isSmaller && (
                      <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                        ⚠️ {locale === 'ar' ? 'باقة أصغر من الرصيد الحالي' : 'Smaller than current credit'}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Selected summary */}
        {selectedPackage && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-xl p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-orange-800 dark:text-orange-200 font-bold">{locale === 'ar' ? 'فرق السعر المحسوب:' : 'Computed difference:'}</span>
              <span className="text-2xl font-bold text-orange-600">{computedFee} {locale === 'ar' ? 'ج' : 'EGP'}</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm font-bold text-gray-800 dark:text-gray-100 flex-1">{locale === 'ar' ? 'سعر النقل النهائي:' : 'Final fee:'}</span>
              <input
                type="number"
                min="0"
                value={customPrice}
                onChange={e => setCustomPrice(e.target.value)}
                placeholder={String(computedFee)}
                className="w-32 px-2 py-1 border-2 border-orange-300 dark:border-orange-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center font-bold focus:outline-none focus:border-orange-500"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'ج' : 'EGP'}</span>
              {customPrice !== '' && (
                <button onClick={() => setCustomPrice('')} className="text-xs text-gray-400 hover:text-red-500">✕</button>
              )}
            </div>
            {newExpiryPreview && (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                📅 {locale === 'ar' ? 'الانتهاء الجديد:' : 'New expiry:'} <span className="font-mono font-bold">{formatDateYMD(newExpiryPreview)}</span>
              </p>
            )}
          </div>
        )}

        {/* Payment */}
        {selectedPackage && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-700 rounded-xl p-4 mb-4">
            <Paymentmethodselector
              value={paymentMethod}
              onChange={setPaymentMethod}
              allowMultiple={true}
              totalAmount={finalFee}
              memberPoints={memberPoints}
              pointsValueInEGP={settings.pointsValueInEGP}
              pointsEnabled={settings.pointsEnabled}
              required
            />
          </div>
        )}

        <div className="bg-primary-50 dark:bg-gray-700 border-2 border-primary-200 dark:border-gray-600 rounded-lg p-3 mb-4">
          <p className="text-xs text-primary-700 dark:text-primary-300 mb-1">👨‍💼 {locale === 'ar' ? 'الموظف' : 'Staff'}</p>
          <p className="font-bold text-primary-900 dark:text-primary-100">{user?.name || '—'}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedId}
            className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 text-white py-3 rounded-xl font-bold hover:from-orange-700 hover:to-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? (locale === 'ar' ? '⏳ جاري الترقية...' : '⏳ Upgrading...') : (locale === 'ar' ? '🚀 تأكيد الترقية' : '🚀 Confirm Upgrade')}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-xl font-bold hover:bg-gray-400 dark:hover:bg-gray-600"
          >
            {locale === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
