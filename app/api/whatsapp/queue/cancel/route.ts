import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

export async function POST(req: Request) {
  try {
    const { id } = await req.json()

    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
    }

    await prisma.whatsAppQueueItem.update({
      where: { id },
      data: { status: 'cancelled' }
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
