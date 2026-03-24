/**
 * WhatsApp Browser Client
 * Runs in the browser (Electron webview OR network browser).
 * Talks to the Next.js API via HTTP + SSE.
 * Single instance per tab/window.
 *
 * Supports both legacy single-session and multi-session APIs.
 */

type EventName = 'qr' | 'ready' | 'disconnected' | 'auth_failure' | 'connecting' | 'incoming_message' | 'message_sent' | 'session_update' | 'status_all';
type EventCallback = (data?: any) => void;

export interface SessionInfo {
  sessionIndex: number
  isReady: boolean
  qrCode: string | null
  hasClient: boolean
  phoneNumber?: string | null
}

export interface ConversationInfo {
  id: string
  remotePhone: string
  remoteName: string | null
  lastMessageAt: string | null
  lastMessageText: string | null
  status: string
  assignedToId: string | null
  sessionId: string | null
  unreadCount: number
  session?: { id: string; sessionIndex: number; label: string } | null
  assignedTo?: { id: string; name: string } | null
}

export interface MessageInfo {
  id: string
  conversationId: string
  sessionId: string | null
  direction: string
  messageType: string
  content: string
  mediaUrl: string | null
  whatsappMsgId: string | null
  status: string
  sentById: string | null
  createdAt: string
  session?: { sessionIndex: number; label: string } | null
}

class WhatsAppClient {
  private sse: EventSource | null = null;
  private multiSse: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private multiReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Record<EventName, EventCallback[]> = {
    qr: [], ready: [], disconnected: [], auth_failure: [], connecting: [],
    incoming_message: [], message_sent: [], session_update: [], status_all: []
  };

  // ─── SSE (legacy, session 0 only) ─────────────────────────────────────────

  connectSSE() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.sse) { this.sse.close(); this.sse = null; }

    const es = new EventSource('/api/whatsapp/events');

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
          case 'qr': this.emit('qr', msg.data.qrCode); break;
          case 'ready': this.emit('ready'); break;
          case 'connecting': this.emit('connecting', msg.data); break;
          case 'disconnected': this.emit('disconnected', msg.data?.reason); break;
          case 'status':
            if (msg.data?.qrCode) this.emit('qr', msg.data.qrCode);
            break;
          case 'heartbeat': break;
        }
      } catch {}
    };

    es.onerror = () => {
      es.close(); this.sse = null;
      this.reconnectTimer = setTimeout(() => this.connectSSE(), 5000);
    };

    this.sse = es;
  }

  disconnectSSE() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.sse?.close(); this.sse = null;
  }

  // ─── Multi-session SSE ──────────────────────────────────────────────────

  connectMultiSSE() {
    if (this.multiReconnectTimer) { clearTimeout(this.multiReconnectTimer); this.multiReconnectTimer = null; }
    if (this.multiSse) { this.multiSse.close(); this.multiSse = null; }

    const es = new EventSource('/api/whatsapp/events/all');

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
          case 'qr': this.emit('qr', msg.data); break;
          case 'ready': this.emit('ready', msg.data); break;
          case 'connecting': this.emit('connecting', msg.data); break;
          case 'disconnected': this.emit('disconnected', msg.data); break;
          case 'incoming_message': this.emit('incoming_message', msg.data); break;
          case 'message_sent': this.emit('message_sent', msg.data); break;
          case 'session_update': this.emit('session_update', msg.data); break;
          case 'status_all': this.emit('status_all', msg.data); break;
          case 'heartbeat': break;
        }
      } catch {}
    };

    es.onerror = () => {
      es.close(); this.multiSse = null;
      this.multiReconnectTimer = setTimeout(() => this.connectMultiSSE(), 5000);
    };

    this.multiSse = es;
  }

  disconnectMultiSSE() {
    if (this.multiReconnectTimer) { clearTimeout(this.multiReconnectTimer); this.multiReconnectTimer = null; }
    this.multiSse?.close(); this.multiSse = null;
  }

  // ─── Legacy API calls (session 0) ─────────────────────────────────────────

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
    } catch (err) { return { success: false, error: (err as Error).message }; }
  }

  async reconnect(): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/whatsapp/reconnect', { method: 'POST' });
      const data = await res.json();
      return res.ok ? { success: true } : { success: false, error: data.error };
    } catch (err) { return { success: false, error: (err as Error).message }; }
  }

  async resetSession(): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/whatsapp/reset', { method: 'POST' });
      const data = await res.json();
      return res.ok ? { success: true } : { success: false, error: data.error };
    } catch (err) { return { success: false, error: (err as Error).message }; }
  }

  async sendMessage(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message })
      });
      const data = await res.json();
      return res.ok ? { success: true } : { success: false, error: data.error };
    } catch (err) { return { success: false, error: (err as Error).message }; }
  }

  async sendImage(phone: string, imageBase64: string, caption = ''): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/whatsapp/send-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, imageBase64, caption })
      });
      const data = await res.json();
      return res.ok ? { success: true } : { success: false, error: data.error };
    } catch (err) { return { success: false, error: (err as Error).message }; }
  }

  // ─── Multi-session API calls ──────────────────────────────────────────────

  async getSessions(): Promise<SessionInfo[]> {
    try {
      const res = await fetch('/api/whatsapp/sessions');
      if (!res.ok) return [];
      return res.json();
    } catch { return []; }
  }

  async initSession(idx: number): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/whatsapp/sessions/${idx}/init`, { method: 'POST' });
      const data = await res.json();
      return res.ok ? { success: true } : { success: false, error: data.error };
    } catch (err) { return { success: false, error: (err as Error).message }; }
  }

  async reconnectSession(idx: number): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/whatsapp/sessions/${idx}/reconnect`, { method: 'POST' });
      const data = await res.json();
      return res.ok ? { success: true } : { success: false, error: data.error };
    } catch (err) { return { success: false, error: (err as Error).message }; }
  }

  async resetSessionByIndex(idx: number): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/whatsapp/sessions/${idx}/reset`, { method: 'POST' });
      const data = await res.json();
      return res.ok ? { success: true } : { success: false, error: data.error };
    } catch (err) { return { success: false, error: (err as Error).message }; }
  }

  async syncHistory(idx: number): Promise<{ success: boolean; requested?: number; error?: string }> {
    try {
      const res = await fetch(`/api/whatsapp/sessions/${idx}/sync-history`, { method: 'POST' });
      return res.json();
    } catch (err) { return { success: false, error: (err as Error).message }; }
  }

  async updateSessionLabel(idx: number, label: string): Promise<{ success: boolean }> {
    try {
      const res = await fetch(`/api/whatsapp/sessions/${idx}/label`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label })
      });
      return { success: res.ok };
    } catch { return { success: false }; }
  }

  // ─── Inbox API calls ────────────────────────────────────────────────────

  async getConversations(params?: { status?: string; search?: string; page?: number }): Promise<{ conversations: ConversationInfo[]; total: number }> {
    try {
      const sp = new URLSearchParams();
      if (params?.status) sp.set('status', params.status);
      if (params?.search) sp.set('search', params.search);
      if (params?.page) sp.set('page', String(params.page));
      const res = await fetch(`/api/whatsapp/inbox/conversations?${sp}`);
      if (!res.ok) return { conversations: [], total: 0 };
      return res.json();
    } catch { return { conversations: [], total: 0 }; }
  }

  async getMessages(conversationId: string, page = 1): Promise<{ messages: MessageInfo[]; total: number }> {
    try {
      const res = await fetch(`/api/whatsapp/inbox/conversations/${conversationId}/messages?page=${page}`);
      if (!res.ok) return { messages: [], total: 0 };
      return res.json();
    } catch { return { messages: [], total: 0 }; }
  }

  async sendInboxMessage(sessionIndex: number, phone: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/whatsapp/inbox/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIndex, phone, message })
      });
      const data = await res.json();
      return data;
    } catch (err) { return { success: false, error: (err as Error).message }; }
  }

  async startNewChat(sessionIndex: number, phone: string, message: string, remoteName?: string): Promise<{ success: boolean; conversationId?: string; error?: string }> {
    try {
      const res = await fetch('/api/whatsapp/inbox/new-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIndex, phone, message, remoteName })
      });
      return res.json();
    } catch (err) { return { success: false, error: (err as Error).message }; }
  }

  async sendInboxAudio(sessionIndex: number, phone: string, audioBase64: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/whatsapp/inbox/send-audio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIndex, phone, audioBase64 })
      });
      return res.json();
    } catch (err) { return { success: false, error: (err as Error).message }; }
  }

  async checkNumber(phone: string): Promise<{ exists: boolean; error?: string }> {
    try {
      const res = await fetch('/api/whatsapp/check-number', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      return res.json();
    } catch (err) { return { exists: false, error: (err as Error).message }; }
  }

  async updateConversation(id: string, data: { status?: string; assignedToId?: string; markAsRead?: boolean }): Promise<ConversationInfo | null> {
    try {
      const res = await fetch(`/api/whatsapp/inbox/conversations/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
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
