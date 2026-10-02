/**
 * ⬆️ هل السيستم على آخر نسخة؟
 * المرجع = آخر release منشور على GitHub (AmrAnter44/fitboost-releases) — ده بالظبط
 * اللي التحديث التلقائي بينزّله، فالتحذير مش هيظهر غير لما يكون فيه نسخة فعلاً تتنزل.
 * كاش ساعة (GitHub بيسمح 60 طلب/ساعة من غير توكن). أي فشل = مفيش تحذير.
 */
import { APP_VERSION } from './gateway'

const RELEASES_URL = 'https://api.github.com/repos/AmrAnter44/fitboost-releases/releases/latest'
const TTL_MS = 60 * 60 * 1000

let cache: { latest: string | null; at: number } | null = null
let inflight: Promise<string | null> | null = null

export function compareVersions(a?: string | null, b?: string | null) {
  const pa = String(a ?? '').replace(/^v/i, '').split(/[.+-]/).map(x => parseInt(x, 10) || 0)
  const pb = String(b ?? '').replace(/^v/i, '').split(/[.+-]/).map(x => parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}

async function fetchLatest(): Promise<string | null> {
  try {
    const res = await fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'fitboost-system' },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    })
    if (!res.ok) return cache?.latest ?? null
    const j: any = await res.json()
    if (j?.draft || j?.prerelease) return cache?.latest ?? null
    const tag = typeof j?.tag_name === 'string' ? j.tag_name.replace(/^v/i, '').trim() : ''
    return /^\d+\.\d+\.\d+/.test(tag) ? tag : null
  } catch {
    return cache?.latest ?? null
  }
}

export async function getVersionStatus() {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    if (!inflight) {
      inflight = fetchLatest().then(latest => {
        cache = { latest, at: Date.now() }
        inflight = null
        return latest
      })
    }
    await inflight
  }
  const latest = cache?.latest ?? null
  const current = APP_VERSION
  return {
    current,
    latest,
    outdated: !!latest && current !== 'unknown' && compareVersions(current, latest) < 0,
  }
}
