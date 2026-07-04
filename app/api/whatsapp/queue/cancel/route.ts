import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requireInternalToken, InternalAuthError } from '../../../../../lib/internalAuth'

export async function POST(req: Request) {
  // 🔒 Internal-only: يُستدعى من الـ sidecar (server-to-server) بـ x-internal-token
  try {
    requireInternalToken(req)
  } catch (err) {
    const status = err instanceof InternalAuthError ? err.status : 401
    return NextResponse.json({ success: false, error: (err as Error).message }, { status })
  }

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
