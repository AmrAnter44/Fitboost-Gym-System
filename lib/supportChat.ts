/**
 * 💬 الدعم الفني — أدوات مشتركة بين صفحة /support وبادج السايدبار
 * (الـ API نفسه: app/api/support/route.ts — GET ?after= / POST {body?, image?})
 *
 * اتجاه الرسايل جاي من Control:
 *   in    = رسالة من موظفي الجيم (إحنا اللي بعتناها)
 *   out   = رد من فريق FitBoost
 *   event = حدث نظامي (اتقفلت / اتفتحت ...)
 */

export type SupportMsg = {
  id: string
  direction: 'in' | 'out' | 'event'
  body: string | null
  mediaUrl: string | null
  mediaType: 'image' | 'audio' | null
  senderName: string | null
  branchName: string | null
  createdAt: string
}
export type SupportConvStatus = 'open' | 'pending' | 'resolved' | null

export const SUPPORT_LAST_SEEN_KEY = 'fbSupport:lastSeen'
/** بيتبعت على window لما صفحة الدعم تعلّم الرسايل كمقروءة — عشان البادج يتصفّر فوراً */
export const SUPPORT_SEEN_EVENT = 'fitboost:support-seen'
export const SUPPORT_WHATSAPP_URL = 'https://wa.me/201028518754'
export const SUPPORT_PATH = '/support'

export const supportTs = (iso: string | null | undefined) => {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

export function readSupportLastSeen(): string | null {
  try { return localStorage.getItem(SUPPORT_LAST_SEEN_KEY) } catch { return null }
}

/** بيكتب lastSeen بس لو أحدث من المتخزن (عمره ما يرجع لورا) */
export function writeSupportLastSeen(iso: string) {
  try {
    const prev = localStorage.getItem(SUPPORT_LAST_SEEN_KEY)
    if (!prev || supportTs(iso) > supportTs(prev)) {
      localStorage.setItem(SUPPORT_LAST_SEEN_KEY, iso)
    }
  } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(SUPPORT_SEEN_EVENT)) } catch { /* ignore */ }
}

export function mergeSupportMessages(prev: SupportMsg[], incoming: SupportMsg[]): SupportMsg[] {
  if (!incoming.length) return prev
  const map = new Map(prev.map((m) => [m.id, m]))
  for (const m of incoming) if (m && m.id) map.set(m.id, m)
  return Array.from(map.values()).sort((a, b) => supportTs(a.createdAt) - supportTs(b.createdAt))
}

export class SupportFetchError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

export async function fetchSupportMessages(after: string | null, fallbackError: string) {
  const res = await fetch(`/api/support${after ? `?after=${encodeURIComponent(after)}` : ''}`, { cache: 'no-store' })
  const d = await res.json().catch(() => ({} as any))
  if (!res.ok || !d?.ok) throw new SupportFetchError(d?.error || fallbackError, d?.code)
  return {
    messages: (Array.isArray(d.messages) ? d.messages : []) as SupportMsg[],
    status: (d.conversationStatus ?? null) as SupportConvStatus,
  }
}

export function fileToBase64(file: File): Promise<string> {
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
