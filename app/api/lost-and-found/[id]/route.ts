import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

const CATEGORIES = ['A', 'B', 'C']
const FOUND_TYPES = ['staff', 'member']
const STATUSES = ['stored', 'returned']

//  تعديل متعلق (بيانات أو تعليمه اتسلم)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const data: any = {}

    if (typeof body.itemName === 'string') {
      const v = body.itemName.trim()
      if (!v) return NextResponse.json({ error: 'اسم/وصف الحاجة مطلوب' }, { status: 400 })
      data.itemName = v
    }
    if (CATEGORIES.includes(body.category)) data.category = body.category
    if (FOUND_TYPES.includes(body.foundByType)) data.foundByType = body.foundByType
    if (STATUSES.includes(body.status)) data.status = body.status
    if (typeof body.location === 'string') data.location = body.location.trim() || null
    if (typeof body.foundByName === 'string') data.foundByName = body.foundByName.trim() || null
    if (typeof body.claimedBy === 'string') data.claimedBy = body.claimedBy.trim() || null
    if (typeof body.notes === 'string') data.notes = body.notes.trim() || null

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'لا يوجد بيانات للتعديل' }, { status: 400 })
    }

    const item = await prisma.lostAndFound.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Error updating lost & found item:', error)
    return NextResponse.json({ error: 'فشل تعديل الحاجة' }, { status: 500 })
  }
}

//  حذف متعلق
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await prisma.lostAndFound.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting lost & found item:', error)
    return NextResponse.json({ error: 'فشل حذف الحاجة' }, { status: 500 })
  }
}
