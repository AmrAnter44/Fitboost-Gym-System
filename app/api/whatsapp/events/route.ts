/**
 * 📡 WhatsApp Events API (Server-Sent Events)
 * Stream real-time WhatsApp events (QR code, status updates)
 */

import { whatsappBackend } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      // Safe enqueue helper
      const safeEnqueue = (data: string) => {
        if (!isClosed && controller.desiredSize !== null) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch (error) {
            console.error('Error enqueueing SSE data:', error);
            isClosed = true;
          }
        }
      };

      // Send initial status
      const initialStatus = whatsappBackend.getStatus();
      const initialData = `data: ${JSON.stringify({
        type: 'status',
        data: initialStatus
      })}\n\n`;
      safeEnqueue(initialData);

      // QR Code event
      const onQR = (qr: string) => {
        const message = `data: ${JSON.stringify({
          type: 'qr',
          data: { qrCode: qr }
        })}\n\n`;
        safeEnqueue(message);
      };

      // Ready event
      const onReady = () => {
        const message = `data: ${JSON.stringify({
          type: 'ready',
          data: { isReady: true }
        })}\n\n`;
        safeEnqueue(message);
      };

      // Connecting event
      const onConnecting = (data: any) => {
        const message = `data: ${JSON.stringify({
          type: 'connecting',
          data
        })}\n\n`;
        safeEnqueue(message);
      };

      // Disconnected event
      const onDisconnected = (reason: string) => {
        const message = `data: ${JSON.stringify({
          type: 'disconnected',
          data: { reason }
        })}\n\n`;
        safeEnqueue(message);
      };

      // Register event listeners
      whatsappBackend.on('qr', onQR);
      whatsappBackend.on('ready', onReady);
      whatsappBackend.on('connecting', onConnecting);
      whatsappBackend.on('disconnected', onDisconnected);

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        const message = `data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`;
        safeEnqueue(message);
      }, 30000); // Every 30 seconds

      // Cleanup on close
      return () => {
        isClosed = true;
        clearInterval(heartbeat);
        whatsappBackend.off('qr', onQR);
        whatsappBackend.off('ready', onReady);
        whatsappBackend.off('connecting', onConnecting);
        whatsappBackend.off('disconnected', onDisconnected);
      };
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
