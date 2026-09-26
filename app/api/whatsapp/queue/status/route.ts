import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '../../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!(await verifyAuth(request))) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 })
  try {
    // Get counts per session per status
    const items = await prisma.whatsAppQueueItem.groupBy({
      by: ['sessionId', 'status'],
      _count: { id: true }
    })

    // Get session info for daily counts
    const sessions = await prisma.whatsAppSession.findMany({
      select: {
        id: true,
        sessionIndex: true,
        dailyMessageCount: true,
        warmupComplete: true,
      }
    })

    // Build per-session stats
    const stats = sessions.map(s => {
      const sessionItems = items.filter(i => i.sessionId === s.id)
      const counts: Record<string, number> = {}
      for (const si of sessionItems) {
        counts[si.status] = si._count.id
      }
      return {
        sessionIndex: s.sessionIndex,
        dailyCount: s.dailyMessageCount,
        queued: counts['queued'] || 0,
        processing: counts['processing'] || 0,
        sent: counts['sent'] || 0,
        failed: counts['failed'] || 0,
        cancelled: counts['cancelled'] || 0,
      }
    })

    return NextResponse.json(stats)
  } catch (err) {
    return NextResponse.json([], { status: 500 })
  }
}
