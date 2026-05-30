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
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const localeString = locale === 'ar' ? 'ar-EG' : 'en-US'

  const [deductions, setDeductions] = useState<StaffDeduction[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [filterStaffId, setFilterStaffId] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'applied'>('all')

  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    staffId: '',
    amount: '',
    reason: '',
    notes: '',
  })

  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string | null; name: string }>({
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
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/staff-deductions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: formData.staffId,
          amount: parseFloat(formData.amount),
          reason: formData.reason,
          notes: formData.notes || undefined,
        })
      })
      if (res.ok) {
        setSuccessMsg(t('deductions.addSuccess'))
        setFormData({ staffId: '', amount: '', reason: '', notes: '' })
        setShowForm(false)
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

  const filteredDeductions = deductions.filter(d => {
    if (filterStaffId !== 'all' && d.staffId !== filterStaffId) return false
    if (filterStatus === 'pending' && d.isApplied) return false
    if (filterStatus === 'applied' && !d.isApplied) return false
    return true
  })

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
            onClick={() => { setShowForm(!showForm); setErrorMsg('') }}
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
            <span>{t('deductions.addNew')}</span>
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('deductions.staff')} *</label>
                <select
                  value={formData.staffId}
                  onChange={e => setFormData({ ...formData, staffId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  required
                >
                  <option value="">{t('deductions.selectStaff')}</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.position || t('deductions.employee')})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('deductions.amount')} *</label>
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M3.181 14.652a8.25 8.25 0 0 0 13.803 3.7l3.181-3.182m-9.348-4.992H3.825V4.356m0 0L7.006 7.538m12.992 8.924v-4.992" />
                  </svg>
                ) : (
                  <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
                <span>{submitting ? t('deductions.saving') : t('deductions.submit')}</span>
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
        <>
          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredDeductions.map(d => (
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
                  {!d.isApplied && (
                    <div className="flex gap-1.5">
                      {hasPermission('canEditDeduction') && (
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
                      {hasPermission('canDeleteDeduction') && (
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
                  )}
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
                {filteredDeductions.map(d => (
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
                      {!d.isApplied ? (
                        <div className="flex gap-1.5 justify-center">
                          {hasPermission('canEditDeduction') && (
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
                          {hasPermission('canDeleteDeduction') && (
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
    </div>
  )
}
