/**
 * WhatsApp Backend Proxy
 * Thin HTTP client for the WhatsApp sidecar service running on port 4002 (Electron main process).
 * API routes proxy directly; this module exports sendWhatsAppMessage for server-side helpers.
 */

const SIDECAR = 'http://127.0.0.1:4002';

export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(`${SIDECAR}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message }),
      cache: 'no-store'
    });
    const data = await res.json() as { success: boolean };
    return data.success;
  } catch {
    return false;
  }
}
