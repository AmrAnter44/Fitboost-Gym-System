/**
 * WhatsApp Send – proxy to sidecar on port 4002
 */

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { phone, message } = await request.json();

    if (!phone || !message) {
      return NextResponse.json({ success: false, error: 'Phone and message are required' }, { status: 400 });
    }

    const res = await fetch('http://127.0.0.1:4002/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message }),
      cache: 'no-store'
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : 500 });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
