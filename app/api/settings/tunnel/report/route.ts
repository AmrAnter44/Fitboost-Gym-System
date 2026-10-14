import { NextResponse } from 'next/server'
import { gatewayErrorResponse } from '../../../../../lib/gateway'
import { reportCloudTunnel } from '../../../../../lib/tunnelCloud'
import { authorizeTunnelCaller } from '../auth'

export const dynamic = 'force-dynamic'

/** Electron main بيبلّغ هنا لما cloudflared يتصل/يقع (throttled هناك) → Control tunnel-report */
export async function POST(request: Request) {
  const auth = await authorizeTunnelCaller(request)
  if ('status' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  const body = await request.json().catch(() => ({}))
  if (typeof body?.running !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'running لازم يكون true/false' }, { status: 400 })
  }
  const error = typeof body?.error === 'string' ? body.error.slice(0, 500) : undefined
  try {
    await reportCloudTunnel(body.running, error)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return gatewayErrorResponse(e)
  }
}
