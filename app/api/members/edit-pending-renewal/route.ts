// app/api/members/edit-pending-renewal/route.ts
//  تعديل تجديد مجدول موجود (من غير إلغاء) — بيغيّر التواريخ والمزايا في التجديد المؤجل.
//  ملاحظة: الإيصال المدفوع مبيتغيّرش هنا؛ ده تعديل لتفاصيل التفعيل بس.
import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { readPendingRenewal, writePendingRenewal, activatePendingRenewalForMember } from '../../../../lib/pendingRenewal'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    if (user.role === 'COACH') return NextResponse.json({ error: 'غير مسموح' }, { status: 403 })

    const body = await request.json()
    const { memberId, startDate, expiryDate, freePTSessions, inBodyScans, invitations, freezeDays } = body
    if (!memberId) return NextResponse.json({ error: 'معرف العضو مطلوب' }, { status: 400 })

    const pending = await readPendingRenewal(memberId)
    if (!pending) return NextResponse.json({ error: 'مفيش تجديد مجدول لهذا العضو' }, { status: 404 })

    //  تواريخ جديدة (لو اتبعتت). البداية من أول اليوم (00:00) عشان لو التاريخ النهاردة يتفعّل فورًا.
    const newStart = startDate ? new Date(startDate.length <= 10 ? `${startDate}T00:00:00` : startDate) : pending.startDate
    const newExpiry = expiryDate ? new Date(expiryDate.length <= 10 ? `${expiryDate}T12:00:00` : expiryDate) : pending.expiryDate

    if (newExpiry && newStart && newExpiry <= newStart) {
      return NextResponse.json({ error: 'تاريخ النهاية لازم يكون بعد البداية' }, { status: 400 })
    }

    //  دمج المزايا الجديدة في بيانات التجديد (اللي مش متبعّت يفضل زي ما هو)
    const data = { ...pending.data }
    if (freePTSessions !== undefined) data.additionalFreePT = Math.max(0, parseInt(String(freePTSessions)) || 0)
    if (inBodyScans !== undefined) data.additionalInBody = Math.max(0, parseInt(String(inBodyScans)) || 0)
    if (invitations !== undefined) data.additionalInvitations = Math.max(0, parseInt(String(invitations)) || 0)
    if (freezeDays !== undefined) data.additionalFreezeDays = Math.max(0, parseInt(String(freezeDays)) || 0)

    await writePendingRenewal(memberId, newStart, newExpiry, data)

    //  لو تاريخ البداية بقى النهاردة أو فات → فعّل التجديد فورًا
    let activatedNow = false
    try { activatedNow = await activatePendingRenewalForMember(memberId) } catch { /* ignore */ }

    const m = await prisma.member.findUnique({ where: { id: memberId }, select: { memberNumber: true, name: true } })
    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Member', resourceId: memberId,
      details: { operation: 'EditScheduledRenew', memberNumber: m?.memberNumber, memberName: m?.name, startDate: newStart, expiryDate: newExpiry },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success',
    })

    return NextResponse.json({ success: true, activatedNow })
  } catch (error) {
    console.error('edit-pending-renewal error:', error)
    return NextResponse.json({ error: 'فشل تعديل التجديد المجدول' }, { status: 500 })
  }
}
