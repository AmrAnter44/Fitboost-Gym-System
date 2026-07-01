import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// PUT - تعديل اسم تصنيف { name }
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(request, 'canCreateExpense')
    const { id } = await ctx.params
    const { name } = await request.json()
    const trimmed = (name || '').trim()
    if (!trimmed) return NextResponse.json({ error: 'اسم التصنيف مطلوب' }, { status: 400 })

    const dup = await prisma.expenseCategory.findUnique({ where: { name: trimmed } })
    if (dup && dup.id !== id) return NextResponse.json({ error: 'التصنيف موجود بالفعل' }, { status: 400 })

    const updated = await prisma.expenseCategory.update({ where: { id }, data: { name: trimmed } })
    return NextResponse.json(updated)
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    return NextResponse.json({ error: 'فشل تعديل التصنيف' }, { status: 500 })
  }
}

// DELETE - حذف تصنيف (المصاريف القديمة بتحتفظ باسم التصنيف كنص)
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(request, 'canCreateExpense')
    const { id } = await ctx.params
    await prisma.expenseCategory.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    return NextResponse.json({ error: 'فشل حذف التصنيف' }, { status: 500 })
  }
}
