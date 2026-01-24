import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/followups/bulk
 * Bulk operations for follow-ups
 *
 * Actions:
 * - assign: Assign multiple followups to a staff member
 * - archive: Archive multiple followups
 * - update_stage: Update stage for multiple followups
 * - update_priority: Update priority for multiple followups
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, followUpIds, data } = body

    if (!action || !followUpIds || !Array.isArray(followUpIds)) {
      return NextResponse.json(
        { error: 'Missing required fields: action, followUpIds' },
        { status: 400 }
      )
    }

    if (followUpIds.length === 0) {
      return NextResponse.json(
        { error: 'No followups selected' },
        { status: 400 }
      )
    }

    let result

    switch (action) {
      case 'assign':
        if (!data || !data.assignedTo) {
          return NextResponse.json(
            { error: 'Missing assignedTo in data' },
            { status: 400 }
          )
        }

        // Verify staff exists
        const staff = await prisma.staff.findUnique({
          where: { id: data.assignedTo }
        })

        if (!staff) {
          return NextResponse.json(
            { error: 'Staff member not found' },
            { status: 404 }
          )
        }

        result = await prisma.followUp.updateMany({
          where: { id: { in: followUpIds } },
          data: { assignedTo: data.assignedTo }
        })

        // Log activity for each followup
        const assignActivities = followUpIds.map(followUpId => ({
          followUpId,
          activityType: 'assignment',
          notes: `Assigned to ${staff.name}`,
          createdBy: data.assignedTo
        }))

        await prisma.followUpActivity.createMany({
          data: assignActivities
        })

        break

      case 'archive':
        result = await prisma.followUp.updateMany({
          where: { id: { in: followUpIds } },
          data: {
            archived: true,
            archivedAt: new Date(),
            archivedReason: data?.archivedReason || 'manual'
          }
        })
        break

      case 'update_stage':
        if (!data || !data.stage) {
          return NextResponse.json(
            { error: 'Missing stage in data' },
            { status: 400 }
          )
        }

        const validStages = ['new', 'contacted', 'interested', 'negotiating', 'converted', 'lost']
        if (!validStages.includes(data.stage)) {
          return NextResponse.json(
            { error: 'Invalid stage value' },
            { status: 400 }
          )
        }

        result = await prisma.followUp.updateMany({
          where: { id: { in: followUpIds } },
          data: { stage: data.stage }
        })

        // Log stage change activity if createdBy is provided
        if (data.createdBy) {
          const stageActivities = followUpIds.map(followUpId => ({
            followUpId,
            activityType: 'stage_change',
            notes: `Stage changed to ${data.stage}`,
            createdBy: data.createdBy
          }))

          await prisma.followUpActivity.createMany({
            data: stageActivities
          })
        }

        break

      case 'update_priority':
        if (!data || !data.priority) {
          return NextResponse.json(
            { error: 'Missing priority in data' },
            { status: 400 }
          )
        }

        const validPriorities = ['high', 'medium', 'low']
        if (!validPriorities.includes(data.priority)) {
          return NextResponse.json(
            { error: 'Invalid priority value' },
            { status: 400 }
          )
        }

        result = await prisma.followUp.updateMany({
          where: { id: { in: followUpIds } },
          data: { priority: data.priority }
        })
        break

      case 'unarchive':
        result = await prisma.followUp.updateMany({
          where: { id: { in: followUpIds } },
          data: {
            archived: false,
            archivedAt: null,
            archivedReason: null
          }
        })
        break

      case 'delete':
        // Permanent delete (use with caution)
        result = await prisma.followUp.deleteMany({
          where: { id: { in: followUpIds } }
        })
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action. Valid actions: assign, archive, update_stage, update_priority, unarchive, delete' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      action,
      affectedCount: result.count,
      message: `Successfully updated ${result.count} followup(s)`
    })

  } catch (error: any) {
    console.error('Bulk operation error:', error)
    return NextResponse.json(
      { error: 'Failed to perform bulk operation', details: error.message },
      { status: 500 }
    )
  }
}
