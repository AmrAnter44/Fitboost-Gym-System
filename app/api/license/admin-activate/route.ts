import { NextResponse } from 'next/server'
import { adminActivate, GatewayError, getDeviceToken } from '../../../../lib/gateway'
import { checkRateLimit, getClientIdentifier } from '../../../../lib/rateLimit'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'
import { fitboostAdminSessionResponse } from '../../../../lib/fitboostAdminSession'

export const dynamic = 'force-dynamic'

/**
 * «تفعيل بحساب FitBoost» — للجهاز اللي لسه مش مربوط بس (إعادة الربط بكود تفعيل).
 * مش محتاج دخول محلي: Control بيتحقق من حساب super admin (باسورد + كود التحقق بخطوتين)
 * ومن هوية التسطيب (السر مبيطلعش من الجهاز).
 *
 * body:
 *  { email, password }               → { step: 'code' }
 *  { email, password, code }         → { step: 'pick', ticket, gyms }
 *  { ticket, gymId, branchId, login? } → { success, license, user? }  — login=true يدخّلك FitBoost Admin على طول
 */
export async function POST(request: Request) {
  try {
    if (await getDeviceToken()) {
      return NextResponse.json(
        { error: 'الجهاز مربوط بالفعل — لإعادة الربط استخدم كود تفعيل من Control', code: 'ALREADY_LINKED' },
        { status: 409 }
      )
    }

    // 🔒 نفس حد صفحة الدخول تقريباً (Control كمان عنده حد خاص بيه)
    const rl = checkRateLimit(getClientIdentifier(request), { id: 'admin-activate', limit: 15, windowMs: 15 * 60 * 1000 })
    if (!rl.success) {
      return NextResponse.json({ error: 'محاولات كتير — استنى ربع ساعة', code: 'RATE_LIMITED' }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    const s = (v: unknown, n = 300) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

    let result
    if (s(body?.ticket)) {
      const gymId = s(body?.gymId, 64)
      const branchId = s(body?.branchId, 64)
      if (!gymId || !branchId) return NextResponse.json({ error: 'اختار الجيم والفرع' }, { status: 400 })
      result = await adminActivate({ ticket: s(body.ticket), gymId, branchId })
    } else {
      const email = s(body?.email, 200)
      const password = typeof body?.password === 'string' ? body.password : ''
      const code = s(body?.code, 12).replace(/\D/g, '')
      if (!email.includes('@') || !password) {
        return NextResponse.json({ error: 'اكتب إيميل وباسورد حساب FitBoost' }, { status: 400 })
      }
      result = await adminActivate({ email, password, code: code || undefined })
    }

    if (result.step !== 'done') return NextResponse.json(result)

    const license = {
      gymId: result.link.gymId,
      gymName: result.link.gymName,
      branchId: result.link.branchId,
      branchName: result.link.branchName,
      systemLicense: result.link.systemLicense,
      linked: true,
    }

    await createAuditLog({
      userId: 'fallback-fitboost-account',
      action: 'UPDATE',
      resource: 'System',
      resourceId: license.branchId,
      details: {
        action: 'device_activated',
        via: 'fitboost_admin',
        by: result.admin.email,
        gymName: license.gymName,
        branchName: license.branchName,
        gymId: license.gymId,
        branchId: license.branchId,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    }).catch(() => {})

    // من صفحة الدخول: ندخّله FitBoost Admin على طول (Control اتحقق من الباسورد + الكود في نفس العملية)
    if (body?.login === true && result.admin.email) {
      return fitboostAdminSessionResponse(request, result.admin, { license })
    }
    return NextResponse.json({ success: true, license })
  } catch (error) {
    if (error instanceof GatewayError) {
      if (error.status === 0) {
        return NextResponse.json({ error: 'مفيش اتصال بسحابة فيت بوست — اتأكد من النت', code: 'OFFLINE' }, { status: 503 })
      }
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status >= 500 ? 502 : error.status || 400 }
      )
    }
    console.error('Admin activate error:', (error as Error)?.message)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
