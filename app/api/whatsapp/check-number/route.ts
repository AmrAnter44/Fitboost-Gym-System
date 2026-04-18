import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { phone } = await req.json()
    const res = await fetch('http://127.0.0.1:4002/check-number', {
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
