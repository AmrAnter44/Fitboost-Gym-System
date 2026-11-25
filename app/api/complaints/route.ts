import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyAuth } from '../../../lib/auth'
import { ensureComplaintNumbers, assignComplaintNumber, getComplaintNumbers } from '../../../lib/complaintNumber'

export const dynamic = 'force-dynamic'

const STATUSES = ['open', 'resolved']
const PRIORITIES = ['low', 'normal', 'high']

//  GET — قائمة الشكاوى (فلترة بالحالة/العضو/بحث)
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const memberId = searchParams.get('memberId')
    const q = searchParams.get('q')?.trim()

    try { await ensureComplaintNumbers() } catch (e) { console.error('complaint numbers:', e) }

    const where: any = {}
    if (status && STATUSES.includes(status)) where.status = status
    if (memberId) where.memberId = memberId
    //  البحث برقم الشكوى (#12 أو 12)
    let numberIds: string[] = []
    const qNum = q ? Number(q.replace(/^#/, '')) : NaN
    if (q && Number.isInteger(qNum) && qNum > 0) {
      const rows: Array<{ id: string }> = await prisma.$queryRawUnsafe('SELECT id FROM Complaint WHERE complaintNumber = ?', qNum)
      numberIds = rows.map(r => r.id)
    }
    if (q) {
      where.OR = [
        ...(numberIds.length ? [{ id: { in: numberIds } }] : []),
        { body: { contains: q } },
        { subject: { contains: q } },
        { memberName: { contains: q } },
        { memberNumber: { contains: q } },
      ]
    }

    const complaints = await prisma.complaint.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    })

    const counts = await prisma.complaint.groupBy({ by: ['status'], _count: { _all: true } })
    const byStatus: Record<string, number> = { open: 0, resolved: 0 }
    counts.forEach((c) => { byStatus[c.status] = c._count._all })

    const numbers = await getComplaintNumbers(complaints.map(c => c.id))
    return NextResponse.json({ complaints: complaints.map(c => ({ ...c, complaintNumber: numbers.get(c.id) ?? null })), byStatus })
  } catch (error) {
    console.error('Load complaints error:', error)
    return NextResponse.json({ error: 'فشل تحميل الشكاوى' }, { status: 500 })
  }
}

//  POST — إضافة شكوى مربوطة بعضو
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

    const b = await request.json()
    const memberId = (b.memberId || '').trim()
    const body = (b.body || '').trim()
    if (!memberId) return NextResponse.json({ error: 'اختار العضو' }, { status: 400 })
    if (!body) return NextResponse.json({ error: 'اكتب نص الشكوى' }, { status: 400 })

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, memberNumber: true, phone: true },
    })
    if (!member) return NextResponse.json({ error: 'العضو مش موجود' }, { status: 404 })

    const priority = PRIORITIES.includes(b.priority) ? b.priority : 'normal'

    const complaint = await prisma.complaint.create({
      data: {
        memberId: member.id,
        memberName: member.name,
        memberNumber: member.memberNumber || null,
        memberPhone: member.phone || null,
        subject: (b.subject || '').trim() || null,
        body,
        priority,
        status: 'open',
        createdBy: user.name || null,
      },
    })

    const complaintNumber = await assignComplaintNumber(complaint.id).catch(() => null)
    return NextResponse.json({ complaint: { ...complaint, complaintNumber } }, { status: 201 })
  } catch (error) {
    console.error('Create complaint error:', error)
    return NextResponse.json({ error: 'فشل إضافة الشكوى' }, { status: 500 })
  }
}
