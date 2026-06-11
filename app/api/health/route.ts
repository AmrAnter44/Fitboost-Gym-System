import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Lightweight ping endpoint used by the Fitboost Assistant client to detect
// the server during LAN discovery. Returns a tiny JSON so subnet scanning is fast.
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'fitboost',
    version: process.env.npm_package_version || 'unknown',
  })
}

// Allow HEAD for even faster probing
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
