import { guard, stripQr } from '@/lib/routeGuard'
import { NextResponse } from 'next/server'
import { WHATSAPP_SIDECAR } from '@/lib/servicePorts'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { idx: string } }) {
  const g = await guard(_req)
  if (g instanceof NextResponse) return g
  if (!/^\d+$/.test(String(params.idx))) return NextResponse.json({ error: 'رقم جلسة غير صحيح' }, { status: 400 })
  try {
    const res = await fetch(`${WHATSAPP_SIDECAR}/status/${params.idx}`, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(stripQr(data, g))
  } catch (err) {
    return NextResponse.json({ isReady: false, error: (err as Error).message }, { status: 500 })
  }
}
