'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useDarkMode } from '@/contexts/DarkModeContext'
import { useToast } from '@/contexts/ToastContext'
import { useServiceSettings } from '@/contexts/ServiceSettingsContext'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ConfirmDialog'
import { LoadingScreen } from '@/components/Spinner'

export const dynamic = 'force-dynamic'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Item {
  id: string
  itemName: string
  category: string
  location: string | null
  foundByType: string
  foundByName: string | null
  status: string
  claimedBy: string | null
  notes: string | null
  createdAt: string
}

const CATS = ['A', 'B', 'C']
const CAT_TONE: Record<string, string> = {
  A: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-blue-200 dark:ring-blue-900/50',
  B: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-900/50',
  C: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 ring-purple-200 dark:ring-purple-900/50',
}

const emptyForm = { itemName: '', category: 'A', location: '', foundByType: 'staff', foundByName: '', notes: '' }

export default function LostAndFoundPage() {
  const { locale, direction } = useLanguage()
  useDarkMode()
  const toast = useToast()
  const { settings, loading: settingsLoading } = useServiceSettings()
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm()
  const ar = locale === 'ar'

  const [items, setItems] = useState<Item[]>([])
  const [byCategory, setByCategory] = useState<Record<string, number>>({ A: 0, B: 0, C: 0 })
  const [loading, setLoading] = useState(true)
  const [catFilter, setCatFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('stored')
  const [q, setQ] = useState('')

  //  Add / edit modal
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  //  Return modal
  const [returningItem, setReturningItem] = useState<Item | null>(null)
  const [claimedBy, setClaimedBy] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (catFilter) params.set('category', catFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/lost-and-found?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || (ar ? 'فشل التحميل' : 'Failed')); return }
      setItems(data.items || [])
      setByCategory(data.byCategory || { A: 0, B: 0, C: 0 })
    } catch {
      toast.error(ar ? 'فشل التحميل' : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [catFilter, statusFilter, q, ar, toast])

  useEffect(() => { load() }, [catFilter, statusFilter])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => load(), 350)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowForm(true) }
  const openEdit = (it: Item) => {
    setEditing(it)
    setForm({
      itemName: it.itemName,
      category: it.category,
      location: it.location || '',
      foundByType: it.foundByType,
      foundByName: it.foundByName || '',
      notes: it.notes || '',
    })
    setShowForm(true)
  }

  const submitForm = async () => {
    if (!form.itemName.trim()) { toast.warning(ar ? 'اكتب وصف الحاجة' : 'Enter item name'); return }
    setSubmitting(true)
    try {
      const url = editing ? `/api/lost-and-found/${editing.id}` : '/api/lost-and-found'
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || (ar ? 'فشل الحفظ' : 'Failed')); return }
      toast.success(editing ? (ar ? 'اتعدلت' : 'Updated') : (ar ? 'اتضافت' : 'Added'))
      setShowForm(false)
      load()
    } catch {
      toast.error(ar ? 'فشل الحفظ' : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const doReturn = async () => {
    if (!returningItem) return
    try {
      const res = await fetch(`/api/lost-and-found/${returningItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'returned', claimedBy: claimedBy.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      toast.success(ar ? 'اتسلمت' : 'Marked returned')
      setReturningItem(null); setClaimedBy('')
      load()
    } catch { toast.error('Failed') }
  }

  const reopen = async (it: Item) => {
    try {
      const res = await fetch(`/api/lost-and-found/${it.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'stored', claimedBy: '' }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return }
      load()
    } catch { toast.error('Failed') }
  }

  const remove = async (it: Item) => {
    const ok = await confirm({
      title: ar ? 'حذف الحاجة' : 'Delete item',
      message: ar ? `متأكد تمسح «${it.itemName}»؟ مش هينفع ترجع فيها.` : `Delete "${it.itemName}"? This cannot be undone.`,
      confirmText: ar ? 'حذف' : 'Delete', cancelText: ar ? 'إلغاء' : 'Cancel', type: 'danger',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/lost-and-found/${it.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return }
      toast.success(ar ? 'اتمسحت' : 'Deleted')
      load()
    } catch { toast.error('Failed') }
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' })

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors'
  const labelCls = 'block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5'

  //  الخدمة متقفولة من الإعدادات
  if (!settingsLoading && !settings.lostFoundEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6" dir={direction}>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-8 text-center max-w-md">
          <p className="text-gray-700 dark:text-gray-200 font-bold">
            {ar ? 'خدمة المتعلقات المفقودة متقفولة. فعّلها من الإعدادات › الخدمات.' : 'Lost & Found is disabled. Enable it in Settings › Services.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6" dir={direction}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                {ar ? 'المتعلقات المفقودة' : 'Lost & Found'}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {ar ? 'الحاجات اللي اتلاقت في الجيم — مصنّفة فئات A/B/C' : 'Items found in the gym — categorized A/B/C'}
              </p>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors text-sm"
          >
            <svg {...stroke} className="w-4 h-4" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            <span>{ar ? 'إضافة حاجة' : 'Add item'}</span>
          </button>
        </div>

        {/* Category cards / filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => setCatFilter('')}
            className={`text-start rounded-xl p-4 ring-1 transition-colors ${catFilter === '' ? 'bg-primary-50 dark:bg-primary-900/30 ring-primary-300 dark:ring-primary-700' : 'bg-white dark:bg-gray-800 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}
          >
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{ar ? 'الكل' : 'All'}</div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{byCategory.A + byCategory.B + byCategory.C}</div>
          </button>
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(catFilter === c ? '' : c)}
              className={`text-start rounded-xl p-4 ring-1 transition-colors ${catFilter === c ? CAT_TONE[c] : 'bg-white dark:bg-gray-800 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}
            >
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{ar ? `فئة ${c}` : `Category ${c}`}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{byCategory[c] || 0}</div>
            </button>
          ))}
        </div>

        {/* Status + search */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 mb-6 flex flex-wrap gap-3 items-center">
          <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-700/50 p-1">
            {[
              { v: 'stored', l: ar ? 'محفوظة' : 'Stored' },
              { v: 'returned', l: ar ? 'اتسلمت' : 'Returned' },
              { v: '', l: ar ? 'الكل' : 'All' },
            ].map((s) => (
              <button
                key={s.v}
                onClick={() => setStatusFilter(s.v)}
                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${statusFilter === s.v ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
              >
                {s.l}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={ar ? 'بحث بالوصف أو المكان أو الاسم...' : 'Search by item, location, finder...'}
              className={inputCls}
            />
          </div>
        </div>

        {/* List */}
        {loading ? (
          <LoadingScreen />
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-12 text-center text-gray-500 dark:text-gray-400">
            {ar ? 'مفيش حاجات هنا' : 'No items here'}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-start font-bold whitespace-nowrap">{ar ? 'الفئة' : 'Cat'}</th>
                  <th className="px-4 py-3 text-start font-bold">{ar ? 'الحاجة' : 'Item'}</th>
                  <th className="px-4 py-3 text-start font-bold whitespace-nowrap">{ar ? 'المكان' : 'Location'}</th>
                  <th className="px-4 py-3 text-start font-bold whitespace-nowrap">{ar ? 'مين لاقاها' : 'Found by'}</th>
                  <th className="px-4 py-3 text-start font-bold whitespace-nowrap">{ar ? 'التاريخ' : 'Date'}</th>
                  <th className="px-4 py-3 text-start font-bold whitespace-nowrap">{ar ? 'الحالة' : 'Status'}</th>
                  <th className="px-4 py-3 text-end font-bold whitespace-nowrap">{ar ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ring-1 ${CAT_TONE[it.category] || CAT_TONE.A}`}>{it.category}</span>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">
                      {it.itemName}
                      {it.notes && <div className="text-xs font-normal text-gray-500 dark:text-gray-400 mt-0.5">{it.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">{it.location || '—'}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${it.foundByType === 'staff' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'}`}>
                        {it.foundByType === 'staff' ? (ar ? 'موظف' : 'Staff') : (ar ? 'عضو' : 'Member')}
                      </span>
                      {it.foundByName && <span className="ms-1 text-gray-500 dark:text-gray-400">{it.foundByName}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(it.createdAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {it.status === 'returned' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          {ar ? 'اتسلمت' : 'Returned'}{it.claimedBy ? ` · ${it.claimedBy}` : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-900/50">
                          {ar ? 'محفوظة' : 'Stored'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-end">
                      <div className="inline-flex items-center gap-1">
                        {it.status === 'stored' ? (
                          <button onClick={() => { setReturningItem(it); setClaimedBy('') }} title={ar ? 'تسليم' : 'Return'} className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30">
                            <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                          </button>
                        ) : (
                          <button onClick={() => reopen(it)} title={ar ? 'رجوع لمحفوظة' : 'Reopen'} className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30">
                            <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>
                          </button>
                        )}
                        <button onClick={() => openEdit(it)} title={ar ? 'تعديل' : 'Edit'} className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                          <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                        </button>
                        <button onClick={() => remove(it)} title={ar ? 'حذف' : 'Delete'} className="p-1.5 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30">
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
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5">
              {editing ? (ar ? 'تعديل حاجة' : 'Edit item') : (ar ? 'إضافة حاجة مفقودة' : 'Add lost item')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>{ar ? 'وصف الحاجة' : 'Item'} <span className="text-red-500">*</span></label>
                <input value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} placeholder={ar ? 'مثال: ساعة سوداء' : 'e.g. black watch'} className={inputCls} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{ar ? 'الفئة' : 'Category'}</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
                    {CATS.map((c) => <option key={c} value={c}>{ar ? `فئة ${c}` : `Category ${c}`}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{ar ? 'مين لاقاها' : 'Found by'}</label>
                  <select value={form.foundByType} onChange={(e) => setForm({ ...form, foundByType: e.target.value })} className={inputCls}>
                    <option value="staff">{ar ? 'موظف' : 'Staff'}</option>
                    <option value="member">{ar ? 'عضو' : 'Member'}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>{ar ? 'مكان اللقيا' : 'Location'}</label>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={ar ? 'مثال: على تريدميل في الفلور' : 'e.g. on a treadmill'} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{ar ? 'اسم اللي لاقاها (اختياري)' : 'Finder name (optional)'}</label>
                <input value={form.foundByName} onChange={(e) => setForm({ ...form, foundByName: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{ar ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600">
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={submitForm} disabled={submitting} className="px-4 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-primary-contrast font-bold text-sm">
                {ar ? 'حفظ' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return modal */}
      {returningItem && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setReturningItem(null) }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-sm w-full p-6" dir={direction} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{ar ? 'تسليم الحاجة' : 'Return item'}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{returningItem.itemName}</p>
            <label className={labelCls}>{ar ? 'اتسلمت لمين؟ (اختياري)' : 'Claimed by? (optional)'}</label>
            <input value={claimedBy} onChange={(e) => setClaimedBy(e.target.value)} className={inputCls} autoFocus />
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setReturningItem(null)} className="px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600">
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={doReturn} className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm">
                {ar ? 'تأكيد التسليم' : 'Confirm return'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={isOpen} title={options.title} message={options.message} confirmText={options.confirmText} cancelText={options.cancelText} onConfirm={handleConfirm} onCancel={handleCancel} type={options.type} />
    </div>
  )
}
