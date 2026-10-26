import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { getRemoteStatus, setupRemoteSupport } from '../../../../lib/remoteSupport'

export const dynamic = 'force-dynamic'

/**
 * 🖥️ الدعم الفني عن بُعد (RustDesk) — لأي موظف عامل لوجين
 * (زرار «دعم عن بُعد» في صفحة الدعم الفني + كارت الإعدادات للأونر)
 *   GET  → الحالة (متسطّب؟ متظبط على سيرفر FitBoost؟ رقم الجهاز)
 *   POST → تسطيب/ظبط (ويندوز هيسأل Yes)
 * الباسورد عمره ما بيرجع هنا — عند فيت بوست بس.
 */
async function requireUser(request: Request) {
  const user = await verifyAuth(request)
  if (!user) throw new Error('Unauthorized')
  return user
}

function errorResponse(e: any) {
  const msg = e?.message || 'خطأ'
  const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500
  return NextResponse.json({ success: false, error: msg }, { status })
}

export async function GET(request: Request) {
  try {
    await requireUser(request)
    return NextResponse.json(getRemoteStatus())
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(request: Request) {
  try {
    await requireUser(request)
    const r = await setupRemoteSupport('manual')
    return NextResponse.json({ success: r.ok, message: r.message, status: r })
  } catch (e) {
    return errorResponse(e)
  }
}
