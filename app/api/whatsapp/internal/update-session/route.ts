import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

// Called by the WhatsApp sidecar to update session status in DB
export async function POST(req: Request) {
  try {
    const { sessionIndex, ...data } = await req.json()

    if (sessionIndex === undefined) {
      return NextResponse.json({ success: false, error: 'sessionIndex required' }, { status: 400 })
    }

    // Build update data (only include fields that were provided)
    const updateData: Record<string, unknown> = {}
    if (data.status !== undefined) updateData.status = data.status
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber
    if (data.warmupComplete !== undefined) updateData.warmupComplete = data.warmupComplete
    if (data.warmupStartedAt !== undefined) updateData.warmupStartedAt = data.warmupStartedAt ? new Date(data.warmupStartedAt) : null
    if (data.startWarmup) updateData.warmupStartedAt = new Date()
    if (data.label !== undefined) updateData.label = data.label

    await prisma.whatsAppSession.updateMany({
      where: { sessionIndex },
      data: updateData,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[WhatsApp Internal] update-session error:', err)
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
