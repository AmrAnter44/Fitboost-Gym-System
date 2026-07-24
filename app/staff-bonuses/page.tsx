'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLanguage } from '../../contexts/LanguageContext'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionDenied from '../../components/PermissionDenied'
import { LoadingScreen } from '../../components/Spinner'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Staff {
  id: string
  staffCode: string
  name: string
  position?: string
  salary?: number
  isActive: boolean
}

interface Bonus {
  id: string
  staffId: string
  amount: number
  reason: string
  month: number
  year: number
  notes?: string
  createdAt: string
  staff: Staff
}

export default function StaffBonusesPage() {
  const { t, locale, direction } = useLanguage()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const localeString = locale === 'ar' ? 'ar-EG' : 'en-US'

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const monthNames = locale === 'ar'
    ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  const [bonuses, setBonuses] = useState<Bonus[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [filterStaffId, setFilterStaffId] = useState<string>('all')
  const [filterMonth, setFilterMonth] = useState<number | 'all'>('all')
  const [filterYear, setFilterYear] = useState<number | 'all'>('all')

  const [showForm, setShowForm] = useState(false)
  // عدد أيام العمل الشهرية (لحساب "بونص يوم" = المرتب ÷ أيام العمل) — من إعدادات الرواتب
  const [workingDays, setWorkingDays] = useState(30)
  const [formData, setFormData] = useState({
    staffId: '',
    kind: 'amount' as 'amount' | 'days',
    amount: '',
    days: '',
    reason: '',
    month: currentMonth,
    year: currentYear,
    notes: '',
  })

  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string | null; name: string }>({
    show: false, id: null, name: ''
  })

  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!permissionsLoading && hasPermission('canViewBonuses')) {
      fetchBonuses()
      fetchStaff()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsLoading])

  // Apply URL params for deep-link filters
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const sid = params.get('staffId')
    const m = params.get('month')
    const y = params.get('year')
    if (sid) setFilterStaffId(sid)
    if (m) setFilterMonth(parseInt(m, 10))
    if (y) setFilterYear(parseInt(y, 10))
  }, [])

  const fetchBonuses = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/bonuses')
      if (res.ok) {
        const data = await res.json()
        setBonuses(data)
      }
    } catch (e) {
      console.error('Failed to fetch bonuses', e)
    } finally {
      setLoading(false)
    }
  }

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/staff')
      if (res.ok) {
        const data = await res.json()
        setStaffList(data.filter((s: Staff) => s.isActive))
      }
    } catch (e) {
      console.error('Failed to fetch staff', e)
    }
    // أيام العمل الشهرية من إعدادات الرواتب (لحساب معاينة بونص اليوم)
    try {
      const sres = await fetch('/api/settings/services')
      if (sres.ok) {
        const s = await sres.json()
        if (s?.payrollWorkingDaysPerMonth > 0) setWorkingDays(s.payrollWorkingDaysPerMonth)
      }
    } catch {}
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/bonuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: formData.staffId,
          ...(formData.kind === 'days'
            ? { days: parseInt(formData.days, 10) }
            : { amount: parseFloat(formData.amount) }),
          reason: formData.reason,
          month: formData.month,
          year: formData.year,
          notes: formData.notes || undefined,
        })
      })
      if (res.ok) {
        setSuccessMsg(t('bonuses.addSuccess'))
        setFormData({ staffId: '', kind: 'amount', amount: '', days: '', reason: '', month: currentMonth, year: currentYear, notes: '' })
        setShowForm(false)
        fetchBonuses()
        setTimeout(() => setSuccessMsg(''), 3000)
      } else {
        const data = await res.json()
        setErrorMsg(data.error || t('bonuses.addFail'))
      }
    } catch {
      setErrorMsg(t('bonuses.connectionError'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm.id) return
    try {
      const res = await fetch(`/api/bonuses/${deleteConfirm.id}`, { method: 'DELETE' })
      if (res.ok) {
        setSuccessMsg(t('bonuses.deleteSuccess'))
        setDeleteConfirm({ show: false, id: null, name: '' })
        fetchBonuses()
        setTimeout(() => setSuccessMsg(''), 3000)
      } else {
        const data = await res.json()
        setErrorMsg(data.error || t('bonuses.deleteFail'))
      }
    } catch {
      setErrorMsg(t('bonuses.connectionError'))
    }
  }

  const filteredBonuses = bonuses.filter(b => {
    if (filterStaffId !== 'all' && b.staffId !== filterStaffId) return false
    if (filterMonth !== 'all' && b.month !== filterMonth) return false
    if (filterYear !== 'all' && b.year !== filterYear) return false
    return true
  })

  const thisMonthBonuses = bonuses.filter(b => b.month === currentMonth && b.year === currentYear)
  const thisMonthTotal = thisMonthBonuses.reduce((s, b) => s + b.amount, 0)
  const thisYearBonuses = bonuses.filter(b => b.year === currentYear)
  const thisYearTotal = thisYearBonuses.reduce((s, b) => s + b.amount, 0)
  const totalAll = bonuses.reduce((s, b) => s + b.amount, 0)

  const availableYears = Array.from(new Set([currentYear, currentYear - 1, ...bonuses.map(b => b.year)])).sort((a, b) => b - a)

  if (permissionsLoading) {
    return <LoadingScreen fullScreen />
  }

  if (!hasPermission('canViewBonuses')) {
    return <PermissionDenied message={t('bonuses.title')} />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6" dir={direction}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <svg {...stroke} className="w-6 h-6" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('bonuses.title')}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('bonuses.subtitle')}</p>
          </div>
        </div>
        {hasPermission('canCreateBonus') && (
          <button
            onClick={() => { setShowForm(!showForm); setErrorMsg('') }}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 text-sm"
          >
            <svg {...stroke} className="w-4 h-4" aria-hidden="true">
              {showForm ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              )}
            </svg>
            <span>{showForm ? t('common.cancel') : t('bonuses.addBonus')}</span>
          </button>
        )}
      </div>

      {/* Success/Error messages */}
      {successMsg && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 text-green-800 dark:text-green-300 px-4 py-3 rounded-lg flex items-center gap-2">
          <svg {...stroke} className="w-5 h-5 flex-shrink-0" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg flex items-center gap-2">
          <svg {...stroke} className="w-5 h-5 flex-shrink-0" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          {
            label: t('bonuses.thisMonthBonuses'),
            value: `${thisMonthTotal.toLocaleString(localeString)} ${t('bonuses.currency')}`,
            sub: `${thisMonthBonuses.length} ${t('bonuses.thisMonthCount')}`,
            tone: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
            icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />),
            valueTone: 'text-emerald-600 dark:text-emerald-400'
          },
          {
            label: t('bonuses.thisYearBonuses'),
            value: `${thisYearTotal.toLocaleString(localeString)} ${t('bonuses.currency')}`,
            sub: `${thisYearBonuses.length} ${t('bonuses.thisYearCount')}`,
            tone: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
            icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />),
            valueTone: 'text-green-600 dark:text-green-400'
          },
          {
            label: t('bonuses.totalBonuses'),
            value: `${totalAll.toLocaleString(localeString)} ${t('bonuses.currency')}`,
            sub: `${bonuses.length} ${t('bonuses.totalCount')}`,
            tone: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
            icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />),
            valueTone: 'text-gray-900 dark:text-gray-100'
          }
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
            <div className={`w-10 h-10 rounded-lg ${s.tone} flex items-center justify-center mb-3`}>
              <svg {...stroke} className="w-5 h-5" aria-hidden="true">{s.icon}</svg>
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold ${s.valueTone}`}>{s.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 mb-6">
          <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg {...stroke} className="w-5 h-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>{t('bonuses.addNew')}</span>
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('bonuses.staff')} *</label>
                <select
                  value={formData.staffId}
                  onChange={e => setFormData({ ...formData, staffId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors duration-200"
                  required
                >
                  <option value="">{t('bonuses.selectStaff')}</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.position || t('bonuses.employee')})</option>
                  ))}
                </select>
              </div>
              <div>
                {/* اختيار النوع: مبلغ ثابت أو بعدد الأيام (بونص يوم) */}
                <div className="flex items-center gap-1 mb-1.5">
                  <button type="button" onClick={() => setFormData({ ...formData, kind: 'amount' })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${formData.kind === 'amount' ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {locale === 'ar' ? 'مبلغ' : 'Amount'}
                  </button>
                  <button type="button" onClick={() => setFormData({ ...formData, kind: 'days' })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${formData.kind === 'days' ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {locale === 'ar' ? 'بونص يوم' : 'By days'}
                  </button>
                </div>
                {formData.kind === 'amount' ? (
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors duration-200"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    required
                  />
                ) : (
                  <>
                    <input
                      type="number"
                      value={formData.days}
                      onChange={e => setFormData({ ...formData, days: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors duration-200"
                      placeholder={locale === 'ar' ? 'عدد الأيام' : 'Number of days'}
                      min="0"
                      step="1"
                      required
                    />
                    {(() => {
                      const sel = staffList.find(s => s.id === formData.staffId)
                      const d = parseInt(formData.days, 10)
                      if (!sel) return <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{locale === 'ar' ? 'اختر الموظف الأول' : 'Select staff first'}</p>
                      if (!sel.salary) return <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{locale === 'ar' ? 'الموظف ملوش مرتب محدد' : 'Staff has no salary set'}</p>
                      const daily = sel.salary / workingDays
                      const total = d > 0 ? Math.round(d * daily) : 0
                      return <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 font-bold">
                        {locale === 'ar'
                          ? `= ${total.toLocaleString('en')} ج.م (اليوم ≈ ${Math.round(daily).toLocaleString('en')} على ${workingDays} يوم)`
                          : `= ${total.toLocaleString('en')} EGP (day ≈ ${Math.round(daily).toLocaleString('en')} on ${workingDays} days)`}
                      </p>
                    })()}
                  </>
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('bonuses.month')} *</label>
                <select
                  value={formData.month}
                  onChange={e => setFormData({ ...formData, month: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors duration-200"
                  required
                >
                  {monthNames.map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('bonuses.year')} *</label>
                <select
                  value={formData.year}
                  onChange={e => setFormData({ ...formData, year: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors duration-200"
                  required
                >
                  {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('bonuses.reason')} *</label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors duration-200"
                  placeholder={t('bonuses.reasonPlaceholder')}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('common.notes')}</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors duration-200"
                  rows={2}
                  placeholder={t('bonuses.notesPlaceholder')}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
              >
                {submitting ? (
                  <svg {...stroke} className="w-4 h-4 animate-spin" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
                <span>{submitting ? t('bonuses.saving') : t('bonuses.submit')}</span>
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setErrorMsg('') }}
                className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 text-sm"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterStaffId}
          onChange={e => setFilterStaffId(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors duration-200 text-sm"
          aria-label={t('bonuses.allStaff')}
        >
          <option value="all">{t('bonuses.allStaff')}</option>
          {staffList.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors duration-200 text-sm"
          aria-label={t('bonuses.allMonths')}
        >
          <option value="all">{t('bonuses.allMonths')}</option>
          {monthNames.map((name, i) => (
            <option key={i + 1} value={i + 1}>{name}</option>
          ))}
        </select>
        <select
          value={filterYear}
          onChange={e => setFilterYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors duration-200 text-sm"
          aria-label={t('bonuses.allYears')}
        >
          <option value="all">{t('bonuses.allYears')}</option>
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <span className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 self-center">
          {filteredBonuses.length} {t('bonuses.bonusCount')}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingScreen message={t('common.loading')} />
      ) : filteredBonuses.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 flex flex-col items-center justify-center py-12 text-center">
          <svg {...stroke} className="w-12 h-12 text-gray-400" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
          </svg>
          <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('bonuses.noBonuses')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('bonuses.noAny')}</p>
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredBonuses.map(b => (
              <div key={b.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-900/40 px-4 py-2 flex justify-between items-center">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                    <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                    </svg>
                    {monthNames[b.month - 1]} {b.year}
                  </span>
                  {hasPermission('canDeleteBonus') && (
                    <button
                      onClick={() => setDeleteConfirm({ show: true, id: b.id, name: b.reason })}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors duration-200"
                      aria-label="حذف"
                      title="حذف"
                    >
                      <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link href={`/staff-hr-assistant?staffId=${b.staffId}&month=${b.month}&year=${b.year}`} className="font-bold text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 hover:underline block">{b.staff.name}</Link>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{b.staff.position || '-'}</p>
                    </div>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">+ {b.amount.toLocaleString(localeString)} {t('bonuses.currency')}</p>
                  </div>
                  <p className="text-gray-700 dark:text-gray-200 text-sm font-medium">{b.reason}</p>
                  {b.notes && <p className="text-gray-600 dark:text-gray-400 text-xs">{b.notes}</p>}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(b.createdAt).toLocaleDateString(localeString)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-start font-bold">{t('bonuses.staffCol')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('bonuses.amountCol')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('bonuses.reasonCol')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('bonuses.periodCol')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('bonuses.dateCol')}</th>
                  <th className="px-4 py-3 text-center font-bold">{t('bonuses.actionsCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {filteredBonuses.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/staff-hr-assistant?staffId=${b.staffId}&month=${b.month}&year=${b.year}`} className="font-bold text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 hover:underline block">{b.staff.name}</Link>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{b.staff.position || '-'}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                      + {b.amount.toLocaleString(localeString)} {t('bonuses.currency')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 dark:text-gray-300">{b.reason}</p>
                      {b.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{b.notes}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                        {monthNames[b.month - 1]} {b.year}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {new Date(b.createdAt).toLocaleDateString(localeString)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hasPermission('canDeleteBonus') ? (
                        <button
                          onClick={() => setDeleteConfirm({ show: true, id: b.id, name: b.reason })}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors duration-200"
                          aria-label="حذف"
                          title="حذف"
                        >
                          <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165" />
                          </svg>
                        </button>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in" role="dialog" aria-modal="true" aria-labelledby="delete-bonus-confirm-title">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-red-200 dark:ring-red-900/50 max-w-sm w-full p-6 animate-modal-in">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 mx-auto mb-3 flex items-center justify-center">
                <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165" />
                </svg>
              </div>
              <h3 id="delete-bonus-confirm-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('bonuses.confirmDelete')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {t('bonuses.confirmDeleteMsg')} <strong>&quot;{deleteConfirm.name}&quot;</strong>؟
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                autoFocus
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                {t('bonuses.confirmDeleteBtn')}
              </button>
              <button
                onClick={() => setDeleteConfirm({ show: false, id: null, name: '' })}
                className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-2.5 rounded-lg transition-colors duration-200"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
