// app/api/members/cancel-pending-renewal/route.ts
//  🔁 إلغاء تجديد مجدول لسه ما اتفعّلش. الفلوس اللي اتدفعت في الإيصال مبتترجعش تلقائي —
//  ده بيلغي الجدولة بس (لو محتاج استرجاع، بيتعمل يدوي).
import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { readPendingRenewal, clearPendingRenewal } from '../../../../lib/pendingRenewal'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (user.role === 'COACH') {
      return NextResponse.json({ error: 'غير مسموح' }, { status: 403 })
    }

    const { memberId } = await request.json()
    if (!memberId) {
      return NextResponse.json({ error: 'معرف العضو مطلوب' }, { status: 400 })
    }

    const pending = await readPendingRenewal(memberId)
    if (!pending) {
      return NextResponse.json({ error: 'مفيش تجديد مجدول لهذا العضو' }, { status: 404 })
    }

    await clearPendingRenewal(memberId)

    const member = await prisma.member.findUnique({ where: { id: memberId }, select: { memberNumber: true, name: true } })
    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Member', resourceId: memberId,
      details: { operation: 'CancelScheduledRenew', memberNumber: member?.memberNumber, memberName: member?.name },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('cancel-pending-renewal error:', error)
    return NextResponse.json({ error: 'فشل إلغاء التجديد المجدول' }, { status: 500 })
  }
}
