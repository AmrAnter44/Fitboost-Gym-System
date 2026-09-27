import { NextResponse } from 'next/server'
import {
  resolveLicensedBranch,
  buildBranchDataPayload,
  validateBranchDataPayload,
  isWebsiteDataType,
} from '../../../../lib/websiteData'
import { gw, gatewayErrorResponse } from '../../../../lib/gateway'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }
type Item = { id: string; data_type: string; name: string }

// الـ gateway بيتأكد إن العنصر تابع لفرع الجهاز — غير كده 404
export async function PUT(request: Request, routeCtx: Ctx) {
  try {
    const ctx = await resolveLicensedBranch(request)
    if (ctx instanceof NextResponse) return ctx
    const { id } = await routeCtx.params
    const safeId = encodeURIComponent(id)

    const { item } = await gw<{ item: Item }>(`website-data/${safeId}`)
    if (!item || !isWebsiteDataType(item.data_type)) {
      return NextResponse.json({ error: 'العنصر غير موجود' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const payload = buildBranchDataPayload(item.data_type, body)
    const invalid = validateBranchDataPayload(item.data_type, payload)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const { item: updated } = await gw<{ item: Item }>(`website-data/${safeId}`, {
      method: 'PUT',
      body: { row: payload },
    })

    await createAuditLog({
      userId: ctx.user.userId,
      action: 'UPDATE',
      resource: 'System',
      resourceId: id,
      details: { action: 'website_data_updated', dataType: item.data_type, name: payload.name, branchId: ctx.branchId },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    }).catch(() => {})

    return NextResponse.json({ item: updated })
  } catch (error) {
    console.error('[website-data] PUT error:', (error as Error)?.message)
    return gatewayErrorResponse(error)
  }
}

export async function DELETE(request: Request, routeCtx: Ctx) {
  try {
    const ctx = await resolveLicensedBranch(request)
    if (ctx instanceof NextResponse) return ctx
    const { id } = await routeCtx.params

    const { item } = await gw<{ item: Item }>(`website-data/${encodeURIComponent(id)}`, { method: 'DELETE' })

    await createAuditLog({
      userId: ctx.user.userId,
      action: 'DELETE',
      resource: 'System',
      resourceId: id,
      details: { action: 'website_data_deleted', dataType: item?.data_type, name: item?.name, branchId: ctx.branchId },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[website-data] DELETE error:', (error as Error)?.message)
    return gatewayErrorResponse(error)
  }
}
