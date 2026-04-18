'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionDenied from '../../components/PermissionDenied'

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
  }, [permissionsLoading])

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
        setSuccessMsg('تم تطبيق الخصم بنجاح ✅')
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
    return (
      <div className="flex justify-center items-center min-h-screen" dir={direction}>
        <div className="text-xl text-gray-700 dark:text-gray-200">{t('common.loading')}</div>
      </div>
    )
  }

  if (!hasPermission('canViewDeductions')) {
    return <PermissionDenied message={t('deductions.title')} />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6" dir={direction}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <span>📉</span>
            <span>{t('deductions.title')}</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('deductions.subtitle')}
          </p>
        </div>
        {hasPermission('canCreateDeduction') && (
          <button
            onClick={() => {
              setShowForm(!showForm)
              setErrorMsg('')
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-bold transition flex items-center gap-2"
          >
            {showForm ? `✕ ${t('common.cancel')}` : `➕ ${t('deductions.addDeduction')}`}
          </button>
        )}
      </div>

      {/* Success/Error messages */}
      {successMsg && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-300 px-4 py-3 rounded-lg">
          ✅ {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg">
          ❌ {errorMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('deductions.pendingDeductions')}</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{pendingTotal.toLocaleString(localeString)} {t('deductions.currency')}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{pendingCount} {t('deductions.pendingCount')}</p>
            </div>
            <div className="text-4xl">⏳</div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('deductions.appliedDeductions')}</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{appliedTotal.toLocaleString(localeString)} {t('deductions.currency')}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{deductions.filter(d => d.isApplied).length} {t('deductions.appliedCount')}</p>
            </div>
            <div className="text-4xl">✅</div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('deductions.totalDeductions')}</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{deductions.reduce((s, d) => s + d.amount, 0).toLocaleString(localeString)} {t('deductions.currency')}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{deductions.length} {t('deductions.totalCount')}</p>
            </div>
            <div className="text-4xl">📊</div>
          </div>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-100">➕ {t('deductions.addNew')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('deductions.staff')} *</label>
                <select
                  value={formData.staffId}
                  onChange={e => setFormData({ ...formData, staffId: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white bg-white text-gray-900"
                  required
                >
                  <option value="">{t('deductions.selectStaff')}</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.position || t('deductions.employee')})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('deductions.amount')} *</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white bg-white text-gray-900"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('deductions.reason')} *</label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white bg-white text-gray-900"
                  placeholder={t('deductions.reasonPlaceholder')}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('common.notes')}</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white bg-white text-gray-900"
                  rows={2}
                  placeholder={t('deductions.notesPlaceholder')}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? t('deductions.saving') : t('deductions.submit')}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setErrorMsg('') }}
                className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-6 py-2 rounded-lg font-bold transition"
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
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white bg-white text-gray-900 rounded-lg"
        >
          <option value="all">{t('deductions.allStaff')}</option>
          {staffList.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as 'all' | 'pending' | 'applied')}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white bg-white text-gray-900 rounded-lg"
        >
          <option value="all">{t('deductions.allStatuses')}</option>
          <option value="pending">{t('deductions.pending')}</option>
          <option value="applied">{t('deductions.applied')}</option>
        </select>
        <span className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
          {filteredDeductions.length} {t('deductions.deductionCount')}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
      ) : filteredDeductions.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl shadow-md">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-xl text-gray-500 dark:text-gray-400 font-bold">{t('deductions.noDeductions')}</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            {filterStatus === 'pending' ? t('deductions.noPending') : filterStatus === 'applied' ? t('deductions.noApplied') : t('deductions.noAny')}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredDeductions.map(d => (
              <div key={d.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border-r-4 border-red-400">
                <div className="bg-gray-50 dark:bg-gray-700 px-4 py-2 flex justify-between items-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${d.isApplied ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'}`}>
                    {d.isApplied ? `✅ ${t('deductions.applied')}` : `⏳ ${t('deductions.pending')}`}
                  </span>
                  {!d.isApplied && (
                    <div className="flex gap-2">
                      {hasPermission('canEditDeduction') && (
                        <button
                          onClick={() => handleApply(d.id)}
                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-bold transition"
                        >
                          ✅ تطبيق
                        </button>
                      )}
                      {hasPermission('canDeleteDeduction') && (
                        <button
                          onClick={() => setDeleteConfirm({ show: true, id: d.id, name: d.reason })}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-bold transition"
                        >
                          🗑️ حذف
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-800 dark:text-gray-100">👤 {d.staff.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{d.staff.position || '-'}</p>
                    </div>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">- {d.amount.toLocaleString(localeString)} {t('deductions.currency')}</p>
                  </div>
                  <p className="text-gray-700 dark:text-gray-200 text-sm font-medium">{d.reason}</p>
                  {d.notes && <p className="text-gray-500 dark:text-gray-400 text-xs">{d.notes}</p>}
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(d.createdAt).toLocaleDateString(localeString)}
                    {d.isApplied && d.appliedAt && ` · ${t('deductions.appliedOn')} ${new Date(d.appliedAt).toLocaleDateString(localeString)}`}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/30 dark:to-orange-900/30">
                <tr>
                  <th className="px-4 py-3 text-right text-gray-700 dark:text-gray-200 font-bold">{t('deductions.staffCol')}</th>
                  <th className="px-4 py-3 text-right text-gray-700 dark:text-gray-200 font-bold">{t('deductions.amountCol')}</th>
                  <th className="px-4 py-3 text-right text-gray-700 dark:text-gray-200 font-bold">{t('deductions.reasonCol')}</th>
                  <th className="px-4 py-3 text-right text-gray-700 dark:text-gray-200 font-bold">{t('deductions.dateCol')}</th>
                  <th className="px-4 py-3 text-center text-gray-700 dark:text-gray-200 font-bold">{t('deductions.statusCol')}</th>
                  <th className="px-4 py-3 text-center text-gray-700 dark:text-gray-200 font-bold">{t('deductions.actionsCol')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeductions.map(d => (
                  <tr key={d.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800 dark:text-gray-100">{d.staff.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{d.staff.position || '-'}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-red-600 dark:text-red-400">
                      - {d.amount.toLocaleString(localeString)} {t('deductions.currency')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-800 dark:text-gray-200">{d.reason}</p>
                      {d.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{d.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-sm">
                      {new Date(d.createdAt).toLocaleDateString(localeString)}
                      {d.isApplied && d.appliedAt && (
                        <p className="text-xs text-green-500 dark:text-green-400">{t('deductions.appliedOn')} {new Date(d.appliedAt).toLocaleDateString(localeString)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${d.isApplied ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'}`}>
                        {d.isApplied ? `✅ ${t('deductions.applied')}` : `⏳ ${t('deductions.pending')}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!d.isApplied ? (
                        <div className="flex gap-2 justify-center">
                          {hasPermission('canEditDeduction') && (
                            <button
                              onClick={() => handleApply(d.id)}
                              className="bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white px-3 py-1 rounded-lg font-bold text-sm transition"
                            >
                              ✅ تطبيق
                            </button>
                          )}
                          {hasPermission('canDeleteDeduction') && (
                            <button
                              onClick={() => setDeleteConfirm({ show: true, id: d.id, name: d.reason })}
                              className="bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white px-3 py-1 rounded-lg font-bold text-sm transition"
                            >
                              🗑️ حذف
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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">🗑️</div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{t('deductions.confirmDelete')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {t('deductions.confirmDeleteMsg')} <strong>&quot;{deleteConfirm.name}&quot;</strong>؟
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl transition"
              >
                {t('deductions.confirmDeleteBtn')}
              </button>
              <button
                onClick={() => setDeleteConfirm({ show: false, id: null, name: '' })}
                className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-2 rounded-xl transition"
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
