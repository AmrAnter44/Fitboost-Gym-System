'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useDarkMode } from '@/contexts/DarkModeContext'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ConfirmDialog'
import { LoadingScreen } from '@/components/Spinner'

export const dynamic = 'force-dynamic'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Reply { id: string; userName: string; body: string; createdAt: string; mine: boolean }
interface InboxMessage {
  recipientId: string
  isRead: boolean
  readAt: string | null
  id: string
  subject: string
  body: string
  senderName: string
  createdAt: string
  replies?: Reply[]
}

export default function InboxPage() {
  const { locale, direction } = useLanguage()
  useDarkMode()
  const toast = useToast()
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm()
  const ar = locale === 'ar'

  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [editReplyId, setEditReplyId] = useState<string | null>(null)
  const [editReplyText, setEditReplyText] = useState('')
  const [savingReply, setSavingReply] = useState(false)

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
    setReplyText('')
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

  const sendReply = async (m: InboxMessage) => {
    const text = replyText.trim()
    if (!text) return
    setSendingReply(true)
    try {
      const res = await fetch('/api/inbox/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId: m.id, body: text }) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      const rp = data.reply
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, replies: [...(x.replies || []), { id: rp.id, userName: rp.userName, body: rp.body, createdAt: rp.createdAt, mine: true }] } : x)))
      setReplyText('')
      toast.success(ar ? 'اتبعت الرد' : 'Reply sent')
    } catch { toast.error(ar ? 'فشل الإرسال' : 'Failed') } finally { setSendingReply(false) }
  }

  const startEditReply = (rp: Reply) => { setEditReplyId(rp.id); setEditReplyText(rp.body) }
  const saveEditReply = async (m: InboxMessage, rp: Reply) => {
    const text = editReplyText.trim()
    if (!text) return
    setSavingReply(true)
    try {
      const res = await fetch(`/api/inbox/reply/${rp.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, replies: (x.replies || []).map((r) => (r.id === rp.id ? { ...r, body: text } : r)) } : x)))
      setEditReplyId(null)
      toast.success(ar ? 'اتعدّل' : 'Updated')
    } catch { toast.error(ar ? 'فشل التعديل' : 'Failed') } finally { setSavingReply(false) }
  }
  const deleteReply = async (m: InboxMessage, rp: Reply) => {
    const ok = await confirm({
      title: ar ? 'حذف الرد' : 'Delete reply',
      message: ar ? 'متأكد تمسح ردك؟ مش هينفع ترجع فيه.' : 'Delete your reply? This cannot be undone.',
      confirmText: ar ? 'حذف' : 'Delete', cancelText: ar ? 'إلغاء' : 'Cancel', type: 'danger',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/inbox/reply/${rp.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return }
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, replies: (x.replies || []).filter((r) => r.id !== rp.id) } : x)))
      toast.success(ar ? 'اتمسح' : 'Deleted')
    } catch { toast.error('Failed') }
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

                      {/* الردود */}
                      {m.replies && m.replies.length > 0 && (
                        <div className="mt-4 space-y-2">
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
                      )}

                      {/* صندوق الرد */}
                      <div className="mt-3 flex items-end gap-2">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          rows={1}
                          placeholder={ar ? 'اكتب ردك...' : 'Write a reply...'}
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                        />
                        <button
                          onClick={() => sendReply(m)}
                          disabled={sendingReply || !replyText.trim()}
                          className="inline-flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-primary-contrast font-bold px-4 py-2 rounded-lg text-sm transition-colors flex-shrink-0"
                        >
                          <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
                          {ar ? 'رد' : 'Reply'}
                        </button>
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
