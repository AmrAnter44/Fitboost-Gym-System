import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

export async function POST(req: Request) {
  try {
    const { sessionIndex, phone, content, messageType, priority, scheduledAt, createdById } = await req.json()

    if (!phone || !content) {
      return NextResponse.json({ success: false, error: 'phone and content required' }, { status: 400 })
    }

    const sessionId = `wa-session-${sessionIndex ?? 0}`

    const item = await prisma.whatsAppQueueItem.create({
      data: {
        sessionId,
        phone: (phone || '').replace(/\D/g, ''),
        messageType: messageType || 'text',
        content,
        priority: priority ?? 5,
        status: 'queued',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
        createdById: createdById || null,
      }
    })

    return NextResponse.json({ success: true, id: item.id })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
