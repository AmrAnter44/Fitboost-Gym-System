'use client'

/**
 * 💬 بادج «الدعم الفني» في السايدبار — عدد ردود FitBoost الأحدث من lastSeen.
 * - بيسأل كل دقيقة (وأول مرة بعد ٥ ثواني) طول ما المستخدم مش على /support
 * - على /support بيرجّع 0 (الصفحة نفسها بتعلّم الرسايل كمقروءة)
 * - بيتصفّر فوراً لما الصفحة تبعت SUPPORT_SEEN_EVENT أو تاب تاني يغيّر localStorage
 */

import { useCallback, useEffect, useState } from 'react'
import {
  SUPPORT_LAST_SEEN_KEY,
  SUPPORT_PATH,
  SUPPORT_SEEN_EVENT,
  fetchSupportMessages,
  readSupportLastSeen,
  supportTs,
  writeSupportLastSeen,
} from '../lib/supportChat'

const POLL_MS = 60_000

export function useSupportUnread(enabled: boolean, pathname: string | null) {
  const [unread, setUnread] = useState(0)
  const onSupport = !!pathname && (pathname === SUPPORT_PATH || pathname.startsWith(SUPPORT_PATH + '/'))

  const check = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    const lastSeen = readSupportLastSeen()
    if (!lastSeen) {
      // أول مرة على الجهاز ده — نبدأ العد من دلوقتي (مش كل التاريخ القديم)
      writeSupportLastSeen(new Date().toISOString())
      setUnread(0)
      return
    }
    try {
      const r = await fetchSupportMessages(lastSeen, 'error')
      const seenT = supportTs(lastSeen)
      setUnread(r.messages.filter((m) => m.direction === 'out' && supportTs(m.createdAt) > seenT).length)
    } catch {
      // مش مربوط / مفيش نت — البادج يفضل زي ما هو
    }
  }, [])

  useEffect(() => {
    if (!enabled || onSupport) {
      setUnread(0)
      return
    }
    const first = setTimeout(check, 5_000)
    const iv = setInterval(check, POLL_MS)
    return () => { clearTimeout(first); clearInterval(iv) }
  }, [enabled, onSupport, check])

  // الصفحة علّمت الرسايل كمقروءة (نفس الشباك أو تاب/iframe تاني)
  useEffect(() => {
    if (!enabled) return
    const reset = () => setUnread(0)
    const onStorage = (e: StorageEvent) => { if (e.key === SUPPORT_LAST_SEEN_KEY) reset() }
    window.addEventListener(SUPPORT_SEEN_EVENT, reset)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(SUPPORT_SEEN_EVENT, reset)
      window.removeEventListener('storage', onStorage)
    }
  }, [enabled])

  return onSupport ? 0 : unread
}
