// app/api/members/waive-remaining/route.ts
//
// إسقاط مديونية عضو (كلها أو جزء منها) — للمالك والأدمن بس.
// مفيش إيصال ومفيش إيراد لأن مفيش فلوس اتحصّلت، والعملية بتتسجل في سجل النشاط.

import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'إسقاط المديونية للأدمن فقط' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const memberId = typeof body?.memberId === 'string' ? body.memberId : ''
    const amount = Number(body?.amount)
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 300) : ''

    if (!memberId) {
      return NextResponse.json({ error: 'معرف العضو مطلوب' }, { status: 400 })
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'مبلغ الإسقاط يجب أن يكون أكبر من صفر' }, { status: 400 })
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, memberNumber: true, remainingAmount: true },
    })
    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }

    const previousRemaining = member.remainingAmount || 0
    if (amount > previousRemaining) {
      return NextResponse.json(
        { error: `مبلغ الإسقاط (${amount}) أكبر من المديونية (${previousRemaining})` },
        { status: 400 }
      )
    }
    const newRemaining = previousRemaining - amount

    //  الشرط على القيمة القديمة: لو حد دفع في نفس اللحظة، الإسقاط مايتحسبش على رقم قديم
    const updated = await prisma.member.updateMany({
      where: { id: memberId, remainingAmount: previousRemaining },
      data: {
        remainingAmount: newRemaining,
        ...(newRemaining === 0 ? { remainingDueDate: null } : {}),
      },
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: 'المديونية اتغيرت، حدّث الصفحة وحاول تاني' }, { status: 409 })
    }

    createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action: 'UPDATE',
      resource: 'Member',
      resourceId: member.id,
      details: {
        operation: 'WaiveRemaining',
        memberNumber: member.memberNumber,
        memberName: member.name,
        amount,
        previousRemaining,
        newRemaining,
        reason,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
      status: 'success',
    })

    return NextResponse.json({ success: true, previousRemaining, newRemaining })
  } catch (error) {
    console.error('Error waiving member remaining:', error)
    return NextResponse.json({ error: 'فشل إسقاط المديونية' }, { status: 500 })
  }
}
