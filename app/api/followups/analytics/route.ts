import { NextResponse } from 'next/server'
import { guard } from '@/lib/routeGuard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'


/**
 * GET /api/followups/analytics
 * Get analytics and statistics for follow-ups
 *
 * Query parameters:
 * - staffId: Filter by assigned staff member
 * - startDate: Filter by creation date (ISO string)
 * - endDate: Filter by creation date (ISO string)
 */
export async function GET(request: Request) {
  const __g = await guard(request, ['canViewFollowUps'])
  if (__g instanceof NextResponse) return __g

  try {
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    //  📍 فلتر المصدر: expired | expiring | invitations | dayuse | others (من غير = الكل)
    const source = searchParams.get('source')

    // Build where clause
    const where: any = {
      archived: false // Only count non-archived followups
    }

    if (staffId === '__unassigned__') {
      where.assignedTo = null
    } else if (staffId) {
      where.assignedTo = staffId
    }

    const SPECIAL_SOURCES = ['expired-member', 'expiring-member', 'member-invitation', 'invitation']
    if (source === 'expired') where.visitor = { source: 'expired-member' }
    else if (source === 'expiring') where.visitor = { source: 'expiring-member' }
    else if (source === 'invitations') where.visitor = { source: 'member-invitation' }
    else if (source === 'dayuse') where.visitor = { source: 'invitation' }
    else if (source === 'others') where.visitor = { source: { notIn: SPECIAL_SOURCES } }

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    // Fetch all followups with relations
    const followUps = await prisma.followUp.findMany({
      where,
      include: {
        visitor: true,
        assignedStaff: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Calculate statistics
    const total = followUps.length
    const converted = followUps.filter(fu => fu.stage === 'converted').length
    const conversionRate = total > 0 ? Number((converted / total * 100).toFixed(1)) : 0

    // Count by stage
    const byStage = followUps.reduce((acc, fu) => {
      const stage = fu.stage || 'new'
      acc[stage] = (acc[stage] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Count by priority
    const byPriority = followUps.reduce((acc, fu) => {
      const priority = fu.priority || 'unset'
      acc[priority] = (acc[priority] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Count by result
    const byResult = followUps.reduce((acc, fu) => {
      const result = fu.result || 'pending'
      acc[result] = (acc[result] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Count contacted vs not contacted
    const contacted = followUps.filter(fu => fu.contacted).length
    const notContacted = total - contacted

    // Calculate statistics by staff
    const byStaff = followUps.reduce((acc, fu) => {
      if (!fu.assignedTo || !fu.assignedStaff) return acc

      const staffId = fu.assignedTo
      const staffName = fu.assignedStaff.name

      if (!acc[staffId]) {
        acc[staffId] = {
          staffId,
          staffName,
          total: 0,
          converted: 0,
          contacted: 0,
          notContacted: 0,
          byStage: {} as Record<string, number>
        }
      }

      acc[staffId].total++
      if (fu.stage === 'converted') acc[staffId].converted++
      if (fu.contacted) acc[staffId].contacted++
      else acc[staffId].notContacted++

      const stage = fu.stage || 'new'
      acc[staffId].byStage[stage] = (acc[staffId].byStage[stage] || 0) + 1

      return acc
    }, {} as Record<string, any>)

    // Top performers (by conversion count)
    const topPerformers = Object.values(byStaff)
      .map((staff: any) => ({
        staffId: staff.staffId,
        name: staff.staffName,
        total: staff.total,
        converted: staff.converted,
        rate: staff.total > 0 ? Number((staff.converted / staff.total * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.converted - a.converted)
      .slice(0, 5)

    // Calculate average response time (time from creation to first contact)
    const contactedFollowUps = followUps.filter(fu => fu.contacted && fu.lastContactedAt)
    let averageResponseTime = 0

    if (contactedFollowUps.length > 0) {
      const totalResponseTime = contactedFollowUps.reduce((sum, fu) => {
        if (!fu.lastContactedAt) return sum
        const responseTime = new Date(fu.lastContactedAt).getTime() - new Date(fu.createdAt).getTime()
        return sum + responseTime
      }, 0)

      averageResponseTime = totalResponseTime / contactedFollowUps.length
    }

    // Convert to hours
    const averageResponseHours = Math.round(averageResponseTime / (1000 * 60 * 60))

    // Count unassigned
    const unassigned = followUps.filter(fu => !fu.assignedTo).length

    // Count overdue (nextFollowUpDate passed and not contacted)
    const now = new Date()
    const overdue = followUps.filter(fu => {
      if (!fu.nextFollowUpDate) return false
      return new Date(fu.nextFollowUpDate) < now && !fu.contacted
    }).length

    // This month conversions
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const convertedThisMonth = followUps.filter(fu => {
      return fu.stage === 'converted' && new Date(fu.updatedAt) >= startOfMonth
    }).length

    //  👥 السيلز للفلتر (النشطين اللي وظيفتهم سيلز)
    const isSales = (p: string | null) => String(p || '').split(',').map(x => x.trim().toLowerCase()).some(x => x === 'sales' || x === 'سيلز')
    const salesStaff = (await prisma.staff.findMany({ where: { isActive: true }, select: { id: true, name: true, position: true }, orderBy: { name: 'asc' } }))
      .filter(s => isSales(s.position))
      .map(s => ({ id: s.id, name: s.name }))

    return NextResponse.json({
      salesStaff,
      total,
      converted,
      convertedThisMonth,
      conversionRate,
      contacted,
      notContacted,
      unassigned,
      overdue,
      averageResponseHours,
      byStage,
      byPriority,
      byResult,
      byStaff: Object.values(byStaff),
      topPerformers,
      metadata: {
        startDate: startDate || null,
        endDate: endDate || null,
        filteredByStaff: staffId || null,
        filteredBySource: source || null
      }
    })

  } catch (error: any) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: error.message },
      { status: 500 }
    )
  }
}
