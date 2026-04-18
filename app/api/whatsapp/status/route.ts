/**
 * WhatsApp Status – checks all sessions, returns ready if any is connected
 */

import { NextResponse } from 'next/server';

const SIDECAR = 'http://127.0.0.1:4002';

export async function GET() {
  try {
    // Try multi-session status first
    const allRes = await fetch(`${SIDECAR}/status/all`, { cache: 'no-store' });
    const sessions = await allRes.json() as { sessionIndex: number; isReady: boolean; phoneNumber?: string }[];
    const connectedSessions = sessions.filter(s => s.isReady);

    if (connectedSessions.length > 0) {
      return NextResponse.json({
        success: true,
        sidecarOnline: true,
        isReady: true,
        connectedCount: connectedSessions.length,
        sessions: sessions,
        // Backward compatibility
        qrCode: null,
        hasClient: true,
        phoneNumber: connectedSessions[0].phoneNumber
      });
    }

    // No sessions connected
    return NextResponse.json({
      success: true,
      sidecarOnline: true,
      isReady: false,
      connectedCount: 0,
      sessions: sessions,
      qrCode: null,
      hasClient: false
    });
  } catch {
    // Fallback to legacy single-session status
    try {
      const res = await fetch(`${SIDECAR}/status`, { cache: 'no-store' });
      const data = await res.json();
      return NextResponse.json({ success: true, sidecarOnline: true, ...data });
    } catch {
      return NextResponse.json({ success: true, sidecarOnline: false, isReady: false, qrCode: null, hasClient: false });
    }
  }
}
