import { NextResponse } from 'next/server'
import { WHATSAPP_SIDECAR } from '@/lib/servicePorts'

export async function POST(_req: Request, { params }: { params: { idx: string } }) {
  try {
    const res = await fetch(`${WHATSAPP_SIDECAR}/reconnect/${params.idx}`, { method: 'POST', cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data, { status: res.ok ? 200 : 400 })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
