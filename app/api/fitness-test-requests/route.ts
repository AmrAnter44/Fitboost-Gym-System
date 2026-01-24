import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyAuth } from '../../../lib/auth'

// POST - إنشاء طلب اختبار لياقة جديد

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { memberId, coachId } = body

    // التحقق من عدم وجود اختبار سابق للعضو
    const existingTest = await prisma.fitnessTest.findUnique({
      where: { memberId },
    })

    if (existingTest) {
      return NextResponse.json(
        { error: 'يوجد اختبار لياقة بالفعل لهذا العضو' },
        { status: 400 }
      )
    }

    // التحقق من عدم وجود طلب معلق
    const existingRequest = await prisma.fitnessTestRequest.findFirst({
      where: {
        memberId,
        status: 'pending',
      },
    })

    if (existingRequest) {
      return NextResponse.json(
        { error: 'يوجد طلب معلق بالفعل لهذا العضو' },
        { status: 400 }
      )
    }

    // إنشاء الطلب
    const testRequest = await prisma.fitnessTestRequest.create({
      data: {
        memberId,
        coachId,
        requestedBy: user.name,
        status: 'pending',
      },
    })

    return NextResponse.json({ success: true, request: testRequest }, { status: 201 })
  } catch (error) {
    console.error('Error creating fitness test request:', error)
    return NextResponse.json(
      { error: 'Failed to create request' },
      { status: 500 }
    )
  }
}

// GET - جلب طلبات اختبار اللياقة
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const coachId = searchParams.get('coachId')
    const status = searchParams.get('status')

    let whereClause: any = {}

    if (coachId) {
      whereClause.coachId = coachId
    }

    if (status) {
      whereClause.status = status
    }

    const requests = await prisma.fitnessTestRequest.findMany({
      where: whereClause,
      include: {
        member: {
          select: {
            id: true,
            name: true,
            phone: true,
            memberNumber: true,
            freePTSessions: true,
          },
        },
        coach: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        requestedAt: 'desc',
      },
    })

    return NextResponse.json(requests)
  } catch (error) {
    console.error('Error fetching fitness test requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    )
  }
}
