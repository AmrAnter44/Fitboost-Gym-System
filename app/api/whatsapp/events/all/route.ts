/**
 * Merged SSE stream for all WhatsApp sessions – proxy to sidecar
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const upstreamRes = await fetch('http://127.0.0.1:4002/events/all', {
      cache: 'no-store',
      headers: { Accept: 'text/event-stream' },
    })

    if (!upstreamRes.body) {
      return new Response('SSE upstream unavailable', { status: 503 })
    }

    return new Response(upstreamRes.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch {
    return new Response('data: {"type":"error","data":{"message":"Service unavailable"}}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
      status: 200,
    })
  }
}
