import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

// Called by the queue worker to update a queue item's status
export async function POST(req: Request) {
  try {
    const { id, status, error, attempts, retrySeconds } = await req.json()

    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (error !== undefined) updateData.error = error
    if (attempts !== undefined) updateData.attempts = attempts

    if (retrySeconds) {
      updateData.scheduledAt = new Date(Date.now() + retrySeconds * 1000)
      updateData.status = 'queued'
    }

    await prisma.whatsAppQueueItem.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[WhatsApp Internal] queue-update error:', err)
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
