// lib/tunnelCloud.ts
// تونل Cloudflare اللي بيتعمل من FitBoost Control (توكن Cloudflare API في Control بس).
// الجهاز بياخد run token التونل بتاعه بس — وبيشغّل cloudflared بيه في الـ Electron main.
import { gw } from './gateway'

export type CloudTunnel = {
  id: string
  name: string
  hostname: string
  token?: string
  localPort?: number
}

export type CloudTunnelStatus = 'requested' | 'creating' | 'ready' | 'failed' | 'disabled' | string

type GetResponse = { ok: boolean; tunnel: CloudTunnel | null; status?: CloudTunnelStatus | null; error?: string; code?: string }
type PostResponse = { ok: boolean; tunnel?: CloudTunnel; error?: string; code?: string }

/** GET /api/gym/v1/tunnel — التونل الحالي للجهاز (لو Control عمله/أعاد عمله) */
export function fetchCloudTunnel() {
  return gw<GetResponse>('tunnel', { method: 'GET', timeoutMs: 15_000 })
}

/** POST /api/gym/v1/tunnel — Control بيعمل/يصلّح التونل ويرجّع الـ token */
export function requestCloudTunnel(localPort?: number) {
  const body: { localPort?: number } = {}
  if (localPort && Number.isInteger(localPort) && localPort > 0 && localPort < 65536) body.localPort = localPort
  // الإنشاء بيكلّم Cloudflare (تونل + config + DNS) — ممكن ياخد وقت
  return gw<PostResponse>('tunnel', { method: 'POST', body, timeoutMs: 60_000 })
}

/** POST /api/gym/v1/tunnel-report — cloudflared متصل ولا لأ */
export function reportCloudTunnel(running: boolean, error?: string) {
  const body: { running: boolean; error?: string } = { running }
  if (!running && error) body.error = error.slice(0, 500)
  return gw<{ ok: boolean }>('tunnel-report', { body, timeoutMs: 10_000 })
}

/** نسخة من غير الـ token (للعرض في الواجهة) */
export function publicTunnel(t: CloudTunnel | null | undefined) {
  if (!t) return null
  return { id: t.id, name: t.name, hostname: t.hostname, localPort: t.localPort ?? null }
}
