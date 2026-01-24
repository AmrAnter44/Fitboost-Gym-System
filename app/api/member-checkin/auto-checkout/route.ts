import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

// POST: حذف التسجيلات القديمة (أكثر من ساعتين)

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const now = new Date()
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)

    // البحث عن جميع التسجيلات التي مر عليها أكثر من ساعتين
    const expiredCheckIns = await prisma.memberCheckIn.findMany({
      where: {
        checkInTime: {
          lte: twoHoursAgo,
        },
      },
    })

    if (expiredCheckIns.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'لا توجد تسجيلات قديمة',
        deleted: 0,
      })
    }

    // حذف جميع التسجيلات القديمة
    const result = await prisma.memberCheckIn.deleteMany({
      where: {
        checkInTime: {
          lte: twoHoursAgo,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `تم حذف ${result.count} تسجيل قديم`,
      deleted: result.count,
      members: expiredCheckIns.map((c) => c.memberId),
    })
  } catch (error) {
    console.error('Error in auto-checkout:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء التسجيل التلقائي' },
      { status: 500 }
    )
  }
}

// GET: معاينة التسجيلات القديمة (أكثر من ساعتين)
export async function GET() {
  try {
    const now = new Date()
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)

    const expiredCheckIns = await prisma.memberCheckIn.findMany({
      where: {
        checkInTime: {
          lte: twoHoursAgo,
        },
      },
      include: {
        member: {
          select: {
            name: true,
            memberNumber: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      count: expiredCheckIns.length,
      checkIns: expiredCheckIns,
    })
  } catch (error) {
    console.error('Error getting expired check-ins:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء الاستعلام' },
      { status: 500 }
    )
  }
}
