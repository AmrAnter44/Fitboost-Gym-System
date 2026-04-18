import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const [messages, total] = await Promise.all([
      prisma.whatsAppMessage.findMany({
        where: { conversationId: params.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          session: { select: { sessionIndex: true, label: true } },
        },
      }),
      prisma.whatsAppMessage.count({ where: { conversationId: params.id } }),
    ])

    return NextResponse.json({ messages, total, page, limit })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
