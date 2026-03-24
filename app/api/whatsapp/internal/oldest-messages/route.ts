import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

// Returns the oldest message per conversation for a given session
// Used by requestHistorySync to know where to fetch history from
export async function POST(req: Request) {
  try {
    const { sessionIndex } = await req.json()
    const sessionId = `wa-session-${sessionIndex ?? 0}`

    // Get conversations for this session
    const conversations = await prisma.whatsAppConversation.findMany({
      where: { sessionId },
      select: { id: true, remotePhone: true },
    })

    if (conversations.length === 0) {
      return NextResponse.json({ messages: [] })
    }

    // For each conversation, find the oldest message
    const messages = []
    for (const conv of conversations) {
      const oldest = await prisma.whatsAppMessage.findFirst({
        where: { conversationId: conv.id },
        orderBy: { createdAt: 'asc' },
        select: {
          whatsappMsgId: true,
          direction: true,
          createdAt: true,
        },
      })

      if (oldest?.whatsappMsgId) {
        messages.push({
          phone: conv.remotePhone,
          whatsappMsgId: oldest.whatsappMsgId,
          direction: oldest.direction,
          timestamp: Math.floor(oldest.createdAt.getTime() / 1000),
        })
      }
    }

    return NextResponse.json({ messages })
  } catch (err) {
    return NextResponse.json({ messages: [], error: (err as Error).message })
  }
}
