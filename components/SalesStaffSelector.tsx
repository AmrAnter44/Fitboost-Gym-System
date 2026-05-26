'use client'

import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface StaffOption {
  id: string
  name: string
  staffCode: string
  position: string | null
  memberCount?: number
}

interface SalesStaffSelectorProps {
  value: string | null
  onChange: (salesStaffId: string | null) => void
  requireConfirmIfChanging?: boolean
  locked?: { reason: string }
  autoSelectLeastLoaded?: boolean
}

function BriefcaseIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18" />
    </svg>
  )
}

function LockIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  )
}

export default function SalesStaffSelector({ value, onChange, requireConfirmIfChanging = false, locked, autoSelectLeastLoaded = false }: SalesStaffSelectorProps) {
  const { locale } = useLanguage()
  const [staff, setStaff] = useState<StaffOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const url = autoSelectLeastLoaded ? '/api/staff/sales-load' : '/api/staff'
    fetch(url)
      .then(r => r.ok ? r.json() : [])
      .then((data: StaffOption[]) => {
        const salesOnly = Array.isArray(data)
          ? (autoSelectLeastLoaded
              ? data
              : data.filter(s => s.position && s.position.split(',').map(p => p.trim()).includes('sales')))
          : []
        setStaff(salesOnly)
      })
      .catch(() => setStaff([]))
      .finally(() => setLoading(false))
  }, [autoSelectLeastLoaded])

  const autoSelectedRef = useRef(false)
  useEffect(() => {
    if (!autoSelectLeastLoaded) return
    if (loading) return
    if (locked) return
    if (value) return
    if (autoSelectedRef.current) return
    if (staff.length === 0) return

    const least = staff.reduce((min, s) => {
      const sc = s.memberCount ?? 0
      const mc = min.memberCount ?? 0
      return sc < mc ? s : min
    })
    autoSelectedRef.current = true
    onChange(least.id)
  }, [autoSelectLeastLoaded, loading, locked, value, staff, onChange])

  const selectedStaff = staff.find(s => s.id === value)
  const nameOf = (id: string | null) => (id ? staff.find(s => s.id === id)?.name || '—' : '—')

  const guardedChange = (next: string | null) => {
    if (requireConfirmIfChanging && value && next !== value) {
      const fromName = nameOf(value)
      const toName = next ? nameOf(next) : (locale === 'ar' ? 'بدون سيلز' : 'No sales staff')
      const msg = locale === 'ar'
        ? `هتغيّر السيلز من «${fromName}» لـ «${toName}»؟\nالعملية دي بتتسجل في الـ audit log.`
        : `Change sales staff from "${fromName}" to "${toName}"?\nThis change will be recorded in the audit log.`
      if (!confirm(msg)) return
    }
    onChange(next)
  }

  return (
    <div className="bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-200 dark:ring-orange-800 rounded-lg p-3">
      <h3 className="font-bold text-base mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
        <BriefcaseIcon className="w-5 h-5 text-orange-600 dark:text-orange-300" />
        <span>{locale === 'ar' ? 'موظف السيلز (اختياري)' : 'Sales Staff (Optional)'}</span>
      </h3>

      {loading ? (
        <div className="text-sm text-gray-600 dark:text-gray-400 py-2" aria-busy="true" aria-live="polite">
          {locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
        </div>
      ) : (
        <div className="space-y-2">
          {locked && (
            <div className="bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-800 rounded px-3 py-2 text-xs text-amber-800 dark:text-amber-200 inline-flex items-center gap-1.5 w-full">
              <LockIcon className="w-3.5 h-3.5" />
              <span>{locale === 'ar' ? 'محجوز' : 'Locked'}: {locked.reason}</span>
            </div>
          )}

          <select
            value={value || ''}
            onChange={e => guardedChange(e.target.value || null)}
            disabled={!!locked}
            aria-label={locale === 'ar' ? 'موظف السيلز' : 'Sales Staff'}
            className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors duration-200 ${
              locked
                ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-400 focus:border-transparent'
            }`}
          >
            <option value="">{locale === 'ar' ? '— بدون موظف سيلز —' : '— No Sales Staff —'}</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} — #{s.staffCode}{s.position ? ` (${s.position})` : ''}
                {typeof s.memberCount === 'number' ? ` — ${s.memberCount} ${locale === 'ar' ? 'عضو' : 'members'}` : ''}
              </option>
            ))}
          </select>

          {selectedStaff && (
            <div className="flex items-center justify-between bg-orange-100 dark:bg-orange-900/30 rounded px-3 py-2">
              <span className="text-sm font-medium text-orange-800 dark:text-orange-200 inline-flex items-center gap-1.5">
                <BriefcaseIcon className="w-4 h-4" />
                {selectedStaff.name}
              </span>
              {!locked && (
                <button
                  type="button"
                  onClick={() => guardedChange(null)}
                  aria-label={locale === 'ar' ? 'إزالة' : 'Clear'}
                  className="p-1 rounded text-orange-700 dark:text-orange-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200"
                >
                  <svg {...stroke} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
