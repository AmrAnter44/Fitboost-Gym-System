import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requireInternalToken, InternalAuthError } from '../../../../../lib/internalAuth'

// Called by the queue worker at midnight to reset daily message counts
export async function POST(req: Request) {
  // 🔒 Internal-only: تحقق من x-internal-token
  try {
    requireInternalToken(req)
  } catch (err) {
    const status = err instanceof InternalAuthError ? err.status : 401
    return NextResponse.json({ success: false, error: (err as Error).message }, { status })
  }

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
