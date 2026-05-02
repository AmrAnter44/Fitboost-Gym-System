import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { processSyncQueue } from '../../../../lib/offline-sync'

export const dynamic = 'force-dynamic'

// Manually flush the offline-sync queue. Useful when items got stuck
// (e.g. Supabase tables didn't exist yet, network was down) and the user
// wants to retry without waiting for the 60s background worker.
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (user.role !== 'OWNER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    // Reset failed items so they get retried
    await prisma.syncQueueItem.updateMany({
      where: { status: 'failed' },
      data: { status: 'pending', attempts: 0 }
    })

    const result = await processSyncQueue(500)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('Flush sync queue error:', error)
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
