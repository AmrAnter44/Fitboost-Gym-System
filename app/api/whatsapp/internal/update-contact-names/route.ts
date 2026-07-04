import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requireInternalToken, InternalAuthError } from '../../../../../lib/internalAuth'

// Called by the WhatsApp sidecar to update contact names on existing conversations
export async function POST(req: Request) {
  // 🔒 Internal-only: تحقق من x-internal-token
  try {
    requireInternalToken(req)
  } catch (err) {
    const status = err instanceof InternalAuthError ? err.status : 401
    return NextResponse.json({ success: false, error: (err as Error).message }, { status })
  }

  try {
    const { contacts } = await req.json()

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ success: true, updated: 0 })
    }

    let updated = 0

    for (const c of contacts) {
      if (!c.phone || !c.name) continue
      try {
        const result = await prisma.whatsAppConversation.updateMany({
          where: {
            remotePhone: c.phone,
            OR: [
              { remoteName: null },
              { remoteName: '' },
            ]
          },
          data: { remoteName: c.name }
        })
        if (result.count > 0) updated++
      } catch {}
    }

    return NextResponse.json({ success: true, updated })
  } catch (err) {
    console.error('[WhatsApp Internal] update-contact-names error:', err)
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
