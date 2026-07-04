import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requireInternalToken, InternalAuthError } from '../../../../../lib/internalAuth'

// Used by Baileys getMessage callback to retrieve stored messages for retry/decrypt
export async function POST(req: Request) {
  // 🔒 Internal-only: تحقق من x-internal-token
  try {
    requireInternalToken(req)
  } catch (err) {
    const status = err instanceof InternalAuthError ? err.status : 401
    return NextResponse.json({ success: false, error: (err as Error).message }, { status })
  }

  try {
    const { whatsappMsgId } = await req.json()
    if (!whatsappMsgId) {
      return NextResponse.json({ content: null })
    }

    const msg = await prisma.whatsAppMessage.findFirst({
      where: { whatsappMsgId },
      select: { content: true, messageType: true },
    })

    return NextResponse.json({ content: msg?.content || null, messageType: msg?.messageType || null })
  } catch {
    return NextResponse.json({ content: null })
  }
}
