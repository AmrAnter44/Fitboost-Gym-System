import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

interface BulkMessage {
  sessionIndex: number
  phone: string
  contactName?: string | null
  text?: string
  messageType?: string
  whatsappMsgId?: string
  mediaUrl?: string | null
  direction?: string
  timestamp?: string | null
}

// Bulk save messages - used by history sync to save many messages at once
export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as { messages: BulkMessage[] }

    if (!messages?.length) {
      return NextResponse.json({ success: true, saved: 0, skipped: 0 })
    }

    // Collect all whatsappMsgIds to check for duplicates in one query
    const msgIds = messages.map(m => m.whatsappMsgId).filter(Boolean) as string[]
    const existingMsgIds = new Set<string>()
    if (msgIds.length > 0) {
      const existing = await prisma.whatsAppMessage.findMany({
        where: { whatsappMsgId: { in: msgIds } },
        select: { whatsappMsgId: true },
      })
      for (const e of existing) {
        if (e.whatsappMsgId) existingMsgIds.add(e.whatsappMsgId)
      }
    }

    // Collect unique phones to batch-fetch/create conversations
    const phoneSet = new Set<string>()
    for (const m of messages) {
      if (m.phone) phoneSet.add(m.phone)
    }

    // Fetch existing conversations for all phones
    const existingConvs = await prisma.whatsAppConversation.findMany({
      where: { remotePhone: { in: Array.from(phoneSet) } },
    })
    const convMap = new Map(existingConvs.map(c => [c.remotePhone, c]))

    let saved = 0
    let skipped = 0

    for (const m of messages) {
      // Skip duplicates
      if (m.whatsappMsgId && existingMsgIds.has(m.whatsappMsgId)) {
        skipped++
        continue
      }

      const sessionId = `wa-session-${m.sessionIndex ?? 0}`
      const displayText = m.text || `[${m.messageType || 'text'}]`
      const msgDirection = m.direction || 'incoming'
      const messageDate = m.timestamp ? new Date(m.timestamp) : new Date()

      // Get or create conversation
      let conv = convMap.get(m.phone)
      if (!conv) {
        conv = await prisma.whatsAppConversation.create({
          data: {
            remotePhone: m.phone,
            remoteName: m.contactName || null,
            lastMessageAt: messageDate,
            lastMessageText: displayText.slice(0, 200),
            status: 'open',
            sessionId,
            unreadCount: 0,
          }
        })
        convMap.set(m.phone, conv)
      }

      try {
        await prisma.whatsAppMessage.create({
          data: {
            conversationId: conv.id,
            sessionId,
            direction: msgDirection,
            messageType: m.messageType || 'text',
            content: displayText,
            whatsappMsgId: m.whatsappMsgId || null,
            mediaUrl: m.mediaUrl || null,
            status: msgDirection === 'outgoing' ? 'sent' : 'delivered',
            createdAt: messageDate,
          }
        })
        saved++
        if (m.whatsappMsgId) existingMsgIds.add(m.whatsappMsgId)
      } catch {
        skipped++
      }
    }

    // Update conversation lastMessageAt to the most recent message per conversation
    const convUpdates = new Map<string, { lastAt: Date; lastText: string; name: string | null }>()
    for (const m of messages) {
      if (m.whatsappMsgId && existingMsgIds.has(m.whatsappMsgId)) {
        const conv = convMap.get(m.phone)
        if (!conv) continue
        const messageDate = m.timestamp ? new Date(m.timestamp) : new Date()
        const displayText = m.text || `[${m.messageType || 'text'}]`
        const existing = convUpdates.get(conv.id)
        if (!existing || messageDate > existing.lastAt) {
          convUpdates.set(conv.id, { lastAt: messageDate, lastText: displayText.slice(0, 200), name: m.contactName || null })
        }
      }
    }

    for (const [convId, update] of convUpdates) {
      try {
        await prisma.whatsAppConversation.update({
          where: { id: convId },
          data: {
            lastMessageAt: update.lastAt,
            lastMessageText: update.lastText,
            ...(update.name ? { remoteName: update.name } : {}),
          }
        })
      } catch {}
    }

    return NextResponse.json({ success: true, saved, skipped })
  } catch (err) {
    console.error('[WhatsApp Internal] save-messages-bulk error:', err)
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
