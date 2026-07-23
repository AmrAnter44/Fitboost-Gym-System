import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyAuth } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'

//  PATCH — صاحب الرد يعدّل رده فقط
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

    const b = await request.json()
    const body = (b.body || '').trim()
    if (!body) return NextResponse.json({ error: 'اكتب ردك' }, { status: 400 })

    const reply = await prisma.internalMessageReply.findUnique({ where: { id: params.id } })
    if (!reply) return NextResponse.json({ error: 'الرد غير موجود' }, { status: 404 })
    if (reply.userId !== user.userId) return NextResponse.json({ error: 'مش مسموح تعدّل رد غيرك' }, { status: 403 })

    const updated = await prisma.internalMessageReply.update({ where: { id: params.id }, data: { body } })
    return NextResponse.json({ reply: updated })
  } catch (error) {
    console.error('Edit reply error:', error)
    return NextResponse.json({ error: 'فشل تعديل الرد' }, { status: 500 })
  }
}

//  DELETE — صاحب الرد يحذف رده فقط
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

    const reply = await prisma.internalMessageReply.findUnique({ where: { id: params.id } })
    if (!reply) return NextResponse.json({ error: 'الرد غير موجود' }, { status: 404 })
    if (reply.userId !== user.userId) return NextResponse.json({ error: 'مش مسموح تحذف رد غيرك' }, { status: 403 })

    await prisma.internalMessageReply.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete reply error:', error)
    return NextResponse.json({ error: 'فشل حذف الرد' }, { status: 500 })
  }
}
