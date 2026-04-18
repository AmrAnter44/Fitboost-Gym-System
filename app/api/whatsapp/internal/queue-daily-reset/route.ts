import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

// Called by the queue worker at midnight to reset daily message counts
export async function POST() {
  try {
    await prisma.whatsAppSession.updateMany({
      data: {
        dailyMessageCount: 0,
        dailyCountResetAt: new Date(),
      }
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[WhatsApp Internal] queue-daily-reset error:', err)
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
