'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useDarkMode } from '@/contexts/DarkModeContext'
import { useToast } from '@/contexts/ToastContext'
import { LoadingScreen } from '@/components/Spinner'

export const dynamic = 'force-dynamic'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface InboxMessage {
  recipientId: string
  isRead: boolean
  readAt: string | null
  id: string
  subject: string
  body: string
  senderName: string
  createdAt: string
}

export default function InboxPage() {
  const { locale, direction } = useLanguage()
  useDarkMode()
  const toast = useToast()
  const ar = locale === 'ar'

  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inbox')
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      setMessages(data.messages || [])
    } catch {
      toast.error(ar ? 'فشل التحميل' : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [ar, toast])

  useEffect(() => { load() }, [load])

  const openMessage = async (m: InboxMessage) => {
    const next = openId === m.recipientId ? null : m.recipientId
    setOpenId(next)
    if (next && !m.isRead) {
      setMessages((prev) => prev.map((x) => (x.recipientId === m.recipientId ? { ...x, isRead: true } : x)))
      try {
        await fetch('/api/inbox', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientId: m.recipientId }) })
      } catch { /* ignore */ }
    }
  }

  const markAll = async () => {
    try {
      const res = await fetch('/api/inbox', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markAll: true }) })
      if (!res.ok) return
      setMessages((prev) => prev.map((x) => ({ ...x, isRead: true })))
      toast.success(ar ? 'اتقرأت كلها' : 'All marked read')
    } catch { /* ignore */ }
  }

  const unread = messages.filter((m) => !m.isRead).length
  const fmtDate = (iso: string) => new Date(iso).toLocaleString(ar ? 'ar-EG' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

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
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{ar ? 'صندوق الوارد' : 'Inbox'}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{ar ? 'الرسائل الداخلية' : 'Internal messages'}{unread > 0 ? ` · ${unread} ${ar ? 'غير مقروءة' : 'unread'}` : ''}</p>
            </div>
          </div>
          {unread > 0 && (
            <button onClick={markAll} className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg font-bold transition-colors text-sm">
              {ar ? 'تعليم الكل مقروء' : 'Mark all read'}
            </button>
          )}
        </div>

        {loading ? (
          <LoadingScreen />
        ) : messages.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-12 text-center text-gray-500 dark:text-gray-400">
            {ar ? 'مفيش رسائل' : 'No messages'}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => {
              const open = openId === m.recipientId
              return (
                <div key={m.recipientId} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 transition-colors ${m.isRead ? 'ring-gray-200 dark:ring-gray-700' : 'ring-primary-300 dark:ring-primary-700'}`}>
                  <button onClick={() => openMessage(m)} className="w-full text-start p-4 flex items-start gap-3">
                    {!m.isRead && <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-primary-500 flex-shrink-0" aria-hidden="true" />}
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${m.isRead ? 'font-semibold text-gray-800 dark:text-gray-200' : 'font-bold text-gray-900 dark:text-gray-100'}`}>{m.subject}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{ar ? 'من' : 'From'} {m.senderName} · {fmtDate(m.createdAt)}</div>
                      {!open && <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">{m.body}</div>}
                    </div>
                    <svg {...stroke} className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-1 transition-transform ${open ? 'rotate-180' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 -mt-1">
                      <div className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap border-t border-gray-100 dark:border-gray-700 pt-3">{m.body}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
