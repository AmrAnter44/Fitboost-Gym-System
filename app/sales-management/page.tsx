'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../contexts/ToastContext'
import PermissionDenied from '../../components/PermissionDenied'
import { LoadingScreen } from '../../components/Spinner'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface SalesStaff { id: string; name: string; staffCode: string; load?: number }
interface RepStat { staffId: string; name: string; staffCode: string; assigned: number; contacted: number; subscribed: number; rate: number }
type Gender = 'all' | 'male' | 'female' | 'unknown'

const SOURCE_OPTIONS: { v: string; ar: string; en: string }[] = [
  { v: 'all', ar: 'كل المصادر', en: 'All sources' },
  { v: 'facebook', ar: 'فيسبوك', en: 'Facebook' },
  { v: 'instagram', ar: 'انستجرام', en: 'Instagram' },
  { v: 'tiktok', ar: 'تيك توك', en: 'TikTok' },
  { v: 'google_maps', ar: 'جوجل ماب', en: 'Google Maps' },
  { v: 'chatgpt', ar: 'ChatGPT', en: 'ChatGPT' },
  { v: 'website', ar: 'موقع الويب', en: 'Website' },
  { v: 'walk-in', ar: 'زيارة مباشرة', en: 'Walk-in' },
  { v: 'call-in', ar: 'اتصال', en: 'Call-in' },
  { v: 'friend_referral', ar: 'إحالة صديق', en: 'Friend referral' },
  { v: 'suggestion', ar: 'اقتراح', en: 'Suggestion' },
]

function monthRange(ym: string): { start: string; end: string } {
  //  ym = 'YYYY-MM' → أول وآخر يوم في الشهر
  const [y, m] = ym.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0)
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { start: fmt(start), end: fmt(end) }
}

export default function SalesManagementPage() {
  const { user, loading: permLoading, isAdmin, permissions } = usePermissions()
  const { locale } = useLanguage()
  const toast = useToast()
  const ar = locale === 'ar'

  const canAccess = isAdmin || user?.role === 'MANAGER' || permissions?.canManageSales === true || permissions?.canEditMembers === true

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [gender, setGender] = useState<Gender>('all')
  const [source, setSource] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState('')  //  'YYYY-MM'
  const [limitCount, setLimitCount] = useState('')  //  عدد محدد للتوزيع (فاضي = الكل)
  const [stats, setStats] = useState<RepStat[]>([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [salesStaff, setSalesStaff] = useState<SalesStaff[]>([])
  //  لكل سيلز: مختار؟ + النسبة
  const [rows, setRows] = useState<Record<string, { selected: boolean; pct: string }>>({})
  const [count, setCount] = useState<number | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [distributing, setDistributing] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [result, setResult] = useState<{ totalAssigned: number; results: { staffId: string; assigned: number }[] } | null>(null)

  //  معاينة العدد + جلب السيلز
  const fetchPreview = useCallback(async () => {
    if (!canAccess) return
    setLoadingPreview(true)
    try {
      const qs = new URLSearchParams()
      if (startDate) qs.set('startDate', startDate)
      if (endDate) qs.set('endDate', endDate)
      qs.set('gender', gender)
      if (source && source !== 'all') qs.set('source', source)
      const res = await fetch(`/api/sales/distribute?${qs.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setCount(data.count ?? 0)
        setSalesStaff(data.salesStaff || [])
        setRows(prev => {
          const next = { ...prev }
          for (const s of data.salesStaff || []) {
            if (!next[s.id]) next[s.id] = { selected: false, pct: '' }
          }
          return next
        })
      } else {
        toast.error(data.error || 'فشل جلب البيانات')
      }
    } catch {
      toast.error(ar ? 'حدث خطأ في الاتصال' : 'Connection error')
    } finally {
      setLoadingPreview(false)
    }
  }, [canAccess, startDate, endDate, gender, source, toast, ar])

  useEffect(() => { fetchPreview() }, [fetchPreview])

  //  إحصائيات أداء السيلز (نفس فترة التاريخ)
  const fetchStats = useCallback(async () => {
    if (!canAccess) return
    setLoadingStats(true)
    try {
      const qs = new URLSearchParams()
      if (startDate) qs.set('startDate', startDate)
      if (endDate) qs.set('endDate', endDate)
      const res = await fetch(`/api/sales/performance?${qs.toString()}`)
      const data = await res.json()
      if (res.ok) setStats(data.stats || [])
    } catch { /* ignore */ } finally { setLoadingStats(false) }
  }, [canAccess, startDate, endDate])

  useEffect(() => { fetchStats() }, [fetchStats])

  //  ترتيب السيلز حسب الأقل ليد للأكثر (عشان التوزيع يبقى أوضح)
  const sortedSalesStaff = [...salesStaff].sort((a, b) => (a.load ?? 0) - (b.load ?? 0))
  const selectedRows = salesStaff.filter(s => rows[s.id]?.selected)
  const sumPct = selectedRows.reduce((s, r) => s + (parseFloat(rows[r.id]?.pct || '0') || 0), 0)

  const distributeEqually = () => {
    const sel = salesStaff.filter(s => rows[s.id]?.selected)
    if (sel.length === 0) { toast.warning(ar ? 'اختار سيلز الأول' : 'Select sales reps first'); return }
    const each = Math.floor(100 / sel.length)
    const remainder = 100 - each * sel.length
    setRows(prev => {
      const next = { ...prev }
      sel.forEach((s, i) => { next[s.id] = { selected: true, pct: String(each + (i === 0 ? remainder : 0)) } })
      return next
    })
  }

  const toggleRep = (id: string) => {
    setRows(prev => ({ ...prev, [id]: { selected: !prev[id]?.selected, pct: prev[id]?.pct || '' } }))
  }
  const setPct = (id: string, pct: string) => {
    setRows(prev => ({ ...prev, [id]: { selected: prev[id]?.selected ?? true, pct } }))
  }

  //  فتح موديل التأكيد بعد التحقق
  const handleDistributeClick = () => {
    const reps = selectedRows.map(s => ({ staffId: s.id, percentage: parseFloat(rows[s.id]?.pct || '0') || 0 })).filter(r => r.percentage > 0)
    if (reps.length === 0) { toast.warning(ar ? 'اختار سيلز بنسبة أكبر من صفر' : 'Select reps with a percentage'); return }
    if (!count || count === 0) { toast.warning(ar ? 'مفيش ليدز مطابقين للفلتر' : 'No matching leads'); return }
    setShowConfirm(true)
  }

  const confirmDistribute = async () => {
    const reps = selectedRows.map(s => ({ staffId: s.id, percentage: parseFloat(rows[s.id]?.pct || '0') || 0 })).filter(r => r.percentage > 0)
    setShowConfirm(false)
    setDistributing(true); setResult(null)
    try {
      const res = await fetch('/api/sales/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: startDate || null, endDate: endDate || null, gender, source: source === 'all' ? null : source, limit: parseInt(limitCount) || 0, reps }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ totalAssigned: data.totalAssigned, results: data.results })
        toast.success(ar ? `تم توزيع ${data.totalAssigned} ليد بنجاح` : `Distributed ${data.totalAssigned} leads`)
        fetchPreview()
        fetchStats()
      } else {
        toast.error(data.error || (ar ? 'فشل التوزيع' : 'Distribution failed'))
      }
    } catch {
      toast.error(ar ? 'حدث خطأ في الاتصال' : 'Connection error')
    } finally {
      setDistributing(false)
    }
  }

  if (permLoading) return <LoadingScreen fullScreen message={ar ? 'جاري التحميل...' : 'Loading...'} />
  if (!canAccess) {
    return <PermissionDenied message={ar ? 'ليس لديك صلاحية الوصول لإدارة السيلز' : 'You do not have access to Sales Management'} />
  }

  //  آخر 12 شهر كـ options أنيقة بدل الـ native month input
  const monthNamesAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
  const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${(ar ? monthNamesAr : monthNamesEn)[d.getMonth()]} ${d.getFullYear()}`
    return { value, label }
  })

  const genderOptions: { v: Gender; label: string }[] = [
    { v: 'all', label: ar ? 'الكل' : 'All' },
    { v: 'male', label: ar ? 'رجالة' : 'Male' },
    { v: 'female', label: ar ? 'ستات' : 'Female' },
    { v: 'unknown', label: ar ? 'غير معروف' : 'Unknown' },
  ]

  return (
    <div className="container mx-auto px-4 py-6 md:px-6" dir={ar ? 'rtl' : 'ltr'}>
      {/* Header — نفس ستايل صفحة المتابعات */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <svg className="w-7 h-7 text-primary-500" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>
          <span>{ar ? 'إدارة السيلز' : 'Sales Management'}</span>
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{ar ? 'وزّع الليدز غير المُسنّين على السيلز بالتساوي أو بنسب مخصصة' : 'Distribute unassigned leads to sales reps equally or by custom percentages'}</p>
      </div>

      {/* الفلاتر */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-5 mb-4">
        <h2 className="font-bold text-gray-800 dark:text-gray-200 mb-3">{ar ? 'اختار الداتا' : 'Choose data'}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{ar ? 'شهر معيّن' : 'Specific month'}</label>
            <select value={selectedMonth}
              onChange={(e) => {
                const v = e.target.value
                setSelectedMonth(v)
                if (v) { const r = monthRange(v); setStartDate(r.start); setEndDate(r.end) }
                else { setStartDate(''); setEndDate('') }
              }}
              className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm">
              <option value="">{ar ? '— اختار شهر —' : '— Pick a month —'}</option>
              {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{ar ? 'من تاريخ' : 'From'}</label>
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setSelectedMonth('') }}
              className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{ar ? 'إلى تاريخ' : 'To'}</label>
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setSelectedMonth('') }}
              className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{ar ? 'الجندر' : 'Gender'}</label>
            <select value={gender} onChange={(e) => setGender(e.target.value as Gender)}
              className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm">
              {genderOptions.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{ar ? 'المصدر' : 'Source'}</label>
            <select value={source} onChange={(e) => setSource(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm">
              {SOURCE_OPTIONS.map(o => <option key={o.v} value={o.v}>{ar ? o.ar : o.en}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{ar ? 'وزّع عدد محدد (اختياري)' : 'Distribute count (optional)'}</label>
            <input type="number" min="1" value={limitCount} onChange={(e) => setLimitCount(e.target.value)}
              placeholder={ar ? 'الكل' : 'All'}
              className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm" />
          </div>
        </div>
        {(startDate || endDate) && (
          <button onClick={() => { setStartDate(''); setEndDate(''); setSelectedMonth('') }} className="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:underline">
            {ar ? 'مسح التاريخ (كل الفترات)' : 'Clear dates (all time)'}
          </button>
        )}

        {/* عدّاد الليدز */}
        <div className="mt-4 flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-800 rounded-lg px-4 py-3">
          <svg {...stroke} className="w-6 h-6 text-primary-600 dark:text-primary-400"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
          <span className="font-bold text-primary-800 dark:text-primary-200">
            {loadingPreview ? (ar ? 'جاري الحساب...' : 'Counting...') : (ar ? `${count ?? 0} ليد غير مُسنّد مطابق للفلتر` : `${count ?? 0} unassigned leads match`)}
          </span>
        </div>
      </div>

      {/* السيلز + النسب */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-5 mb-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-bold text-gray-800 dark:text-gray-200">{ar ? 'السيلز والنسب' : 'Sales reps & percentages'}</h2>
          <button onClick={distributeEqually} className="text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-1.5 rounded-lg">
            {ar ? 'توزيع بالتساوي' : 'Split equally'}
          </button>
        </div>

        {salesStaff.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4">{ar ? 'لا يوجد موظفو سيلز نشطين' : 'No active sales reps'}</p>
        ) : (
          <div className="space-y-2">
            {sortedSalesStaff.map(s => {
              const row = rows[s.id] || { selected: false, pct: '' }
              return (
                <div key={s.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 ring-1 ${row.selected ? 'bg-primary-50 dark:bg-primary-900/20 ring-primary-200 dark:ring-primary-800' : 'ring-gray-200 dark:ring-gray-700'}`}>
                  <input type="checkbox" checked={row.selected} onChange={() => toggleRep(s.id)} className="w-5 h-5 accent-primary-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">{s.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      #{s.staffCode}
                      <span className="ms-2 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                        · {ar ? `عليه ${s.load ?? 0} ليد` : `${s.load ?? 0} leads`}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <input type="number" min="0" max="100" value={row.pct} disabled={!row.selected}
                      onChange={(e) => setPct(s.id, e.target.value)}
                      placeholder="0"
                      className="w-20 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm text-center disabled:opacity-50" />
                    <span className="text-gray-500 dark:text-gray-400 text-sm font-bold">%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {selectedRows.length > 0 && (
          <div className={`mt-3 text-sm font-bold ${Math.abs(sumPct - 100) < 0.5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {ar ? `مجموع النسب: ${sumPct}%` : `Total: ${sumPct}%`}
            {Math.abs(sumPct - 100) >= 0.5 && <span className="font-normal"> — {ar ? 'التوزيع بيتحسب حسب النسب النسبية' : 'distribution uses relative weights'}</span>}
          </div>
        )}
      </div>

      {/* زرار التوزيع */}
      <button onClick={handleDistributeClick} disabled={distributing || !count || selectedRows.length === 0}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
        <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
        {distributing ? (ar ? 'جاري التوزيع...' : 'Distributing...') : (ar ? 'وزّع الليدز' : 'Distribute leads')}
      </button>

      {/* النتيجة */}
      {result && (
        <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800 rounded-xl p-4">
          <p className="font-bold text-emerald-800 dark:text-emerald-200 mb-2">✅ {ar ? `تم توزيع ${result.totalAssigned} ليد` : `Distributed ${result.totalAssigned} leads`}</p>
          <div className="space-y-1">
            {result.results.map(r => {
              const s = salesStaff.find(x => x.id === r.staffId)
              return <div key={r.staffId} className="text-sm text-gray-700 dark:text-gray-300 flex justify-between"><span>{s?.name || r.staffId}</span><span className="font-bold">{r.assigned}</span></div>
            })}
          </div>
        </div>
      )}

      {/* 📊 إحصائيات أداء السيلز للفترة */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>
            {ar ? 'أداء السيلز' : 'Sales performance'}
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{ar ? '(حسب فترة التاريخ المختارة)' : '(for the selected date range)'}</span>
          </h2>
        </div>
        {loadingStats ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-2">{ar ? 'جاري الحساب...' : 'Loading...'}</p>
        ) : stats.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-2">{ar ? 'لا توجد بيانات' : 'No data'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="text-gray-500 dark:text-gray-400 text-xs border-b border-gray-200 dark:border-gray-700">
                  <th className="text-start py-2 font-bold">{ar ? 'السيلز' : 'Rep'}</th>
                  <th className="text-center py-2 font-bold">{ar ? 'مُسنّد' : 'Assigned'}</th>
                  <th className="text-center py-2 font-bold">{ar ? 'اتواصل' : 'Contacted'}</th>
                  <th className="text-center py-2 font-bold">{ar ? 'اشترك' : 'Subscribed'}</th>
                  <th className="text-center py-2 font-bold">{ar ? 'التحويل' : 'Conv.'}</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(st => (
                  <tr key={st.staffId} className="border-b border-gray-100 dark:border-gray-700/60">
                    <td className="py-2 font-bold text-gray-800 dark:text-gray-100">{st.name}</td>
                    <td className="py-2 text-center text-gray-700 dark:text-gray-300">{st.assigned}</td>
                    <td className="py-2 text-center text-gray-700 dark:text-gray-300">{st.contacted}</td>
                    <td className="py-2 text-center font-bold text-emerald-600 dark:text-emerald-400">{st.subscribed}</td>
                    <td className="py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${st.rate >= 30 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : st.rate >= 15 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {st.rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* موديل تأكيد التوزيع (بدل الـ alert) */}
      {showConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !distributing && setShowConfirm(false)}>
          <div dir={ar ? 'rtl' : 'ltr'} className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 w-full max-w-md p-6 animate-modal-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                <svg {...stroke} className="w-6 h-6 text-emerald-600 dark:text-emerald-400"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 mb-1">{ar ? 'تأكيد التوزيع' : 'Confirm distribution'}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {ar
                    ? `هيتوزّع ${count} ليد على ${selectedRows.length} سيلز حسب النسب. متأكد؟`
                    : `${count} leads will be distributed to ${selectedRows.length} reps by the set percentages. Continue?`}
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowConfirm(false)} disabled={distributing}
                className="px-4 py-2 rounded-lg font-bold text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50">
                {ar ? 'رجوع' : 'Back'}
              </button>
              <button onClick={confirmDistribute} disabled={distributing}
                className="px-4 py-2 rounded-lg font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2">
                {distributing && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                )}
                {ar ? 'أكّد التوزيع' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
