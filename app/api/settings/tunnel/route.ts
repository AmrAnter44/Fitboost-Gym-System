import { NextResponse } from 'next/server'
import { gatewayErrorResponse } from '../../../../lib/gateway'
import { fetchCloudTunnel, requestCloudTunnel, publicTunnel } from '../../../../lib/tunnelCloud'
import { authorizeTunnelCaller } from './auth'

export const dynamic = 'force-dynamic'

/**
 * ☁️ تونل FitBoost (بيتعمل في Control)
 *   GET  → التونل المسجّل للجهاز في Control + حالته.
 *          الـ token بيرجع لـ Electron main بس (x-internal-token) — الواجهة بتاخد hostname/الحالة.
 *   POST → { localPort? } يطلب من Control يعمل/يصلّح التونل ويرجّع الـ token
 *          (الصفحة بتسلّمه للـ tunnel manager عبر IPC tunnel:applyCloud).
 */
export async function GET(request: Request) {
  const auth = await authorizeTunnelCaller(request)
  if ('status' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  try {
    const r = await fetchCloudTunnel()
    const tunnel = auth.caller.internal ? r.tunnel ?? null : publicTunnel(r.tunnel)
    return NextResponse.json({ ok: true, tunnel, status: r.status ?? null })
  } catch (e) {
    return gatewayErrorResponse(e)
  }
}

export async function POST(request: Request) {
  const auth = await authorizeTunnelCaller(request)
  if ('status' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  let localPort: number | undefined
  try {
    const body = await request.json().catch(() => ({}))
    const p = Number(body?.localPort)
    if (Number.isInteger(p) && p > 0 && p < 65536) localPort = p
  } catch {
    /* body اختياري */
  }
  try {
    const r = await requestCloudTunnel(localPort)
    if (!r?.ok || !r.tunnel?.token) {
      return NextResponse.json(
        { ok: false, error: r?.error || 'FitBoost مرجّعش تونل جاهز', code: r?.code || 'CF_ERROR' },
        { status: 502 }
      )
    }
    return NextResponse.json({ ok: true, tunnel: r.tunnel })
  } catch (e) {
    return gatewayErrorResponse(e)
  }
}
