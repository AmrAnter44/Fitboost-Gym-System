import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const conversation = await prisma.whatsAppConversation.findUnique({
      where: { id: params.id },
      include: {
        session: { select: { id: true, sessionIndex: true, label: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    })
    if (!conversation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(conversation)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const updateData: any = {}

    if (body.status !== undefined) updateData.status = body.status
    if (body.assignedToId !== undefined) updateData.assignedToId = body.assignedToId || null
    if (body.remoteName !== undefined) updateData.remoteName = body.remoteName

    // Reset unread count when opening a conversation
    if (body.markAsRead) updateData.unreadCount = 0

    const conversation = await prisma.whatsAppConversation.update({
      where: { id: params.id },
      data: updateData,
      include: {
        session: { select: { id: true, sessionIndex: true, label: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(conversation)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
