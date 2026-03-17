/**
 * 📤 WhatsApp Send Message API
 * Send text message via WhatsApp
 */

import { NextResponse } from 'next/server';
import { whatsappBackend } from '@/lib/whatsapp';

export async function POST(request: Request) {
  try {
    const { phone, message } = await request.json();

    if (!phone || !message) {
      return NextResponse.json({
        success: false,
        error: 'Phone and message are required'
      }, { status: 400 });
    }

    const result = await whatsappBackend.sendMessage(phone, message);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Message sent successfully'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Error in WhatsApp send API:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}
