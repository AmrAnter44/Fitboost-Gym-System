// app/api/system/ip/route.ts
import { NextResponse } from 'next/server'
import os from 'os'

// الحصول على IP Address المحلي

export const dynamic = 'force-dynamic'

function getLocalIPAddress(): string {
  const interfaces = os.networkInterfaces()

  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name]
    if (!iface) continue

    for (const addr of iface) {
      // تجاهل internal (127.0.0.1) و IPv6
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address
      }
    }
  }

  return 'localhost' // fallback
}

export async function GET() {
  try {
    const ip = getLocalIPAddress()
    const port = process.env.PORT || '4001'
    const url = `http://${ip}:${port}`

    return NextResponse.json({
      ip,
      port,
      url
    })
  } catch (error) {
    console.error('Error getting IP:', error)
    return NextResponse.json(
      { error: 'Failed to get IP address' },
      { status: 500 }
    )
  }
}
