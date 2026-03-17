/**
 * 🚀 WhatsApp Initialize API
 * Initialize WhatsApp connection and get QR code
 */

import { NextResponse } from 'next/server';
import { whatsappBackend } from '@/lib/whatsapp';

export async function POST() {
  try {
    const result = await whatsappBackend.initialize();

    if (result.success) {
      const status = whatsappBackend.getStatus();
      return NextResponse.json({
        success: true,
        ...status
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Error in WhatsApp init API:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}
