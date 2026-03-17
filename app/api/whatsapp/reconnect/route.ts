/**
 * 🔄 WhatsApp Reconnect API
 * Reconnect to WhatsApp
 */

import { NextResponse } from 'next/server';
import { whatsappBackend } from '@/lib/whatsapp';

export async function POST() {
  try {
    const result = await whatsappBackend.reconnect();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Reconnection initiated'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Error in WhatsApp reconnect API:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}
