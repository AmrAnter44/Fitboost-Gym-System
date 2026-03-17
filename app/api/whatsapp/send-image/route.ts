/**
 * 🖼️ WhatsApp Send Image API
 * Send image with caption via WhatsApp
 */

import { NextResponse } from 'next/server';
import { whatsappBackend } from '@/lib/whatsapp';

export async function POST(request: Request) {
  try {
    const { phone, imageBase64, caption } = await request.json();

    if (!phone || !imageBase64) {
      return NextResponse.json({
        success: false,
        error: 'Phone and imageBase64 are required'
      }, { status: 400 });
    }

    const result = await whatsappBackend.sendImage(phone, imageBase64, caption || '');

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Image sent successfully'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Error in WhatsApp send-image API:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}
