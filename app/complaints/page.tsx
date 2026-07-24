'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useDarkMode } from '@/contexts/DarkModeContext'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ConfirmDialog'
import { LoadingScreen } from '@/components/Spinner'

export const dynamic = 'force-dynamic'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface MemberHit { id: string; name: string; memberNumber?: string | null; phone?: string | null }
interface Complaint {
  id: string
  memberId: string
  memberName: string
  memberNumber: string | null
  memberPhone: string | null
  subject: string | null
  body: string
  status: string
  priority: string
  resolution: string | null
  createdBy: string | null
  createdAt: string
}

const PRIO_TONE: Record<string, string> = {
  high: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  normal: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  low: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
}

export default function ComplaintsPage() {
  const { locale, direction } = useLanguage()
  useDarkMode()
  const toast = useToast()
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm()
  const ar = locale === 'ar'

  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [byStatus, setByStatus] = useState<Record<string, number>>({ open: 0, resolved: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('open')
  const [q, setQ] = useState('')

  //  add modal
  const [showForm, setShowForm] = useState(false)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberResults, setMemberResults] = useState<MemberHit[]>([])
  const [selectedMember, setSelectedMember] = useState<MemberHit | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState('normal')
  const [submitting, setSubmitting] = useState(false)
  const searchAbort = useRef<AbortController | null>(null)

  //  resolve modal
  const [resolving, setResolving] = useState<Complaint | null>(null)
  const [resolution, setResolution] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/complaints?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      setComplaints(data.complaints || [])
      setByStatus(data.byStatus || { open: 0, resolved: 0 })
    } catch {
      toast.error(ar ? 'فشل التحميل' : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, q, ar, toast])

  useEffect(() => { load() }, [statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => load(), 350); return () => clearTimeout(t) }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  //  debounced member search
  useEffect(() => {
    if (!showForm) return
    const query = memberQuery.trim()
    if (query.length < 2) { setMemberResults([]); return }
    const t = setTimeout(async () => {
      try {
        searchAbort.current?.abort()
        searchAbort.current = new AbortController()
        const res = await fetch(`/api/members?search=${encodeURIComponent(query)}`, { signal: searchAbort.current.signal })
        if (!res.ok) return
        const data = await res.json()
        const list = Array.isArray(data) ? data : (data.members || [])
        setMemberResults(list.slice(0, 20))
        setShowResults(true)
      } catch { /* aborted */ }
    }, 350)
    return () => clearTimeout(t)
  }, [memberQuery, showForm])

  const openAdd = () => {
    setSelectedMember(null); setMemberQuery(''); setMemberResults([])
    setSubject(''); setBody(''); setPriority('normal'); setShowForm(true)
  }
  const selectMember = (m: MemberHit) => {
    setSelectedMember(m)
    setMemberQuery(`${m.name}${m.memberNumber ? ` #${m.memberNumber}` : ''}`)
    setShowResults(false)
  }

  const submit = async () => {
    if (!selectedMember) { toast.warning(ar ? 'اختار العضو الأول' : 'Select a member'); return }
    if (!body.trim()) { toast.warning(ar ? 'اكتب نص الشكوى' : 'Enter the complaint'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: selectedMember.id, subject, body, priority }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || (ar ? 'فشل الحفظ' : 'Failed')); return }
      toast.success(ar ? 'اتسجّلت الشكوى' : 'Complaint added')
      setShowForm(false)
      load()
    } catch {
      toast.error(ar ? 'فشل الحفظ' : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const doResolve = async () => {
    if (!resolving) return
    try {
      const res = await fetch(`/api/complaints/${resolving.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', resolution: resolution.trim() }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return }
      toast.success(ar ? 'اتحلّت الشكوى' : 'Resolved')
      setResolving(null); setResolution('')
      load()
    } catch { toast.error('Failed') }
  }

  const reopen = async (c: Complaint) => {
    try {
      const res = await fetch(`/api/complaints/${c.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'open' }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return }
      load()
    } catch { toast.error('Failed') }
  }

  const remove = async (c: Complaint) => {
    const ok = await confirm({
      title: ar ? 'حذف الشكوى' : 'Delete complaint',
      message: ar ? `متأكد تمسح شكوى «${c.memberName}»؟ مش هينفع ترجع فيها.` : `Delete "${c.memberName}" complaint? This cannot be undone.`,
      confirmText: ar ? 'حذف' : 'Delete', cancelText: ar ? 'إلغاء' : 'Cancel', type: 'danger',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/complaints/${c.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return }
      toast.success(ar ? 'اتمسحت' : 'Deleted')
      load()
    } catch { toast.error('Failed') }
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleString(ar ? 'ar-EG' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const prioLabel = (p: string) => (p === 'high' ? (ar ? 'عالية' : 'High') : p === 'low' ? (ar ? 'منخفضة' : 'Low') : (ar ? 'عادية' : 'Normal'))

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors'
  const labelCls = 'block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6" dir={direction}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-6 h-6" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.019Z" /></svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{ar ? 'الشكاوى' : 'Complaints'}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{ar ? 'سجّل شكوى وحدّد العضو التابعة له' : 'Log a complaint linked to a member'}</p>
            </div>
          </div>
          <button onClick={openAdd} className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors text-sm">
            <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            {ar ? 'شكوى جديدة' : 'New complaint'}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 mb-6 flex flex-wrap gap-3 items-center">
          <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-700/50 p-1">
            {[
              { v: 'open', l: `${ar ? 'مفتوحة' : 'Open'} (${byStatus.open || 0})` },
              { v: 'resolved', l: `${ar ? 'اتحلّت' : 'Resolved'} (${byStatus.resolved || 0})` },
              { v: '', l: ar ? 'الكل' : 'All' },
            ].map((s) => (
              <button key={s.v} onClick={() => setStatusFilter(s.v)} className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${statusFilter === s.v ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                {s.l}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[200px]">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? 'بحث بالعضو أو نص الشكوى...' : 'Search member or text...'} className={inputCls} />
          </div>
        </div>

        {/* List */}
        {loading ? (
          <LoadingScreen />
        ) : complaints.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-12 text-center text-gray-500 dark:text-gray-400">
            {ar ? 'مفيش شكاوى هنا' : 'No complaints here'}
          </div>
        ) : (
          <div className="space-y-3">
            {complaints.map((c) => (
              <div key={c.id} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 p-4 ${c.status === 'open' ? 'ring-gray-200 dark:ring-gray-700' : 'ring-gray-200 dark:ring-gray-700 opacity-80'}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 dark:text-gray-100">{c.memberName}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{c.memberNumber ? `#${c.memberNumber}` : ''} {c.memberPhone || ''}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${PRIO_TONE[c.priority] || PRIO_TONE.normal}`}>{prioLabel(c.priority)}</span>
                      {c.status === 'resolved' ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">{ar ? 'اتحلّت' : 'Resolved'}</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{ar ? 'مفتوحة' : 'Open'}</span>
                      )}
                    </div>
                    {c.subject && <div className="font-semibold text-gray-800 dark:text-gray-200 mt-2">{c.subject}</div>}
                    <div className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">{c.body}</div>
                    {c.resolution && (
                      <div className="mt-2 text-sm bg-emerald-50/60 dark:bg-emerald-900/20 rounded-lg p-2.5 text-emerald-800 dark:text-emerald-200">
                        <span className="font-bold">{ar ? 'الحل: ' : 'Resolution: '}</span>{c.resolution}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">{fmtDate(c.createdAt)}{c.createdBy ? ` · ${c.createdBy}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {c.status === 'open' ? (
                      <button onClick={() => { setResolving(c); setResolution('') }} title={ar ? 'حل الشكوى' : 'Resolve'} className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30">
                        <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                      </button>
                    ) : (
                      <button onClick={() => reopen(c)} title={ar ? 'إعادة فتح' : 'Reopen'} className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30">
                        <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>
                      </button>
                    )}
                    <button onClick={() => remove(c)} title={ar ? 'حذف' : 'Delete'} className="p-1.5 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30">
                      <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add modal */}
      {showForm && (
        <div className="fixed inset-0 z-[10000] flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-lg w-full p-6 my-4" dir={direction} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5">{ar ? 'شكوى جديدة' : 'New complaint'}</h2>
            <div className="space-y-4">
              {/* member picker */}
              <div className="relative">
                <label className={labelCls}>{ar ? 'العضو' : 'Member'} <span className="text-red-500">*</span></label>
                <input
                  value={memberQuery}
                  onChange={(e) => { setMemberQuery(e.target.value); setSelectedMember(null) }}
                  onFocus={() => memberResults.length && setShowResults(true)}
                  placeholder={ar ? 'ابحث بالاسم أو رقم العضوية أو التليفون...' : 'Search name / number / phone...'}
                  className={inputCls}
                />
                {showResults && memberResults.length > 0 && !selectedMember && (
                  <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl ring-1 ring-gray-200 dark:ring-gray-700 max-h-56 overflow-y-auto">
                    {memberResults.map((m) => (
                      <button key={m.id} onClick={() => selectMember(m)} className="w-full text-start px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/60 flex items-center justify-between gap-2">
                        <span className="font-bold text-gray-900 dark:text-gray-100">{m.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{m.memberNumber ? `#${m.memberNumber}` : ''} {m.phone || ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{ar ? 'العنوان (اختياري)' : 'Subject (optional)'}</label>
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{ar ? 'الأولوية' : 'Priority'}</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
                    <option value="low">{ar ? 'منخفضة' : 'Low'}</option>
                    <option value="normal">{ar ? 'عادية' : 'Normal'}</option>
                    <option value="high">{ar ? 'عالية' : 'High'}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>{ar ? 'نص الشكوى' : 'Complaint'} <span className="text-red-500">*</span></label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className={inputCls} placeholder={ar ? 'اكتب الشكوى اللي قالها العميل...' : 'Write the complaint...'} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={submit} disabled={submitting} className="px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-primary-contrast font-bold text-sm">{ar ? 'حفظ' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve modal */}
      {resolving && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setResolving(null) }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-sm w-full p-6" dir={direction} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{ar ? 'حل الشكوى' : 'Resolve complaint'}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{resolving.memberName}</p>
            <label className={labelCls}>{ar ? 'الحل / الرد (اختياري)' : 'Resolution (optional)'}</label>
            <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3} className={inputCls} autoFocus />
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setResolving(null)} className="px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={doResolve} className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm">{ar ? 'تأكيد الحل' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={isOpen} title={options.title} message={options.message} confirmText={options.confirmText} cancelText={options.cancelText} onConfirm={handleConfirm} onCancel={handleCancel} type={options.type} />
    </div>
  )
}
