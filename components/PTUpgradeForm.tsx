'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'
import { usePermissions } from '../hooks/usePermissions'
import { formatDateYMD } from '../lib/dateFormatter'
import Paymentmethodselector from './Paymentmethodselector'
import type { PaymentMethod } from '../lib/paymentHelpers'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

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
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pt-upgrade-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg ring-1 ring-gray-200 dark:ring-gray-700 max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6" dir={direction}>
        <div className="flex justify-between items-center mb-4">
          <h2 id="pt-upgrade-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg className="w-7 h-7 text-orange-500" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            </svg>
            <span>{locale === 'ar' ? 'ترقية باقة PT' : 'Upgrade PT Package'}</span>
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-300 rounded-lg p-1 transition-colors duration-200 disabled:opacity-50"
            aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
          >
            <svg className="w-6 h-6" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-3 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{locale === 'ar' ? 'الاشتراك الحالي' : 'Current Subscription'}</p>
          <p className="font-bold text-lg text-gray-900 dark:text-gray-100">
            {session.clientName} <span className="text-primary-600 dark:text-primary-400">#{session.ptNumber}</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
            <div className="bg-gray-50 dark:bg-gray-900/40 rounded p-2 text-center">
              <p className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'الحصص' : 'Sessions'}</p>
              <p className="font-bold text-gray-900 dark:text-gray-100">{session.sessionsRemaining}/{session.sessionsPurchased}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/40 rounded p-2 text-center">
              <p className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'سعر الحصة' : 'Per session'}</p>
              <p className="font-bold text-gray-900 dark:text-gray-100">{session.pricePerSession.toFixed(0)} {locale === 'ar' ? 'ج' : 'EGP'}</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded p-2 text-center">
              <p className="text-emerald-700 dark:text-emerald-300">{locale === 'ar' ? 'باقي مدفوع' : 'Remaining paid'}</p>
              <p className="font-bold text-emerald-700 dark:text-emerald-300">{remainingValue.toFixed(0)} {locale === 'ar' ? 'ج' : 'EGP'}</p>
            </div>
            {session.expiryDate && (
              <div className="bg-gray-50 dark:bg-gray-900/40 rounded p-2 text-center">
                <p className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'الانتهاء' : 'Expires'}</p>
                <p className="font-bold text-gray-900 dark:text-gray-100 font-mono">{formatDateYMD(session.expiryDate)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mb-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3">{locale === 'ar' ? 'اختر الباقة الجديدة' : 'Select new package'}</h3>
          {packagesLoading ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" {...stroke}>
                <circle className="opacity-25" cx="12" cy="12" r="10" />
                <path className="opacity-75" d="M4 12a8 8 0 018-8" strokeLinecap="round" />
              </svg>
              <span>{locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}</span>
            </p>
          ) : eligiblePackages.length === 0 ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-200 dark:ring-yellow-900/50 rounded-xl p-4 text-yellow-800 dark:text-yellow-200 text-sm flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span>{locale === 'ar' ? 'مفيش باقات أكبر مناسبة للترقية' : 'No eligible larger packages available'}</span>
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
                    className={`p-3 rounded-xl ring-1 text-start transition-colors duration-200 ${
                      isSelected
                        ? 'ring-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-sm'
                        : 'ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-800 hover:ring-orange-300 dark:hover:ring-orange-700'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-gray-100">{pkg.name}</h4>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          {pkg.sessions} {locale === 'ar' ? 'حصة' : 'sessions'} {'·'} {pkg.durationDays} {locale === 'ar' ? 'يوم' : 'days'}
                        </p>
                      </div>
                      {isSelected && (
                        <svg className="w-5 h-5 text-orange-500" {...stroke}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">{locale === 'ar' ? 'السعر:' : 'Price:'}</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{pkg.price.toFixed(0)} {locale === 'ar' ? 'ج' : 'EGP'}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-gray-600 dark:text-gray-400">{locale === 'ar' ? 'فرق السعر:' : 'Diff:'}</span>
                      <span className={`font-bold ${isSmaller ? 'text-gray-500 dark:text-gray-400' : 'text-orange-600 dark:text-orange-400'}`}>
                        {isSmaller
                          ? (locale === 'ar' ? 'بدون فرق' : 'No diff')
                          : `+${fee} ${locale === 'ar' ? 'ج' : 'EGP'}`}
                      </span>
                    </div>
                    {isSmaller && (
                      <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                        {locale === 'ar' ? 'باقة أصغر من الرصيد الحالي' : 'Smaller than current credit'}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {selectedPackage && (
          <div className="bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-200 dark:ring-orange-900/50 rounded-xl p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-orange-800 dark:text-orange-200 font-bold">{locale === 'ar' ? 'فرق السعر المحسوب:' : 'Computed difference:'}</span>
              <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{computedFee} {locale === 'ar' ? 'ج' : 'EGP'}</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <label htmlFor="upgrade-custom-price" className="text-sm font-bold text-gray-900 dark:text-gray-100 flex-1">
                {locale === 'ar' ? 'سعر النقل النهائي:' : 'Final fee:'}
              </label>
              <input
                id="upgrade-custom-price"
                type="number"
                min="0"
                value={customPrice}
                onChange={e => setCustomPrice(e.target.value)}
                placeholder={String(computedFee)}
                className="w-32 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'ج' : 'EGP'}</span>
              {customPrice !== '' && (
                <button
                  type="button"
                  onClick={() => setCustomPrice('')}
                  className="text-gray-400 hover:text-red-500 transition-colors duration-200"
                  aria-label={locale === 'ar' ? 'مسح' : 'Clear'}
                >
                  <svg className="w-4 h-4" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {newExpiryPreview && (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <svg className="w-4 h-4" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span>{locale === 'ar' ? 'الانتهاء الجديد:' : 'New expiry:'} <span className="font-mono font-bold">{formatDateYMD(newExpiryPreview)}</span></span>
              </p>
            )}
          </div>
        )}

        {selectedPackage && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-green-200 dark:ring-green-900/50 p-4 mb-4">
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

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-primary-200 dark:ring-primary-900/50 p-3 mb-4">
          <p className="text-xs text-primary-700 dark:text-primary-300 mb-1 flex items-center gap-1.5">
            <svg className="w-4 h-4" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span>{locale === 'ar' ? 'الموظف' : 'Staff'}</span>
          </p>
          <p className="font-bold text-primary-900 dark:text-primary-100">{user?.name || '—'}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedId}
            className="flex-1 bg-primary-500 hover:bg-primary-600 text-primary-contrast py-2.5 rounded-lg font-bold transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading
              ? (locale === 'ar' ? 'جاري الترقية...' : 'Upgrading...')
              : (locale === 'ar' ? 'تأكيد الترقية' : 'Confirm Upgrade')}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg font-bold transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {locale === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
