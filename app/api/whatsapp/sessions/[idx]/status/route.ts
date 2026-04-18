import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { idx: string } }) {
  try {
    const res = await fetch(`http://127.0.0.1:4002/status/${params.idx}`, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ isReady: false, error: (err as Error).message }, { status: 500 })
  }
}
