'use client'

import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

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
  /** When true, prompts the user to confirm before swapping an already-set sales staff. */
  requireConfirmIfChanging?: boolean
  /** When set, the selector is read-only. The server enforces this assignment regardless. */
  locked?: { reason: string }
  /** When true, auto-selects the sales staff with the fewest assigned members (only if value is null). */
  autoSelectLeastLoaded?: boolean
}

export default function SalesStaffSelector({ value, onChange, requireConfirmIfChanging = false, locked, autoSelectLeastLoaded = false }: SalesStaffSelectorProps) {
  const { locale } = useLanguage()
  const [staff, setStaff] = useState<StaffOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 💼 في الـ auto-select mode بنستعمل endpoint السيلز-لود اللي بيرجع العدّ كمان
    const url = autoSelectLeastLoaded ? '/api/staff/sales-load' : '/api/staff'
    fetch(url)
      .then(r => r.ok ? r.json() : [])
      .then((data: StaffOption[]) => {
        // الـ /api/staff/sales-load بيرجع موظفين السيلز فقط؛
        // الـ /api/staff العادي بيرجع الكل فلازم نفلتر
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

  // 🤖 Auto-select least-loaded sales staff لما الـ value فاضي (مرة واحدة بعد تحميل القايمة)
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

  // يلف الـ onChange بـ confirmation modal لو الـ value الحالية مش null والقيمة الجديدة مختلفة
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
    <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-lg p-3">
      <h3 className="font-bold text-base mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
        <span>💼</span>
        <span>{locale === 'ar' ? 'موظف السيلز (اختياري)' : 'Sales Staff (Optional)'}</span>
      </h3>

      {loading ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 py-2">
          {locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
        </div>
      ) : (
        <div className="space-y-2">
          {locked && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              🔒 {locale === 'ar' ? 'محجوز' : 'Locked'}: {locked.reason}
            </div>
          )}

          <select
            value={value || ''}
            onChange={e => guardedChange(e.target.value || null)}
            disabled={!!locked}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none ${
              locked
                ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'border-orange-300 dark:border-orange-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-400'
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
              <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                💼 {selectedStaff.name}
              </span>
              {!locked && (
                <button
                  type="button"
                  onClick={() => guardedChange(null)}
                  className="text-xs text-orange-600 dark:text-orange-400 hover:text-red-500"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
