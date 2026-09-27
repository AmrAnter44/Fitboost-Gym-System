import { guard } from '@/lib/routeGuard'
import { NextResponse } from 'next/server'
import { WHATSAPP_SIDECAR } from '@/lib/servicePorts'

export async function PUT(req: Request, { params }: { params: { idx: string } }) {
  const g = await guard(req, ['canManageWhatsApp'])
  if (g instanceof NextResponse) return g
  if (!/^\d+$/.test(String(params.idx))) return NextResponse.json({ error: 'رقم جلسة غير صحيح' }, { status: 400 })

  try {
    const { label } = await req.json()
    const res = await fetch(`${WHATSAPP_SIDECAR}/session/${params.idx}/label`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
      cache: 'no-store'
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.ok ? 200 : 400 })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
