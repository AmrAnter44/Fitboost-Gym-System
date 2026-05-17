'use client'

import { useEffect, useState } from 'react'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../contexts/ToastContext'
import { useLanguage } from '../contexts/LanguageContext'

export type AssignEntityType = 'member' | 'visitor' | 'dayuse' | 'invitation'

interface StaffOption {
  id: string
  name: string
  staffCode: string
  position: string | null
}

interface AssignSalesButtonProps {
  entityType: AssignEntityType
  entityId: string
  currentSalesStaff?: { id?: string | null; name?: string | null } | null
  /** Compact variant for inline use inside table rows / tight cards */
  size?: 'sm' | 'xs'
  /** Called after a successful assign/transfer so the parent can refetch */
  onAssigned?: (salesStaffId: string | null) => void
  className?: string
}

export default function AssignSalesButton({
  entityType,
  entityId,
  currentSalesStaff,
  size = 'sm',
  onAssigned,
  className = '',
}: AssignSalesButtonProps) {
  const { isAdmin, loading: authLoading } = usePermissions()
  const { locale } = useLanguage()
  const toast = useToast()

  const [open, setOpen] = useState(false)
  const [staff, setStaff] = useState<StaffOption[]>([])
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selected, setSelected] = useState<string>(currentSalesStaff?.id || '')

  const hasSales = !!currentSalesStaff?.id

  useEffect(() => {
    setSelected(currentSalesStaff?.id || '')
  }, [currentSalesStaff?.id])

  useEffect(() => {
    if (!open) return
    setLoadingStaff(true)
    fetch('/api/staff')
      .then(r => (r.ok ? r.json() : []))
      .then((data: StaffOption[]) => {
        const salesOnly = Array.isArray(data)
          ? data.filter(s => s.position && s.position.split(',').map(p => p.trim()).includes('sales'))
          : []
        setStaff(salesOnly)
      })
      .catch(() => setStaff([]))
      .finally(() => setLoadingStaff(false))
  }, [open])

  if (authLoading || !isAdmin) return null

  const buttonLabel = hasSales
    ? (locale === 'ar' ? 'تحويل سيلز' : 'Transfer Sales')
    : (locale === 'ar' ? 'تعيين سيلز' : 'Assign Sales')

  const buttonIcon = hasSales ? '🔁' : '💼'

  const sizeClasses = size === 'xs'
    ? 'text-[11px] px-2 py-0.5'
    : 'text-xs px-2.5 py-1'

  const colorClasses = hasSales
    ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-700 hover:bg-orange-200 dark:hover:bg-orange-900/60'
    : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-900/60'

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const newOwner: string | null = selected || null
      const res = await fetch('/api/sales/assign-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId, salesStaffId: newOwner }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error || (locale === 'ar' ? 'فشل التعيين' : 'Failed to assign'))
        return
      }

      const newName = newOwner ? staff.find(s => s.id === newOwner)?.name : null
      toast.success(
        newOwner
          ? (locale === 'ar' ? `تم التعيين لـ ${newName || 'موظف السيلز'}` : `Assigned to ${newName || 'sales staff'}`)
          : (locale === 'ar' ? 'تم إلغاء التعيين' : 'Sales assignment cleared')
      )
      setOpen(false)
      onAssigned?.(newOwner)
    } catch (e) {
      console.error(e)
      toast.error(locale === 'ar' ? 'حدث خطأ' : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className={`inline-flex items-center gap-1 rounded-md border font-medium shadow-sm transition ${sizeClasses} ${colorClasses} ${className}`}
        title={hasSales ? `${buttonLabel} (${currentSalesStaff?.name || ''})` : buttonLabel}
      >
        <span>{buttonIcon}</span>
        <span>{buttonLabel}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { e.stopPropagation(); if (!submitting) setOpen(false) }}
        >
          <div
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-100 dark:bg-orange-900/40 rounded-full mb-3">
                <span className="text-3xl">{hasSales ? '🔁' : '💼'}</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {hasSales
                  ? (locale === 'ar' ? 'تحويل لموظف سيلز آخر' : 'Transfer to Another Sales Staff')
                  : (locale === 'ar' ? 'تعيين موظف سيلز' : 'Assign Sales Staff')}
              </h3>
              {hasSales && currentSalesStaff?.name && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {locale === 'ar' ? 'حالياً مع:' : 'Currently with:'}{' '}
                  <span className="font-semibold text-orange-700 dark:text-orange-300">{currentSalesStaff.name}</span>
                </p>
              )}
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-lg p-3 mb-4">
              <label className="block text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">
                💼 {locale === 'ar' ? 'موظف السيلز' : 'Sales Staff'}
              </label>
              {loadingStaff ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 py-2">
                  {locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                </div>
              ) : (
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="w-full px-3 py-2 border border-orange-300 dark:border-orange-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">{locale === 'ar' ? '— بدون موظف سيلز —' : '— No Sales Staff —'}</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} — #{s.staffCode}
                    </option>
                  ))}
                </select>
              )}
              {staff.length === 0 && !loadingStaff && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                  {locale === 'ar' ? 'مفيش موظفين سيلز نشطين' : 'No active sales staff found'}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={submitting || loadingStaff || (selected === (currentSalesStaff?.id || ''))}
                className="flex-1 bg-orange-600 text-white py-2.5 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition"
              >
                {submitting
                  ? (locale === 'ar' ? '⏳ جاري الحفظ...' : '⏳ Saving...')
                  : (locale === 'ar' ? '✓ حفظ' : '✓ Save')}
              </button>
              <button
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:cursor-not-allowed font-medium transition"
              >
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
