/**
 * WhatsApp Init – proxy to sidecar on port 4002
 */

import { NextResponse } from 'next/server';
import { verifyAuth } from '../../../../lib/auth';
import { WHATSAPP_SIDECAR } from '@/lib/servicePorts'

export async function POST(request: Request) {
  // 🔒 Auth
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'يجب تسجيل الدخول أولاً' }, { status: 401 });
  }

  try {
    const res = await fetch(`${WHATSAPP_SIDECAR}/init`, { method: 'POST', cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ success: false, error: 'WhatsApp service unavailable' }, { status: 503 });
  }
}
