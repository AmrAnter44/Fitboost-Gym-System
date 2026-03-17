/**
 * WhatsApp Status – proxy to sidecar on port 4002
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('http://127.0.0.1:4002/status', { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json({ success: true, sidecarOnline: true, ...data });
  } catch {
    return NextResponse.json({ success: true, sidecarOnline: false, isReady: false, qrCode: null, hasClient: false });
  }
}
