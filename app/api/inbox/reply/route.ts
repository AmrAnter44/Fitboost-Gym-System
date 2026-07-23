import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

//  POST — الموظف يرد على رسالة داخلية استقبلها
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

    const b = await request.json()
    const messageId = (b.messageId || '').trim()
    const body = (b.body || '').trim()
    if (!messageId || !body) return NextResponse.json({ error: 'اكتب ردك' }, { status: 400 })

    //  نتأكد إن الرسالة دي مستقبلها فعلاً (ضد الرد على رسالة مش ليه)
    const recipient = await prisma.internalMessageRecipient.findFirst({ where: { messageId, userId: user.userId } })
    if (!recipient) return NextResponse.json({ error: 'الرسالة مش موجهة ليك' }, { status: 403 })

    const reply = await prisma.internalMessageReply.create({
      data: { messageId, userId: user.userId, userName: user.name || 'موظف', body },
    })

    return NextResponse.json({ reply }, { status: 201 })
  } catch (error) {
    console.error('Reply internal mail error:', error)
    return NextResponse.json({ error: 'فشل إرسال الرد' }, { status: 500 })
  }
}
