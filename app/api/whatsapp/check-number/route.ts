import { guard } from '@/lib/routeGuard'
import { NextResponse } from 'next/server'
import { WHATSAPP_SIDECAR } from '@/lib/servicePorts'

export async function POST(req: Request) {
  const g = await guard(req, ['canSendWhatsApp', 'canManageWhatsApp'])
  if (g instanceof NextResponse) return g

  try {
    const { phone } = await req.json()
    const res = await fetch(`${WHATSAPP_SIDECAR}/check-number`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
      cache: 'no-store'
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ exists: false, error: (err as Error).message }, { status: 500 })
  }
}
