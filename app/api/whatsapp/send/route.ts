/**
 * WhatsApp Send – multi-session with auto-fallback
 * If sessionIndex is provided, tries that session first then falls back.
 * If not provided, tries all connected sessions in order.
 *
 * 🔒 محمي بـ:
 *  - Authentication (verifyAuth)
 *  - Rate limiting (30 msg/دقيقة per user, 5 msg/دقيقة per phone)
 *  - Input validation (phone format, message length)
 */

import { NextResponse } from 'next/server';
import { verifyAuth } from '../../../../lib/auth';
import { checkRateLimit } from '../../../../lib/rateLimit';
import {
  RATE_LIMITS,
  WHATSAPP_MAX_MESSAGE_LENGTH,
  WHATSAPP_PHONE_REGEX
} from '../../../../lib/constants';

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
    // 🔒 Auth
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'يجب تسجيل الدخول أولاً' }, { status: 401 });
    }

    const body = await request.json();
    const { phone, message, sessionIndex } = body;

    // 🔒 Input validation
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ success: false, error: 'رقم الهاتف مطلوب' }, { status: 400 });
    }
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ success: false, error: 'نص الرسالة مطلوب' }, { status: 400 });
    }

    const normalizedPhone = phone.replace(/[\s-]/g, '');
    if (!WHATSAPP_PHONE_REGEX.test(normalizedPhone)) {
      return NextResponse.json({ success: false, error: 'رقم الهاتف غير صحيح' }, { status: 400 });
    }
    if (message.length > WHATSAPP_MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { success: false, error: `نص الرسالة طويل جداً (الحد الأقصى ${WHATSAPP_MAX_MESSAGE_LENGTH} حرف)` },
        { status: 400 }
      );
    }

    // 🔒 Rate limit per user
    const userLimit = checkRateLimit(user.userId, {
      id: 'whatsapp-send-user',
      ...RATE_LIMITS.WHATSAPP_USER
    });
    if (!userLimit.success) {
      return NextResponse.json(
        { success: false, error: userLimit.error || 'تم تجاوز حد الإرسال. حاول بعد قليل' },
        { status: 429 }
      );
    }

    // 🔒 Rate limit per destination phone (منع السبام لنفس الرقم)
    const phoneLimit = checkRateLimit(normalizedPhone, {
      id: 'whatsapp-send-phone',
      ...RATE_LIMITS.WHATSAPP_PHONE
    });
    if (!phoneLimit.success) {
      return NextResponse.json(
        { success: false, error: 'تم إرسال رسائل كثيرة لهذا الرقم. حاول بعد قليل' },
        { status: 429 }
      );
    }

    const connectedSessions = await getConnectedSessions();

    if (connectedSessions.length === 0) {
      try {
        const res = await fetch(`${SIDECAR}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: normalizedPhone, message }),
          cache: 'no-store'
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.ok ? 200 : 500 });
      } catch {
        return NextResponse.json({ success: false, error: 'لا يوجد أرقام واتساب متصلة' }, { status: 500 });
      }
    }

    let sessionsToTry = [...connectedSessions];
    if (sessionIndex !== undefined && sessionIndex !== null) {
      const idx = parseInt(sessionIndex.toString());
      if (!Number.isNaN(idx) && connectedSessions.includes(idx)) {
        sessionsToTry = [idx, ...connectedSessions.filter(s => s !== idx)];
      }
    }

    let lastError = '';
    for (const sessionIdx of sessionsToTry) {
      try {
        const res = await fetch(`${SIDECAR}/send-multi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionIndex: sessionIdx, phone: normalizedPhone, message }),
          cache: 'no-store'
        });
        const data = await res.json() as { success: boolean; error?: string };
        if (data.success) {
          return NextResponse.json({ ...data, sessionUsed: sessionIdx });
        }
        lastError = data.error || `Session ${sessionIdx} failed`;
      } catch (err) {
        lastError = (err as Error).message;
      }
    }

    return NextResponse.json({ success: false, error: lastError || 'All sessions failed' }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
