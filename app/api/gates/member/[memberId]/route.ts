// 🚪 مسح وش العضو من الأجهزة — زرار في صفحة العضو
//
//  ليه صلاحية تعديل الأعضاء مش الأونر بس؟ لأن دي عملية تشغيلية يومية
//  (عضو سجّل وشه غلط، أو عضو مشترك جديد بياخد مكان القديم) — لو محصورة
//  على الأونر، الريسبشن هيتعطّل.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { gateErrorResponse } from '@/lib/gates/api'
import { removeMemberFromGates, syncMember } from '@/lib/gates/sync'

export const dynamic = 'force-dynamic'

/** حالة العضو على الأجهزة — عشان الزرار يعرف يظهر بأي شكل */
export async function GET(request: Request, { params }: { params: { memberId: string } }) {
  try {
    const user = await verifyAuth(request)
    if (!user) throw new Error('Unauthorized')

    const rows = await prisma.gateMemberSync.findMany({
      where: { memberId: params.memberId },
      select: { gateId: true, isAllowed: true, validUntil: true, syncedAt: true, lastError: true },
    })
    const gates = await prisma.gate.findMany({ select: { id: true, name: true } })
    const nameById = new Map(gates.map(g => [g.id, g.name]))

    return NextResponse.json({
      success: true,
      onGates: rows.map(r => ({ ...r, gateName: nameById.get(r.gateId) ?? 'بوابة محذوفة' })),
    })
  } catch (e) {
    return gateErrorResponse(e)
  }
}

export async function DELETE(request: Request, { params }: { params: { memberId: string } }) {
  try {
    const user = await verifyAuth(request)
    if (!user) throw new Error('Unauthorized')
    const privileged = user.role === 'OWNER' || user.role === 'ADMIN'
    if (!privileged && !user.permissions?.canEditMembers) throw new Error('Forbidden')

    const { removed, errors } = await removeMemberFromGates(params.memberId)

    if (removed === 0 && errors.length > 0) {
      return NextResponse.json(
        { success: false, error: 'مقدرتش أمسح العضو من الجهاز', detail: errors.join(' · ') },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      removed,
      //  فشل جزئي: اتمسح من جهاز وفشل في تاني — لازم يتقال مش يتخبّى
      warning: errors.length > 0 ? `اتمسح من ${removed} جهاز، وفشل في: ${errors.join(' · ')}` : undefined,
      note: 'العضو اتشال من الجهاز. لو جدّد هيحتاج يسجّل وشه تاني.',
    })
  } catch (e) {
    return gateErrorResponse(e)
  }
}

/** إعادة إرسال العضو للأجهزة — لو حصل فشل وعايز تعيد المحاولة */
export async function POST(request: Request, { params }: { params: { memberId: string } }) {
  try {
    const user = await verifyAuth(request)
    if (!user) throw new Error('Unauthorized')
    const privileged = user.role === 'OWNER' || user.role === 'ADMIN'
    if (!privileged && !user.permissions?.canEditMembers) throw new Error('Forbidden')

    await syncMember(params.memberId)
    return NextResponse.json({ success: true })
  } catch (e) {
    return gateErrorResponse(e)
  }
}
