import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

const STATUSES = ['reported', 'fixed']

//  PATCH — تعديل / تعليم كمُصلَّح مع التكلفة
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

    const b = await request.json()
    const data: any = {}
    if (typeof b.deviceName === 'string') {
      const v = b.deviceName.trim()
      if (!v) return NextResponse.json({ error: 'اسم الجهاز مطلوب' }, { status: 400 })
      data.deviceName = v
    }
    if (typeof b.issue === 'string') {
      const v = b.issue.trim()
      if (!v) return NextResponse.json({ error: 'وصف العطل مطلوب' }, { status: 400 })
      data.issue = v
    }
    if (b.cost !== undefined) { const c = Number(b.cost); data.cost = isNaN(c) || c < 0 ? 0 : c }
    if (typeof b.notes === 'string') data.notes = b.notes.trim() || null
    if (STATUSES.includes(b.status)) {
      data.status = b.status
      data.fixedAt = b.status === 'fixed' ? new Date() : null
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'لا يوجد بيانات للتعديل' }, { status: 400 })

    const record = await prisma.maintenanceRecord.update({ where: { id: params.id }, data })
    return NextResponse.json({ record })
  } catch (error) {
    console.error('Update maintenance error:', error)
    return NextResponse.json({ error: 'فشل تعديل السجل' }, { status: 500 })
  }
}

//  DELETE
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    await prisma.maintenanceRecord.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete maintenance error:', error)
    return NextResponse.json({ error: 'فشل حذف السجل' }, { status: 500 })
  }
}
