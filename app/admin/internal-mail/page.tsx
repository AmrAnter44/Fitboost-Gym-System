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

interface SentMessage {
  id: string
  subject: string
  body: string
  senderName: string
  targetDepts: string
  createdAt: string
  total: number
  readCount: number
}

export default function InternalMailPage() {
  const { locale, direction } = useLanguage()
  useDarkMode()
  const toast = useToast()
  const { user, loading: permLoading } = usePermissions()
  const ar = locale === 'ar'
  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN'

  const TARGET_OPTIONS = [
    { value: 'coaches', label: ar ? 'الكباتن' : 'Coaches', depts: ['coaches'] },
    { value: 'reception_sales', label: ar ? 'الريسبشن والسيلز' : 'Reception & Sales', depts: ['reception', 'sales'] },
    { value: 'all', label: ar ? 'الكل' : 'Everyone', depts: ['coaches', 'reception', 'sales'] },
  ]

  const [target, setTarget] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<SentMessage[]>([])

  const loadSent = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/internal-mail')
      if (!res.ok) return
      const data = await res.json()
      setSent(data.messages || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { if (isAdmin) loadSent() }, [isAdmin, loadSent])

  const send = async () => {
    const opt = TARGET_OPTIONS.find((o) => o.value === target)
    if (!opt) { toast.warning(ar ? 'اختار القسم' : 'Select a department'); return }
    if (!subject.trim()) { toast.warning(ar ? 'اكتب العنوان' : 'Enter subject'); return }
    if (!body.trim()) { toast.warning(ar ? 'اكتب الرسالة' : 'Enter message'); return }
    setSending(true)
    try {
      const res = await fetch('/api/admin/internal-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, departments: opt.depts }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || (ar ? 'فشل الإرسال' : 'Failed')); return }
      toast.success(ar ? `اتبعتت لـ ${data.recipientCount} شخص` : `Sent to ${data.recipientCount}`)
      setSubject(''); setBody(''); setTarget('')
      loadSent()
    } catch {
      toast.error(ar ? 'فشل الإرسال' : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const deptLabel = (raw: string) =>
    raw.split(',').map((d) => (d === 'coaches' ? (ar ? 'الكباتن' : 'Coaches') : d === 'reception' ? (ar ? 'الريسبشن' : 'Reception') : d === 'sales' ? (ar ? 'السيلز' : 'Sales') : d)).join(' + ')

  const fmtDate = (iso: string) => new Date(iso).toLocaleString(ar ? 'ar-EG' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

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
          <Link href="/inbox" className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg font-bold transition-colors text-sm">
            {ar ? 'صندوق الوارد' : 'Inbox'}
          </Link>
        </div>

        {/* Compose */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 mb-6">
          <div className="mb-4">
            <label className={labelCls}>{ar ? 'القسم' : 'Department'}</label>
            <select value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls}>
              <option value="">{ar ? 'اختر القسم' : 'Select department'}</option>
              {TARGET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className={labelCls}>{ar ? 'العنوان' : 'Subject'}</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} placeholder={ar ? 'عنوان الرسالة' : 'Subject'} />
          </div>
          <div className="mb-4">
            <label className={labelCls}>{ar ? 'الرسالة' : 'Message'}</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className={inputCls} placeholder={ar ? 'اكتب رسالتك...' : 'Write your message...'} />
          </div>
          <div className="flex justify-end">
            <button onClick={send} disabled={sending} className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-primary-contrast font-bold px-5 py-2.5 rounded-lg text-sm">
              <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
              {ar ? 'إرسال' : 'Send'}
            </button>
          </div>
        </div>

        {/* Sent */}
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">{ar ? 'الرسائل المُرسَلة' : 'Sent messages'}</h2>
        {sent.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
            {ar ? 'لسه مفيش رسائل' : 'No messages yet'}
          </div>
        ) : (
          <div className="space-y-3">
            {sent.map((m) => (
              <div key={m.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 dark:text-gray-100">{m.subject}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">{m.body}</div>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 whitespace-nowrap">{deptLabel(m.targetDepts)}</span>
                </div>
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>{fmtDate(m.createdAt)}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <svg {...stroke} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                    {ar ? `قرأها ${m.readCount} من ${m.total}` : `Read ${m.readCount}/${m.total}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
