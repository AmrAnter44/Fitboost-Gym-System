'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface PayrollFields {
  payrollWorkingDaysPerMonth: number
  payrollLateGraceMinutes: number
  payrollSuggestedLatePerMinute: number
  payrollMonthEndDay: number
  requireSelfieOnCheckIn: boolean
}

const DEFAULTS: PayrollFields = {
  payrollWorkingDaysPerMonth: 26,
  payrollLateGraceMinutes: 5,
  payrollSuggestedLatePerMinute: 2,
  payrollMonthEndDay: 28,
  requireSelfieOnCheckIn: false,
}

// إعدادات الرواتب — منقولة من صفحة الإعدادات لصفحة الموظفين
export default function PayrollSettingsModal({ onClose }: { onClose: () => void }) {
  const { locale, direction } = useLanguage()
  const toast = useToast()
  const { refetch: refetchServiceSettings } = useServiceSettings()

  const [fields, setFields] = useState<PayrollFields>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings/services')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setFields({
            payrollWorkingDaysPerMonth: d.payrollWorkingDaysPerMonth ?? DEFAULTS.payrollWorkingDaysPerMonth,
            payrollLateGraceMinutes: d.payrollLateGraceMinutes ?? DEFAULTS.payrollLateGraceMinutes,
            payrollSuggestedLatePerMinute: d.payrollSuggestedLatePerMinute ?? DEFAULTS.payrollSuggestedLatePerMinute,
            payrollMonthEndDay: d.payrollMonthEndDay ?? DEFAULTS.payrollMonthEndDay,
            requireSelfieOnCheckIn: d.requireSelfieOnCheckIn ?? DEFAULTS.requireSelfieOnCheckIn,
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const set = <K extends keyof PayrollFields>(key: K, value: PayrollFields[K]) =>
    setFields(prev => ({ ...prev, [key]: value }))

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (res.ok) {
        localStorage.removeItem('serviceSettingsCache')
        refetchServiceSettings()
        toast.success(locale === 'ar' ? 'تم حفظ إعدادات الرواتب' : 'Payroll settings saved')
        onClose()
      } else {
        toast.error(locale === 'ar' ? 'فشل الحفظ' : 'Save failed')
      }
    } catch {
      toast.error(locale === 'ar' ? 'فشل الحفظ' : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200'

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-lg w-full max-h-[92vh] overflow-y-auto animate-modal-in" dir={direction}>
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{locale === 'ar' ? 'إعدادات الرواتب' : 'Payroll Settings'}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{locale === 'ar' ? 'إعدادات نظام حساب المرتبات الذكي' : 'Settings for the smart payroll system'}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center shrink-0">
            <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {loading ? (
          <p className="p-8 text-center text-gray-500">{locale === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}</p>
        ) : (
          <div className="p-4 sm:p-6 space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {locale === 'ar' ? 'عدد أيام العمل الشهري الافتراضي' : 'Default Working Days per Month'}
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{locale === 'ar' ? 'يُستخدم لما الموظف ما عندوش Rotation محدد' : 'Used when the staff has no Rotation set'}</p>
              <input type="number" min={20} max={31} value={fields.payrollWorkingDaysPerMonth}
                onChange={e => set('payrollWorkingDaysPerMonth', parseInt(e.target.value) || 26)} className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {locale === 'ar' ? 'فترة السماحة للتأخير (بالدقائق)' : 'Late Grace Period (minutes)'}
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{locale === 'ar' ? 'دقائق التأخير اللي ما بتتحسبش — للـ reporting بس، مفيش خصم تلقائي' : 'Late minutes not counted — for reporting only, no auto-deduction'}</p>
              <input type="number" min={0} max={60} value={fields.payrollLateGraceMinutes}
                onChange={e => set('payrollLateGraceMinutes', parseInt(e.target.value) || 0)} className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {locale === 'ar' ? 'السعر المقترح للدقيقة المتأخرة (ج.م)' : 'Suggested Penalty per Late Minute (EGP)'}
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{locale === 'ar' ? 'بيظهر كاقتراح في الـ pre-payroll checklist عشان تختار تضمه يدوياً' : 'Shown as a suggestion in the pre-payroll checklist for manual approval'}</p>
              <input type="number" min={0} step={0.5} value={fields.payrollSuggestedLatePerMinute}
                onChange={e => set('payrollSuggestedLatePerMinute', parseFloat(e.target.value) || 0)} className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {locale === 'ar' ? 'يوم قفل الشهر للـ payroll' : 'Payroll Month-End Day'}
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{locale === 'ar' ? 'اليوم في الشهر اللي بعده الـ payroll بيتقفل تلقائياً' : 'Day of the month when payroll auto-locks'}</p>
              <input type="number" min={25} max={31} value={fields.payrollMonthEndDay}
                onChange={e => set('payrollMonthEndDay', parseInt(e.target.value) || 28)} className={inputClass} />
            </div>

            {/* Anti buddy-punching toggle */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-bold text-gray-800 dark:text-gray-100 mb-1 inline-flex items-center gap-2">
                    📸 {locale === 'ar' ? 'سيلفي إجباري مع كل سكان' : 'Mandatory selfie on check-in'}
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {locale === 'ar'
                      ? 'لما مفعّل: الكاميرا بتفتح تلقائياً بعد كل سكان، تتصور سيلفي، وتتخزن مع سجل الحضور. مينفعش موظف يـ scan لزميله.'
                      : 'When enabled: camera auto-opens after each scan, takes a selfie, and stores it with the attendance record. Prevents buddy-punching.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => set('requireSelfieOnCheckIn', !fields.requireSelfieOnCheckIn)}
                  aria-pressed={fields.requireSelfieOnCheckIn}
                  className={`relative inline-flex h-8 w-14 shrink-0 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                    fields.requireSelfieOnCheckIn ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
                  } cursor-pointer`}
                >
                  <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-300 mt-1 ${
                    fields.requireSelfieOnCheckIn ? 'translate-x-7 rtl:-translate-x-7' : 'translate-x-1 rtl:-translate-x-1'
                  }`} />
                </button>
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="w-full min-h-[44px] bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (locale === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : (locale === 'ar' ? 'حفظ' : 'Save')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
