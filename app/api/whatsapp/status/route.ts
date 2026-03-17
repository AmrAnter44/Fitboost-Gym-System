/**
 * 📊 WhatsApp Status API
 * Get current WhatsApp connection status
 */

import { NextResponse } from 'next/server';
import { whatsappBackend } from '@/lib/whatsapp';

export async function GET() {
  try {
    const status = whatsappBackend.getStatus();
    return NextResponse.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('❌ Error in WhatsApp status API:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}
