import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

// Called by the queue worker when a message is successfully sent
// Marks queue item as sent, saves outgoing message, increments daily count
export async function POST(req: Request) {
  try {
    const { queueItemId, sessionIndex, phone, content, messageType, whatsappMsgId, createdById } = await req.json()

    const sessionId = `wa-session-${sessionIndex ?? 0}`

    // Mark queue item as sent
    await prisma.whatsAppQueueItem.update({
      where: { id: queueItemId },
      data: { status: 'sent', sentAt: new Date() }
    })

    // Increment daily count
    await prisma.whatsAppSession.updateMany({
      where: { sessionIndex: sessionIndex ?? 0 },
      data: { dailyMessageCount: { increment: 1 } }
    })

    // Upsert conversation
    const normalizedPhone = (phone || '').replace(/\D/g, '')
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
          lastMessageText: (content || '').slice(0, 200),
          sessionId,
        }
      })
    } else {
      const conv = await prisma.whatsAppConversation.create({
        data: {
          remotePhone: normalizedPhone,
          lastMessageAt: new Date(),
          lastMessageText: (content || '').slice(0, 200),
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
        messageType: messageType || 'text',
        content: content || '',
        whatsappMsgId: whatsappMsgId || null,
        status: 'sent',
        sentById: createdById || null,
      }
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[WhatsApp Internal] queue-sent error:', err)
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
