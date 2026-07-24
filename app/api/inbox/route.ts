import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyAuth } from '../../../lib/auth'

export const dynamic = 'force-dynamic'

//  GET — صندوق الوارد للمستخدم الحالي
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

    const rows = await prisma.internalMessageRecipient.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { message: { include: { replies: { orderBy: { createdAt: 'asc' } } } } },
    })

    const messages = rows.map((r) => ({
      recipientId: r.id,
      isRead: r.isRead,
      readAt: r.readAt,
      id: r.message.id,
      subject: r.message.subject,
      body: r.message.body,
      senderName: r.message.senderName,
      createdAt: r.message.createdAt,
      replies: r.message.replies.map((rp) => ({
        id: rp.id,
        userName: rp.userName,
        body: rp.body,
        createdAt: rp.createdAt,
        mine: rp.userId === user.userId,
      })),
    }))

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Inbox list error:', error)
    return NextResponse.json({ error: 'فشل تحميل الرسائل' }, { status: 500 })
  }
}

//  PATCH — تعليم رسالة مقروءة (body: { recipientId }) أو الكل ({ markAll: true })
export async function PATCH(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    if (body.markAll) {
      await prisma.internalMessageRecipient.updateMany({
        where: { userId: user.userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      })
      return NextResponse.json({ success: true })
    }

    const recipientId = (body.recipientId || '').trim()
    if (!recipientId) return NextResponse.json({ error: 'recipientId مطلوب' }, { status: 400 })

    //  نتأكد إن الصف بتاع المستخدم نفسه (ضد الـ IDOR)
    const row = await prisma.internalMessageRecipient.findUnique({ where: { id: recipientId } })
    if (!row || row.userId !== user.userId) {
      return NextResponse.json({ error: 'غير مسموح' }, { status: 403 })
    }
    await prisma.internalMessageRecipient.update({
      where: { id: recipientId },
      data: { isRead: true, readAt: new Date() },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Inbox mark-read error:', error)
    return NextResponse.json({ error: 'فشل تحديث الحالة' }, { status: 500 })
  }
}
