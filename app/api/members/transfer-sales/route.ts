import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/members/transfer-sales
 * نقل أعضاء/متابعات/داي يوز/انفيتيشن من موظف سيلز لموظف تاني (أو لـ unassigned)
 *
 * body:
 *   {
 *     fromStaffId: string,
 *     toStaffId: string | null,                                  // null = إلغاء التعيين
 *     types: ('members' | 'followups' | 'dayuse' | 'invitations')[]
 *   }
 */
export async function POST(request: Request) {
  try {
    await requirePermission(request, 'canEditMembers')

    const { fromStaffId, toStaffId, types } = await request.json()

    if (!fromStaffId) {
      return NextResponse.json({ error: 'fromStaffId مطلوب' }, { status: 400 })
    }

    if (toStaffId === undefined) {
      return NextResponse.json({ error: 'toStaffId مطلوب (null للإلغاء)' }, { status: 400 })
    }

    if (toStaffId !== null && fromStaffId === toStaffId) {
      return NextResponse.json({ error: 'لا يمكن النقل لنفس الموظف' }, { status: 400 })
    }

    if (!Array.isArray(types) || types.length === 0) {
      return NextResponse.json({ error: 'types مطلوب' }, { status: 400 })
    }

    const newOwner: string | null = toStaffId

    let transferredMembers = 0
    let transferredFollowUps = 0
    let transferredDayUse = 0
    let transferredInvitations = 0

    // ── نقل الأعضاء ──
    if (types.includes('members')) {
      const result = await prisma.member.updateMany({
        where: { salesStaffId: fromStaffId },
        data: { salesStaffId: newOwner }
      })
      transferredMembers = result.count
    }

    // ── نقل المتابعات العامة (الزوار اللي مش source = invitation/member-invitation) ──
    if (types.includes('followups')) {
      const targetIds = await prisma.followUp.findMany({
        where: {
          assignedTo: fromStaffId,
          archived: false,
          visitor: { source: { notIn: ['invitation', 'member-invitation'] } }
        },
        select: { id: true }
      })
      if (targetIds.length > 0) {
        const result = await prisma.followUp.updateMany({
          where: { id: { in: targetIds.map(f => f.id) } },
          data: { assignedTo: newOwner }
        })
        transferredFollowUps = result.count
      }
    }

    // ── نقل الزوار/داي يوز ──
    if (types.includes('dayuse')) {
      // 1. سجلات DayUseInBody
      const dayUseResult = await prisma.dayUseInBody.updateMany({
        where: { salesStaffId: fromStaffId },
        data: { salesStaffId: newOwner }
      })
      transferredDayUse += dayUseResult.count

      // 2. FollowUps لزوار source='invitation'
      const targetIds = await prisma.followUp.findMany({
        where: {
          assignedTo: fromStaffId,
          archived: false,
          visitor: { source: 'invitation' }
        },
        select: { id: true }
      })
      if (targetIds.length > 0) {
        const result = await prisma.followUp.updateMany({
          where: { id: { in: targetIds.map(f => f.id) } },
          data: { assignedTo: newOwner }
        })
        transferredDayUse += result.count
      }
    }

    // ── نقل الانفيتيشن (متابعات الزوار من دعوات الأعضاء) ──
    if (types.includes('invitations')) {
      const targetIds = await prisma.followUp.findMany({
        where: {
          assignedTo: fromStaffId,
          archived: false,
          visitor: { source: 'member-invitation' }
        },
        select: { id: true }
      })
      if (targetIds.length > 0) {
        const result = await prisma.followUp.updateMany({
          where: { id: { in: targetIds.map(f => f.id) } },
          data: { assignedTo: newOwner }
        })
        transferredInvitations = result.count
      }
    }

    return NextResponse.json({
      transferredMembers,
      transferredFollowUps,
      transferredDayUse,
      transferredInvitations,
      // backward compat
      transferred: transferredMembers + transferredFollowUps + transferredDayUse + transferredInvitations
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }
    console.error('transfer-sales error:', error)
    return NextResponse.json({ error: 'فشل النقل' }, { status: 500 })
  }
}
