import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../../../lib/auth'
import { WHATSAPP_SIDECAR } from '@/lib/servicePorts'

export async function POST(request: Request, { params }: { params: { idx: string } }) {
  // 🔒 Auth
  const user = await verifyAuth(request)
  if (!user) {
    return NextResponse.json({ success: false, error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
  }

  try {
    const res = await fetch(`${WHATSAPP_SIDECAR}/init/${params.idx}`, { method: 'POST', cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data, { status: res.ok ? 200 : 400 })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
