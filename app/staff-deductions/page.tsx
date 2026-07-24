'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

interface StaffDeduction {
  id: string
  staffId: string
  amount: number
  reason: string
  notes?: string
  isApplied: boolean
  appliedAt?: string
  createdAt: string
  staff: Staff
}

export default function StaffDeductionsPage() {
  const { t, locale, direction } = useLanguage()
  const router = useRouter()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const localeString = locale === 'ar' ? 'ar-EG' : 'en-US'

  const [deductions, setDeductions] = useState<StaffDeduction[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [filterStaffId, setFilterStaffId] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'applied'>('all')
  const [filterMonth, setFilterMonth] = useState<string>('all')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null) // id الخصم اللي بيتعدّل (null = إضافة)
  // عدد أيام العمل الشهرية (لحساب "خصم يوم" = المرتب ÷ أيام العمل) — من إعدادات الرواتب
  const [workingDays, setWorkingDays] = useState(30)
  const [formData, setFormData] = useState({
    staffId: '',
    kind: 'amount' as 'amount' | 'days',
    amount: '',
    days: '',
    reason: '',
    notes: '',
  })

  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string | null; name: string }>({
    show: false, id: null, name: ''
  })
  const [unapplyConfirm, setUnapplyConfirm] = useState<{ show: boolean; id: string | null; name: string }>({
    show: false, id: null, name: ''
  })

  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!permissionsLoading && hasPermission('canViewDeductions')) {
      fetchDeductions()
      fetchStaff()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsLoading])

  // Apply URL params for deep-link filters
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const sid = params.get('staffId')
    if (sid) setFilterStaffId(sid)
  }, [])

  const fetchDeductions = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/staff-deductions')
      if (res.ok) {
        const data = await res.json()
        setDeductions(data)
      }
    } catch (e) {
      console.error('Failed to fetch deductions', e)
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
    // أيام العمل الشهرية من إعدادات الرواتب (لحساب معاينة خصم اليوم)
    try {
      const sres = await fetch('/api/settings/services')
      if (sres.ok) {
        const s = await sres.json()
        if (s?.payrollWorkingDaysPerMonth > 0) setWorkingDays(s.payrollWorkingDaysPerMonth)
      }
    } catch {}
  }

  // فتح الفورم في وضع التعديل (يشتغل للمطبّقة والمعلّقة)
  const handleEditClick = (d: StaffDeduction) => {
    setEditingId(d.id)
    setFormData({
      staffId: d.staffId,
      kind: 'amount',
      amount: String(d.amount),
      days: '',
      reason: d.reason,
      notes: d.notes || '',
    })
    setShowForm(true)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetForm = () => {
    setEditingId(null)
    setFormData({ staffId: '', kind: 'amount', amount: '', days: '', reason: '', notes: '' })
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg('')
    try {
      const isEdit = !!editingId
      const res = await fetch('/api/staff-deductions', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit
            ? {
                id: editingId,
                amount: parseFloat(formData.amount),
                reason: formData.reason,
                notes: formData.notes || null,
              }
            : {
                staffId: formData.staffId,
                ...(formData.kind === 'days'
                  ? { days: parseInt(formData.days, 10) }
                  : { amount: parseFloat(formData.amount) }),
                reason: formData.reason,
                notes: formData.notes || undefined,
              }
        )
      })
      if (res.ok) {
        setSuccessMsg(editingId ? (localeString === 'ar-EG' ? 'تم تعديل الخصم' : 'Deduction updated') : t('deductions.addSuccess'))
        resetForm()
        fetchDeductions()
        setTimeout(() => setSuccessMsg(''), 3000)
      } else {
        const data = await res.json()
        setErrorMsg(data.error || t('deductions.addFail'))
      }
    } catch {
      setErrorMsg(t('deductions.connectionError'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleApply = async (deductionId: string) => {
    try {
      const res = await fetch('/api/staff-deductions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: deductionId,
          isApplied: true,
          appliedAt: new Date().toISOString()
        })
      })
      if (res.ok) {
        setSuccessMsg('تم تطبيق الخصم بنجاح')
        fetchDeductions()
        setTimeout(() => setSuccessMsg(''), 3000)
      } else {
        const data = await res.json()
        setErrorMsg(data.error || 'فشل تطبيق الخصم')
      }
    } catch {
      setErrorMsg(t('deductions.connectionError'))
    }
  }

  // إلغاء التطبيق — يرجّع الخصم لـ"معلّق" (الفلوس ترجع، مش متخصومة)
  const confirmUnapply = async () => {
    if (!unapplyConfirm.id) return
    const id = unapplyConfirm.id
    setUnapplyConfirm({ show: false, id: null, name: '' })
    try {
      const res = await fetch('/api/staff-deductions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isApplied: false, appliedAt: null })
      })
      if (res.ok) {
        setSuccessMsg(locale === 'ar' ? 'تم إلغاء التطبيق ورجع المبلغ' : 'Un-applied — amount returned')
        fetchDeductions()
        setTimeout(() => setSuccessMsg(''), 3000)
      } else {
        const data = await res.json()
        setErrorMsg(data.error || (locale === 'ar' ? 'فشل إلغاء التطبيق' : 'Failed to un-apply'))
      }
    } catch {
      setErrorMsg(t('deductions.connectionError'))
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm.id) return
    try {
      const res = await fetch(`/api/staff-deductions?id=${deleteConfirm.id}`, { method: 'DELETE' })
      if (res.ok) {
        setSuccessMsg(t('deductions.deleteSuccess'))
        setDeleteConfirm({ show: false, id: null, name: '' })
        fetchDeductions()
        setTimeout(() => setSuccessMsg(''), 3000)
      } else {
        const data = await res.json()
        setErrorMsg(data.error || t('deductions.deleteFail'))
      }
    } catch {
      setErrorMsg(t('deductions.connectionError'))
    }
  }

  //  مفتاح الشهر (YYYY-MM) من تاريخ إنشاء الخصم — أساس فصل الشهور عن بعض
  const monthKey = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const monthLabel = (key: string) => {
    const [y, m] = key.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString(localeString, { month: 'long', year: 'numeric' })
  }

  const filteredDeductions = deductions.filter(d => {
    if (filterStaffId !== 'all' && d.staffId !== filterStaffId) return false
    if (filterStatus === 'pending' && d.isApplied) return false
    if (filterStatus === 'applied' && !d.isApplied) return false
    if (filterMonth !== 'all' && monthKey(d.createdAt) !== filterMonth) return false
    return true
  })

  //  كل الشهور الموجودة في البيانات (للفلتر) — الأحدث الأول
  const availableMonths = useMemo(() => {
    const keys = new Set(deductions.map(d => monthKey(d.createdAt)))
    return [...keys].sort((a, b) => b.localeCompare(a))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deductions])

  //  تجميع الخصومات: كل شهر لوحده بإجماليه — الأحدث الأول
  const monthGroups = useMemo(() => {
    const map = new Map<string, { key: string; items: StaffDeduction[]; total: number; pending: number }>()
    for (const d of filteredDeductions) {
      const key = monthKey(d.createdAt)
      if (!map.has(key)) map.set(key, { key, items: [], total: 0, pending: 0 })
      const g = map.get(key)!
      g.items.push(d)
      g.total += d.amount
      if (!d.isApplied) g.pending += d.amount
    }
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredDeductions])

  const pendingTotal = deductions.filter(d => !d.isApplied).reduce((sum, d) => sum + d.amount, 0)
  const pendingCount = deductions.filter(d => !d.isApplied).length
  const appliedTotal = deductions.filter(d => d.isApplied).reduce((sum, d) => sum + d.amount, 0)

  if (permissionsLoading) {
    return <LoadingScreen fullScreen />
  }

  if (!hasPermission('canViewDeductions')) {
    return <PermissionDenied message={t('deductions.title')} />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6" dir={direction}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          {/*  زرار رجوع — يرجع للصفحة اللي جه منها */}
          <button
            type="button"
            onClick={() => router.back()}
            className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center flex-shrink-0 transition-colors duration-200"
            aria-label={direction === 'rtl' ? 'رجوع' : 'Back'}
            title={direction === 'rtl' ? 'رجوع' : 'Back'}
          >
            <svg {...stroke} className={`w-5 h-5 ${direction === 'rtl' ? 'rotate-180' : ''}`} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 flex items-center justify-center flex-shrink-0">
            <svg {...stroke} className="w-6 h-6" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.51-5.511-3.181" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('deductions.title')}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('deductions.subtitle')}</p>
          </div>
        </div>
        {hasPermission('canCreateDeduction') && (
          <button
            onClick={() => { if (showForm) { resetForm() } else { setEditingId(null); setShowForm(true) }; setErrorMsg('') }}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 text-sm"
          >
            <svg {...stroke} className="w-4 h-4" aria-hidden="true">
              {showForm ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              )}
            </svg>
            <span>{showForm ? t('common.cancel') : t('deductions.addDeduction')}</span>
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
            label: t('deductions.pendingDeductions'),
            value: `${pendingTotal.toLocaleString(localeString)} ${t('deductions.currency')}`,
            sub: `${pendingCount} ${t('deductions.pendingCount')}`,
            tone: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
            icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />),
            valueTone: 'text-red-600 dark:text-red-400'
          },
          {
            label: t('deductions.appliedDeductions'),
            value: `${appliedTotal.toLocaleString(localeString)} ${t('deductions.currency')}`,
            sub: `${deductions.filter(d => d.isApplied).length} ${t('deductions.appliedCount')}`,
            tone: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
            icon: (<path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />),
            valueTone: 'text-green-600 dark:text-green-400'
          },
          {
            label: t('deductions.totalDeductions'),
            value: `${deductions.reduce((s, d) => s + d.amount, 0).toLocaleString(localeString)} ${t('deductions.currency')}`,
            sub: `${deductions.length} ${t('deductions.totalCount')}`,
            tone: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
            icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />),
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
            <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>{editingId ? (locale === 'ar' ? 'تعديل الخصم' : 'Edit Deduction') : t('deductions.addNew')}</span>
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('deductions.staff')} *</label>
                <select
                  value={formData.staffId}
                  onChange={e => setFormData({ ...formData, staffId: e.target.value })}
                  disabled={!!editingId}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  required
                >
                  <option value="">{t('deductions.selectStaff')}</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.position || t('deductions.employee')})</option>
                  ))}
                </select>
              </div>
              <div>
                {/* اختيار النوع: مبلغ ثابت أو بعدد الأيام (خصم يوم) — يظهر في الإضافة بس */}
                {!editingId && (
                <div className="flex items-center gap-1 mb-1.5">
                  <button type="button" onClick={() => setFormData({ ...formData, kind: 'amount' })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${formData.kind === 'amount' ? 'bg-primary-500 text-primary-contrast' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {locale === 'ar' ? 'مبلغ' : 'Amount'}
                  </button>
                  <button type="button" onClick={() => setFormData({ ...formData, kind: 'days' })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${formData.kind === 'days' ? 'bg-primary-500 text-primary-contrast' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {locale === 'ar' ? 'خصم يوم' : 'By days'}
                  </button>
                </div>
                )}
                {formData.kind === 'amount' ? (
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
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
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
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
                      return <p className="text-xs text-red-700 dark:text-red-400 mt-1 font-bold">
                        {locale === 'ar'
                          ? `= ${total.toLocaleString('en')} ج.م (اليوم ≈ ${Math.round(daily).toLocaleString('en')} على ${workingDays} يوم)`
                          : `= ${total.toLocaleString('en')} EGP (day ≈ ${Math.round(daily).toLocaleString('en')} on ${workingDays} days)`}
                      </p>
                    })()}
                  </>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('deductions.reason')} *</label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  placeholder={t('deductions.reasonPlaceholder')}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('common.notes')}</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  rows={2}
                  placeholder={t('deductions.notesPlaceholder')}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
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
                <span>{submitting ? t('deductions.saving') : editingId ? (locale === 'ar' ? 'حفظ التعديل' : 'Save Changes') : t('deductions.submit')}</span>
              </button>
              <button
                type="button"
                onClick={() => { resetForm(); setErrorMsg('') }}
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
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
          aria-label={t('deductions.allStaff')}
        >
          <option value="all">{t('deductions.allStaff')}</option>
          {staffList.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as 'all' | 'pending' | 'applied')}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
          aria-label={t('deductions.allStatuses')}
        >
          <option value="all">{t('deductions.allStatuses')}</option>
          <option value="pending">{t('deductions.pending')}</option>
          <option value="applied">{t('deductions.applied')}</option>
        </select>
        <select
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
          aria-label={locale === 'ar' ? 'كل الشهور' : 'All months'}
        >
          <option value="all">{locale === 'ar' ? 'كل الشهور' : 'All months'}</option>
          {availableMonths.map(m => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
        <span className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 self-center">
          {filteredDeductions.length} {t('deductions.deductionCount')}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingScreen message={t('common.loading')} />
      ) : filteredDeductions.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 flex flex-col items-center justify-center py-12 text-center">
          <svg {...stroke} className="w-12 h-12 text-gray-400" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 0 1-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 0 0 1.183 1.981l6.478 3.488m8.839 2.51-4.66-2.51m0 0-1.023-.55a2.25 2.25 0 0 0-2.134 0l-1.022.55m0 0-4.661 2.51m16.5 1.615a2.25 2.25 0 0 1-1.183 1.981l-6.478 3.488a2.25 2.25 0 0 1-2.134 0L3.432 19.67A2.25 2.25 0 0 1 2.25 17.69V6.31a2.25 2.25 0 0 1 1.183-1.981l6.478-3.488a2.25 2.25 0 0 1 2.134 0l6.478 3.488a2.25 2.25 0 0 1 1.183 1.981v11.38Z" />
          </svg>
          <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('deductions.noDeductions')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filterStatus === 'pending' ? t('deductions.noPending') : filterStatus === 'applied' ? t('deductions.noApplied') : t('deductions.noAny')}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {monthGroups.map(g => (
          <section key={g.key}>
            {/* ── عنوان الشهر: كل شهر مفصول لوحده بإجماليه ── */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b-2 border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center flex-shrink-0">
                  <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                  </svg>
                </span>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{monthLabel(g.key)}</h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {g.items.length} {t('deductions.deductionCount')}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {g.pending > 0 && (
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {locale === 'ar' ? 'معلّق' : 'Pending'}: {g.pending.toLocaleString(localeString)}
                  </span>
                )}
                <span className="font-bold text-red-600 dark:text-red-400">
                  {locale === 'ar' ? 'إجمالي الشهر' : 'Month total'}: - {g.total.toLocaleString(localeString)} {t('deductions.currency')}
                </span>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {g.items.map(d => (
              <div key={d.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-900/40 px-4 py-2 flex justify-between items-center">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${d.isApplied ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'}`}>
                    <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                      {d.isApplied ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      )}
                    </svg>
                    {d.isApplied ? t('deductions.applied') : t('deductions.pending')}
                  </span>
                  <div className="flex gap-1.5">
                    {hasPermission('canEditDeduction') && (
                      <button
                        onClick={() => handleEditClick(d)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors duration-200"
                        aria-label="تعديل"
                        title="تعديل"
                      >
                        <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487 18.549 2.799a2.122 2.122 0 1 1 3 3L19.862 7.487m-3-3L8.078 13.27a2 2 0 0 0-.5.831l-1.111 4.222 4.222-1.111a2 2 0 0 0 .832-.5l8.781-8.781m-3-3 3 3" />
                        </svg>
                      </button>
                    )}
                    {d.isApplied && hasPermission('canEditDeduction') && (
                      <button
                        onClick={() => setUnapplyConfirm({ show: true, id: d.id, name: d.reason })}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors duration-200"
                        aria-label="إلغاء التطبيق"
                        title={locale === 'ar' ? 'إلغاء التطبيق ورجوع المبلغ' : 'Un-apply (return amount)'}
                      >
                        <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                        </svg>
                      </button>
                    )}
                    {!d.isApplied && hasPermission('canEditDeduction') && (
                      <button
                        onClick={() => handleApply(d.id)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors duration-200"
                        aria-label="تطبيق"
                        title="تطبيق"
                      >
                        <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </button>
                    )}
                    {!d.isApplied && hasPermission('canDeleteDeduction') && (
                      <button
                        onClick={() => setDeleteConfirm({ show: true, id: d.id, name: d.reason })}
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
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link href={`/staff-hr-assistant?staffId=${d.staffId}`} className="font-bold text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 hover:underline block">{d.staff.name}</Link>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{d.staff.position || '-'}</p>
                    </div>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">- {d.amount.toLocaleString(localeString)} {t('deductions.currency')}</p>
                  </div>
                  <p className="text-gray-700 dark:text-gray-200 text-sm font-medium">{d.reason}</p>
                  {d.notes && <p className="text-gray-600 dark:text-gray-400 text-xs">{d.notes}</p>}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(d.createdAt).toLocaleDateString(localeString)}
                    {d.isApplied && d.appliedAt && ` · ${t('deductions.appliedOn')} ${new Date(d.appliedAt).toLocaleDateString(localeString)}`}
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
                  <th className="px-4 py-3 text-start font-bold">{t('deductions.staffCol')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('deductions.amountCol')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('deductions.reasonCol')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('deductions.dateCol')}</th>
                  <th className="px-4 py-3 text-center font-bold">{t('deductions.statusCol')}</th>
                  <th className="px-4 py-3 text-center font-bold">{t('deductions.actionsCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {g.items.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/staff-hr-assistant?staffId=${d.staffId}`} className="font-bold text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 hover:underline block">{d.staff.name}</Link>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{d.staff.position || '-'}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-red-600 dark:text-red-400">
                      - {d.amount.toLocaleString(localeString)} {t('deductions.currency')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 dark:text-gray-300">{d.reason}</p>
                      {d.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{d.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {new Date(d.createdAt).toLocaleDateString(localeString)}
                      {d.isApplied && d.appliedAt && (
                        <p className="text-xs text-green-600 dark:text-green-400">{t('deductions.appliedOn')} {new Date(d.appliedAt).toLocaleDateString(localeString)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${d.isApplied ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'}`}>
                        <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                          {d.isApplied ? (
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                          )}
                        </svg>
                        {d.isApplied ? t('deductions.applied') : t('deductions.pending')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1.5 justify-center">
                        {hasPermission('canEditDeduction') && (
                          <button
                            onClick={() => handleEditClick(d)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors duration-200"
                            aria-label="تعديل"
                            title="تعديل"
                          >
                            <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487 18.549 2.799a2.122 2.122 0 1 1 3 3L19.862 7.487m-3-3L8.078 13.27a2 2 0 0 0-.5.831l-1.111 4.222 4.222-1.111a2 2 0 0 0 .832-.5l8.781-8.781m-3-3 3 3" />
                            </svg>
                          </button>
                        )}
                        {d.isApplied && hasPermission('canEditDeduction') && (
                          <button
                            onClick={() => setUnapplyConfirm({ show: true, id: d.id, name: d.reason })}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors duration-200"
                            aria-label="إلغاء التطبيق"
                            title={locale === 'ar' ? 'إلغاء التطبيق ورجوع المبلغ' : 'Un-apply (return amount)'}
                          >
                            <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                            </svg>
                          </button>
                        )}
                        {!d.isApplied && hasPermission('canEditDeduction') && (
                          <button
                            onClick={() => handleApply(d.id)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors duration-200"
                            aria-label="تطبيق"
                            title="تطبيق"
                          >
                            <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          </button>
                        )}
                        {!d.isApplied && hasPermission('canDeleteDeduction') && (
                          <button
                            onClick={() => setDeleteConfirm({ show: true, id: d.id, name: d.reason })}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </section>
          ))}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-red-200 dark:ring-red-900/50 max-w-sm w-full p-6 animate-modal-in">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 mx-auto mb-3 flex items-center justify-center">
                <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165" />
                </svg>
              </div>
              <h3 id="delete-confirm-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('deductions.confirmDelete')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {t('deductions.confirmDeleteMsg')} <strong>&quot;{deleteConfirm.name}&quot;</strong>؟
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                autoFocus
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                {t('deductions.confirmDeleteBtn')}
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

      {/* Un-apply Confirm Modal */}
      {unapplyConfirm.show && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in" role="dialog" aria-modal="true" aria-labelledby="unapply-confirm-title">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-amber-200 dark:ring-amber-900/50 max-w-sm w-full p-6 animate-modal-in">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 mx-auto mb-3 flex items-center justify-center">
                <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                </svg>
              </div>
              <h3 id="unapply-confirm-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">{locale === 'ar' ? 'إلغاء تطبيق الخصم؟' : 'Un-apply deduction?'}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {locale === 'ar'
                  ? <>المبلغ هيرجع والخصم يبقى معلّق — <strong>&quot;{unapplyConfirm.name}&quot;</strong></>
                  : <>The amount returns (back to pending) — <strong>&quot;{unapplyConfirm.name}&quot;</strong></>}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmUnapply}
                autoFocus
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                {locale === 'ar' ? 'إلغاء التطبيق' : 'Un-apply'}
              </button>
              <button
                onClick={() => setUnapplyConfirm({ show: false, id: null, name: '' })}
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
