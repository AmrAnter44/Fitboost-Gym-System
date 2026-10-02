import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { getRemoteStatus, setupRemoteSupport } from '../../../../lib/remoteSupport'

export const dynamic = 'force-dynamic'

/**
 * 🖥️ الدعم الفني عن بُعد (RustDesk) — للأونر بس
 *   GET  → الحالة (متسطّب؟ متظبط على سيرفر FitBoost؟ رقم الجهاز)
 *   POST → تسطيب/ظبط (ويندوز هيسأل Yes)
 */
async function requireOwner(request: Request) {
  const user = await verifyAuth(request)
  if (!user) throw new Error('Unauthorized')
  if (user.role !== 'OWNER') throw new Error('Forbidden')
  return user
}

function errorResponse(e: any) {
  const msg = e?.message || 'خطأ'
  const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500
  return NextResponse.json({ success: false, error: msg }, { status })
}

export async function GET(request: Request) {
  try {
    await requireOwner(request)
    return NextResponse.json(getRemoteStatus())
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(request: Request) {
  try {
    await requireOwner(request)
    const r = await setupRemoteSupport('manual')
    return NextResponse.json({ success: r.ok, message: r.message, status: r })
  } catch (e) {
    return errorResponse(e)
  }
}
