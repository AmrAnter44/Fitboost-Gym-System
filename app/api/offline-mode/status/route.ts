import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { getSyncQueueStats } from '../../../../lib/offline-sync'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (user.role !== 'OWNER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const license = await prisma.supabaseLicense.findFirst({
      orderBy: { lastChecked: 'desc' }
    })

    if (!license) {
      return NextResponse.json({
        configured: false,
        offlineModeEnabled: false,
        stats: { pending: 0, failed: 0, sent: 0, lastSentAt: null }
      })
    }

    const stats = await getSyncQueueStats()

    return NextResponse.json({
      configured: true,
      offlineModeEnabled: license.offlineModeEnabled,
      gymName: license.gymName,
      branchName: license.branchName,
      stats
    })
  } catch (error: any) {
    console.error('Offline mode status error:', error)
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
