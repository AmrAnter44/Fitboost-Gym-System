// app/api/admin/audit-logs/route.ts
import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/auth'
import { getAuditLogs } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'


export async function GET(request: Request) {
  try {
    // ✅ التحقق من صلاحية Admin
    await requireAdmin(request)

    const { searchParams } = new URL(request.url)

    // استخراج البارامترات
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')
    const userId = searchParams.get('userId')
    const userSearch = searchParams.get('user')  // User search by name or email
    const action = searchParams.get('action')
    const resource = searchParams.get('resource')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // جلب الـ logs
    const result = await getAuditLogs({
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
      userId: userId || undefined,
      userSearch: userSearch || undefined,
      action: action as any,
      resource: resource as any,
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching audit logs:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Admin access required')) {
      return NextResponse.json(
        { error: 'يجب أن تكون Admin للوصول لهذه الصفحة' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل جلب سجلات التدقيق' },
      { status: 500 }
    )
  }
}
