import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { EXTERNAL_COACH_POSITION } from '@/lib/classInstructor'

//  الكباتن المتاحين لجدول الكلاسيز: مدربين الجيم + الكباتن اللي من برا (اتعملهم حساب قبل كده)
const isCoach = (position: string | null) =>
  String(position || '').split(',').map(p => p.trim().toLowerCase())
    .some(p => p === 'مدرب' || p === 'مدربة' || p === 'coach' || p === EXTERNAL_COACH_POSITION)

export async function GET(request: Request) {
  try {
    await requirePermission(request, 'canCreateGroupClass')
    const staff = await prisma.staff.findMany({
      where: { isActive: true },
      select: { id: true, name: true, phone: true, staffCode: true, position: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(
      staff.filter(s => isCoach(s.position)).map(s => ({ ...s, external: String(s.position || '').includes(EXTERNAL_COACH_POSITION) }))
    )
  } catch (error: any) {
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (error.message?.includes('Forbidden')) return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    console.error('Get class instructors error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
