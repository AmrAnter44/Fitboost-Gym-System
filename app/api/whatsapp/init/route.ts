/**
 * WhatsApp Init – proxy to sidecar on port 4002
 */

import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const res = await fetch('http://127.0.0.1:4002/init', { method: 'POST', cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ success: false, error: 'WhatsApp service unavailable' }, { status: 503 });
  }
}
