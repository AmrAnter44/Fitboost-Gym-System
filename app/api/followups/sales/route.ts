import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // بداية ونهاية الشهر الحالي
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // جلب كل الموظفين النشطين
    const allStaff = await prisma.staff.findMany({
      where: {
        isActive: true,
        position: { contains: 'sales' }
      },
      select: {
        id: true,
        name: true,
        staffCode: true,
        position: true,
        salesTarget: true,
        salesCommissionType: true,
        salesCommissionRate: true,
        salesCommissionTiers: true,
      },
      orderBy: { name: 'asc' }
    })

    // جلب جميع المتابعات النشطة (غير archived) مع بيانات الفيزيتور
    const activeFollowUps = await prisma.followUp.findMany({
      where: { archived: false },
      select: {
        id: true,
        assignedTo: true,
        stage: true,
        priority: true,
        nextFollowUpDate: true,
        contacted: true,
        result: true,
        createdAt: true,
        visitor: {
          select: { id: true, name: true, phone: true, status: true }
        }
      }
    })

    // جلب الأعضاء المرتبطين بموظفي السيلز
    const salesMembers = await prisma.member.findMany({
      where: { salesStaffId: { not: null } },
      select: {
        id: true,
        name: true,
        phone: true,
        memberNumber: true,
        isActive: true,
        expiryDate: true,
        salesStaffId: true,
        subscriptionPrice: true,
      }
    })

    // جلب إيصالات الشهر الحالي لأعضاء السيلز
    const salesMemberIds = salesMembers.map(m => m.id)
    const thisMonthReceipts = salesMemberIds.length > 0
      ? await prisma.receipt.findMany({
          where: {
            memberId: { in: salesMemberIds },
            isCancelled: false,
            createdAt: { gte: startOfMonth, lte: endOfMonth }
          },
          select: { memberId: true, amount: true }
        })
      : []

    // بناء map للتحصيل لكل عضو
    const memberRevenueMap: Record<string, number> = {}
    for (const receipt of thisMonthReceipts) {
      if (receipt.memberId) {
        memberRevenueMap[receipt.memberId] = (memberRevenueMap[receipt.memberId] || 0) + receipt.amount
      }
    }

    // بناء النتيجة لكل موظف
    const result = allStaff.map(staff => {
      const leads = activeFollowUps.filter(f => f.assignedTo === staff.id)
      const members = salesMembers.filter(m => m.salesStaffId === staff.id)
      const collectedThisMonth = members.reduce((sum, m) => sum + (memberRevenueMap[m.id] || 0), 0)

      return {
        staffId: staff.id,
        name: staff.name,
        staffCode: staff.staffCode,
        position: staff.position,
        salesTarget: staff.salesTarget || 0,
        salesCommissionType: staff.salesCommissionType || null,
        salesCommissionRate: staff.salesCommissionRate || null,
        salesCommissionTiers: staff.salesCommissionTiers || null,
        collectedThisMonth,
        leadsCount: leads.length,
        leads: leads.map(f => ({
          id: f.id,
          visitorName: f.visitor.name,
          visitorPhone: f.visitor.phone,
          stage: f.stage,
          priority: f.priority,
          contacted: f.contacted,
          result: f.result,
          nextFollowUpDate: f.nextFollowUpDate,
          createdAt: f.createdAt,
        })),
        membersCount: members.length,
        members: members.map(m => ({
          id: m.id,
          name: m.name,
          phone: m.phone,
          memberNumber: m.memberNumber,
          isActive: m.isActive,
          expiryDate: m.expiryDate,
          collectedThisMonth: memberRevenueMap[m.id] || 0,
        })),
      }
    })

    // الأعضاء الغير مُسنَّدين لسيلز
    const unassignedMembers = await prisma.member.count({
      where: { salesStaffId: null }
    })

    // المتابعات الغير مُسنَّدة لسيلز (كل المصادر)
    const unassignedFollowUpsDB = await prisma.followUp.count({
      where: { assignedTo: null, archived: false }
    })

    // Visitor records بدون أي FollowUp نشط (زوار بدون متابعة)
    const visitorsWithFollowUp = await prisma.visitor.count({
      where: { followUps: { some: { archived: false } } }
    })
    const totalVisitors = await prisma.visitor.count()
    const visitorsWithoutFollowUp = Math.max(0, totalVisitors - visitorsWithFollowUp)

    const unassignedFollowUps = unassignedFollowUpsDB + visitorsWithoutFollowUp

    // داي يوز غير مُسنَّدة:
    // 1. FollowUps غير مُسنَّدة لزوار source='invitation'
    const unassignedDayUseFollowUps = await prisma.followUp.count({
      where: { assignedTo: null, archived: false, visitor: { source: 'invitation' } }
    })
    // 2. DayUseInBody phones بدون أي FollowUp نشط
    const allDayUsePhones = (await prisma.dayUseInBody.findMany({
      select: { phone: true }
    })).map(d => d.phone)
    const uniqueDayUsePhones = [...new Set(allDayUsePhones)]
    let dayUseWithoutFollowUp = 0
    if (uniqueDayUsePhones.length > 0) {
      // عدد أرقام الداي يوز التي لديها Visitor + FollowUp نشط (assigned أو لا)
      const visitorsWithActiveFollowUp = await prisma.visitor.count({
        where: {
          phone: { in: uniqueDayUsePhones },
          followUps: { some: { archived: false } }
        }
      })
      // الباقي: أرقام بدون Visitor أو بدون FollowUp نشط
      dayUseWithoutFollowUp = Math.max(0, uniqueDayUsePhones.length - visitorsWithActiveFollowUp)
    }
    const unassignedDayUse = unassignedDayUseFollowUps + dayUseWithoutFollowUp

    // انفيتيشن غير مُسنَّدة:
    // 1. FollowUps غير مُسنَّدة لزوار source='member-invitation'
    const unassignedInvitationFollowUps = await prisma.followUp.count({
      where: { assignedTo: null, archived: false, visitor: { source: 'member-invitation' } }
    })
    // 2. Invitation records بدون أي FollowUp نشط
    const allInvitationPhones = (await prisma.invitation.findMany({
      select: { guestPhone: true }
    })).map(i => i.guestPhone)
    const uniqueInvitationPhones = [...new Set(allInvitationPhones)]
    let invitationWithoutFollowUp = 0
    if (uniqueInvitationPhones.length > 0) {
      const invVisitorsWithFollowUp = await prisma.visitor.count({
        where: {
          phone: { in: uniqueInvitationPhones },
          followUps: { some: { archived: false } }
        }
      })
      invitationWithoutFollowUp = Math.max(0, uniqueInvitationPhones.length - invVisitorsWithFollowUp)
    }
    const unassignedInvitations = unassignedInvitationFollowUps + invitationWithoutFollowUp

    return NextResponse.json({
      staff: result,
      unassigned: {
        membersCount: unassignedMembers,
        followUpsCount: unassignedFollowUps,
        dayUseCount: unassignedDayUse,
        invitationCount: unassignedInvitations,
      }
    })
  } catch (error: any) {
    console.error('Error fetching sales data:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to fetch sales data' }, { status: 500 })
  }
}
