import { NextResponse } from 'next/server'
import os from 'os'

export async function GET() {
  try {
    // Get local IP address
    const interfaces = os.networkInterfaces()
    let localIP = 'localhost'

    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name]
      if (!iface) continue

      for (const details of iface) {
        // Skip internal (loopback) and IPv6 addresses
        if (details.family === 'IPv4' && !details.internal) {
          localIP = details.address
          break
        }
      }

      if (localIP !== 'localhost') break
    }

    // Get port from environment or default to 4001
    const port = process.env.PORT || '4001'

    // Construct local URL
    const localURL = `http://${localIP}:${port}`

    return NextResponse.json({
      success: true,
      ip: localIP,
      port,
      url: localURL
    })
  } catch (error) {
    console.error('Error getting local IP:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get local IP address',
        ip: 'localhost',
        port: '4001',
        url: 'http://localhost:4001'
      },
      { status: 500 }
    )
  }
}
