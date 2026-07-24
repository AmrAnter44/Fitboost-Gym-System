import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyAuth } from '../../../lib/auth'

export const dynamic = 'force-dynamic'

const CATEGORIES = ['A', 'B', 'C']
const FOUND_TYPES = ['staff', 'member']
const STATUSES = ['stored', 'returned']

//  قائمة المتعلقات المفقودة — فلترة اختيارية بالفئة والحالة والبحث
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const q = searchParams.get('q')?.trim()

    const where: any = {}
    if (category && CATEGORIES.includes(category)) where.category = category
    if (status && STATUSES.includes(status)) where.status = status
    if (q) {
      where.OR = [
        { itemName: { contains: q } },
        { location: { contains: q } },
        { foundByName: { contains: q } },
      ]
    }

    const items = await prisma.lostAndFound.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    //  عدّادات لكل فئة (للحاجات المحفوظة بس)
    const counts = await prisma.lostAndFound.groupBy({
      by: ['category'],
      where: { status: 'stored' },
      _count: { _all: true },
    })
    const byCategory: Record<string, number> = { A: 0, B: 0, C: 0 }
    counts.forEach((c) => { byCategory[c.category] = c._count._all })

    return NextResponse.json({ items, byCategory })
  } catch (error) {
    console.error('Error loading lost & found:', error)
    return NextResponse.json({ error: 'فشل تحميل المتعلقات المفقودة' }, { status: 500 })
  }
}

//  إضافة متعلق مفقود جديد
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const itemName = (body.itemName || '').trim()
    if (!itemName) {
      return NextResponse.json({ error: 'اسم/وصف الحاجة مطلوب' }, { status: 400 })
    }

    const category = CATEGORIES.includes(body.category) ? body.category : 'A'
    const foundByType = FOUND_TYPES.includes(body.foundByType) ? body.foundByType : 'staff'

    const item = await prisma.lostAndFound.create({
      data: {
        itemName,
        category,
        location: (body.location || '').trim() || null,
        foundByType,
        foundByName: (body.foundByName || '').trim() || null,
        notes: (body.notes || '').trim() || null,
        status: 'stored',
      },
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('Error creating lost & found item:', error)
    return NextResponse.json({ error: 'فشل إضافة الحاجة' }, { status: 500 })
  }
}
