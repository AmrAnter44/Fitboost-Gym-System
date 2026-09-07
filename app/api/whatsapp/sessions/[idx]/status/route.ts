import { NextResponse } from 'next/server'
import { WHATSAPP_SIDECAR } from '@/lib/servicePorts'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { idx: string } }) {
  try {
    const res = await fetch(`${WHATSAPP_SIDECAR}/status/${params.idx}`, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ isReady: false, error: (err as Error).message }, { status: 500 })
  }
}
