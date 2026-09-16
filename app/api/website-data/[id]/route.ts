import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'
import {
  resolveLicensedBranch,
  buildBranchDataPayload,
  validateBranchDataPayload,
  isWebsiteDataType,
} from '../../../../lib/websiteData'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

// العنصر لازم يكون تابع لفرع الرخصة — غير كده نرجّع 404
async function findOwnedItem(id: string, branchId: string) {
  const { data, error } = await supabaseAdmin
    .from('branch_data')
    .select('id, data_type, name')
    .eq('id', id)
    .eq('branch_id', branchId)
    .maybeSingle()
  return { item: data as { id: string; data_type: string; name: string } | null, error }
}

export async function PUT(request: Request, routeCtx: Ctx) {
  try {
    const ctx = await resolveLicensedBranch(request)
    if (ctx instanceof NextResponse) return ctx
    const { id } = await routeCtx.params

    const { item, error: findError } = await findOwnedItem(id, ctx.branchId)
    if (findError) return NextResponse.json({ error: 'تعذر الاتصال بالموقع' }, { status: 502 })
    if (!item || !isWebsiteDataType(item.data_type)) {
      return NextResponse.json({ error: 'العنصر غير موجود' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const payload = buildBranchDataPayload(item.data_type, body)
    const invalid = validateBranchDataPayload(item.data_type, payload)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('branch_data')
      .update(payload)
      .eq('id', id)
      .eq('branch_id', ctx.branchId)
      .select()
      .single()

    if (error) {
      console.error('[website-data] update error:', error)
      return NextResponse.json({ error: 'فشل الحفظ: ' + error.message }, { status: 502 })
    }

    await createAuditLog({
      userId: ctx.user.userId,
      action: 'UPDATE',
      resource: 'System',
      resourceId: id,
      details: { action: 'website_data_updated', dataType: item.data_type, name: payload.name, branchId: ctx.branchId },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    }).catch(() => {})

    return NextResponse.json({ item: data })
  } catch (error: any) {
    console.error('[website-data] PUT error:', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

export async function DELETE(request: Request, routeCtx: Ctx) {
  try {
    const ctx = await resolveLicensedBranch(request)
    if (ctx instanceof NextResponse) return ctx
    const { id } = await routeCtx.params

    const { item, error: findError } = await findOwnedItem(id, ctx.branchId)
    if (findError) return NextResponse.json({ error: 'تعذر الاتصال بالموقع' }, { status: 502 })
    if (!item) return NextResponse.json({ error: 'العنصر غير موجود' }, { status: 404 })

    const { error } = await supabaseAdmin
      .from('branch_data')
      .delete()
      .eq('id', id)
      .eq('branch_id', ctx.branchId)

    if (error) {
      console.error('[website-data] delete error:', error)
      return NextResponse.json({ error: 'فشل الحذف: ' + error.message }, { status: 502 })
    }

    await createAuditLog({
      userId: ctx.user.userId,
      action: 'DELETE',
      resource: 'System',
      resourceId: id,
      details: { action: 'website_data_deleted', dataType: item.data_type, name: item.name, branchId: ctx.branchId },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[website-data] DELETE error:', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
