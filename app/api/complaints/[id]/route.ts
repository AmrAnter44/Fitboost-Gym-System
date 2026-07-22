import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

const STATUSES = ['open', 'resolved']
const PRIORITIES = ['low', 'normal', 'high']

//  PATCH — تعديل الشكوى / تغيير الحالة / إضافة الحل
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

    const b = await request.json()
    const data: any = {}
    if (STATUSES.includes(b.status)) data.status = b.status
    if (PRIORITIES.includes(b.priority)) data.priority = b.priority
    if (typeof b.subject === 'string') data.subject = b.subject.trim() || null
    if (typeof b.body === 'string') {
      const v = b.body.trim()
      if (!v) return NextResponse.json({ error: 'نص الشكوى مطلوب' }, { status: 400 })
      data.body = v
    }
    if (typeof b.resolution === 'string') data.resolution = b.resolution.trim() || null

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'لا يوجد بيانات للتعديل' }, { status: 400 })
    }

    const complaint = await prisma.complaint.update({ where: { id: params.id }, data })
    return NextResponse.json({ complaint })
  } catch (error) {
    console.error('Update complaint error:', error)
    return NextResponse.json({ error: 'فشل تعديل الشكوى' }, { status: 500 })
  }
}

//  DELETE — حذف الشكوى
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    await prisma.complaint.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete complaint error:', error)
    return NextResponse.json({ error: 'فشل حذف الشكوى' }, { status: 500 })
  }
}
