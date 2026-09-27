import { NextResponse } from 'next/server'
import {
  resolveLicensedBranch,
  buildBranchDataPayload,
  validateBranchDataPayload,
  isWebsiteDataType,
} from '../../../lib/websiteData'
import { gw, gatewayErrorResponse } from '../../../lib/gateway'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../lib/auditLog'

export const dynamic = 'force-dynamic'

// GET: كل بيانات الويبسايت للفرع المربوط بالرخصة (عن طريق Control)
export async function GET(request: Request) {
  try {
    const ctx = await resolveLicensedBranch(request)
    if (ctx instanceof NextResponse) return ctx

    const data = await gw<{
      gym: { name_ar?: string; name_en?: string } | null
      branch: { name_ar?: string; name_en?: string } | null
      storageBaseUrl: string
      items: unknown[]
    }>('website-data')

    return NextResponse.json({
      gymName: data.gym?.name_ar || data.gym?.name_en || ctx.gymName,
      branchName: data.branch?.name_ar || data.branch?.name_en || ctx.branchName,
      // صفحات الجيمات اتشالت من fitboost.website
      websiteUrl: null,
      storageBaseUrl: data.storageBaseUrl,
      items: data.items || [],
    })
  } catch (error) {
    console.error('[website-data] GET error:', (error as Error)?.message)
    return gatewayErrorResponse(error)
  }
}

// POST: إضافة عنصر جديد (كوتش / عرض / باقة PT / كلاس / اشتراك)
export async function POST(request: Request) {
  try {
    const ctx = await resolveLicensedBranch(request)
    if (ctx instanceof NextResponse) return ctx

    const body = await request.json().catch(() => null)
    if (!isWebsiteDataType(body?.data_type)) {
      return NextResponse.json({ error: 'نوع البيانات غير صحيح' }, { status: 400 })
    }

    const payload = buildBranchDataPayload(body.data_type, body)
    const invalid = validateBranchDataPayload(body.data_type, payload)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const { item } = await gw<{ item: { id: string } }>('website-data', {
      body: { data_type: body.data_type, row: payload },
    })

    await createAuditLog({
      userId: ctx.user.userId,
      action: 'CREATE',
      resource: 'System',
      resourceId: item.id,
      details: { action: 'website_data_created', dataType: body.data_type, name: payload.name, branchId: ctx.branchId },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    }).catch(() => {})

    return NextResponse.json({ item })
  } catch (error) {
    console.error('[website-data] POST error:', (error as Error)?.message)
    return gatewayErrorResponse(error)
  }
}
