/**
 * 🔥 WhatsApp Reset Session API
 * Reset WhatsApp session and start fresh
 */

import { NextResponse } from 'next/server';
import { whatsappBackend } from '@/lib/whatsapp';

export async function POST() {
  try {
    const result = await whatsappBackend.resetSession();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Session reset successfully'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Error in WhatsApp reset API:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}
