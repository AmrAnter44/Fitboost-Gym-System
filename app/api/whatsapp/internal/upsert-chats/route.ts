import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

// Called by the WhatsApp sidecar to save chat list (no old messages, just conversation metadata)
export async function POST(req: Request) {
  try {
    const { sessionIndex, chats } = await req.json()

    if (!Array.isArray(chats) || chats.length === 0) {
      return NextResponse.json({ success: true, created: 0 })
    }

    const sessionId = `wa-session-${sessionIndex ?? 0}`
    let created = 0

    for (const chat of chats) {
      try {
        if (!chat.phone) continue

        const existing = await prisma.whatsAppConversation.findUnique({
          where: { remotePhone: chat.phone }
        })

        if (!existing) {
          await prisma.whatsAppConversation.create({
            data: {
              remotePhone: chat.phone,
              remoteName: chat.name || null,
              lastMessageAt: chat.timestamp ? new Date(chat.timestamp) : null,
              status: 'open',
              sessionId,
              unreadCount: chat.unreadCount || 0,
            }
          })
          created++
        }
      } catch (err) {
        // Skip individual chat errors (e.g. duplicate)
      }
    }

    return NextResponse.json({ success: true, created })
  } catch (err) {
    console.error('[WhatsApp Internal] upsert-chats error:', err)
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
