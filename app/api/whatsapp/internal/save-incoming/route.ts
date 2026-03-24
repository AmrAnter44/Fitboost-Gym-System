import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

// Called by the WhatsApp sidecar when a message arrives (incoming or outgoing)
export async function POST(req: Request) {
  try {
    const { sessionIndex, phone, contactName, text, messageType, whatsappMsgId, mediaUrl, direction, timestamp } = await req.json()

    if (!phone) {
      return NextResponse.json({ success: false, error: 'phone required' }, { status: 400 })
    }

    // Deduplicate: if whatsappMsgId already exists, skip
    if (whatsappMsgId) {
      const existing = await prisma.whatsAppMessage.findFirst({
        where: { whatsappMsgId },
      })
      if (existing) {
        return NextResponse.json({ success: true, conversationId: existing.conversationId, messageId: existing.id, duplicate: true })
      }
    }

    const sessionId = `wa-session-${sessionIndex ?? 0}`
    const displayText = text || `[${messageType || 'text'}]`
    const msgDirection = direction || 'incoming'
    const messageDate = timestamp ? new Date(timestamp) : new Date()

    // Upsert conversation
    const existingConv = await prisma.whatsAppConversation.findUnique({
      where: { remotePhone: phone }
    })

    let conversationId: string

    if (existingConv) {
      conversationId = existingConv.id

      // Only update conversation if this message is newer than what we have
      const shouldUpdate = !existingConv.lastMessageAt || messageDate >= existingConv.lastMessageAt

      if (shouldUpdate) {
        await prisma.whatsAppConversation.update({
          where: { id: existingConv.id },
          data: {
            lastMessageAt: messageDate,
            lastMessageText: displayText.slice(0, 200),
            ...(msgDirection === 'incoming' ? { unreadCount: (existingConv.unreadCount || 0) + 1 } : {}),
            remoteName: contactName || existingConv.remoteName,
            sessionId,
            status: 'open',
          }
        })
      } else if (msgDirection === 'incoming') {
        // Even for older messages, increment unread if incoming
        await prisma.whatsAppConversation.update({
          where: { id: existingConv.id },
          data: {
            unreadCount: (existingConv.unreadCount || 0) + 1,
            remoteName: contactName || existingConv.remoteName,
          }
        })
      }
    } else {
      const conv = await prisma.whatsAppConversation.create({
        data: {
          remotePhone: phone,
          remoteName: contactName || null,
          lastMessageAt: messageDate,
          lastMessageText: displayText.slice(0, 200),
          status: 'open',
          sessionId,
          unreadCount: msgDirection === 'incoming' ? 1 : 0,
        }
      })
      conversationId = conv.id
    }

    // Insert message
    const msg = await prisma.whatsAppMessage.create({
      data: {
        conversationId,
        sessionId,
        direction: msgDirection,
        messageType: messageType || 'text',
        content: displayText,
        whatsappMsgId: whatsappMsgId || null,
        mediaUrl: mediaUrl || null,
        status: msgDirection === 'outgoing' ? 'sent' : 'delivered',
        createdAt: messageDate,
      }
    })

    return NextResponse.json({ success: true, conversationId, messageId: msg.id })
  } catch (err) {
    console.error('[WhatsApp Internal] save-incoming error:', err)
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
