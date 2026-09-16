import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
import {
  resolveLicensedBranch,
  buildBranchDataPayload,
  validateBranchDataPayload,
  isWebsiteDataType,
  WEBSITE_MEDIA_BUCKET,
} from '../../../lib/websiteData'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../lib/auditLog'

export const dynamic = 'force-dynamic'

// GET: كل بيانات الويبسايت للفرع المربوط بالرخصة
export async function GET(request: Request) {
  try {
    const ctx = await resolveLicensedBranch(request)
    if (ctx instanceof NextResponse) return ctx

    const [branchRes, dataRes] = await Promise.all([
      supabaseAdmin
        .from('branches')
        .select('id, slug, name_en, name_ar, gyms:gym_id (id, slug, name_en, name_ar)')
        .eq('id', ctx.branchId)
        .single(),
      supabaseAdmin
        .from('branch_data')
        .select('*')
        .eq('branch_id', ctx.branchId)
        .order('display_order'),
    ])

    if (dataRes.error) {
      console.error('[website-data] fetch error:', dataRes.error)
      return NextResponse.json({ error: 'تعذر الاتصال بالموقع: ' + dataRes.error.message }, { status: 502 })
    }

    const branch: any = branchRes.data
    const gym: any = Array.isArray(branch?.gyms) ? branch.gyms[0] : branch?.gyms
    const websiteBase = (process.env.NEXT_PUBLIC_SUPPORT_WEBSITE || 'https://fitboost.website').replace(/\/$/, '')
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')

    return NextResponse.json({
      gymName: gym?.name_ar || gym?.name_en || ctx.gymName,
      branchName: branch?.name_ar || branch?.name_en || ctx.branchName,
      websiteUrl: gym?.slug && branch?.slug ? `${websiteBase}/ar/gyms/${gym.slug}/branches/${branch.slug}` : null,
      storageBaseUrl: supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/${WEBSITE_MEDIA_BUCKET}` : null,
      items: dataRes.data || [],
    })
  } catch (error: any) {
    console.error('[website-data] GET error:', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
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

    const { data, error } = await supabaseAdmin
      .from('branch_data')
      .insert({ ...payload, branch_id: ctx.branchId, data_type: body.data_type, display_order: 0 })
      .select()
      .single()

    if (error) {
      console.error('[website-data] insert error:', error)
      return NextResponse.json({ error: 'فشل الحفظ: ' + error.message }, { status: 502 })
    }

    await createAuditLog({
      userId: ctx.user.userId,
      action: 'CREATE',
      resource: 'System',
      resourceId: data.id,
      details: { action: 'website_data_created', dataType: body.data_type, name: payload.name, branchId: ctx.branchId },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    }).catch(() => {})

    return NextResponse.json({ item: data })
  } catch (error: any) {
    console.error('[website-data] POST error:', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
