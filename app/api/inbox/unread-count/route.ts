import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

//  GET — عدد الرسائل غير المقروءة للمستخدم الحالي (للبادج)
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ count: 0 })
    const count = await prisma.internalMessageRecipient.count({
      where: { userId: user.userId, isRead: false },
    })
    return NextResponse.json({ count })
  } catch (error) {
    console.error('Inbox unread-count error:', error)
    return NextResponse.json({ count: 0 })
  }
}
