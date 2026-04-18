import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: { idx: string } }) {
  try {
    const { label } = await req.json()
    const res = await fetch(`http://127.0.0.1:4002/session/${params.idx}/label`, {
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
