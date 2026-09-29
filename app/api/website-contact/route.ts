import { NextResponse } from 'next/server'
import { resolveLicensedBranch } from '../../../lib/websiteData'
import { pickContact, type WebsiteContact } from '../../../lib/websiteContact'
import { gw, gatewayErrorResponse } from '../../../lib/gateway'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../lib/auditLog'

export const dynamic = 'force-dynamic'

type ContactResponse = { contact: WebsiteContact | null; updatedAt: string | null }

// GET: بيانات التواصل الحالية للفرع المربوط بالرخصة (عن طريق Control)
export async function GET(request: Request) {
  try {
    const ctx = await resolveLicensedBranch(request)
    if (ctx instanceof NextResponse) return ctx
    const data = await gw<ContactResponse>('website-contact')
    return NextResponse.json({ ...data, gymName: ctx.gymName, branchName: ctx.branchName })
  } catch (error) {
    console.error('[website-contact] GET error:', (error as Error)?.message)
    return gatewayErrorResponse(error)
  }
}

// PUT: حفظ بيانات التواصل (Control بيتحقق ويرجّع رسالة الخطأ بالعربي)
export async function PUT(request: Request) {
  try {
    const ctx = await resolveLicensedBranch(request)
    if (ctx instanceof NextResponse) return ctx

    const body = await request.json().catch(() => null)
    const contact = pickContact(body?.contact)

    const data = await gw<ContactResponse>('website-contact', { method: 'PUT', body: { contact } })

    await createAuditLog({
      userId: ctx.user.userId,
      action: 'UPDATE',
      resource: 'System',
      resourceId: ctx.branchId,
      details: { action: 'website_contact_updated', branchId: ctx.branchId },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    }).catch(() => {})

    return NextResponse.json(data)
  } catch (error) {
    console.error('[website-contact] PUT error:', (error as Error)?.message)
    return gatewayErrorResponse(error)
  }
}
