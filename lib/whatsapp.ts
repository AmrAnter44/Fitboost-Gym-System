import { WHATSAPP_SIDECAR } from '@/lib/servicePorts'
/**
 * WhatsApp Backend Proxy
 * Multi-session with auto-fallback: tries all connected sessions.
 */

async function getConnectedSessions(): Promise<number[]> {
  try {
    const res = await fetch(`${WHATSAPP_SIDECAR}/status/all`, { cache: 'no-store' });
    const sessions = await res.json() as { sessionIndex: number; isReady: boolean }[];
    return sessions.filter(s => s.isReady).map(s => s.sessionIndex);
  } catch {
    return [];
  }
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  try {
    const connectedSessions = await getConnectedSessions();

    if (connectedSessions.length === 0) {
      // Fallback: try legacy /send (session 0)
      const res = await fetch(`${WHATSAPP_SIDECAR}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message }),
        cache: 'no-store'
      });
      const data = await res.json() as { success: boolean };
      return data.success;
    }

    // Try each connected session until one succeeds
    for (const sessionIdx of connectedSessions) {
      try {
        const res = await fetch(`${WHATSAPP_SIDECAR}/send-multi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionIndex: sessionIdx, phone, message }),
          cache: 'no-store'
        });
        const data = await res.json() as { success: boolean };
        if (data.success) return true;
      } catch {
      }
    }

    return false;
  } catch {
    return false;
  }
}
