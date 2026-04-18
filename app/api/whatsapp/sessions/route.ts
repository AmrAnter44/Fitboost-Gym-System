import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch('http://127.0.0.1:4002/status/all', { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
