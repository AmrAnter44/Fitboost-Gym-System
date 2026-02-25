import { NextResponse } from 'next/server'
import { requirePermission } from '../../../../lib/auth'
import { validateLicense } from '../../../../lib/license'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

// POST - فحص الترخيص يدوياً
export async function POST(request: Request) {
  try {
    // ✅ التحقق من أن المستخدم هو OWNER
    const user = await requirePermission(request, 'canAccessSettings')

    if (user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'هذه العملية متاحة فقط لمالك النظام (OWNER)' },
        { status: 403 }
      )
    }

    // استدعاء validateLicense للفحص
    const result = await validateLicense()

    // ✅ تسجيل في Audit Log
    createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action: 'READ',
      resource: 'License',
      resourceId: 'manual-check',
      details: {
        operation: 'ManualLicenseCheck',
        valid: result.valid,
        message: result.message
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
      status: 'success'
    })

    return NextResponse.json({
      success: true,
      valid: result.valid,
      message: result.message,
      lastChecked: new Date()
    })

  } catch (error: any) {
    console.error('❌ خطأ في فحص الترخيص:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'فشل في فحص الترخيص' },
      { status: 500 }
    )
  }
}
