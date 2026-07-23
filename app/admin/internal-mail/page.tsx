'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useDarkMode } from '@/contexts/DarkModeContext'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ConfirmDialog'
import { LoadingScreen } from '@/components/Spinner'

export const dynamic = 'force-dynamic'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface SentMessage {
  id: string
  subject: string
  body: string
  senderName: string
  targetDepts: string
  createdAt: string
  total: number
  readCount: number
  replies?: { id: string; userName: string; body: string; createdAt: string; mine?: boolean }[]
}
type Reply = NonNullable<SentMessage['replies']>[number]

export default function InternalMailPage() {
  const { locale, direction } = useLanguage()
  useDarkMode()
  const toast = useToast()
  const { user, loading: permLoading } = usePermissions()
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm()
  const ar = locale === 'ar'
  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN'

  const TARGET_OPTIONS = [
    { value: 'coaches', label: ar ? 'الكباتن' : 'Coaches', depts: ['coaches'] },
    { value: 'reception_sales', label: ar ? 'الريسبشن والسيلز' : 'Reception & Sales', depts: ['reception', 'sales'] },
    { value: 'all', label: ar ? 'الكل' : 'Everyone', depts: ['coaches', 'reception', 'sales'] },
  ]

  const [mode, setMode] = useState<'dept' | 'people'>('dept')
  const [target, setTarget] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [empSearch, setEmpSearch] = useState('')
  const [showEmpResults, setShowEmpResults] = useState(false)
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; role: string; position: string | null }>>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<SentMessage[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [editReplyId, setEditReplyId] = useState<string | null>(null)
  const [editReplyText, setEditReplyText] = useState('')
  const [savingReply, setSavingReply] = useState(false)

  const startEdit = (m: SentMessage) => { setEditingId(m.id); setEditSubject(m.subject); setEditBody(m.body) }
  const saveEdit = async (m: SentMessage) => {
    if (!editSubject.trim() || !editBody.trim()) { toast.warning(ar ? 'العنوان والرسالة مطلوبين' : 'Subject and message required'); return }
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/admin/internal-mail/${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: editSubject, body: editBody }) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      toast.success(ar ? 'اتعدّلت' : 'Updated')
      setEditingId(null)
      loadSent()
    } catch { toast.error(ar ? 'فشل التعديل' : 'Failed') } finally { setSavingEdit(false) }
  }
  const removeMessage = async (m: SentMessage) => {
    const ok = await confirm({
      title: ar ? 'حذف الرسالة' : 'Delete message',
      message: ar ? `متأكد تمسح رسالة «${m.subject}»؟ هتتشال من كل المستقبلين. مش هينفع ترجع فيها.` : `Delete "${m.subject}"? It will be removed from all recipients.`,
      confirmText: ar ? 'حذف' : 'Delete', cancelText: ar ? 'إلغاء' : 'Cancel', type: 'danger',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/admin/internal-mail/${m.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return }
      toast.success(ar ? 'اتمسحت' : 'Deleted')
      if (openId === m.id) setOpenId(null)
      loadSent()
    } catch { toast.error('Failed') }
  }

  const sendReply = async (m: SentMessage) => {
    const text = replyText.trim()
    if (!text) return
    setSendingReply(true)
    try {
      const res = await fetch(`/api/admin/internal-mail/${m.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      const rp = data.reply
      setSent((prev) => prev.map((x) => (x.id === m.id ? { ...x, replies: [...(x.replies || []), { id: rp.id, userName: rp.userName, body: rp.body, createdAt: rp.createdAt, mine: true }] } : x)))
      setReplyText('')
      toast.success(ar ? 'اتبعت الرد' : 'Reply sent')
    } catch { toast.error(ar ? 'فشل الإرسال' : 'Failed') } finally { setSendingReply(false) }
  }
  const startEditReply = (rp: Reply) => { setEditReplyId(rp.id); setEditReplyText(rp.body) }
  const saveEditReply = async (m: SentMessage, rp: Reply) => {
    const text = editReplyText.trim()
    if (!text) return
    setSavingReply(true)
    try {
      const res = await fetch(`/api/inbox/reply/${rp.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      setSent((prev) => prev.map((x) => (x.id === m.id ? { ...x, replies: (x.replies || []).map((r) => (r.id === rp.id ? { ...r, body: text } : r)) } : x)))
      setEditReplyId(null)
      toast.success(ar ? 'اتعدّل' : 'Updated')
    } catch { toast.error(ar ? 'فشل التعديل' : 'Failed') } finally { setSavingReply(false) }
  }
  const deleteReply = async (m: SentMessage, rp: Reply) => {
    const ok = await confirm({
      title: ar ? 'حذف الرد' : 'Delete reply',
      message: ar ? 'متأكد تمسح ردك؟ مش هينفع ترجع فيه.' : 'Delete your reply? This cannot be undone.',
      confirmText: ar ? 'حذف' : 'Delete', cancelText: ar ? 'إلغاء' : 'Cancel', type: 'danger',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/inbox/reply/${rp.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return }
      setSent((prev) => prev.map((x) => (x.id === m.id ? { ...x, replies: (x.replies || []).filter((r) => r.id !== rp.id) } : x)))
      toast.success(ar ? 'اتمسح' : 'Deleted')
    } catch { toast.error('Failed') }
  }

  const toggleEmp = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const roleLabel = (e: { role: string; position: string | null }) => e.position || (e.role === 'COACH' ? (ar ? 'كابتن' : 'Coach') : e.role)

  const loadSent = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/internal-mail')
      if (!res.ok) return
      const data = await res.json()
      setSent(data.messages || [])
      setEmployees(data.employees || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { if (isAdmin) loadSent() }, [isAdmin, loadSent])

  const send = async () => {
    let payload: any = { subject, body }
    if (mode === 'dept') {
      const opt = TARGET_OPTIONS.find((o) => o.value === target)
      if (!opt) { toast.warning(ar ? 'اختار القسم' : 'Select a department'); return }
      payload.departments = opt.depts
    } else {
      if (selected.length === 0) { toast.warning(ar ? 'اختار شخص واحد على الأقل' : 'Select at least one person'); return }
      payload.userIds = selected
    }
    if (!subject.trim()) { toast.warning(ar ? 'اكتب العنوان' : 'Enter subject'); return }
    if (!body.trim()) { toast.warning(ar ? 'اكتب الرسالة' : 'Enter message'); return }
    setSending(true)
    try {
      const res = await fetch('/api/admin/internal-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || (ar ? 'فشل الإرسال' : 'Failed')); return }
      toast.success(ar ? `اتبعتت لـ ${data.recipientCount} شخص` : `Sent to ${data.recipientCount}`)
      setSubject(''); setBody(''); setTarget(''); setSelected([]); setEmpSearch('')
      loadSent()
    } catch {
      toast.error(ar ? 'فشل الإرسال' : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const filteredEmps = employees.filter((e) => !empSearch.trim() || e.name.toLowerCase().includes(empSearch.toLowerCase()) || (e.position || '').toLowerCase().includes(empSearch.toLowerCase()))

  const deptLabel = (raw: string) =>
    raw.split(',').map((d) => (d === 'coaches' ? (ar ? 'الكباتن' : 'Coaches') : d === 'reception' ? (ar ? 'الريسبشن' : 'Reception') : d === 'sales' ? (ar ? 'السيلز' : 'Sales') : d)).join(' + ')

  const fmtDate = (iso: string) => new Date(iso).toLocaleString(ar ? 'ar-EG' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  //  تاريخ مختصر لصفوف الإنبوكس: النهاردة → الساعة، غير كده → يوم/شهر
  const fmtShort = (iso: string) => {
    const d = new Date(iso); const now = new Date()
    const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
    return sameDay
      ? d.toLocaleTimeString(ar ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { day: '2-digit', month: '2-digit' })
  }

  if (permLoading) return <LoadingScreen fullScreen />
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6" dir={direction}>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-8 text-center max-w-md">
          <p className="text-gray-700 dark:text-gray-200 font-bold">{ar ? 'هذه الصفحة للأدمن فقط' : 'Admins only'}</p>
        </div>
      </div>
    )
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors'
  const labelCls = 'block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6" dir={direction}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-6 h-6" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{ar ? 'الإيميل الداخلي' : 'Internal Mail'}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{ar ? 'ابعت رسالة لقسم داخل السيستم' : 'Send a message to a department'}</p>
            </div>
          </div>
        </div>

        {/* Compose */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden mb-6">
          <div className="flex items-center gap-2 px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700/60">
            <span className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
            </span>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{ar ? 'رسالة جديدة' : 'New message'}</h2>
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            {/* المستهدَف: قسم أو أشخاص */}
            <div>
              <label className={labelCls}>{ar ? 'المستهدَف' : 'Send to'} <span className="text-red-500">*</span></label>
              <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-700/50 p-1 mb-2">
                {[{ v: 'dept', l: ar ? 'قسم' : 'Department' }, { v: 'people', l: ar ? 'أشخاص محددين' : 'Specific people' }].map((m) => (
                  <button key={m.v} type="button" onClick={() => setMode(m.v as any)} className={`px-3.5 py-1.5 rounded-md text-sm font-bold transition-colors ${mode === m.v ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>{m.l}</button>
                ))}
              </div>

              {mode === 'dept' ? (
                <>
                  <select value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls}>
                    <option value="">{ar ? 'اختر القسم' : 'Select department'}</option>
                    {TARGET_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 min-h-[1rem]">
                    {target ? `${ar ? 'هتوصل لـ ' : 'Goes to '}${TARGET_OPTIONS.find((o) => o.value === target)?.label}` : ''}
                  </p>
                </>
              ) : (
                <div className="relative">
                  {/* المختارين chips */}
                  {selected.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {employees.filter((e) => selected.includes(e.id)).map((e) => (
                        <span key={e.id} className="inline-flex items-center gap-1.5 ps-1 pe-2.5 py-1 rounded-full text-xs font-bold bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-primary-contrast flex items-center justify-center text-[10px]">{e.name.charAt(0).toUpperCase()}</span>
                          {e.name}
                          <button onClick={() => toggleEmp(e.id)} className="w-4 h-4 rounded-full hover:bg-primary-200/60 dark:hover:bg-primary-800 flex items-center justify-center" aria-label="remove">
                            <svg {...stroke} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* بحث */}
                  <input
                    value={empSearch}
                    onChange={(e) => { setEmpSearch(e.target.value); setShowEmpResults(true) }}
                    onFocus={() => setShowEmpResults(true)}
                    placeholder={ar ? 'ابحث بالاسم وأضِف...' : 'Search a name to add...'}
                    className={inputCls}
                  />
                  {showEmpResults && empSearch.trim() && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowEmpResults(false)} aria-hidden="true" />
                      <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl ring-1 ring-gray-200 dark:ring-gray-700 max-h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                        {filteredEmps.filter((e) => !selected.includes(e.id)).length === 0 ? (
                          <div className="p-3 text-sm text-center text-gray-400">{ar ? 'مفيش نتائج' : 'No results'}</div>
                        ) : filteredEmps.filter((e) => !selected.includes(e.id)).map((e) => (
                          <button key={e.id} type="button" onClick={() => { toggleEmp(e.id); setEmpSearch('') }} className="w-full flex items-center gap-3 px-3 py-2.5 text-start hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-primary-contrast flex items-center justify-center font-bold text-xs flex-shrink-0">{e.name.charAt(0).toUpperCase()}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{e.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{roleLabel(e)}</div>
                            </div>
                            <svg {...stroke} className="w-4 h-4 text-primary-500 flex-shrink-0" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className={labelCls}>{ar ? 'العنوان' : 'Subject'} <span className="text-red-500">*</span></label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} placeholder={ar ? 'عنوان الرسالة' : 'Subject'} />
            </div>
            <div>
              <label className={labelCls}>{ar ? 'الرسالة' : 'Message'} <span className="text-red-500">*</span></label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className={inputCls} placeholder={ar ? 'اكتب رسالتك...' : 'Write your message...'} />
            </div>
            <div className="flex justify-end">
              <button onClick={send} disabled={sending} className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-primary-contrast font-bold px-6 py-2.5 rounded-lg text-sm transition-colors">
                <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
                {sending ? (ar ? 'جارٍ الإرسال...' : 'Sending...') : (ar ? 'إرسال' : 'Send')}
              </button>
            </div>
          </div>
        </div>

        {/* Sent */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{ar ? 'الرسائل المُرسَلة' : 'Sent messages'}</h2>
          {sent.length > 0 && <span className="text-xs font-bold text-gray-400 dark:text-gray-500">{sent.length}</span>}
        </div>
        {sent.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-10 text-center">
            <svg {...stroke} className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{ar ? 'لسه مفيش رسائل مُرسَلة' : 'No messages sent yet'}</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/60">
            {sent.map((m) => {
              const open = openId === m.id
              const allRead = m.total > 0 && m.readCount === m.total
              return (
                <div key={m.id}>
                  {/* صف زي الإيميل */}
                  <button
                    onClick={() => { setOpenId(open ? null : m.id); setReplyText(''); setEditReplyId(null); setEditingId(null) }}
                    className="w-full text-start px-3 sm:px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    {/* أفاتار القسم */}
                    <span className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center flex-shrink-0">
                      <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
                    </span>
                    {/* المحتوى */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-gray-900 dark:text-gray-100 truncate">{m.subject}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 flex-shrink-0">{deptLabel(m.targetDepts)}</span>
                      </div>
                      {!open && <div className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{m.body}</div>}
                    </div>
                    {/* الميتا على اليمين */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{fmtShort(m.createdAt)}</span>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${allRead ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                        <svg {...stroke} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                        {m.readCount}/{m.total}
                      </span>
                    </div>
                  </button>

                  {/* المحتوى المفتوح */}
                  {open && (
                    <div className="px-4 sm:px-5 pb-4 pt-1">
                      <div className="ms-12 border-s-2 border-gray-100 dark:border-gray-700 ps-4">
                        {editingId === m.id ? (
                          <div className="space-y-2">
                            <input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className={inputCls} placeholder={ar ? 'العنوان' : 'Subject'} />
                            <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={4} className={inputCls} placeholder={ar ? 'الرسالة' : 'Message'} />
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-xs hover:bg-gray-200 dark:hover:bg-gray-600">{ar ? 'إلغاء' : 'Cancel'}</button>
                              <button onClick={() => saveEdit(m)} disabled={savingEdit} className="px-4 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-primary-contrast font-bold text-xs">{ar ? 'حفظ' : 'Save'}</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{m.body}</div>

                            {/* الردود من الموظفين والأدمن */}
                            {m.replies && m.replies.length > 0 && (
                              <div className="mt-4">
                                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{ar ? `الردود (${m.replies.length})` : `Replies (${m.replies.length})`}</div>
                                <div className="space-y-2">
                                  {m.replies.map((rp) => (
                                    <div key={rp.id} className={`rounded-lg p-2.5 text-sm ${rp.mine ? 'bg-primary-50 dark:bg-primary-900/25 ms-6' : 'bg-gray-50 dark:bg-gray-700/40 me-6'}`}>
                                      <div className="flex items-center justify-between gap-2 mb-0.5">
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{rp.mine ? (ar ? 'أنت' : 'You') : rp.userName}</span>
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500">{fmtDate(rp.createdAt)}</span>
                                      </div>
                                      {editReplyId === rp.id ? (
                                        <div className="mt-1 space-y-2">
                                          <textarea value={editReplyText} onChange={(e) => setEditReplyText(e.target.value)} rows={2} className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none" />
                                          <div className="flex justify-end gap-2">
                                            <button onClick={() => setEditReplyId(null)} className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xs">{ar ? 'إلغاء' : 'Cancel'}</button>
                                            <button onClick={() => saveEditReply(m, rp)} disabled={savingReply} className="px-3 py-1 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-primary-contrast font-bold text-xs">{ar ? 'حفظ' : 'Save'}</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <div className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{rp.body}</div>
                                          {rp.mine && (
                                            <div className="flex items-center gap-3 mt-1.5">
                                              <button onClick={() => startEditReply(rp)} className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                                                <svg {...stroke} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                                                {ar ? 'تعديل' : 'Edit'}
                                              </button>
                                              <button onClick={() => deleteReply(m, rp)} className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors">
                                                <svg {...stroke} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                                                {ar ? 'حذف' : 'Delete'}
                                              </button>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* صندوق رد الأدمن */}
                            <div className="mt-3 flex items-end gap-2">
                              <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={1} placeholder={ar ? 'اكتب ردك...' : 'Write a reply...'} className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none" />
                              <button onClick={() => sendReply(m)} disabled={sendingReply || !replyText.trim()} className="inline-flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-primary-contrast font-bold px-4 py-2 rounded-lg text-sm transition-colors flex-shrink-0">
                                <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
                                {ar ? 'رد' : 'Reply'}
                              </button>
                            </div>

                            {/* التاريخ + أزرار التعديل والحذف — مكان ثابت آخر الرسالة */}
                            <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                              <span className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(m.createdAt)}</span>
                              <button onClick={() => startEdit(m)} className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                                <svg {...stroke} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                                {ar ? 'تعديل' : 'Edit'}
                              </button>
                              <button onClick={() => removeMessage(m)} className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors">
                                <svg {...stroke} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                                {ar ? 'حذف' : 'Delete'}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        type={options.type}
      />
    </div>
  )
}
