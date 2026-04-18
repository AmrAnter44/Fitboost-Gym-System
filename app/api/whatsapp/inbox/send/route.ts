import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

export async function POST(req: Request) {
  try {
    const { sessionIndex, phone, message } = await req.json()

    if (!phone || !message) {
      return NextResponse.json({ success: false, error: 'Phone and message required' }, { status: 400 })
    }

    const idx = sessionIndex ?? 0

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

    // Normalize phone
    let normalizedPhone = phone.replace(/\D/g, '')
    if (normalizedPhone.startsWith('0')) normalizedPhone = '20' + normalizedPhone.slice(1)
    else if (!normalizedPhone.startsWith('20')) normalizedPhone = '20' + normalizedPhone

    const sessionId = `wa-session-${idx}`

    // Find or create conversation
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
        }
      })
    } else {
      const conv = await prisma.whatsAppConversation.create({
        data: {
          remotePhone: normalizedPhone,
          lastMessageAt: new Date(),
          lastMessageText: message.slice(0, 200),
          status: 'open',
          sessionId,
        }
      })
      conversationId = conv.id
    }

    // Save outgoing message
    const savedMsg = await prisma.whatsAppMessage.create({
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

    return NextResponse.json({ success: true, conversationId, messageId: savedMsg.id })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
