import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

/**
 * تحديث الجلسات المجانية لتحديد أنها تم تحصيلها
 * Mark free sessions as collected with expense ID
 */
export async function POST(request: Request) {
  try {
    // التحقق من المصادقة
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      serviceType,
      coachName,
      startDate,
      endDate,
      expenseId
    } = await request.json()

    // Validation
    if (!serviceType || !coachName || !startDate || !endDate || !expenseId) {
      return NextResponse.json({
        error: 'Missing required fields'
      }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    let updateResult: any

    // تحديث الجلسات حسب نوع الخدمة
    switch (serviceType) {
      case 'PT':
        updateResult = await prisma.pTSession.updateMany({
          where: {
            isFreeSession: true,
            collectedInExpenseId: null, // فقط الجلسات التي لم يتم تحصيلها
            OR: [
              { coachName },
              { attendedBy: coachName }
            ],
            sessionDate: {
              gte: start,
              lte: end
            }
          },
          data: {
            collectedInExpenseId: expenseId
          }
        })
        break

      case 'Nutrition':
        updateResult = await prisma.nutritionSession.updateMany({
          where: {
            isFreeSession: true,
            collectedInExpenseId: null,
            OR: [
              { nutritionistName: coachName },
              { attendedBy: coachName }
            ],
            sessionDate: {
              gte: start,
              lte: end
            }
          },
          data: {
            collectedInExpenseId: expenseId
          }
        })
        break

      case 'Physiotherapy':
        updateResult = await prisma.physiotherapySession.updateMany({
          where: {
            isFreeSession: true,
            collectedInExpenseId: null,
            OR: [
              { therapistName: coachName },
              { attendedBy: coachName }
            ],
            sessionDate: {
              gte: start,
              lte: end
            }
          },
          data: {
            collectedInExpenseId: expenseId
          }
        })
        break

      case 'GroupClass':
        updateResult = await prisma.groupClassSession.updateMany({
          where: {
            isFreeSession: true,
            collectedInExpenseId: null,
            OR: [
              { instructorName: coachName },
              { attendedBy: coachName }
            ],
            sessionDate: {
              gte: start,
              lte: end
            }
          },
          data: {
            collectedInExpenseId: expenseId
          }
        })
        break

      default:
        return NextResponse.json({
          error: 'Invalid service type'
        }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      updatedCount: updateResult.count,
      message: `تم تحديد ${updateResult.count} جلسة مجانية كمحصلة`
    })

  } catch (error) {
    console.error('Error marking sessions as collected:', error)
    return NextResponse.json({
      error: 'Failed to mark sessions as collected'
    }, { status: 500 })
  }
}
