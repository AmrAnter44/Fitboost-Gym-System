import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { activateWithCode, GatewayError } from '../../../../lib/gateway'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

// تفعيل الجهاز بكود من Control (بيحدد الجيم والفرع — مفيش اختيار يدوي تاني)
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (user.role !== 'OWNER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    if (!code) return NextResponse.json({ error: 'اكتب كود التفعيل' }, { status: 400 })

    const license = await activateWithCode(code)

    await createAuditLog({
      userId: user.userId,
      action: 'UPDATE',
      resource: 'System',
      resourceId: license.id,
      details: {
        action: 'device_activated',
        gymName: license.gymName,
        branchName: license.branchName,
        gymId: license.gymId,
        branchId: license.branchId
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request)
    }).catch(() => {})

    // التوكن مبيرجعش للمتصفح
    const { gatewayToken: _t, ...safe } = license as typeof license & { gatewayToken?: string | null }
    return NextResponse.json({ license: safe })
  } catch (error) {
    if ((error as Error)?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }
    if (error instanceof GatewayError) {
      const msg = error.status === 0 ? 'مفيش اتصال بسحابة فيت بوست — اتأكد من النت' : error.message
      return NextResponse.json({ error: msg, code: error.code }, { status: error.status === 0 ? 503 : 400 })
    }
    console.error('Activate license error:', (error as Error)?.message)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
