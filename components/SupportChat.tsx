'use client'

/**
 * 💬 الدعم الفني — صفحة شات كاملة شبه واتساب (/support) مع فريق FitBoost
 * (بيعدّي من /api/support → Control). مفيش زرار عايم ولا بوب أب.
 * - لينك «الدعم الفني» في السايدبار (لكل الأدوار) + بادج ردود جديدة (hooks/useSupportUnread)
 * - تحديث كل ~7 ثواني والصفحة ظاهرة (?after= آخر createdAt)، وبيقف لما التاب يستخبى
 * - بيعلّم الرسايل كمقروءة (localStorage fbSupport:lastSeen) طول ما الصفحة مفتوحة
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import { compressImage } from '../lib/imageCompress'
import {
  SUPPORT_WHATSAPP_URL,
  SupportFetchError,
  fetchSupportMessages,
  fileToBase64,
  mergeSupportMessages,
  readSupportLastSeen,
  supportTs,
  writeSupportLastSeen,
  type SupportConvStatus,
  type SupportMsg,
} from '../lib/supportChat'

type Attachment = { file: File; previewUrl: string }
type PendingMsg = { id: string; body: string | null; previewUrl: string | null; createdAt: string }
type Tick = 'pending' | 'sent' | 'seen'

const POLL_MS = 7_000
const MAX_BODY = 4000
const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const COMPRESS_OVER_BYTES = 1.5 * 1024 * 1024
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const BOTTOM_THRESHOLD = 80

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

// ألوان أسماء الموظفين (زي جروبات واتساب) — light / dark
const SENDER_COLORS = [
  'text-[#1f7aec] dark:text-[#53bdeb]',
  'text-[#c4532d] dark:text-[#ff8a65]',
  'text-[#8b2fc9] dark:text-[#c792ea]',
  'text-[#a86a00] dark:text-[#ffd279]',
  'text-[#d6336c] dark:text-[#ff72a1]',
  'text-[#0f7b6c] dark:text-[#5fd4c0]',
]
function colorFor(key: string) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return SENDER_COLORS[h % SENDER_COLORS.length]
}

// اتجاه الرسالة من أول حرف قوي — عشان الوقت يقعد في آخر السطر الصح (زي واتساب)
function textDir(s: string, fallback: 'rtl' | 'ltr'): 'rtl' | 'ltr' {
  const m = /[A-Za-z\u0590-\u08FF]/.exec(s)
  if (!m) return fallback
  return /[A-Za-z]/.test(m[0]) ? 'ltr' : 'rtl'
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

type Item =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'event'; key: string; m: SupportMsg }
  | { kind: 'msg'; key: string; m: SupportMsg; mine: boolean; first: boolean; label: string | null; labelColor: string; tick: Tick | null; localPreview: string | null }

// ---------- icons ----------
function TailSvg({ onRight }: { onRight: boolean }) {
  // نفس شكل ديل فقاعة واتساب — بياخد لون الفقاعة من currentColor
  return onRight ? (
    <svg viewBox="0 0 8 13" width="8" height="13" className="absolute top-0 -right-2" aria-hidden="true">
      <path fill="currentColor" d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" />
    </svg>
  ) : (
    <svg viewBox="0 0 8 13" width="8" height="13" className="absolute top-0 -left-2" aria-hidden="true">
      <path fill="currentColor" d="M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z" />
    </svg>
  )
}

function TickIcon({ tick, label }: { tick: Tick; label: string }) {
  if (tick === 'pending') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" role="img" aria-label={label}>
        <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 4.6V8l2.3 1.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 16 11" width="16" height="11" role="img" aria-label={label} className={tick === 'seen' ? 'text-[#53bdeb]' : ''}>
      <path fill="currentColor" d="M11.07.65 10.4.13a.37.37 0 0 0-.52.06L4.35 7.03a.24.24 0 0 1-.36.01L1.63 4.75a.36.36 0 0 0-.51.01l-.5.51a.37.37 0 0 0 0 .52l3.33 3.25c.17.17.45.15.6-.04l6.58-8.1a.37.37 0 0 0-.06-.25Z" />
      <path fill="currentColor" d="M15.07.65 14.4.13a.37.37 0 0 0-.52.06L8.35 7.03a.24.24 0 0 1-.36.01l-.6-.59-.84 1.03 1.07 1.05c.17.17.45.15.6-.04l6.58-8.1a.37.37 0 0 0 .27-.74Z" />
    </svg>
  )
}

const WhatsAppGlyph = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="currentColor" d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.470-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.040 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.12-.27-.2-.57-.35ZM12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.890 9.88Zm8.41-18.3A11.81 11.81 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41Z" />
  </svg>
)

export default function SupportChat() {
  const router = useRouter()
  const { user, loading } = usePermissions()
  const { locale, tr } = useLanguage()
  const toast = useToast()
  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  const isRtl = dir === 'rtl'
  // tr بيتعمل من جديد كل رندر — نحطه في ref عشان مايعيدش تشغيل الـ polling
  const trRef = useRef(tr)
  trRef.current = tr

  const [messages, setMessages] = useState<SupportMsg[]>([])
  const [status, setStatus] = useState<SupportConvStatus>(null)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<{ text: string; code?: string } | null>(null)
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [pending, setPending] = useState<PendingMsg | null>(null)
  const [sending, setSending] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [viewer, setViewer] = useState<string | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [newCount, setNewCount] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const lastCreatedRef = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const stickBottomRef = useRef(true)
  const prevLenRef = useRef(0)
  const firstScrollDoneRef = useRef(false)
  const inFlightRef = useRef(false)
  const viewerOpenerRef = useRef<HTMLElement | null>(null)
  const attachmentRef = useRef<Attachment | null>(null)
  attachmentRef.current = attachment

  const enabled = !loading && !!user

  // 🔒 الصفحة للي عاملين لوجين بس (نفس نمط باقي الصفحات)
  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  // ---------- data ----------
  const markSeen = useCallback((newest: string | null) => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    if (newest) writeSupportLastSeen(newest)
    else if (!readSupportLastSeen()) writeSupportLastSeen(new Date().toISOString())
  }, [])

  const applyIncoming = useCallback((incoming: SupportMsg[], st: SupportConvStatus) => {
    setStatus(st)
    if (incoming.length) {
      setMessages((prev) => mergeSupportMessages(prev, incoming))
      const newest = incoming.reduce<string | null>(
        (acc, m) => (!acc || supportTs(m.createdAt) > supportTs(acc) ? m.createdAt : acc),
        lastCreatedRef.current
      )
      lastCreatedRef.current = newest
    }
    markSeen(lastCreatedRef.current)
  }, [markSeen])

  const poll = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    try {
      const r = await fetchSupportMessages(lastCreatedRef.current, trRef.current('حصل خطأ', 'An error occurred'))
      applyIncoming(r.messages, r.status)
      setLoadError(null)
    } catch (e) {
      const err = e as SupportFetchError
      setLoadError({ text: err?.message || trRef.current('حصل خطأ', 'An error occurred'), code: err?.code })
    } finally {
      inFlightRef.current = false
      setLoaded(true)
    }
  }, [applyIncoming])

  // أول تحميل + تحديث دوري والصفحة ظاهرة بس
  useEffect(() => {
    if (!enabled) return
    poll()
    const iv = setInterval(() => {
      if (document.visibilityState === 'hidden') return
      poll()
    }, POLL_MS)
    const onVis = () => { if (document.visibilityState === 'visible') poll() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis) }
  }, [enabled, poll])

  // ---------- scrolling ----------
  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    stickBottomRef.current = true
    setAtBottom(true)
    setNewCount(0)
  }, [])

  const onListScroll = () => {
    const el = listRef.current
    if (!el) return
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD
    stickBottomRef.current = bottom
    setAtBottom(bottom)
    if (bottom) setNewCount(0)
  }

  useLayoutEffect(() => {
    const el = listRef.current
    const prevLen = prevLenRef.current
    prevLenRef.current = messages.length
    if (!el || !loaded) return
    if (!firstScrollDoneRef.current) {
      firstScrollDoneRef.current = true
      el.scrollTop = el.scrollHeight
      return
    }
    if (stickBottomRef.current) {
      el.scrollTop = el.scrollHeight
    } else if (messages.length > prevLen) {
      const added = messages.slice(prevLen).filter((m) => m.direction !== 'in').length
      if (added > 0) setNewCount((c) => c + added)
    }
  }, [messages, pending, loaded])

  // صورة خلصت تحميل وكبّرت الارتفاع → نفضل تحت لو كنا تحت
  const onMediaLoad = useCallback(() => {
    const el = listRef.current
    if (el && stickBottomRef.current) el.scrollTop = el.scrollHeight
  }, [])

  // ---------- attachments ----------
  const clearAttachment = useCallback(() => {
    setAttachment((a) => { if (a) URL.revokeObjectURL(a.previewUrl); return null })
  }, [])

  useEffect(() => () => {
    if (attachmentRef.current) URL.revokeObjectURL(attachmentRef.current.previewUrl)
  }, [])

  const pickFile = useCallback(async (raw: File | null | undefined) => {
    if (!raw) return
    if (!ALLOWED_MIME.includes(raw.type)) {
      toast.error(trRef.current('نوع الصورة مش مدعوم — استخدم JPG أو PNG أو WEBP', 'Unsupported image — use JPG, PNG or WEBP'))
      return
    }
    setPreparing(true)
    try {
      // سكرين شوت كبيرة → نصغّرها بس بدقة كفاية تتقري
      const file = raw.size > COMPRESS_OVER_BYTES ? await compressImage(raw, 1920, 0.85) : raw
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(trRef.current('الصورة كبيرة — الحد الأقصى ٣ ميجا', 'Image too large — max 3MB'))
        return
      }
      setAttachment((a) => {
        if (a) URL.revokeObjectURL(a.previewUrl)
        return { file, previewUrl: URL.createObjectURL(file) }
      })
      textareaRef.current?.focus()
    } catch {
      toast.error(trRef.current('مش قادرين نجهّز الصورة — جرّب صورة تانية', 'Could not prepare the image — try another one'))
    } finally {
      setPreparing(false)
    }
  }, [toast])

  const notLinked = loadError?.code === 'NOT_LINKED'

  const onPaste = (e: React.ClipboardEvent) => {
    if (notLinked) return
    const items = Array.from(e.clipboardData?.items || [])
    const img = items.find((it) => it.kind === 'file' && it.type.startsWith('image/'))
    if (!img) return
    const f = img.getAsFile()
    if (!f) return
    e.preventDefault()
    pickFile(f)
  }

  const onDragOver = (e: React.DragEvent) => {
    if (notLinked || !Array.from(e.dataTransfer?.types || []).includes('Files')) return
    e.preventDefault()
    setDragOver(true)
  }
  const onDrop = (e: React.DragEvent) => {
    setDragOver(false)
    if (notLinked) return
    const f = Array.from(e.dataTransfer?.files || []).find((x) => x.type.startsWith('image/'))
    if (!f) return
    e.preventDefault()
    pickFile(f)
  }

  // ---------- send ----------
  const canSend = !sending && !preparing && !notLinked && (text.trim().length > 0 || !!attachment)

  const send = async () => {
    if (!canSend) return
    const body = text.trim()
    if (body.length > MAX_BODY) {
      toast.error(tr(`الرسالة طويلة — الحد الأقصى ${MAX_BODY} حرف`, `Message too long — max ${MAX_BODY} characters`))
      return
    }
    const att = attachment
    setSending(true)
    // فقاعة مؤقتة (🕓) لحد ما السيرفر يرد — زي واتساب
    setPending({ id: `pending-${Date.now()}`, body: body || null, previewUrl: att?.previewUrl ?? null, createdAt: new Date().toISOString() })
    setText('')
    setAttachment(null)
    stickBottomRef.current = true
    let ok = false
    try {
      const payload: { body?: string; image?: { base64: string; mime: string } } = {}
      if (body) payload.body = body
      if (att) payload.image = { base64: await fileToBase64(att.file), mime: att.file.type }
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json().catch(() => ({} as any))
      if (!res.ok || !d?.ok) {
        if (d?.code === 'NOT_LINKED') setLoadError({ text: d.error, code: d.code })
        toast.error(d?.error || tr('الرسالة متبعتتش — جرّب تاني', 'Message not sent — try again'))
      } else {
        ok = true
        if (d.message && d.message.id) applyIncoming([d.message as SupportMsg], status === 'resolved' || status === null ? 'open' : status)
        else poll()
      }
    } catch {
      toast.error(tr('مفيش اتصال — الرسالة متبعتتش', 'No connection — message not sent'))
    } finally {
      if (ok) {
        if (att) URL.revokeObjectURL(att.previewUrl)
      } else {
        // نرجّع الكلام والصورة عشان يقدر يبعت تاني
        setText((cur) => (cur ? cur : body))
        if (att) setAttachment((cur) => cur ?? att)
      }
      setPending(null)
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

  // textarea بيكبر مع الكلام لحد ~6 سطور
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`
  }, [text])

  // ---------- image viewer ----------
  const openViewer = (src: string, opener: HTMLElement) => {
    viewerOpenerRef.current = opener
    setViewer(src)
  }
  const closeViewer = useCallback(() => {
    setViewer(null)
    setTimeout(() => viewerOpenerRef.current?.focus(), 0)
  }, [])
  useEffect(() => {
    if (!viewer) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeViewer() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewer, closeViewer])

  // ---------- formatting ----------
  const loc = locale === 'ar' ? 'ar-EG' : 'en-GB'
  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' })
  }

  // ---------- build render list ----------
  const items = useMemo<Item[]>(() => {
    const today = new Date()
    const yest = new Date(); yest.setDate(today.getDate() - 1)
    const dayLabel = (d: Date) => {
      if (dayKey(d) === dayKey(today)) return tr('النهارده', 'Today')
      if (dayKey(d) === dayKey(yest)) return tr('امبارح', 'Yesterday')
      const diffDays = (today.getTime() - d.getTime()) / 86_400_000
      if (diffDays > 0 && diffDays < 6) return d.toLocaleDateString(loc, { weekday: 'long' })
      return d.toLocaleDateString(loc, {
        day: 'numeric',
        month: 'long',
        ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' as const } : {}),
      })
    }

    const all: (SupportMsg & { _local?: string | null })[] = pending
      ? [...messages, { id: pending.id, direction: 'in', body: pending.body, mediaUrl: null, mediaType: pending.previewUrl ? 'image' : null, senderName: user?.name || null, branchName: null, createdAt: pending.createdAt, _local: pending.previewUrl }]
      : messages
    const staffKeys = new Set(messages.filter((m) => m.direction === 'in').map((m) => `${m.senderName || ''}|${m.branchName || ''}`))
    const multiStaff = staffKeys.size > 1
    // آخر نشاط من FitBoost (رد أو حدث) — أي رسالة مننا قبله تبقى «اتشافت» (✓✓ أزرق)
    let lastSupportT = 0
    for (const m of messages) if (m.direction !== 'in') lastSupportT = Math.max(lastSupportT, supportTs(m.createdAt))

    const out: Item[] = []
    let lastDay = ''
    let prev: SupportMsg | null = null
    for (const m of all) {
      const d = new Date(m.createdAt)
      const dk = Number.isNaN(d.getTime()) ? 'x' : dayKey(d)
      if (dk !== lastDay) {
        lastDay = dk
        out.push({ kind: 'day', key: `day-${dk}`, label: dk === 'x' ? '' : dayLabel(d) })
        prev = null
      }
      if (m.direction === 'event') {
        out.push({ kind: 'event', key: m.id, m })
        prev = null
        continue
      }
      const mine = m.direction === 'in'
      const senderKey = mine ? `${m.senderName || ''}|${m.branchName || ''}` : (m.senderName || '')
      const prevKey = prev ? (prev.direction === 'in' ? `${prev.senderName || ''}|${prev.branchName || ''}` : (prev.senderName || '')) : null
      const first = !prev || prev.direction !== m.direction || prevKey !== senderKey
      let label: string | null = null
      if (first) {
        if (mine) label = multiStaff ? [m.senderName, m.branchName].filter(Boolean).join(' · ') || null : null
        else label = `${m.senderName || 'FitBoost'} — ${tr('الدعم الفني', 'Support')}`
      }
      const isPending = m.id.startsWith('pending-')
      const tick: Tick | null = !mine ? null : isPending ? 'pending' : supportTs(m.createdAt) < lastSupportT ? 'seen' : 'sent'
      out.push({
        kind: 'msg',
        key: m.id,
        m,
        mine,
        first,
        label,
        labelColor: mine ? colorFor(senderKey) : 'text-[#008069] dark:text-[#06cf9c]',
        tick,
        localPreview: (m as { _local?: string | null })._local ?? null,
      })
      prev = m
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, pending, locale, user?.name])

  if (loading || !user) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center" aria-label={tr('جاري التحميل', 'Loading')}>
        <span className="w-8 h-8 rounded-full border-2 border-[#00a884] border-t-transparent animate-spin" />
      </div>
    )
  }

  const statusLine = notLinked
    ? tr('الجهاز مش مربوط بـ FitBoost', 'Device not linked to FitBoost')
    : status === 'pending'
      ? tr('جاري الحل', 'Working on it')
      : status === 'resolved'
        ? tr('اتحلت — ابعت لو محتاج حاجة تانية', 'Resolved — message us if you need anything else')
        : tr('بنرد عليك في أسرع وقت', "We'll reply as soon as possible")
  const statusDot = notLinked ? 'bg-amber-500' : status === 'resolved' ? 'bg-gray-400' : status === 'pending' ? 'bg-sky-500' : 'bg-[#25d366]'

  const tickLabel = (t: Tick) =>
    t === 'pending' ? tr('بتتبعت', 'Sending') : t === 'seen' ? tr('اتشافت', 'Seen') : tr('اتبعتت', 'Sent')

  return (
    <section
      dir={dir}
      aria-labelledby="support-title"
      onPaste={onPaste}
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className="relative flex flex-col h-full min-h-0 bg-[#efeae2] dark:bg-[#0b141a]"
    >
      {/* ===== Header ===== */}
      <header className="flex-shrink-0 flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-black/5 dark:border-white/5">
        <Link
          href="/"
          aria-label={tr('رجوع للرئيسية', 'Back to home')}
          className="lg:hidden w-11 h-11 -ms-1 rounded-full flex items-center justify-center text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a884]"
        >
          <svg className={`w-6 h-6 ${isRtl ? '-scale-x-100' : ''}`} {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div className="relative flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fb.png" alt="" className="w-10 h-10 rounded-full object-contain bg-white ring-1 ring-black/5 dark:ring-white/10 p-0.5" />
          <span className={`absolute bottom-0 end-0 w-3 h-3 rounded-full ring-2 ring-[#f0f2f5] dark:ring-[#202c33] ${statusDot}`} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 id="support-title" className="text-[15px] sm:text-base font-semibold text-[#111b21] dark:text-[#e9edef] truncate">
            {tr('الدعم الفني — FitBoost', 'Support — FitBoost')}
          </h1>
          <p className="text-xs text-[#667781] dark:text-[#8696a0] truncate" aria-live="polite">{statusLine}</p>
        </div>
        <a
          href={SUPPORT_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={tr('كلّمنا على واتساب (بيفتح في شباك جديد)', 'Chat with us on WhatsApp (opens in a new window)')}
          title={tr('لو الشات مش شغال — كلّمنا واتساب', "If chat isn't working — message us on WhatsApp")}
          className="flex-shrink-0 inline-flex items-center gap-1.5 h-11 px-3 rounded-full text-xs font-semibold text-[#008069] dark:text-[#25d366] hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a884]"
        >
          <WhatsAppGlyph className="w-5 h-5" />
          <span className="hidden sm:inline">{tr('واتساب', 'WhatsApp')}</span>
        </a>
      </header>

      {/* ===== Messages ===== */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={listRef}
          onScroll={onListScroll}
          className="fb-wa-bg absolute inset-0 overflow-y-auto overscroll-contain"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label={tr('رسايل الدعم الفني', 'Support messages')}
        >
          <div className="mx-auto w-full max-w-4xl px-3 sm:px-[6%] lg:px-10 py-3 flex flex-col gap-[3px]">
            {loadError && (
              <div role="alert" className="self-center my-2 max-w-md text-center rounded-lg bg-[#fff5c4] dark:bg-[#182229] text-[#54656f] dark:text-[#ffd279] text-[13px] px-3 py-2 shadow-sm">
                {loadError.text}
              </div>
            )}

            {!loaded && !loadError && (
              <div className="flex justify-center py-10" aria-label={tr('جاري التحميل', 'Loading')}>
                <span className="w-7 h-7 rounded-full border-2 border-[#00a884] border-t-transparent animate-spin" />
              </div>
            )}

            {loaded && !messages.length && !pending && !loadError && (
              <div className="self-center my-6 max-w-sm text-center rounded-lg bg-[#fff5c4] dark:bg-[#182229] text-[#54656f] dark:text-[#8696a0] text-[13px] leading-relaxed px-4 py-3 shadow-sm">
                <p className="font-semibold text-[#111b21] dark:text-[#e9edef] mb-1">{tr('أهلاً بيك 👋', 'Welcome 👋')}</p>
                <p>{tr('اكتب مشكلتك أو ابعت سكرين شوت (تقدر تعمل لصق Ctrl+V) وفريق FitBoost هيرد عليك هنا.', 'Describe your issue or send a screenshot (you can paste with Ctrl+V) and the FitBoost team will reply here.')}</p>
              </div>
            )}

            {items.map((it) => {
              if (it.kind === 'day') {
                if (!it.label) return null
                return (
                  <div key={it.key} className="sticky top-2 z-10 flex justify-center my-2 pointer-events-none">
                    <span className="rounded-lg bg-white dark:bg-[#182229] text-[#54656f] dark:text-[#8696a0] text-[12.5px] px-3 py-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
                      {it.label}
                    </span>
                  </div>
                )
              }
              if (it.kind === 'event') {
                return (
                  <div key={it.key} className="flex justify-center my-1.5">
                    <span className="max-w-[85%] text-center rounded-lg bg-[#fff5c4] dark:bg-[#182229] text-[#54656f] dark:text-[#ffd279] text-[12.5px] px-3 py-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
                      {it.m.body}
                      {it.m.createdAt && <span className="opacity-70"> · {fmtTime(it.m.createdAt)}</span>}
                    </span>
                  </div>
                )
              }

              const { m, mine, first, label, labelColor, tick, localPreview } = it
              // RTL: رسايلنا (الجيم) على الشمال، LTR: على اليمين — نفس واتساب
              const onRight = mine !== isRtl
              const imgSrc = localPreview || (m.mediaType === 'image' ? m.mediaUrl : null)
              const imageOnly = !!imgSrc && !m.body
              const bubbleBg = mine
                ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef]'
                : 'bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef]'
              const tailColor = mine ? 'text-[#d9fdd3] dark:text-[#005c4b]' : 'text-white dark:text-[#202c33]'
              const metaColor = mine ? 'text-[#667781] dark:text-white/60' : 'text-[#667781] dark:text-[#8696a0]'
              const corner = first ? (onRight ? 'rounded-tr-none' : 'rounded-tl-none') : ''
              const meta = (
                <>
                  <time dateTime={m.createdAt}>{fmtTime(m.createdAt)}</time>
                  {tick && <TickIcon tick={tick} label={tickLabel(tick)} />}
                </>
              )

              return (
                <div key={it.key} className={`flex ${mine ? 'justify-end' : 'justify-start'} ${first ? 'mt-2' : ''}`}>
                  <div className={`relative max-w-[88%] sm:max-w-[70%] lg:max-w-[62%] rounded-lg shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${bubbleBg} ${corner} ${imageOnly ? 'p-1' : 'px-2 pt-1.5 pb-2'}`}>
                    {first && <span className={tailColor}><TailSvg onRight={onRight} /></span>}
                    <span className="sr-only">
                      {mine ? tr('إنت', 'You') : `${m.senderName || 'FitBoost'} — ${tr('الدعم الفني', 'Support')}`}:
                    </span>
                    {label && (
                      <div className={`text-[12.5px] font-semibold leading-5 truncate ${labelColor} ${imageOnly ? 'px-1.5 pt-0.5 pb-1' : ''}`} aria-hidden="true">
                        {label}
                      </div>
                    )}

                    {imgSrc && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => openViewer(imgSrc, e.currentTarget)}
                          className="block rounded-md overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a884]"
                          aria-label={tr('فتح الصورة', 'Open image')}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imgSrc}
                            alt={tr('صورة مرفقة', 'Attached image')}
                            loading="lazy"
                            onLoad={onMediaLoad}
                            className={`block max-h-80 w-auto max-w-full sm:max-w-[320px] min-w-[120px] min-h-[80px] object-cover bg-black/5 dark:bg-white/5 ${tick === 'pending' ? 'opacity-70' : ''}`}
                          />
                        </button>
                        {imageOnly && (
                          <>
                            <span className="pointer-events-none absolute bottom-0 inset-x-0 h-10 rounded-b-md bg-gradient-to-t from-black/45 to-transparent" aria-hidden="true" />
                            <span className="pointer-events-none absolute bottom-1 end-2 inline-flex items-center gap-1 text-[11px] text-white">
                              {meta}
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {m.mediaType === 'audio' && m.mediaUrl && (
                      <audio
                        controls
                        preload="none"
                        src={m.mediaUrl}
                        className="block mt-0.5 h-10 w-[260px] max-w-full"
                        aria-label={tr('رسالة صوتية', 'Voice message')}
                      />
                    )}

                    {!imageOnly && (
                      <div className={`relative ${imgSrc ? 'px-1 pt-1' : ''}`} dir={m.body ? textDir(m.body, dir) : dir}>
                        {m.body ? (
                          <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words">
                            {m.body}
                            {/* مسافة محجوزة للوقت والعلامات زي واتساب */}
                            <span className={`inline-block ${tick ? 'w-[74px]' : 'w-[54px]'}`} aria-hidden="true" />
                          </p>
                        ) : (
                          <div className="h-3" aria-hidden="true" />
                        )}
                        <span className={`absolute -bottom-1 end-0 inline-flex items-center gap-1 text-[11px] leading-none whitespace-nowrap ${metaColor}`}>
                          {meta}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* «رسايل جديدة ↓» لما يكون طالع لفوق */}
        {!atBottom && (
          <div className="pointer-events-none absolute bottom-3 inset-x-0 flex justify-center z-20">
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              className={`pointer-events-auto inline-flex items-center gap-1.5 h-11 rounded-full shadow-md text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a884] ${newCount > 0
                ? 'px-4 bg-[#00a884] text-white hover:bg-[#008f72]'
                : 'w-11 justify-center bg-white dark:bg-[#202c33] text-[#54656f] dark:text-[#aebac1] hover:bg-gray-50 dark:hover:bg-[#2a3942]'}`}
              aria-label={newCount > 0 ? tr(`${newCount} رسايل جديدة — انزل لآخر الشات`, `${newCount} new messages — jump to latest`) : tr('انزل لآخر الشات', 'Jump to latest')}
            >
              {newCount > 0 && <span>{tr('رسايل جديدة', 'New messages')} ({newCount > 99 ? '99+' : newCount})</span>}
              <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>
        )}

        {dragOver && (
          <div className="pointer-events-none absolute inset-2 z-30 rounded-xl border-2 border-dashed border-[#00a884] bg-[#00a884]/10 flex items-center justify-center text-[#008069] dark:text-[#25d366] font-semibold">
            {tr('سيب الصورة هنا عشان تبعتها', 'Drop the image to send it')}
          </div>
        )}
      </div>

      {/* ===== Composer ===== */}
      <div
        className="flex-shrink-0 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-black/5 dark:border-white/5 px-2 sm:px-4 pt-2"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto w-full max-w-4xl">
          {notLinked ? (
            <div role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-1 text-center text-[13px] text-[#54656f] dark:text-[#8696a0]">
              <span>{tr('الجهاز ده مش مربوط بـ FitBoost، فمش هتقدر تبعت من هنا.', "This device isn't linked to FitBoost, so you can't send from here.")}</span>
              <a
                href={SUPPORT_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-11 px-4 rounded-full bg-[#00a884] hover:bg-[#008f72] text-white font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a884] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#202c33]"
              >
                <WhatsAppGlyph /> {tr('كلّمنا واتساب', 'Message us on WhatsApp')}
              </a>
            </div>
          ) : (
            <>
              {attachment && (
                <div className="flex items-center gap-3 mb-2 p-2 rounded-xl bg-white dark:bg-[#2a3942] shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={attachment.previewUrl} alt={tr('الصورة اللي هتتبعت', 'Image to send')} className="w-16 h-16 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0 text-xs text-[#54656f] dark:text-[#aebac1]">
                    <p className="font-semibold text-[#111b21] dark:text-[#e9edef]">{tr('صورة جاهزة للإرسال', 'Image ready to send')}</p>
                    <p className="truncate">
                      {tr('تقدر تكتب تعليق معاها', 'You can add a caption')} ·{' '}
                      {attachment.file.size < 1024 * 1024
                        ? `${Math.max(1, Math.round(attachment.file.size / 1024))} KB`
                        : `${(attachment.file.size / 1024 / 1024).toFixed(1)} MB`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearAttachment}
                    aria-label={tr('شيل الصورة', 'Remove image')}
                    className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-[#54656f] dark:text-[#aebac1] hover:text-red-600 hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a884]"
                  >
                    <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              <div className="flex items-end gap-1.5 sm:gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  tabIndex={-1}
                  onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = '' }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={sending || preparing}
                  aria-label={tr('إرفاق صورة', 'Attach image')}
                  title={tr('إرفاق صورة (أو الصق سكرين شوت)', 'Attach image (or paste a screenshot)')}
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a884]"
                >
                  {preparing
                    ? <span className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />
                    : <svg className="w-6 h-6" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" /></svg>}
                </button>
                <div className="flex-1 min-w-0 flex items-end rounded-3xl bg-white dark:bg-[#2a3942] px-4 focus-within:ring-2 focus-within:ring-[#00a884]/60">
                  <label htmlFor="support-input" className="sr-only">{tr('اكتب رسالتك', 'Type your message')}</label>
                  <textarea
                    id="support-input"
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, MAX_BODY))}
                    onKeyDown={onKeyDown}
                    rows={1}
                    dir="auto"
                    maxLength={MAX_BODY}
                    placeholder={tr('اكتب رسالة', 'Type a message')}
                    className="block w-full min-h-[44px] max-h-36 resize-none bg-transparent border-0 px-0 py-[11px] text-[15px] leading-[22px] text-[#111b21] dark:text-[#e9edef] placeholder-[#667781] dark:placeholder-[#8696a0] shadow-none focus:outline-none focus:ring-0"
                  />
                </div>
                <button
                  type="button"
                  onClick={send}
                  disabled={!canSend}
                  aria-label={sending ? tr('جاري الإرسال', 'Sending') : tr('إرسال', 'Send')}
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 bg-[#00a884] hover:bg-[#008f72] text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a884] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f0f2f5] dark:focus-visible:ring-offset-[#202c33]"
                >
                  {sending
                    ? <span className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" aria-hidden="true" />
                    : <svg viewBox="0 0 24 24" className={`w-5 h-5 ${isRtl ? '-scale-x-100' : ''}`} aria-hidden="true"><path fill="currentColor" d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z" /></svg>}
                </button>
              </div>
              <p className="hidden md:block text-[11px] text-[#667781] dark:text-[#8696a0] mt-1 px-14">
                {tr('Enter للإرسال · Shift+Enter لسطر جديد · Ctrl+V للصق سكرين شوت', 'Enter to send · Shift+Enter for new line · Ctrl+V to paste a screenshot')}
              </p>
            </>
          )}
        </div>
      </div>

      {/* ===== Full-screen image viewer ===== */}
      {viewer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={tr('عرض الصورة', 'Image viewer')}
          className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4"
          onClick={closeViewer}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewer} alt={tr('صورة مرفقة', 'Attached image')} className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          <div className="absolute top-4 end-4 flex gap-2" style={{ marginTop: 'env(safe-area-inset-top)' }}>
            {!viewer.startsWith('blob:') && (
              <a
                href={viewer}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label={tr('فتح الصورة في شباك جديد', 'Open image in a new window')}
                className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
              </a>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); closeViewer() }}
              autoFocus
              aria-label={tr('قفل الصورة', 'Close image')}
              className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <svg className="w-6 h-6" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
