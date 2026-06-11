import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// GET — lists PT subscriptions that are expired or expiring soon, each
// enriched with its contact-log history. Optional ?daysAhead=N controls
// the look-ahead window for "expiring soon" (default 14 days).
export async function GET(request: Request) {
  try {
    await requirePermission(request, 'canViewPT')
    const { searchParams } = new URL(request.url)
    const daysAhead = Math.max(0, Math.min(60, parseInt(searchParams.get('daysAhead') || '14', 10)))
    const statusFilter = searchParams.get('status') // 'all' | 'expired' | 'expiring'

    const now = new Date()
    const horizon = new Date(now)
    horizon.setDate(horizon.getDate() + daysAhead)

    const where: any = {
      OR: [
        // expired (had an expiry date that's already past)
        { expiryDate: { lt: now } },
        // expiring soon (between now and the horizon)
        { AND: [{ expiryDate: { gte: now } }, { expiryDate: { lte: horizon } }] },
        // no expiry date but sessions ran out
        { AND: [{ expiryDate: null }, { sessionsRemaining: { lte: 0 } }] },
      ],
    }

    const pts = await prisma.pT.findMany({
      where,
      include: {
        contactLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            staff: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ expiryDate: 'asc' }],
    })

    const enriched = pts.map(pt => {
      const isExpired = pt.expiryDate ? pt.expiryDate < now : (pt.sessionsRemaining ?? 0) <= 0
      const daysToExpiry = pt.expiryDate
        ? Math.ceil((pt.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null
      const latestContact = pt.contactLogs[0] || null
      return {
        ptNumber: pt.ptNumber,
        clientName: pt.clientName,
        phone: pt.phone,
        coachName: pt.coachName,
        sessionsPurchased: pt.sessionsPurchased,
        sessionsRemaining: pt.sessionsRemaining,
        startDate: pt.startDate,
        expiryDate: pt.expiryDate,
        pricePerSession: pt.pricePerSession,
        status: isExpired ? 'expired' : 'expiring',
        daysToExpiry,
        contactLogs: pt.contactLogs,
        latestContact,
        contactCount: pt.contactLogs.length,
      }
    })

    const filtered = statusFilter && statusFilter !== 'all'
      ? enriched.filter(p => p.status === statusFilter)
      : enriched

    return NextResponse.json({
      data: filtered,
      counts: {
        total: enriched.length,
        expired: enriched.filter(p => p.status === 'expired').length,
        expiring: enriched.filter(p => p.status === 'expiring').length,
      },
    })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية عرض الـ PT مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}

// POST — log a contact attempt for a PT client.
// Body: { ptNumber, activityType, result?, notes?, nextContactAt? }
export async function POST(request: Request) {
  try {
    const user = await requirePermission(request, 'canEditPT')
    const body = await request.json()
    const { ptNumber, activityType, result, notes, nextContactAt } = body as {
      ptNumber?: number | string
      activityType?: string
      result?: string
      notes?: string
      nextContactAt?: string
    }

    if (!ptNumber || !activityType) {
      return NextResponse.json({ error: 'ptNumber و activityType مطلوبين' }, { status: 400 })
    }
    const ptNum = typeof ptNumber === 'string' ? parseInt(ptNumber, 10) : ptNumber
    if (!Number.isInteger(ptNum)) return NextResponse.json({ error: 'ptNumber غير صالح' }, { status: 400 })

    const VALID_TYPES = new Set(['call', 'whatsapp', 'visit', 'note'])
    if (!VALID_TYPES.has(activityType)) {
      return NextResponse.json({ error: 'activityType غير صحيح' }, { status: 400 })
    }

    const pt = await prisma.pT.findUnique({ where: { ptNumber: ptNum }, select: { ptNumber: true } })
    if (!pt) return NextResponse.json({ error: 'اشتراك PT غير موجود' }, { status: 404 })

    // Resolve staffId from the user — fall back gracefully if no Staff record linked
    const staffId = user.staffId || null

    const log = await prisma.pTContactLog.create({
      data: {
        ptNumber: ptNum,
        activityType,
        result: result || null,
        notes: notes?.trim() || null,
        nextContactAt: nextContactAt ? new Date(nextContactAt) : null,
        createdBy: staffId,
      },
      include: { staff: { select: { id: true, name: true } } },
    })

    return NextResponse.json(log, { status: 201 })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية تعديل الـ PT مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}
