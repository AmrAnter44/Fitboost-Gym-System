/**
 * WhatsApp Send Image – multi-session with auto-fallback
 */

import { NextResponse } from 'next/server';

const SIDECAR = 'http://127.0.0.1:4002';

async function getConnectedSessions(): Promise<number[]> {
  try {
    const res = await fetch(`${SIDECAR}/status/all`, { cache: 'no-store' });
    const sessions = await res.json() as { sessionIndex: number; isReady: boolean }[];
    return sessions.filter(s => s.isReady).map(s => s.sessionIndex);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const { phone, imageBase64, caption } = await request.json();

    if (!phone || !imageBase64) {
      return NextResponse.json({ success: false, error: 'Phone and imageBase64 are required' }, { status: 400 });
    }

    const connectedSessions = await getConnectedSessions();

    if (connectedSessions.length === 0) {
      // Fallback: try legacy /send-image (session 0)
      try {
        const res = await fetch(`${SIDECAR}/send-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, imageBase64, caption: caption || '' }),
          cache: 'no-store'
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.ok ? 200 : 500 });
      } catch (err) {
        return NextResponse.json({ success: false, error: 'لا يوجد أرقام واتساب متصلة' }, { status: 500 });
      }
    }

    let lastError = '';
    for (const sessionIdx of connectedSessions) {
      try {
        const res = await fetch(`${SIDECAR}/send-image-multi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionIndex: sessionIdx, phone, imageBase64, caption: caption || '' }),
          cache: 'no-store'
        });
        const data = await res.json() as { success: boolean; error?: string };
        if (data.success) {
          return NextResponse.json({ ...data, sessionUsed: sessionIdx });
        }
        lastError = data.error || `Session ${sessionIdx} failed`;
      } catch (err) {
        lastError = (err as Error).message;
      }
    }

    return NextResponse.json({ success: false, error: lastError || 'All sessions failed' }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
