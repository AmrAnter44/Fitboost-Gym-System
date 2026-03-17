/**
 * WhatsApp Browser Client
 * Runs in the browser (Electron webview OR network browser).
 * Talks to the Next.js API via HTTP + SSE.
 * Single instance per tab/window.
 */

type EventName = 'qr' | 'ready' | 'disconnected' | 'auth_failure' | 'connecting';
type EventCallback = (data?: any) => void;

class WhatsAppClient {
  private sse: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Record<EventName, EventCallback[]> = {
    qr: [], ready: [], disconnected: [], auth_failure: [], connecting: []
  };

  // ─── SSE ───────────────────────────────────────────────────────────────────

  connectSSE() {
    // Cancel any pending reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close existing connection
    if (this.sse) {
      this.sse.close();
      this.sse = null;
    }

    const es = new EventSource('/api/whatsapp/events');

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
          case 'qr':
            this.emit('qr', msg.data.qrCode);
            break;
          case 'ready':
            this.emit('ready');
            break;
          case 'connecting':
            this.emit('connecting', msg.data);
            break;
          case 'disconnected':
            this.emit('disconnected', msg.data?.reason);
            break;
          case 'status':
            // Initial snapshot sent when SSE connects.
            // Only propagate QR if there's a pending one – do NOT fire 'ready'
            // (avoids showing a toast on every page load).
            if (msg.data?.qrCode) this.emit('qr', msg.data.qrCode);
            break;
          case 'heartbeat':
            break;
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      this.sse = null;
      // Reconnect after 5 s
      this.reconnectTimer = setTimeout(() => this.connectSSE(), 5000);
    };

    this.sse = es;
  }

  disconnectSSE() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.sse?.close();
    this.sse = null;
  }

  // ─── API calls ─────────────────────────────────────────────────────────────

  async getStatus(): Promise<{ isReady: boolean; qrCode: string | null; hasClient: boolean }> {
    try {
      const res = await fetch('/api/whatsapp/status');
      if (!res.ok) throw new Error('status failed');
      return res.json();
    } catch {
      return { isReady: false, qrCode: null, hasClient: false };
    }
  }

  async init(): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/whatsapp/init', { method: 'POST' });
      const data = await res.json();
      return res.ok ? { success: true } : { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async reconnect(): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/whatsapp/reconnect', { method: 'POST' });
      const data = await res.json();
      return res.ok ? { success: true } : { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async resetSession(): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/whatsapp/reset', { method: 'POST' });
      const data = await res.json();
      return res.ok ? { success: true } : { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async sendMessage(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message })
      });
      const data = await res.json();
      return res.ok ? { success: true } : { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async sendImage(phone: string, imageBase64: string, caption = ''): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/whatsapp/send-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, imageBase64, caption })
      });
      const data = await res.json();
      return res.ok ? { success: true } : { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  // ─── Events ────────────────────────────────────────────────────────────────

  on(event: EventName, cb: EventCallback) {
    this.listeners[event]?.push(cb);
  }

  off(event: EventName, cb: EventCallback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(x => x !== cb);
    }
  }

  offAll() {
    (Object.keys(this.listeners) as EventName[]).forEach(k => { this.listeners[k] = []; });
  }

  private emit(event: EventName, data?: any) {
    this.listeners[event]?.forEach(cb => { try { cb(data); } catch {} });
  }
}

// ─── Singleton (one per browser tab) ─────────────────────────────────────────
let _instance: WhatsAppClient | null = null;

export function getWhatsAppBrowserClient(): WhatsAppClient {
  if (!_instance) _instance = new WhatsAppClient();
  return _instance;
}
