import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

//  GET — عدد المهام المفتوحة للمستخدم الحالي (للبادج)
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ count: 0 })
    const count = await prisma.taskAssignment.count({ where: { userId: user.userId, status: 'pending' } })
    return NextResponse.json({ count })
  } catch (error) {
    console.error('Tasks pending-count error:', error)
    return NextResponse.json({ count: 0 })
  }
}
