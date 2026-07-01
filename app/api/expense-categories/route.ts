import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission, requireAnyPermission } from '../../../lib/auth'

export const dynamic = 'force-dynamic'

// GET - قائمة تصنيفات المصاريف
export async function GET(request: Request) {
  try {
    await requireAnyPermission(request, ['canViewExpenses', 'canCreateExpense', 'canAccessClosing'])
    const categories = await prisma.expenseCategory.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(categories)
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    return NextResponse.json({ error: 'فشل جلب التصنيفات' }, { status: 500 })
  }
}

// POST - إضافة تصنيف جديد { name }
export async function POST(request: Request) {
  try {
    await requirePermission(request, 'canCreateExpense')
    const { name } = await request.json()
    const trimmed = (name || '').trim()
    if (!trimmed) return NextResponse.json({ error: 'اسم التصنيف مطلوب' }, { status: 400 })
    if (trimmed.length > 50) return NextResponse.json({ error: 'اسم التصنيف طويل جداً' }, { status: 400 })

    const existing = await prisma.expenseCategory.findUnique({ where: { name: trimmed } })
    if (existing) return NextResponse.json({ error: 'التصنيف موجود بالفعل' }, { status: 400 })

    const category = await prisma.expenseCategory.create({ data: { name: trimmed } })
    return NextResponse.json(category, { status: 201 })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    return NextResponse.json({ error: 'فشل إضافة التصنيف' }, { status: 500 })
  }
}
