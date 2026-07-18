'use client'

import { useState, useEffect } from 'react'
import { calculateDaysBetween, formatDateYMD, formatDurationInMonths } from '../lib/dateFormatter'
import PaymentMethodSelector from './Paymentmethodselector'
import ReceiptSuccessModal from './ReceiptSuccessModal'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'
import type { PaymentMethod } from '../lib/paymentHelpers'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Staff {
  id: string
  name: string
  phone?: string
  position?: string
  isActive: boolean
}

interface PTSession {
  ptNumber: number
  memberNumber?: string | null
  clientName: string
  phone: string
  sessionsPurchased: number
  sessionsRemaining: number
  coachName: string
  pricePerSession: number
  startDate?: string
  expiryDate?: string
  remainingAmount?: number
}

interface PTRenewalFormProps {
  session: PTSession
  onSuccess: () => void
  onClose: () => void
}

export default function PTRenewalForm({ session, onSuccess, onClose }: PTRenewalFormProps) {
  const { user } = usePermissions()
  const { t, direction } = useLanguage()
  const toast = useToast()
  const { settings } = useServiceSettings()
  const [memberPoints, setMemberPoints] = useState(0)
  const [coaches, setCoaches] = useState<Staff[]>([])
  const [coachesLoading, setCoachesLoading] = useState(true)
  const [packages, setPackages] = useState<any[]>([])
  const [successMessage, setSuccessMessage] = useState('')
  const [createdReceipt, setCreatedReceipt] = useState<any>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

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
    coachName: string
    totalPrice: number
    remainingAmount: number //  مبلغ متبقي على الميمبر في التجديد الجديد
    startDate: string
    expiryDate: string
    paymentMethod: string | PaymentMethod[]
    staffName: string
  }>({
    phone: session.phone,
    sessionsPurchased: 0,
    coachName: session.coachName,
    totalPrice: 0,
    remainingAmount: 0,
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
      // /api/coaches/with-stats مفتوح لأي حد مسجّل دخول (مش محتاج canViewStaff)
      // عشان الكوتشيز يظهروا دايماً في فورم تجديد PT
      const response = await fetch('/api/coaches/with-stats')
      const data: Staff[] = await response.json()
      const activeCoaches = data.filter(
        (staff) => staff.isActive && (staff.position?.toLowerCase().includes('مدرب') || staff.position?.toLowerCase().includes('trainer'))
      )
      setCoaches(activeCoaches)
    } catch (error) {
      console.error('Error fetching coaches:', error)
    } finally {
      setCoachesLoading(false)
    }
  }

  const fetchPackages = async () => {
    try {
      const response = await fetch('/api/packages?serviceType=PT')
      const data = await response.json()
      if (Array.isArray(data)) {
        setPackages(data)
      } else {
        setPackages([])
      }
    } catch (error) {
      console.error('Error fetching PT packages:', error)
      setPackages([])
    }
  }

  const applyPackage = (pkg: any) => {
    let calculatedExpiry = ''
    if (formData.startDate && pkg.durationDays) {
      const start = new Date(formData.startDate)
      const expiry = new Date(start)
      expiry.setDate(expiry.getDate() + pkg.durationDays)
      calculatedExpiry = formatDateYMD(expiry)
    }

    setFormData(prev => ({
      ...prev,
      sessionsPurchased: pkg.sessions,
      totalPrice: pkg.price,
      expiryDate: calculatedExpiry || prev.expiryDate
    }))

    setSuccessMessage(`تم تطبيق باقة ${pkg.name} (${pkg.durationDays} يوم)`)
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
        toast.error(t('pt.renewal.dateError'))
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
        toast.success(t('pt.renewal.successMessage'))

        if (result.receipt) {
          //  الإيصال بيرجع كامل من /api/pt/renew فبنستخدمه على طول
          //  (قبل كده كان بيحاول يجيبه من /api/receipts/[id] اللي مش موجود أصلاً،
          //   فالمودال مكانش بيفتح والموظف بيحس إن التجديد ماتسجلش)
          setCreatedReceipt(result.receipt)
          setShowSuccessModal(true)
        } else {
          setTimeout(() => {
            onSuccess()
            onClose()
          }, 1500)
        }
      } else {
        toast.error(result.error || t('pt.renewal.failureMessage'))
      }
    } catch (error) {
      console.error(error)
      toast.error(t('pt.renewal.connectionError'))
    } finally {
      setLoading(false)
    }
  }

  const duration = calculateDuration()

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      dir={direction}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pt-renewal-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg ring-1 ring-gray-200 dark:ring-gray-700 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-primary-500 text-primary-contrast p-4 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 id="pt-renewal-title" className="text-xl font-bold mb-1 flex items-center gap-2">
                <svg className="w-6 h-6" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                <span>{t('pt.renewal.title')}</span>
              </h2>
              <p className="text-gray-800 text-sm">{t('pt.renewal.subtitle')}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-900 hover:bg-black/10 rounded-full w-8 h-8 flex items-center justify-center transition-colors duration-200"
              aria-label={t('pt.cancelButton')}
            >
              <svg className="w-5 h-5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4">
          {successMessage && (
            <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 p-3 rounded-lg text-center font-medium text-sm mb-4">
              {successMessage}
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-primary-200 dark:ring-primary-900/50 p-5 mb-4">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-primary-800 dark:text-primary-300">
              <svg className="w-6 h-6" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              <span>{direction === 'rtl' ? 'باقات PT المتاحة' : 'Available PT Packages'}</span>
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">{direction === 'rtl' ? 'اختر باقة لملء البيانات تلقائياً' : 'Select a package to auto-fill data'}</p>

            {!Array.isArray(packages) || packages.length === 0 ? (
              <div className="text-center py-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl ring-1 ring-dashed ring-gray-300 dark:ring-gray-600">
                <p className="text-gray-500 dark:text-gray-400 text-xs">{direction === 'rtl' ? 'لا توجد باقات PT متاحة' : 'No PT packages available'}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{direction === 'rtl' ? 'يمكن للمدير إضافة باقات من الإعدادات' : 'Admin can add packages from settings'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {packages.map(pkg => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => applyPackage(pkg)}
                    className="bg-white dark:bg-gray-800 ring-1 ring-primary-300 dark:ring-primary-900/50 hover:ring-primary-500 dark:hover:ring-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl p-3 transition-colors duration-200"
                  >
                    <svg className="w-7 h-7 mx-auto mb-1 text-primary-600 dark:text-primary-400" {...stroke}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                    <div className="font-bold text-primary-800 dark:text-primary-300 mb-1 text-sm">{pkg.name}</div>
                    <div className="text-xl font-bold text-green-600 dark:text-green-400 mb-1">{pkg.price} {t('renewal.currency')}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                      <div>{pkg.sessions} {direction === 'rtl' ? 'جلسة' : 'sessions'}</div>
                      {pkg.durationDays && <div className="text-blue-600 dark:text-blue-400">{pkg.durationDays} {direction === 'rtl' ? 'يوم' : 'days'}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className={`mt-3 bg-primary-50 dark:bg-primary-900/20 p-2 rounded ${direction === 'rtl' ? 'border-e-4' : 'border-s-4'} border-primary-500 dark:border-primary-700`}>
              <p className="text-xs text-primary-800 dark:text-primary-300">
                <strong>{direction === 'rtl' ? 'ملاحظة' : 'Note'}:</strong> {direction === 'rtl' ? 'يمكنك تعديل البيانات بعد اختيار الباقة' : 'You can edit the data after selecting a package'}
              </p>
            </div>
          </div>

          <div className={`bg-green-50 dark:bg-green-900/20 ${direction === 'rtl' ? 'border-e-4' : 'border-s-4'} border-green-500 dark:border-green-700 p-3 rounded-lg mb-4`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">{t('pt.renewal.ptNumber')}</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">#{session.memberNumber ?? session.ptNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">{t('pt.renewal.clientName')}</p>
                <p className="text-base font-bold text-gray-900 dark:text-gray-100">{session.clientName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">{t('pt.renewal.currentCoach')}</p>
                <p className="text-base text-gray-900 dark:text-gray-100">{session.coachName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">{t('pt.renewal.currentRemainingSessions')}</p>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{session.sessionsRemaining}</p>
              </div>
            </div>

            {(session.remainingAmount || 0) > 0 && (
              <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-900/50">
                <div className="bg-orange-100 dark:bg-orange-900/30 ring-1 ring-orange-300 dark:ring-orange-900/50 rounded-lg p-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-orange-700 dark:text-orange-300">{direction === 'rtl' ? 'المبلغ المتبقي من الاشتراك السابق' : 'Remaining from previous subscription'}</span>
                  <span className="text-base font-bold text-orange-600 dark:text-orange-400">{(session.remainingAmount || 0).toFixed(0)} {t('pt.egp')}</span>
                </div>
              </div>
            )}

            {session.expiryDate && (
              <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-900/50">
                <p className="text-xs text-gray-600 dark:text-gray-400 inline-block">{t('pt.renewal.currentExpiryDate')}: </p>
                <p className="text-sm font-mono inline-block ms-2 text-gray-900 dark:text-gray-100">{formatDateYMD(session.expiryDate)}</p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-primary-200 dark:ring-primary-900/50 p-5">
              <h3 className="font-bold text-base mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <svg className="w-5 h-5" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
                <span>{t('pt.renewal.renewalData')}</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="pt-renew-phone" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('pt.phoneNumber')}
                  </label>
                  <input
                    id="pt-renew-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    placeholder={t('pt.phonePlaceholder')}
                    dir="ltr"
                  />
                </div>

                <div>
                  <label htmlFor="pt-renew-sessions" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('pt.renewal.newSessionsCount')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="pt-renew-sessions"
                    type="number"
                    required
                    min="1"
                    value={formData.sessionsPurchased}
                    onChange={(e) => setFormData({ ...formData, sessionsPurchased: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    placeholder={t('pt.sessionsPlaceholder')}
                  />
                </div>

                <div>
                  <label htmlFor="pt-renew-coach" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('pt.coachName')} <span className="text-red-600">*</span>
                  </label>
                  {coachesLoading ? (
                    <div className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm">
                      {t('pt.loadingCoaches')}
                    </div>
                  ) : coaches.length === 0 ? (
                    <div className="space-y-1">
                      <input
                        id="pt-renew-coach"
                        type="text"
                        required
                        value={formData.coachName}
                        onChange={(e) => setFormData({ ...formData, coachName: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                        placeholder={t('pt.coachNamePlaceholder')}
                      />
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" {...stroke}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        <span>{t('pt.noActiveCoaches')}</span>
                      </p>
                    </div>
                  ) : (
                    <select
                      id="pt-renew-coach"
                      required
                      value={formData.coachName}
                      onChange={(e) => setFormData({ ...formData, coachName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
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

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pt-renew-price" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('pt.renewal.totalPrice')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="pt-renew-price"
                    type="number"
                    required
                    min="0"
                    value={formData.totalPrice}
                    onChange={(e) => setFormData({ ...formData, totalPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-green-400 dark:border-green-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors duration-200 font-bold"
                    placeholder="0.00"
                  />
                </div>
                {/*  المبلغ المتبقي (تبقية فلوس) — اختياري */}
                <div>
                  <label htmlFor="pt-renew-remaining" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {direction === 'rtl' ? 'الباقي عليه (تبقية)' : 'Remaining (Owes)'}
                  </label>
                  <input
                    id="pt-renew-remaining"
                    type="number"
                    min="0"
                    max={formData.totalPrice || undefined}
                    value={formData.remainingAmount || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      const capped = Math.max(0, Math.min(val, formData.totalPrice || 0))
                      setFormData({ ...formData, remainingAmount: capped })
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-orange-400 dark:border-orange-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200 font-bold"
                    placeholder="0.00"
                  />
                  {formData.remainingAmount > 0 && formData.totalPrice > 0 && (
                    <p className="mt-1 text-xs text-green-700 dark:text-green-400 font-bold">
                      💰 {direction === 'rtl' ? 'المدفوع:' : 'Paid:'} {(formData.totalPrice - formData.remainingAmount).toFixed(0)} {t('pt.egp')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-primary-200 dark:ring-primary-900/50 p-5">
                <h3 className="font-bold text-base mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <svg className="w-5 h-5" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  <span>{t('pt.renewal.newSubscriptionPeriod')}</span>
                </h3>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label htmlFor="pt-renew-start" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      {t('pt.startDate')} <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="pt-renew-start"
                      type="text"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 font-mono"
                      placeholder={t('pt.startDatePlaceholder')}
                      pattern="\d{4}-\d{2}-\d{2}"
                    />
                  </div>

                  <div>
                    <label htmlFor="pt-renew-expiry" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      {t('pt.expiryDate')} <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="pt-renew-expiry"
                      type="text"
                      required
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 font-mono"
                      placeholder={t('pt.expiryDatePlaceholder')}
                      pattern="\d{4}-\d{2}-\d{2}"
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-xs font-bold mb-2 text-gray-700 dark:text-gray-300">{t('pt.quickAdd')}</p>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 6, 9, 12].map(months => (
                      <button
                        key={months}
                        type="button"
                        onClick={() => calculateExpiryFromMonths(months)}
                        className="px-2.5 py-1 bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 dark:hover:bg-primary-800/40 text-primary-800 dark:text-primary-300 rounded-lg text-xs font-bold transition-colors duration-200"
                      >
                        + {months} {months === 1 ? t('pt.month') : t('pt.months')}
                      </button>
                    ))}
                  </div>
                </div>

                {duration !== null && formData.expiryDate && (
                  <div className="bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-900/50 rounded-lg p-2">
                    {duration > 0 ? (
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" {...stroke}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="font-bold text-primary-800 dark:text-primary-300 text-xs">{t('pt.renewal.subscriptionDuration')}</p>
                          <p className="text-base font-mono text-gray-900 dark:text-gray-100">
                            {formatDurationInMonths(duration)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-red-600 dark:text-red-400 flex items-center gap-2 text-xs">
                        <svg className="w-4 h-4" {...stroke}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>{t('pt.renewal.dateError')}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-green-200 dark:ring-green-900/50 p-5">
                  <PaymentMethodSelector
                    value={formData.paymentMethod}
                    onChange={(method) => setFormData({ ...formData, paymentMethod: method })}
                    allowMultiple={true}
                    //  المبلغ المطلوب توزيعه = المدفوع فعلاً (الإجمالي - التبقية)
                    totalAmount={Math.max(0, formData.totalPrice - formData.remainingAmount)}
                    memberPoints={memberPoints}
                    pointsValueInEGP={settings.pointsValueInEGP}
                    pointsEnabled={settings.pointsEnabled}
                    required
                  />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-yellow-200 dark:ring-yellow-900/50 p-5">
                  <h3 className="font-bold text-base mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <svg className="w-5 h-5" {...stroke}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                    <span>{t('pt.renewal.summary')}</span>
                  </h3>

                  <div className="space-y-2">
                    <div className={`bg-primary-50 dark:bg-primary-900/20 ${direction === 'rtl' ? 'border-e-4' : 'border-s-4'} border-primary-400 dark:border-primary-700 p-2 rounded`}>
                      <p className="text-xs text-primary-800 dark:text-primary-300">
                        {t('pt.renewal.replacementWarning', {
                          sessionsRemaining: session.sessionsRemaining.toString()
                        })}
                      </p>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{t('pt.renewal.newSessionsLabel')}</span>
                      <span className="font-bold text-green-600 dark:text-green-400">{formData.sessionsPurchased} {t('pt.session')}</span>
                    </div>
                    <div className={`bg-green-100 dark:bg-green-900/20 ${direction === 'rtl' ? 'border-e-4' : 'border-s-4'} border-green-500 dark:border-green-700 p-2 rounded`}>
                      <div className="flex justify-between">
                        <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">{t('pt.renewal.paidAmount')}</span>
                        <span className="font-bold text-green-600 dark:text-green-400 text-base">{formData.totalPrice} {t('pt.egp')}</span>
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
                className="flex-1 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? t('pt.renewal.renewing') : t('pt.renewal.renewButton')}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-bold transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {t('pt.cancelButton')}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ReceiptSuccessModal
        receipt={createdReceipt}
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false)
          onSuccess()
          onClose()
        }}
      />
    </div>
  )
}
