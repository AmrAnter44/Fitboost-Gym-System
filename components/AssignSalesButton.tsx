'use client'

import { useEffect, useState } from 'react'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../contexts/ToastContext'
import { useLanguage } from '../contexts/LanguageContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

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

function BriefcaseIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18" />
    </svg>
  )
}

function SwitchIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  )
}

export default function AssignSalesButton({
  entityType,
  entityId,
  currentSalesStaff,
  size = 'sm',
  onAssigned,
  className = '',
}: AssignSalesButtonProps) {
  const { isAdmin, hasPermission, loading: authLoading } = usePermissions()
  const canManageSales = hasPermission('canManageSales')
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

  // الزرار يظهر للأدمن/أونر، أو لأي حد عنده صلاحية مسؤول السيلز
  if (authLoading || (!isAdmin && !canManageSales)) return null

  const buttonLabel = hasSales
    ? (locale === 'ar' ? 'تحويل سيلز' : 'Transfer Sales')
    : (locale === 'ar' ? 'تعيين سيلز' : 'Assign Sales')

  const sizeClasses = size === 'xs'
    ? 'text-[11px] px-2 py-0.5'
    : 'text-xs px-2.5 py-1'

  const colorClasses = hasSales
    ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 ring-1 ring-orange-300 dark:ring-orange-700 hover:bg-orange-200 dark:hover:bg-orange-900/60'
    : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-300 dark:ring-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-900/60'

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
        aria-label={buttonLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 rounded-md font-medium shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 focus-visible:ring-orange-500 ${sizeClasses} ${colorClasses} ${className}`}
        title={hasSales ? `${buttonLabel} (${currentSalesStaff?.name || ''})` : buttonLabel}
      >
        {hasSales ? <SwitchIcon className="w-3.5 h-3.5" /> : <BriefcaseIcon className="w-3.5 h-3.5" />}
        <span>{buttonLabel}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-sales-title"
          onClick={(e) => { e.stopPropagation(); if (!submitting) setOpen(false) }}
        >
          <div
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 rounded-full mb-3">
                {hasSales ? <SwitchIcon className="w-7 h-7" /> : <BriefcaseIcon className="w-7 h-7" />}
              </div>
              <h3 id="assign-sales-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {hasSales
                  ? (locale === 'ar' ? 'تحويل لموظف سيلز آخر' : 'Transfer to Another Sales Staff')
                  : (locale === 'ar' ? 'تعيين موظف سيلز' : 'Assign Sales Staff')}
              </h3>
              {hasSales && currentSalesStaff?.name && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {locale === 'ar' ? 'حالياً مع:' : 'Currently with:'}{' '}
                  <span className="font-semibold text-orange-700 dark:text-orange-300">{currentSalesStaff.name}</span>
                </p>
              )}
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-200 dark:ring-orange-900/50 rounded-lg p-3 mb-4">
              <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                <BriefcaseIcon className="w-4 h-4" />
                {locale === 'ar' ? 'موظف السيلز' : 'Sales Staff'}
              </label>
              {loadingStaff ? (
                <div className="text-sm text-gray-600 dark:text-gray-400 py-2">
                  {locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                </div>
              ) : (
                <>
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-colors duration-200"
                  >
                    <option value="">{locale === 'ar' ? '— بدون موظف سيلز —' : '— No Sales Staff —'}</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} — #{s.staffCode}
                      </option>
                    ))}
                  </select>

                  {/* 💼 كارت بيظهر اسم الموظف المختار بشكل واضح */}
                  {(() => {
                    const picked = staff.find(s => s.id === selected)
                    if (picked) {
                      return (
                        <div className="mt-3 flex items-center gap-3 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/40 dark:to-emerald-800/30 ring-2 ring-emerald-300 dark:ring-emerald-700 rounded-xl px-4 py-3 shadow-sm">
                          <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                            <BriefcaseIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-base text-emerald-900 dark:text-emerald-100 truncate">
                              {picked.name}
                            </p>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5 font-mono">
                              #{picked.staffCode}
                              {picked.position && <span className="ms-2 font-sans opacity-80">({picked.position})</span>}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-200 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full whitespace-nowrap">
                            {locale === 'ar' ? 'المختار' : 'SELECTED'}
                          </span>
                        </div>
                      )
                    }
                    if (selected === '') {
                      // ما اختارش حد — يعني هيلغي التعيين
                      return currentSalesStaff?.id ? (
                        <div className="mt-3 flex items-center gap-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/40 dark:to-red-800/30 ring-2 ring-red-300 dark:ring-red-700 rounded-xl px-4 py-3 shadow-sm">
                          <div className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0">
                            <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5">
                              <circle cx="12" cy="12" r="9"/>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5l14 14"/>
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-base text-red-900 dark:text-red-100">
                              {locale === 'ar' ? 'إلغاء التعيين' : 'Unassign'}
                            </p>
                            <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                              {locale === 'ar' ? 'هيتشال موظف السيلز الحالي' : 'Current sales staff will be removed'}
                            </p>
                          </div>
                        </div>
                      ) : null
                    }
                    return null
                  })()}
                </>
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
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-medium py-2.5 rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                {submitting
                  ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...')
                  : (locale === 'ar' ? 'حفظ' : 'Save')}
              </button>
              <button
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 font-medium py-2.5 rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
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
