import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { supabaseAdmin } from '../../../../lib/supabase'
import { invalidateOfflineSyncCache } from '../../../../lib/offline-sync'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (user.role !== 'OWNER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const { enabled } = await request.json()
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled لازم يكون boolean' }, { status: 400 })
    }

    const license = await prisma.supabaseLicense.findFirst({
      orderBy: { lastChecked: 'desc' }
    })
    if (!license) {
      return NextResponse.json(
        { error: 'لازم تختار الجيم والفرع الأول من إعدادات الترخيص' },
        { status: 400 }
      )
    }

    // 1) Update Supabase first — that's the source of truth
    const { error } = await supabaseAdmin
      .from('branches')
      .update({ offline_mode_enabled: enabled })
      .eq('id', license.branchId)

    if (error) {
      console.error('Supabase toggle error:', error)
      return NextResponse.json(
        { error: 'فشل التحديث على Supabase: ' + error.message },
        { status: 502 }
      )
    }

    // 2) Reflect in local cache
    await prisma.supabaseLicense.update({
      where: { id: license.id },
      data: { offlineModeEnabled: enabled }
    })
    invalidateOfflineSyncCache()

    createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action: 'UPDATE',
      resource: 'System',
      resourceId: license.id,
      details: { action: 'offline_mode_toggled', enabled, branchName: license.branchName },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
      status: 'success'
    })

    return NextResponse.json({ success: true, offlineModeEnabled: enabled })
  } catch (error: any) {
    console.error('Toggle offline mode error:', error)
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
