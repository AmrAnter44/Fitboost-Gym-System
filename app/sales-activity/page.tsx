'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'
import { useDarkMode } from '@/contexts/DarkModeContext'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import { LoadingScreen } from '@/components/Spinner'

export const dynamic = 'force-dynamic'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Rep { id: string; name: string; staffCode: string }
interface ActivityRow {
  id: string
  clientName: string | null
  clientPhone: string | null
  result: string | null
  notes: string | null
  createdAt: string
  status: 'responded' | 'no-answer' | 'pending'
}
interface Summary { total: number; responded: number; noAnswer: number; pending: number }

//  YYYY-MM-DD بتوقيت محلي
const localDate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function SalesActivityPage() {
  const { locale, direction } = useLanguage()
  useDarkMode()
  const toast = useToast()
  const { user, loading: permLoading } = usePermissions()
  const ar = locale === 'ar'

  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN'

  const [reps, setReps] = useState<Rep[]>([])
  const [staffId, setStaffId] = useState('')
  const [from, setFrom] = useState(() => {
    const d = new Date()
    return localDate(new Date(d.getFullYear(), d.getMonth(), 1))
  })
  const [to, setTo] = useState(() => localDate(new Date()))
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  //  تحميل قائمة موظفي السيلز
  useEffect(() => {
    if (permLoading || !isAdmin) return
    ;(async () => {
      try {
        const res = await fetch('/api/hr/sales-activity')
        if (!res.ok) return
        const data = await res.json()
        setReps(data.reps || [])
      } catch { /* ignore */ }
    })()
  }, [permLoading, isAdmin])

  const loadActivity = useCallback(async () => {
    if (!staffId) {
      toast.warning(ar ? 'اختار موظف السيلز الأول' : 'Select a sales rep first')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/hr/sales-activity?staffId=${encodeURIComponent(staffId)}&from=${from}&to=${to}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || (ar ? 'فشل التحميل' : 'Failed to load'))
        return
      }
      setActivity(data.activity || [])
      setSummary(data.summary || null)
      setLoaded(true)
    } catch {
      toast.error(ar ? 'فشل التحميل' : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [staffId, from, to, ar, toast])

  if (permLoading) return <LoadingScreen fullScreen />

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6" dir={direction}>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-8 text-center max-w-md">
          <p className="text-gray-700 dark:text-gray-200 font-bold">
            {ar ? 'هذه الصفحة للأدمن فقط' : 'This page is for admins only'}
          </p>
        </div>
      </div>
    )
  }

  const resultLabel = (r: string | null) => {
    if (!r) return ar ? '—' : '—'
    const map: Record<string, [string, string]> = {
      interested: ['مهتم', 'Interested'],
      'not-interested': ['غير مهتم', 'Not interested'],
      'no-answer': ['لم يرد', 'No answer'],
      postponed: ['مؤجل', 'Postponed'],
      subscribed: ['اشترك', 'Subscribed'],
    }
    const v = map[r]
    return v ? (ar ? v[0] : v[1]) : r
  }

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    const date = d.toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' })
    const time = d.toLocaleTimeString(ar ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
    return `${date} · ${time}`
  }

  const selectCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200'
  const labelCls = 'block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6" dir={direction}>
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                {ar ? 'خصائص السيلز' : 'Sales Activity'}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {ar ? 'تابع تواصل كل موظف سيلز — العميل رد ولا مردّش' : 'Track each rep’s outreach — who responded vs no answer'}
              </p>
            </div>
          </div>
          <Link
            href="/staff-hr-assistant"
            className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 text-sm"
          >
            <svg {...stroke} className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            <span>{ar ? 'رجوع' : 'Back'}</span>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className={labelCls}>{ar ? 'موظف السيلز' : 'Sales rep'}</label>
              <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={selectCls}>
                <option value="">{ar ? 'اختر موظف' : 'Select rep'}</option>
                {reps.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{ar ? 'من تاريخ' : 'From'}</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls} />
            </div>
            <div>
              <label className={labelCls}>{ar ? 'إلى تاريخ' : 'To'}</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectCls} />
            </div>
            <div>
              <button
                onClick={loadActivity}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 text-sm"
              >
                <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <span>{ar ? 'عرض' : 'Show'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary + Table */}
      <div className="max-w-6xl mx-auto">
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: ar ? 'إجمالي التواصل' : 'Total contacts', value: summary.total, tone: 'text-gray-900 dark:text-gray-100', ring: 'ring-gray-200 dark:ring-gray-700' },
              { label: ar ? 'رد' : 'Responded', value: summary.responded, tone: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-200 dark:ring-emerald-900/50' },
              { label: ar ? 'لم يرد' : 'No answer', value: summary.noAnswer, tone: 'text-red-600 dark:text-red-400', ring: 'ring-red-200 dark:ring-red-900/50' },
              { label: ar ? 'بدون نتيجة' : 'No result', value: summary.pending, tone: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-900/50' },
            ].map((s, i) => (
              <div key={i} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ${s.ring} p-4`}>
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{s.label}</div>
                <div className={`mt-1 text-2xl font-bold ${s.tone}`}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-12 text-center text-gray-500 dark:text-gray-400">
            {ar ? 'جارٍ التحميل...' : 'Loading...'}
          </div>
        ) : loaded && activity.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-12 text-center text-gray-500 dark:text-gray-400">
            {ar ? 'مفيش تواصل في الفترة دي' : 'No contacts in this period'}
          </div>
        ) : activity.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-start font-bold whitespace-nowrap">{ar ? 'العميل' : 'Client'}</th>
                  <th className="px-4 py-3 text-start font-bold whitespace-nowrap">{ar ? 'الهاتف' : 'Phone'}</th>
                  <th className="px-4 py-3 text-start font-bold whitespace-nowrap">{ar ? 'الحالة' : 'Status'}</th>
                  <th className="px-4 py-3 text-start font-bold whitespace-nowrap">{ar ? 'النتيجة' : 'Result'}</th>
                  <th className="px-4 py-3 text-start font-bold whitespace-nowrap">{ar ? 'التاريخ' : 'Date'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {activity.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">{a.clientName || '—'}</td>
                    <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-300 whitespace-nowrap" dir="ltr">{a.clientPhone || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {a.status === 'responded' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-900/50">
                          {ar ? 'رد' : 'Responded'}
                        </span>
                      ) : a.status === 'no-answer' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-900/50">
                          {ar ? 'لم يرد' : 'No answer'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-900/50">
                          {ar ? 'بدون نتيجة' : 'No result'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">{resultLabel(a.result)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-12 text-center text-gray-500 dark:text-gray-400">
            {ar ? 'اختار موظف وفترة واضغط عرض' : 'Pick a rep and period, then press Show'}
          </div>
        )}
      </div>
    </div>
  )
}
