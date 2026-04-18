import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const assignedToId = searchParams.get('assignedToId') || undefined
    const search = searchParams.get('search') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = {}
    if (status && status !== 'all') where.status = status
    if (assignedToId) where.assignedToId = assignedToId
    if (search) {
      where.OR = [
        { remotePhone: { contains: search } },
        { remoteName: { contains: search } },
        { lastMessageText: { contains: search } },
      ]
    }

    const [conversations, total] = await Promise.all([
      prisma.whatsAppConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          session: { select: { id: true, sessionIndex: true, label: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      prisma.whatsAppConversation.count({ where }),
    ])

    return NextResponse.json({ conversations, total, page, limit })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
