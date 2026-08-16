// app/api/dayuse-services/[id]/route.ts
// 🏷️ تعديل/حذف نوع استخدام — للأدمن فقط (النوع الأساسي مايتحذفش)
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAdmin } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const data: { name?: string; price?: number; isActive?: boolean } = {}
    if (typeof body?.name === 'string') {
      const name = body.name.trim()
      if (!name) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 })
      data.name = name
    }
    if (body?.price !== undefined) data.price = Math.max(0, Number(body.price) || 0)
    if (typeof body?.isActive === 'boolean') data.isActive = body.isActive

    const service = await prisma.dayUseService.update({ where: { id: params.id }, data })
    return NextResponse.json(service)
  } catch (error: any) {
    console.error('PUT DayUseService error:', error)
    if (error.message === 'Unauthorized' || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }
    return NextResponse.json({ error: 'فشل تعديل النوع' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(request)
    const service = await prisma.dayUseService.findUnique({ where: { id: params.id } })
    if (!service) return NextResponse.json({ error: 'النوع غير موجود' }, { status: 404 })
    if (service.isBase) {
      return NextResponse.json({ error: 'النوع الأساسي (يوم استخدام) لا يمكن حذفه' }, { status: 400 })
    }
    await prisma.dayUseService.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE DayUseService error:', error)
    if (error.message === 'Unauthorized' || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }
    return NextResponse.json({ error: 'فشل حذف النوع' }, { status: 500 })
  }
}
