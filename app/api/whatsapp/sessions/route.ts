import { guard, stripQr } from '@/lib/routeGuard'
import { NextResponse } from 'next/server'
import { WHATSAPP_SIDECAR } from '@/lib/servicePorts'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const g = await guard(request)
  if (g instanceof NextResponse) return g
  try {
    const res = await fetch(`${WHATSAPP_SIDECAR}/status/all`, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(stripQr(data, g))
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
