// app/api/system/log/route.ts
import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { ensureSamplerStarted, readLog } from '../../../../lib/systemStatsLogger'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    ensureSamplerStarted()

    const { searchParams } = new URL(request.url)
    const hours = Math.min(Math.max(Number(searchParams.get('hours')) || 24, 1), 168)
    const entries = readLog(Date.now() - hours * 3600 * 1000)

    return NextResponse.json({ hours, entries })
  } catch (error) {
    console.error('Error reading system stats log:', error)
    return NextResponse.json({ error: 'فشل قراءة سجل الأداء' }, { status: 500 })
  }
}
