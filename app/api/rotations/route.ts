import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyAuth } from '../../../lib/auth'

// GET - جلب جداول المناوبات

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')

    let whereClause: any = { isActive: true }

    // إذا كان المستخدم مدرب، يجلب مناوباته فقط
    if (user.role === 'COACH' && user.staffId) {
      whereClause.staffId = user.staffId
    } else if (staffId) {
      whereClause.staffId = staffId
    }

    const rotations = await prisma.rotation.findMany({
      where: whereClause,
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            position: true,
          },
        },
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
      ],
    })

    return NextResponse.json(rotations)
  } catch (error) {
    console.error('Error fetching rotations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rotations' },
      { status: 500 }
    )
  }
}

// POST - إنشاء مناوبة جديدة
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // فقط ADMIN يمكنه إنشاء مناوبات
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can create rotations' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { staffId, dayOfWeek, startTime, endTime } = body

    const rotation = await prisma.rotation.create({
      data: {
        staffId,
        dayOfWeek,
        startTime,
        endTime,
      },
    })

    return NextResponse.json({ success: true, rotation }, { status: 201 })
  } catch (error) {
    console.error('Error creating rotation:', error)
    return NextResponse.json(
      { error: 'Failed to create rotation' },
      { status: 500 }
    )
  }
}

// DELETE - حذف مناوبة
export async function DELETE(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can delete rotations' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Rotation ID required' }, { status: 400 })
    }

    await prisma.rotation.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting rotation:', error)
    return NextResponse.json(
      { error: 'Failed to delete rotation' },
      { status: 500 }
    )
  }
}
