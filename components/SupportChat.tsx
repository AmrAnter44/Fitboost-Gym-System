'use client'

/**
 * 💬 الدعم الفني — شات مباشر مع فريق FitBoost (بيعدّي من /api/support → Control)
 * - زرار عايم لكل الموظفين اللي عاملين لوجين (مش في صفحات الدخول/العامة، ومش جوه التابات/iframes)
 * - بانل جانبي ~400px على الديسكتوب، وفل سكرين على الموبايل
 * - تحديث كل 8 ثواني والشات مفتوح، وكل دقيقة وهو مقفول عشان بادج الرسايل الجديدة
 * - تقدر تفتحه من أي مكان: window.dispatchEvent(new Event('fitboost:open-support'))
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '../contexts/LanguageContext'
import { useTabs } from '../contexts/TabsContext'
import { useToast } from '../contexts/ToastContext'
import { compressImage } from '../lib/imageCompress'

type Msg = {
  id: string
  direction: 'in' | 'out' | 'event'
  body: string | null
  mediaUrl: string | null
  mediaType: 'image' | 'audio' | null
  senderName: string | null
  branchName: string | null
  createdAt: string
}
type ConvStatus = 'open' | 'pending' | 'resolved' | null
type Attachment = { file: File; previewUrl: string }

const OPEN_POLL_MS = 8_000
const CLOSED_POLL_MS = 60_000
const MAX_BODY = 4000
const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const LAST_SEEN_KEY = 'fbSupport:lastSeen'
const HIDDEN_PREFIXES = ['/login', '/setup', '/check', '/public', '/emergency-signup']
export const OPEN_SUPPORT_EVENT = 'fitboost:open-support'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

function readLastSeen(): string | null {
  try { return localStorage.getItem(LAST_SEEN_KEY) } catch { return null }
}
function writeLastSeen(iso: string) {
  try {
    const prev = localStorage.getItem(LAST_SEEN_KEY)
    if (!prev || Date.parse(iso) > Date.parse(prev)) localStorage.setItem(LAST_SEEN_KEY, iso)
  } catch { /* ignore */ }
}
const ts = (iso: string) => { const t = Date.parse(iso); return Number.isNaN(t) ? 0 : t }

function mergeMessages(prev: Msg[], incoming: Msg[]): Msg[] {
  if (!incoming.length) return prev
  const map = new Map(prev.map((m) => [m.id, m]))
  for (const m of incoming) if (m && m.id) map.set(m.id, m)
  return Array.from(map.values()).sort((a, b) => ts(a.createdAt) - ts(b.createdAt))
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = String(r.result || '')
      resolve(s.slice(s.indexOf(',') + 1))
    }
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(file)
  })
}

export default function SupportChat() {
  const pathname = usePathname() || ''
  const { user, loading } = usePermissions()
  const { locale, tr } = useLanguage()
  const { isEmbedded } = useTabs()
  const toast = useToast()
  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [status, setStatus] = useState<ConvStatus>(null)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<{ text: string; code?: string } | null>(null)
  const [unread, setUnread] = useState(0)
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [sending, setSending] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [viewer, setViewer] = useState<string | null>(null)

  const lastCreatedRef = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const stickBottomRef = useRef(true)
  const openRef = useRef(open)
  openRef.current = open

  const hidden = isEmbedded || HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
  const enabled = !loading && !!user && !hidden

  // ---------- data ----------
  const fetchMessages = useCallback(async (after: string | null) => {
    const res = await fetch(`/api/support${after ? `?after=${encodeURIComponent(after)}` : ''}`, { cache: 'no-store' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok || !d?.ok) {
      const err = new Error(d?.error || tr('حصل خطأ', 'An error occurred')) as Error & { code?: string }
      err.code = d?.code
      throw err
    }
    return { messages: (Array.isArray(d.messages) ? d.messages : []) as Msg[], status: (d.conversationStatus ?? null) as ConvStatus }
  }, [tr])

  const applyIncoming = useCallback((incoming: Msg[], st: ConvStatus) => {
    setStatus(st)
    if (!incoming.length) return
    setMessages((prev) => mergeMessages(prev, incoming))
    const newest = incoming.reduce<string | null>((acc, m) => (!acc || ts(m.createdAt) > ts(acc) ? m.createdAt : acc), lastCreatedRef.current)
    lastCreatedRef.current = newest
    if (openRef.current && newest) writeLastSeen(newest)
  }, [])

  const pollOpen = useCallback(async (initial = false) => {
    try {
      const r = await fetchMessages(initial ? null : lastCreatedRef.current)
      applyIncoming(r.messages, r.status)
      setLoadError(null)
    } catch (e: any) {
      setLoadError({ text: e?.message || tr('حصل خطأ', 'An error occurred'), code: e?.code })
    } finally {
      setLoaded(true)
    }
  }, [fetchMessages, applyIncoming, tr])

  // أول ما الشات يتفتح: نجيب آخر 100 ونحدّث كل 8 ثواني
  useEffect(() => {
    if (!open || !enabled) return
    setUnread(0)
    pollOpen(!lastCreatedRef.current)
    const iv = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      pollOpen(false)
    }, OPEN_POLL_MS)
    return () => clearInterval(iv)
  }, [open, enabled, pollOpen])

  // والشات مقفول: كل دقيقة نشوف فيه ردود جديدة من FitBoost (للبادج)
  useEffect(() => {
    if (open || !enabled) return
    let active = true
    const check = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      let lastSeen = readLastSeen()
      if (!lastSeen) {
        lastSeen = new Date().toISOString()
        writeLastSeen(lastSeen)
        return
      }
      try {
        const r = await fetchMessages(lastSeen)
        if (!active) return
        const seenT = ts(lastSeen)
        setUnread(r.messages.filter((m) => m.direction === 'out' && ts(m.createdAt) > seenT).length)
        if (lastCreatedRef.current) applyIncoming(r.messages, r.status)
      } catch {
        // مش مربوط / مفيش نت — البادج يفضل زي ما هو
      }
    }
    const first = setTimeout(check, 5_000)
    const iv = setInterval(check, CLOSED_POLL_MS)
    return () => { active = false; clearTimeout(first); clearInterval(iv) }
  }, [open, enabled, fetchMessages, applyIncoming])

  // ---------- open / close ----------
  const openChat = useCallback(() => setOpen(true), [])
  const closeChat = useCallback(() => {
    setOpen(false)
    setViewer(null)
    if (lastCreatedRef.current) writeLastSeen(lastCreatedRef.current)
    setTimeout(() => fabRef.current?.focus(), 0)
  }, [])

  useEffect(() => {
    const h = () => setOpen(true)
    window.addEventListener(OPEN_SUPPORT_EVENT, h)
    return () => window.removeEventListener(OPEN_SUPPORT_EVENT, h)
  }, [])

  useEffect(() => {
    if (!open) return
    stickBottomRef.current = true
    const t = setTimeout(() => textareaRef.current?.focus(), 50)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (viewer) setViewer(null)
      else closeChat()
    }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey) }
  }, [open, viewer, closeChat])

  // نفضل تحت لو المستخدم كان تحت
  useEffect(() => {
    const el = listRef.current
    if (el && stickBottomRef.current) el.scrollTop = el.scrollHeight
  }, [messages, open, loaded])

  const onListScroll = () => {
    const el = listRef.current
    if (!el) return
    stickBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  // ---------- attachments ----------
  const clearAttachment = useCallback(() => {
    setAttachment((a) => { if (a) URL.revokeObjectURL(a.previewUrl); return null })
  }, [])

  useEffect(() => () => { if (attachment) URL.revokeObjectURL(attachment.previewUrl) }, [attachment])

  const pickFile = useCallback(async (raw: File | null | undefined) => {
    if (!raw) return
    if (!ALLOWED_MIME.includes(raw.type)) {
      toast.error(tr('نوع الصورة مش مدعوم — استخدم JPG أو PNG أو WEBP', 'Unsupported image — use JPG, PNG or WEBP'))
      return
    }
    setPreparing(true)
    try {
      // سكرين شوت كبيرة → نصغّرها بس بدقة كفاية تتقري
      const file = raw.size > 1.5 * 1024 * 1024 ? await compressImage(raw, 1920, 0.85) : raw
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(tr('الصورة كبيرة — الحد الأقصى ٣ ميجا', 'Image too large — max 3MB'))
        return
      }
      setAttachment((a) => {
        if (a) URL.revokeObjectURL(a.previewUrl)
        return { file, previewUrl: URL.createObjectURL(file) }
      })
      textareaRef.current?.focus()
    } finally {
      setPreparing(false)
    }
  }, [toast, tr])

  const onPaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || [])
    const img = items.find((it) => it.kind === 'file' && it.type.startsWith('image/'))
    if (!img) return
    const f = img.getAsFile()
    if (!f) return
    e.preventDefault()
    pickFile(f)
  }

  // ---------- send ----------
  const notLinked = loadError?.code === 'NOT_LINKED'
  const canSend = !sending && !preparing && !notLinked && (text.trim().length > 0 || !!attachment)

  const send = async () => {
    if (!canSend) return
    const body = text.trim()
    if (body.length > MAX_BODY) {
      toast.error(tr(`الرسالة طويلة — الحد الأقصى ${MAX_BODY} حرف`, `Message too long — max ${MAX_BODY} characters`))
      return
    }
    setSending(true)
    try {
      const payload: { body?: string; image?: { base64: string; mime: string } } = {}
      if (body) payload.body = body
      if (attachment) payload.image = { base64: await fileToBase64(attachment.file), mime: attachment.file.type }
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d?.ok) {
        if (d?.code === 'NOT_LINKED') setLoadError({ text: d.error, code: d.code })
        toast.error(d?.error || tr('الرسالة متبعتتش — جرّب تاني', 'Message not sent — try again'))
        return
      }
      setText('')
      clearAttachment()
      stickBottomRef.current = true
      if (d.message && d.message.id) applyIncoming([d.message as Msg], status === 'resolved' || status === null ? 'open' : status)
      else pollOpen(false)
    } catch {
      toast.error(tr('مفيش اتصال — الرسالة متبعتتش', 'No connection — message not sent'))
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  // textarea بيكبر مع الكلام لحد حد معين
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [text, open])

  if (!enabled) return null

  const statusLine = notLinked
    ? tr('الجهاز مش مربوط', 'Device not linked')
    : status === 'pending'
      ? tr('فريق الدعم شغال على طلبك', 'Support is working on your request')
      : status === 'open'
        ? tr('رسالتك وصلت — هنرد عليك حالاً', 'Message received — we will reply shortly')
        : status === 'resolved'
          ? tr('المشكلة اتحلت ✅ ابعت لو محتاج أي حاجة تانية', 'Resolved ✅ message us if you need anything else')
          : tr('ابعتلنا مشكلتك وهنرد عليك في أسرع وقت', 'Tell us your issue and we will reply ASAP')

  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const loc = locale === 'ar' ? 'ar-EG' : 'en-GB'
    const sameDay = d.toDateString() === new Date().toDateString()
    return sameDay
      ? d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' })
      : d.toLocaleString(loc, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
  }

  const fabLabel = unread > 0
    ? tr(`الدعم الفني — ${unread} رد جديد`, `Support — ${unread} new repl${unread === 1 ? 'y' : 'ies'}`)
    : tr('الدعم الفني', 'Support')

  return (
    <>
      {/* الزرار العايم — على الموبايل مكان زرار البحث (البحث مخفي تحت sm)، وعلى الديسكتوب جنبه */}
      {!open && (
        <button
          ref={fabRef}
          type="button"
          onClick={openChat}
          aria-label={fabLabel}
          title={fabLabel}
          className="fixed bottom-6 end-6 sm:end-24 z-50 w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 dark:from-emerald-600 dark:to-emerald-700 text-white shadow-lg ring-1 ring-emerald-700/20 transition-[transform,box-shadow] duration-200 hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <svg className="w-6 h-6" {...stroke} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
          {unread > 0 && (
            <span className="absolute -top-1 -end-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center ring-2 ring-white dark:ring-gray-900" aria-hidden="true">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="support-chat-title"
          dir={dir}
          onPaste={onPaste}
          className="fixed inset-0 sm:inset-y-0 sm:start-auto sm:end-0 sm:w-[400px] z-[70] flex flex-col bg-white dark:bg-gray-900 sm:border-s border-gray-200 dark:border-gray-800 shadow-2xl"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Header */}
          <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <svg className="w-5 h-5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.712 4.33a9.027 9.027 0 0 1 1.652 1.306c.51.51.944 1.064 1.306 1.652M16.712 4.33l-3.448 4.138m3.448-4.138a9.014 9.014 0 0 0-9.424 0M19.67 7.288l-4.138 3.448m4.138-3.448a9.014 9.014 0 0 1 0 9.424m-4.138-5.976a3.736 3.736 0 0 0-.88-1.388 3.737 3.737 0 0 0-1.388-.88m2.268 2.268a3.765 3.765 0 0 1 0 2.528m-2.268-4.796a3.765 3.765 0 0 0-2.528 0m4.796 4.796c-.181.506-.475.982-.88 1.388a3.736 3.736 0 0 1-1.388.88m2.268-2.268 4.138 3.448m0 0a9.027 9.027 0 0 1-1.306 1.652c-.51.51-1.064.944-1.652 1.306m0 0-3.448-4.138m3.448 4.138a9.014 9.014 0 0 1-9.424 0m5.976-4.138a3.765 3.765 0 0 1-2.528 0m0 0a3.736 3.736 0 0 1-1.388-.88 3.737 3.737 0 0 1-.88-1.388m2.268 2.268L7.288 19.67m0 0a9.024 9.024 0 0 1-1.652-1.306 9.027 9.027 0 0 1-1.306-1.652m0 0 4.138-3.448M4.33 16.712a9.014 9.014 0 0 1 0-9.424m4.138 5.976a3.765 3.765 0 0 1 0-2.528m0 0c.181-.506.475-.982.88-1.388a3.736 3.736 0 0 1 1.388-.88m-2.268 2.268L4.33 7.288m6.406 1.18L7.288 4.33m0 0a9.024 9.024 0 0 0-1.652 1.306A9.025 9.025 0 0 0 4.33 7.288" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 id="support-chat-title" className="font-bold text-gray-900 dark:text-gray-100 truncate">
                {tr('الدعم الفني — FitBoost', 'Support — FitBoost')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate" aria-live="polite">{statusLine}</p>
            </div>
            <button
              type="button"
              onClick={closeChat}
              aria-label={tr('قفل الدعم الفني', 'Close support')}
              className="w-11 h-11 rounded-lg flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 flex-shrink-0"
            >
              <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </header>

          {/* Messages */}
          <div
            ref={listRef}
            onScroll={onListScroll}
            className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-3 bg-gray-50/60 dark:bg-gray-900"
            aria-live="polite"
            aria-relevant="additions"
          >
            {loadError && (
              <div role="alert" className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm px-3 py-2.5">
                {loadError.text}
              </div>
            )}

            {!loaded && !loadError && (
              <div className="flex justify-center py-8" aria-label={tr('جاري التحميل', 'Loading')}>
                <span className="w-6 h-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              </div>
            )}

            {loaded && !messages.length && !loadError && (
              <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-10 px-6 leading-relaxed">
                <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">{tr('أهلاً بيك 👋', 'Welcome 👋')}</p>
                <p>{tr('اكتب مشكلتك أو ابعت سكرين شوت (تقدر تعمل لصق Ctrl+V) وفريق FitBoost هيرد عليك هنا.', 'Describe your issue or send a screenshot (you can paste with Ctrl+V) and the FitBoost team will reply here.')}</p>
              </div>
            )}

            {messages.map((m) => {
              if (m.direction === 'event') {
                return (
                  <div key={m.id} className="flex justify-center">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-200/70 dark:bg-gray-800 rounded-full px-3 py-1 text-center">
                      {m.body} {m.createdAt && <span className="opacity-70">· {fmtTime(m.createdAt)}</span>}
                    </span>
                  </div>
                )
              }
              const mine = m.direction === 'in'
              const who = mine
                ? [m.senderName, m.branchName].filter(Boolean).join(' · ')
                : `${m.senderName || 'FitBoost'} — ${tr('الدعم الفني', 'Support')}`
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${mine
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-gray-900 dark:text-gray-100 rounded-ss-md'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ring-1 ring-gray-200 dark:ring-gray-700 rounded-se-md'}`}>
                    {who && (
                      <div className={`text-[11px] font-semibold mb-0.5 ${mine ? 'text-primary-800 dark:text-primary-300' : 'text-emerald-700 dark:text-emerald-400'}`}>{who}</div>
                    )}
                    {m.mediaType === 'image' && m.mediaUrl && (
                      <button
                        type="button"
                        onClick={() => setViewer(m.mediaUrl)}
                        className="block mt-1 rounded-lg overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        aria-label={tr('عرض الصورة', 'View image')}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.mediaUrl} alt={tr('صورة مرفقة', 'Attached image')} className="max-h-60 w-auto max-w-full object-contain bg-gray-100 dark:bg-gray-900" loading="lazy" />
                      </button>
                    )}
                    {m.mediaType === 'audio' && m.mediaUrl && (
                      <audio controls preload="none" src={m.mediaUrl} className="mt-1 w-60 max-w-full" aria-label={tr('رسالة صوتية', 'Voice message')} />
                    )}
                    {m.body && <p className="text-sm whitespace-pre-wrap break-words leading-relaxed" dir="auto">{m.body}</p>}
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 text-end">{fmtTime(m.createdAt)}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Composer */}
          <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2.5">
            {attachment && (
              <div className="flex items-center gap-2 mb-2 p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={attachment.previewUrl} alt={tr('الصورة اللي هتتبعت', 'Image to send')} className="w-14 h-14 rounded object-cover" />
                <span className="flex-1 text-xs text-gray-600 dark:text-gray-300 truncate">{tr('صورة جاهزة للإرسال', 'Image ready to send')}</span>
                <button
                  type="button"
                  onClick={clearAttachment}
                  aria-label={tr('شيل الصورة', 'Remove image')}
                  className="w-11 h-11 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-gray-200 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = '' }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={sending || preparing || notLinked}
                aria-label={tr('إرفاق صورة', 'Attach image')}
                title={tr('إرفاق صورة (أو الصق سكرين شوت)', 'Attach image (or paste a screenshot)')}
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                {preparing
                  ? <span className="w-5 h-5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" aria-hidden="true" />
                  : <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>}
              </button>
              <label htmlFor="support-chat-input" className="sr-only">{tr('اكتب رسالتك', 'Type your message')}</label>
              <textarea
                id="support-chat-input"
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_BODY))}
                onKeyDown={onKeyDown}
                rows={1}
                dir="auto"
                maxLength={MAX_BODY}
                disabled={notLinked}
                placeholder={tr('اكتب رسالتك…', 'Type your message…')}
                className="flex-1 min-h-[44px] max-h-[140px] resize-none rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-60"
              />
              <button
                type="button"
                onClick={send}
                disabled={!canSend}
                aria-label={sending ? tr('جاري الإرسال', 'Sending') : tr('إرسال', 'Send')}
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                {sending
                  ? <span className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" aria-hidden="true" />
                  : <svg className={`w-5 h-5 ${dir === 'rtl' ? '-scale-x-100' : ''}`} {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>}
              </button>
            </div>
            <p className="hidden sm:block text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 px-1">
              {tr('Enter للإرسال · Shift+Enter لسطر جديد · Ctrl+V للصق سكرين شوت', 'Enter to send · Shift+Enter for new line · Ctrl+V to paste a screenshot')}
            </p>
          </div>

          {/* Image viewer */}
          {viewer && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={tr('عرض الصورة', 'Image viewer')}
              className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-4"
              onClick={() => setViewer(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={viewer} alt={tr('صورة مرفقة', 'Attached image')} className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
              <button
                type="button"
                onClick={() => setViewer(null)}
                autoFocus
                aria-label={tr('قفل الصورة', 'Close image')}
                className="absolute top-4 end-4 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                style={{ marginTop: 'env(safe-area-inset-top)' }}
              >
                <svg className="w-6 h-6" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}
        </section>
      )}
    </>
  )
}
