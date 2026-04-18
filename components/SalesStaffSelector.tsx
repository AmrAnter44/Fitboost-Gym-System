'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

interface StaffOption {
  id: string
  name: string
  staffCode: string
  position: string | null
}

interface SalesStaffSelectorProps {
  value: string | null
  onChange: (salesStaffId: string | null) => void
}

export default function SalesStaffSelector({ value, onChange }: SalesStaffSelectorProps) {
  const { locale } = useLanguage()
  const [staff, setStaff] = useState<StaffOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/staff')
      .then(r => r.ok ? r.json() : [])
      .then((data: StaffOption[]) => {
        // فلتر: الموظفين اللي عندهم تاج "sales" في الـ position
        const salesOnly = Array.isArray(data)
          ? data.filter(s => s.position && s.position.split(',').map(p => p.trim()).includes('sales'))
          : []
        setStaff(salesOnly)
      })
      .catch(() => setStaff([]))
      .finally(() => setLoading(false))
  }, [])

  const selectedStaff = staff.find(s => s.id === value)

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
          <select
            value={value || ''}
            onChange={e => onChange(e.target.value || null)}
            className="w-full px-3 py-2 border border-orange-300 dark:border-orange-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">{locale === 'ar' ? '— بدون موظف سيلز —' : '— No Sales Staff —'}</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} — #{s.staffCode}{s.position ? ` (${s.position})` : ''}
              </option>
            ))}
          </select>

          {selectedStaff && (
            <div className="flex items-center justify-between bg-orange-100 dark:bg-orange-900/30 rounded px-3 py-2">
              <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                💼 {selectedStaff.name}
              </span>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-xs text-orange-600 dark:text-orange-400 hover:text-red-500"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
