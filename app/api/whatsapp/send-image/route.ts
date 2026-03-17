/**
 * WhatsApp Send Image – proxy to sidecar on port 4002
 */

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { phone, imageBase64, caption } = await request.json();

    if (!phone || !imageBase64) {
      return NextResponse.json({ success: false, error: 'Phone and imageBase64 are required' }, { status: 400 });
    }

    const res = await fetch('http://127.0.0.1:4002/send-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, imageBase64, caption: caption || '' }),
      cache: 'no-store'
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : 500 });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
