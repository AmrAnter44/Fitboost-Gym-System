import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { toWhatsAppNumber } from '../../../../../lib/phoneNormalize'

export async function POST(req: Request) {
  try {
    const { sessionIndex, phone, message, remoteName } = await req.json()

    if (!phone || !message) {
      return NextResponse.json({ success: false, error: 'Phone and message required' }, { status: 400 })
    }

    // Normalize phone
    const normalizedPhone = toWhatsAppNumber(phone)

    const idx = sessionIndex ?? 0
    const sessionId = `wa-session-${idx}`

    // Send message via sidecar
    const res = await fetch('http://127.0.0.1:4002/send-multi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIndex: idx, phone, message }),
      cache: 'no-store'
    })
    const sendResult = await res.json()

    if (!sendResult.success) {
      return NextResponse.json(sendResult, { status: 400 })
    }

    // Create or update conversation
    const existing = await prisma.whatsAppConversation.findUnique({
      where: { remotePhone: normalizedPhone }
    })

    let conversationId: string

    if (existing) {
      conversationId = existing.id
      await prisma.whatsAppConversation.update({
        where: { id: existing.id },
        data: {
          lastMessageAt: new Date(),
          lastMessageText: message.slice(0, 200),
          sessionId,
          status: 'open',
          remoteName: remoteName || existing.remoteName,
        }
      })
    } else {
      const conv = await prisma.whatsAppConversation.create({
        data: {
          remotePhone: normalizedPhone,
          remoteName: remoteName || null,
          lastMessageAt: new Date(),
          lastMessageText: message.slice(0, 200),
          status: 'open',
          sessionId,
        }
      })
      conversationId = conv.id
    }

    // Save outgoing message
    await prisma.whatsAppMessage.create({
      data: {
        conversationId,
        sessionId,
        direction: 'outgoing',
        messageType: 'text',
        content: message,
        whatsappMsgId: sendResult.messageId || null,
        status: 'sent',
      }
    })

    return NextResponse.json({ success: true, conversationId })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
