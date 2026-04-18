import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

// Called by the queue worker to get next queued item + daily info for a session
export async function POST(req: Request) {
  try {
    const { sessionIndex } = await req.json()
    const sessionId = `wa-session-${sessionIndex ?? 0}`

    // Get daily info
    const session = await prisma.whatsAppSession.findUnique({
      where: { sessionIndex: sessionIndex ?? 0 }
    })

    if (!session) {
      return NextResponse.json({ item: null, dailyCount: 0, dailyLimit: 30 })
    }

    const DAILY_LIMIT = 30
    const WARMUP_DAILY_LIMIT = 10
    const WARMUP_DAYS = 3

    let limit = DAILY_LIMIT
    if (!session.warmupComplete && session.warmupStartedAt) {
      const daysSinceWarmup = (Date.now() - session.warmupStartedAt.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceWarmup < WARMUP_DAYS) {
        limit = WARMUP_DAILY_LIMIT
      } else {
        // Mark warmup complete
        await prisma.whatsAppSession.update({
          where: { id: session.id },
          data: { warmupComplete: true }
        })
      }
    }

    const dailyCount = session.dailyMessageCount || 0
    if (dailyCount >= limit) {
      return NextResponse.json({ item: null, dailyCount, dailyLimit: limit })
    }

    // Get next queued item
    const item = await prisma.whatsAppQueueItem.findFirst({
      where: {
        sessionId,
        status: 'queued',
        scheduledAt: { lte: new Date() }
      },
      orderBy: [
        { priority: 'asc' },
        { scheduledAt: 'asc' }
      ]
    })

    return NextResponse.json({ item, dailyCount, dailyLimit: limit })
  } catch (err) {
    console.error('[WhatsApp Internal] queue-poll error:', err)
    return NextResponse.json({ item: null, dailyCount: 0, dailyLimit: 30, error: (err as Error).message })
  }
}
