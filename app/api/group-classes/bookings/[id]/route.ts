import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'

export const dynamic = 'force-dynamic'

//  DELETE — إلغاء الحجز
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission(request, 'canRegisterClassAttendance')
    await prisma.classBooking.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (String(error?.message || '').includes('Forbidden')) return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    console.error('Delete class booking error:', error)
    return NextResponse.json({ error: 'فشل حذف الحجز' }, { status: 500 })
  }
}
