// app/api/more/scan/route.ts
//  سكان السباحة/المزيد بالتليفون — بيلاقي اشتراك More بالرقم، بيعرض كارت العضو، ويخصم حصة مرة واحدة في اليوم.
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await requirePermission(request, 'canRegisterMoreAttendance')
    const body = await request.json()
    const rawPhone = String(body.phone || '').replace(/\D/g, '')
    if (!rawPhone) {
      return NextResponse.json({ found: false, error: 'رقم التليفون مطلوب' }, { status: 400 })
    }

    const candidates = await prisma.more.findMany({ where: { isActive: true }, orderBy: { expiryDate: 'desc' } })
    const matches = candidates.filter(m => (m.phone || '').replace(/\D/g, '') === rawPhone)

    if (matches.length === 0) {
      return NextResponse.json({ found: false, error: 'مفيش اشتراك سباحة/مزيد نشط بالرقم ده' }, { status: 404 })
    }

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const isUsable = (m: any) => {
      if (m.sessionsRemaining <= 0) return false
      if (m.startDate && new Date(new Date(m.startDate).setHours(0, 0, 0, 0)) > today) return false
      if (m.expiryDate && new Date(new Date(m.expiryDate).setHours(0, 0, 0, 0)) < today) return false
      return true
    }
    //  نفضّل اشتراك صالح، وإلا نعرض أول واحد عشان الكارت يبان
    const target = matches.find(isUsable) || matches[0]

    //  كارت العضو (بيرجع في كل الحالات)
    const card = {
      clientName: target.clientName,
      coachName: target.coachName,
      moreNumber: target.moreNumber,
      phone: target.phone,
      expiryDate: target.expiryDate,
      sessionsPurchased: target.sessionsPurchased,
      sessionsRemaining: target.sessionsRemaining,
    }

    //  حالات مش قابلة للخصم
    if (!isUsable(target)) {
      const expired = target.expiryDate && new Date(new Date(target.expiryDate).setHours(0, 0, 0, 0)) < today
      const notStarted = target.startDate && new Date(new Date(target.startDate).setHours(0, 0, 0, 0)) > today
      const status = target.sessionsRemaining <= 0 ? 'no-sessions' : expired ? 'expired' : notStarted ? 'not-started' : 'blocked'
      return NextResponse.json({ found: true, success: false, status, ...card })
    }

    //  🛡️ مرة واحدة في اليوم — لو سجّل النهاردة مايتخصمش تاني
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999)
    const already = await prisma.moreSession.findFirst({
      where: { moreNumber: target.moreNumber, attended: true, attendedAt: { gte: startOfDay, lte: endOfDay } },
      select: { id: true },
    })
    if (already) {
      return NextResponse.json({ found: true, success: true, status: 'already', ...card })
    }

    //  خصم حصة + تسجيل حضور
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.moreSession.create({
        data: {
          moreNumber: target.moreNumber,
          clientName: target.clientName,
          coachName: target.coachName,
          sessionDate: new Date(),
          attended: true,
          attendedAt: new Date(),
          attendedBy: user.name || user.email,
          isFreeSession: false,
        },
      })
      const updatedMore = await tx.more.update({
        where: { moreNumber: target.moreNumber },
        data: { sessionsRemaining: { decrement: 1 } },
      })
      return { session, updatedMore }
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'CREATE', resource: 'More', resourceId: result.session.id,
      details: { via: 'phone-scan', moreNumber: target.moreNumber, clientName: target.clientName, sessionsRemaining: result.updatedMore.sessionsRemaining },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success',
    }).catch(() => {})

    return NextResponse.json({
      found: true,
      success: true,
      status: 'attended',
      ...card,
      sessionsRemaining: result.updatedMore.sessionsRemaining,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ found: false, error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (typeof error?.message === 'string' && error.message.includes('Forbidden')) {
      return NextResponse.json({ found: false, error: 'ليس لديك صلاحية تسجيل حضور المزيد' }, { status: 403 })
    }
    console.error('more scan error:', error)
    return NextResponse.json({ found: false, error: 'فشل تسجيل الحضور' }, { status: 500 })
  }
}
