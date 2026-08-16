// app/api/dayuse-services/route.ts
// 🏷️ أنواع الاستخدامات (يوم استخدام / مساج / تأجير لوكر…) — GET للجميع، POST للأدمن
import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyAuth, requireAdmin } from '../../../lib/auth'

export const dynamic = 'force-dynamic'

//  يضمن وجود النوع الأساسي «يوم استخدام» دايمًا (auto-seed)
async function ensureBase() {
  const count = await prisma.dayUseService.count()
  if (count === 0) {
    await prisma.dayUseService.createMany({
      data: [
        { name: 'يوم استخدام', price: 0, isBase: true, sortOrder: 0 },
        { name: 'تأجير لوكر', price: 0, isBase: false, sortOrder: 1 },
      ],
    })
  }
}

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureBase()
    const services = await prisma.dayUseService.findMany({
      where: { isActive: true },
      orderBy: [{ isBase: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json(services)
  } catch (error) {
    console.error('GET DayUseService error:', error)
    return NextResponse.json({ error: 'فشل تحميل الأنواع' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const name = (body?.name || '').trim()
    const price = Number(body?.price) || 0
    if (!name) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 })

    // آخر ترتيب + 1
    const last = await prisma.dayUseService.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } })
    const service = await prisma.dayUseService.create({
      data: { name, price: Math.max(0, price), isBase: false, sortOrder: (last?.sortOrder ?? 0) + 1 },
    })
    return NextResponse.json(service, { status: 201 })
  } catch (error: any) {
    console.error('POST DayUseService error:', error)
    if (error.message === 'Unauthorized' || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }
    return NextResponse.json({ error: 'فشل إضافة النوع' }, { status: 500 })
  }
}
