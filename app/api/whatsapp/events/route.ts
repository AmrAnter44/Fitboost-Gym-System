/**
 * WhatsApp Events – SSE proxy to sidecar on port 4002
 */

import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const res = await fetch('http://127.0.0.1:4002/events', {
      cache: 'no-store',
      signal: request.signal,
      headers: { Accept: 'text/event-stream' }
    });

    return new Response(res.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    });
  } catch {
    // Sidecar unavailable – send a single status event then close
    const body = `data: ${JSON.stringify({ type: 'status', data: { isReady: false, qrCode: null, hasClient: false } })}\n\n`;
    return new Response(body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    });
  }
}
