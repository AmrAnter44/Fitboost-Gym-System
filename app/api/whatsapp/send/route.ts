/**
 * WhatsApp Send – multi-session with auto-fallback
 * If sessionIndex is provided, tries that session first then falls back.
 * If not provided, tries all connected sessions in order.
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
    const body = await request.json();
    const { phone, message, sessionIndex } = body;

    if (!phone || !message) {
      return NextResponse.json({ success: false, error: 'Phone and message are required' }, { status: 400 });
    }

    const connectedSessions = await getConnectedSessions();

    if (connectedSessions.length === 0) {
      // Fallback: try legacy /send (session 0) in case status/all is unavailable
      try {
        const res = await fetch(`${SIDECAR}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, message }),
          cache: 'no-store'
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.ok ? 200 : 500 });
      } catch (err) {
        return NextResponse.json({ success: false, error: 'لا يوجد أرقام واتساب متصلة' }, { status: 500 });
      }
    }

    // If specific session requested, put it first then add others as fallback
    let sessionsToTry = [...connectedSessions];
    if (sessionIndex !== undefined && sessionIndex !== null) {
      const idx = parseInt(sessionIndex.toString());
      if (connectedSessions.includes(idx)) {
        sessionsToTry = [idx, ...connectedSessions.filter(s => s !== idx)];
      }
    }

    // Try each session until one succeeds
    let lastError = '';
    for (const sessionIdx of sessionsToTry) {
      try {
        const res = await fetch(`${SIDECAR}/send-multi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionIndex: sessionIdx, phone, message }),
          cache: 'no-store'
        });
        const data = await res.json() as { success: boolean; error?: string };
        if (data.success) {
          return NextResponse.json({ ...data, sessionUsed: sessionIdx });
        }
        lastError = data.error || `Session ${sessionIdx} failed`;
        console.log(`⚠️ WhatsApp session ${sessionIdx} failed, trying next...`);
      } catch (err) {
        lastError = (err as Error).message;
        console.log(`⚠️ WhatsApp session ${sessionIdx} error: ${lastError}, trying next...`);
      }
    }

    return NextResponse.json({ success: false, error: lastError || 'All sessions failed' }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
