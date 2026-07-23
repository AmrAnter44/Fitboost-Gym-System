'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useDarkMode } from '@/contexts/DarkModeContext'
import { useToast } from '@/contexts/ToastContext'
import { LoadingScreen } from '@/components/Spinner'

export const dynamic = 'force-dynamic'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Rec {
  id: string
  deviceName: string
  issue: string
  cost: number
  status: string
  fixedAt: string | null
  notes: string | null
  createdBy: string | null
  createdAt: string
}
interface Summary { totalCost: number; fixedCount: number; openCount: number; count: number }
interface DeviceAgg { deviceName: string; repairs: number; open: number; totalCost: number }

const localDate = (d: Date) => {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const emptyForm = { deviceName: '', issue: '', cost: '', status: 'fixed', notes: '' }

export default function MaintenancePage() {
  const { locale, direction } = useLanguage()
  useDarkMode()
  const toast = useToast()
  const ar = locale === 'ar'

  const [records, setRecords] = useState<Rec[]>([])
  const [summary, setSummary] = useState<Summary>({ totalCost: 0, fixedCount: 0, openCount: 0, count: 0 })
  const [byDevice, setByDevice] = useState<DeviceAgg[]>([])
  const [devices, setDevices] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [from, setFrom] = useState(() => { const d = new Date(); return localDate(new Date(d.getFullYear(), d.getMonth(), 1)) })
  const [to, setTo] = useState(() => localDate(new Date()))
  const [deviceFilter, setDeviceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [q, setQ] = useState('')

  //  add / edit modal
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Rec | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  //  fix modal
  const [fixing, setFixing] = useState<Rec | null>(null)
  const [fixCost, setFixCost] = useState('')

  const money = (n: number) => `${(n || 0).toLocaleString(ar ? 'ar-EG' : 'en-US', { maximumFractionDigits: 0 })} ${ar ? 'ج.م' : 'EGP'}`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (deviceFilter) params.set('deviceName', deviceFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/maintenance?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      setRecords(data.records || [])
      setSummary(data.summary || { totalCost: 0, fixedCount: 0, openCount: 0, count: 0 })
      setByDevice(data.byDevice || [])
      setDevices(data.devices || [])
    } catch {
      toast.error(ar ? 'فشل التحميل' : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [from, to, deviceFilter, statusFilter, q, ar, toast])

  useEffect(() => { load() }, [from, to, deviceFilter, statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => load(), 350); return () => clearTimeout(t) }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowForm(true) }
  const openEdit = (r: Rec) => {
    setEditing(r)
    setForm({ deviceName: r.deviceName, issue: r.issue, cost: String(r.cost || ''), status: r.status, notes: r.notes || '' })
    setShowForm(true)
  }

  const submit = async () => {
    if (!form.deviceName.trim()) { toast.warning(ar ? 'اكتب اسم الجهاز' : 'Enter device'); return }
    if (!form.issue.trim()) { toast.warning(ar ? 'اكتب العطل' : 'Enter issue'); return }
    setSubmitting(true)
    try {
      const url = editing ? `/api/maintenance/${editing.id}` : '/api/maintenance'
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceName: form.deviceName, issue: form.issue, cost: form.cost, status: form.status, notes: form.notes }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || (ar ? 'فشل الحفظ' : 'Failed')); return }
      toast.success(editing ? (ar ? 'اتعدّل' : 'Updated') : (ar ? 'اتسجّل' : 'Added'))
      setShowForm(false)
      load()
    } catch { toast.error(ar ? 'فشل الحفظ' : 'Failed to save') } finally { setSubmitting(false) }
  }

  const doFix = async () => {
    if (!fixing) return
    try {
      const res = await fetch(`/api/maintenance/${fixing.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'fixed', cost: fixCost || fixing.cost || 0 }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return }
      toast.success(ar ? 'اتصلح' : 'Fixed')
      setFixing(null); setFixCost('')
      load()
    } catch { toast.error('Failed') }
  }

  const reopen = async (r: Rec) => {
    try {
      const res = await fetch(`/api/maintenance/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'reported' }) })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return }
      load()
    } catch { toast.error('Failed') }
  }

  const remove = async (r: Rec) => {
    if (!confirm(ar ? 'متأكد تمسح السجل ده؟' : 'Delete this record?')) return
    try {
      const res = await fetch(`/api/maintenance/${r.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return }
      toast.success(ar ? 'اتمسح' : 'Deleted')
      load()
    } catch { toast.error('Failed') }
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors'
  const labelCls = 'block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6" dir={direction}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-6 h-6" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" /></svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{ar ? 'صيانة الأجهزة' : 'Maintenance'}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{ar ? 'متابعة أعطال وإصلاحات الأجهزة وتكلفتها' : 'Track equipment repairs and costs'}</p>
            </div>
          </div>
          <button onClick={openAdd} className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors text-sm">
            <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            {ar ? 'تسجيل صيانة' : 'Add record'}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className={labelCls}>{ar ? 'من' : 'From'}</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{ar ? 'إلى' : 'To'}</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{ar ? 'الجهاز' : 'Device'}</label>
            <select value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)} className={inputCls}>
              <option value="">{ar ? 'كل الأجهزة' : 'All devices'}</option>
              {devices.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>{ar ? 'الحالة' : 'Status'}</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls}>
              <option value="">{ar ? 'الكل' : 'All'}</option>
              <option value="reported">{ar ? 'بلاغ مفتوح' : 'Open'}</option>
              <option value="fixed">{ar ? 'اتصلح' : 'Fixed'}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{ar ? 'بحث' : 'Search'}</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? 'جهاز أو عطل...' : 'device or issue...'} className={inputCls} />
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: ar ? 'إجمالي التكلفة' : 'Total cost', value: money(summary.totalCost), tone: 'text-primary-700 dark:text-primary-300' },
            { label: ar ? 'عدد الإصلاحات' : 'Repairs', value: summary.fixedCount, tone: 'text-emerald-600 dark:text-emerald-400' },
            { label: ar ? 'بلاغات مفتوحة' : 'Open', value: summary.openCount, tone: 'text-amber-600 dark:text-amber-400' },
            { label: ar ? 'إجمالي السجلات' : 'Records', value: summary.count, tone: 'text-gray-900 dark:text-gray-100' },
          ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{s.label}</div>
              <div className={`mt-1 text-2xl font-bold ${s.tone}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Per-device summary */}
        {byDevice.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-start font-bold whitespace-nowrap">{ar ? 'الجهاز' : 'Device'}</th>
                  <th className="px-4 py-3 text-center font-bold whitespace-nowrap">{ar ? 'مرات الإصلاح' : 'Repairs'}</th>
                  <th className="px-4 py-3 text-center font-bold whitespace-nowrap">{ar ? 'مفتوح' : 'Open'}</th>
                  <th className="px-4 py-3 text-center font-bold whitespace-nowrap">{ar ? 'إجمالي التكلفة' : 'Total cost'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {byDevice.map((d, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">{d.deviceName}</td>
                    <td className="px-4 py-3 text-center">{d.repairs}</td>
                    <td className="px-4 py-3 text-center">{d.open > 0 ? <span className="text-amber-600 dark:text-amber-400 font-bold">{d.open}</span> : '—'}</td>
                    <td className="px-4 py-3 text-center font-bold text-primary-700 dark:text-primary-300 whitespace-nowrap">{money(d.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Detailed list */}
        {loading ? (
          <LoadingScreen />
        ) : records.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-12 text-center text-gray-500 dark:text-gray-400">
            {ar ? 'مفيش سجلات صيانة في الفترة دي' : 'No maintenance records'}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-start font-bold whitespace-nowrap">{ar ? 'الجهاز' : 'Device'}</th>
                  <th className="px-4 py-3 text-start font-bold">{ar ? 'العطل' : 'Issue'}</th>
                  <th className="px-4 py-3 text-center font-bold whitespace-nowrap">{ar ? 'التكلفة' : 'Cost'}</th>
                  <th className="px-4 py-3 text-center font-bold whitespace-nowrap">{ar ? 'الحالة' : 'Status'}</th>
                  <th className="px-4 py-3 text-start font-bold whitespace-nowrap">{ar ? 'التاريخ' : 'Date'}</th>
                  <th className="px-4 py-3 text-end font-bold whitespace-nowrap">{ar ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">{r.deviceName}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {r.issue}
                      {r.notes && <div className="text-xs text-gray-400 mt-0.5">{r.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap font-semibold text-gray-900 dark:text-gray-100">{r.cost ? money(r.cost) : '—'}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {r.status === 'fixed' ? (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">{ar ? 'اتصلح' : 'Fixed'}</span>
                      ) : (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{ar ? 'مفتوح' : 'Open'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-end">
                      <div className="inline-flex items-center gap-1">
                        {r.status === 'reported' ? (
                          <button onClick={() => { setFixing(r); setFixCost(String(r.cost || '')) }} title={ar ? 'تعليم كمُصلَّح' : 'Mark fixed'} className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30">
                            <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                          </button>
                        ) : (
                          <button onClick={() => reopen(r)} title={ar ? 'إعادة فتح' : 'Reopen'} className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30">
                            <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>
                          </button>
                        )}
                        <button onClick={() => openEdit(r)} title={ar ? 'تعديل' : 'Edit'} className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                          <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                        </button>
                        <button onClick={() => remove(r)} title={ar ? 'حذف' : 'Delete'} className="p-1.5 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30">
                          <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-[10000] flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-lg w-full p-6 my-4" dir={direction} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5">{editing ? (ar ? 'تعديل سجل' : 'Edit record') : (ar ? 'تسجيل صيانة' : 'Add maintenance')}</h2>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>{ar ? 'اسم الجهاز' : 'Device'} <span className="text-red-500">*</span></label>
                <input list="device-list" value={form.deviceName} onChange={(e) => setForm({ ...form, deviceName: e.target.value })} placeholder={ar ? 'مثال: تريدميل 1' : 'e.g. Treadmill 1'} className={inputCls} />
                <datalist id="device-list">{devices.map((d) => <option key={d} value={d} />)}</datalist>
              </div>
              <div>
                <label className={labelCls}>{ar ? 'العطل / المشكلة' : 'Issue'} <span className="text-red-500">*</span></label>
                <textarea value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} rows={2} className={inputCls} placeholder={ar ? 'مثال: الحزام بايظ' : 'e.g. belt worn out'} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{ar ? 'التكلفة (ج.م)' : 'Cost (EGP)'}</label>
                  <input type="number" min={0} value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className={inputCls} placeholder="0" />
                </div>
                <div>
                  <label className={labelCls}>{ar ? 'الحالة' : 'Status'}</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                    <option value="fixed">{ar ? 'اتصلح' : 'Fixed'}</option>
                    <option value="reported">{ar ? 'بلاغ مفتوح' : 'Open'}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>{ar ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</label>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={submit} disabled={submitting} className="px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-primary-contrast font-bold text-sm">{ar ? 'حفظ' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Fix modal */}
      {fixing && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setFixing(null) }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-sm w-full p-6" dir={direction} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{ar ? 'تعليم كمُصلَّح' : 'Mark fixed'}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{fixing.deviceName} — {fixing.issue}</p>
            <label className={labelCls}>{ar ? 'تكلفة الإصلاح (ج.م)' : 'Repair cost (EGP)'}</label>
            <input type="number" min={0} value={fixCost} onChange={(e) => setFixCost(e.target.value)} className={inputCls} autoFocus placeholder="0" />
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setFixing(null)} className="px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={doFix} className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm">{ar ? 'تأكيد' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
