import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requireAdmin } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'

//  POST — الأدمن يرد على رسالة (يشوفه المستقبلون في صندوقهم)
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request)
    const b = await request.json()
    const body = (b.body || '').trim()
    if (!body) return NextResponse.json({ error: 'اكتب ردك' }, { status: 400 })

    const msg = await prisma.internalMessage.findUnique({ where: { id: params.id }, select: { id: true } })
    if (!msg) return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 })

    const reply = await prisma.internalMessageReply.create({
      data: { messageId: params.id, userId: admin.userId, userName: admin.name || 'Admin', body },
    })
    return NextResponse.json({ reply }, { status: 201 })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (String(error?.message || '').includes('Forbidden')) return NextResponse.json({ error: 'مسموح للأدمن فقط' }, { status: 403 })
    console.error('Admin reply internal mail error:', error)
    return NextResponse.json({ error: 'فشل إرسال الرد' }, { status: 500 })
  }
}

//  PATCH — تعديل عنوان/محتوى الرسالة
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(request)
    const b = await request.json()
    const data: any = {}
    if (typeof b.subject === 'string') {
      const v = b.subject.trim()
      if (!v) return NextResponse.json({ error: 'العنوان مطلوب' }, { status: 400 })
      data.subject = v
    }
    if (typeof b.body === 'string') {
      const v = b.body.trim()
      if (!v) return NextResponse.json({ error: 'محتوى الرسالة مطلوب' }, { status: 400 })
      data.body = v
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'لا يوجد بيانات للتعديل' }, { status: 400 })

    const message = await prisma.internalMessage.update({ where: { id: params.id }, data })
    return NextResponse.json({ message })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (String(error?.message || '').includes('Forbidden')) return NextResponse.json({ error: 'مسموح للأدمن فقط' }, { status: 403 })
    console.error('Update internal mail error:', error)
    return NextResponse.json({ error: 'فشل تعديل الرسالة' }, { status: 500 })
  }
}

//  DELETE — حذف الرسالة (وكل المستقبلين والردود)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(request)
    await prisma.internalMessageReply.deleteMany({ where: { messageId: params.id } })
    await prisma.internalMessageRecipient.deleteMany({ where: { messageId: params.id } })
    await prisma.internalMessage.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (String(error?.message || '').includes('Forbidden')) return NextResponse.json({ error: 'مسموح للأدمن فقط' }, { status: 403 })
    console.error('Delete internal mail error:', error)
    return NextResponse.json({ error: 'فشل حذف الرسالة' }, { status: 500 })
  }
}
