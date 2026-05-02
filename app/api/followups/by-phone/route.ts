import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// Resolve a phone number to its most recent (non-archived) follow-up so the
// member-creation form can surface the assigned sales staff. Used by reception
// when typing a phone in MemberForm.
export async function GET(request: Request) {
  try {
    await requirePermission(request, 'canCreateMembers')

    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')?.trim()

    if (!phone || phone.length < 6) {
      return NextResponse.json({ found: false }, { status: 200 })
    }

    const followUp = await prisma.followUp.findFirst({
      where: {
        archived: false,
        visitor: { phone }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        assignedStaff: { select: { id: true, name: true } },
        visitor: { select: { name: true, phone: true } }
      }
    })

    if (!followUp || !followUp.assignedStaff) {
      return NextResponse.json({ found: false }, { status: 200 })
    }

    return NextResponse.json({
      found: true,
      salesStaffId: followUp.assignedStaff.id,
      salesStaffName: followUp.assignedStaff.name,
      visitorName: followUp.visitor?.name || null,
      followUpId: followUp.id
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }
    if (error?.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'صلاحية غير كافية' }, { status: 403 })
    }
    console.error('followups/by-phone error:', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
