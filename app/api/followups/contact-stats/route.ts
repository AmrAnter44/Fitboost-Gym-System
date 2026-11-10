import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAnyPermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/followups/contact-stats?staffId=…&from=YYYY-MM-DD&to=YYYY-MM-DD
 * السيلز ده اتواصل مع كام شخص — من سطور المتابعة نفسها (كل تواصل بيعمل FollowUp جديد
 * عليه assignedTo = اللي اتواصل + contacted). عدد أشخاص مختلفين (visitorId)، مش عدد المكالمات.
 * مش بيتأثر بزرار «طبق لم يتم التواصل على الجميع» ولا بتحميل القايمة صفحة صفحة.
 */
export async function GET(request: Request) {
  try {
    const user = await requireAnyPermission(request, ['canViewFollowUps'])
    const sp = new URL(request.url).searchParams
    const staffId = sp.get('staffId') || ''
    if (!staffId) return NextResponse.json({ error: 'staffId مطلوب' }, { status: 400 })

    //  السيلز العادي يشوف أرقامه هو بس
    const isManager = user.role === 'OWNER' || user.role === 'ADMIN' || user.role === 'MANAGER' || !!user.permissions?.canManageSales
    if (!isManager && staffId !== user.staffId) {
      return NextResponse.json({ error: 'صلاحية غير كافية' }, { status: 403 })
    }

    const now = new Date()
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const count = async (gte: Date, lte?: Date) => {
      const rows = await prisma.followUp.findMany({
        where: { assignedTo: staffId, contacted: true, createdAt: { gte, ...(lte ? { lte } : {}) } },
        select: { visitorId: true, contactMethod: true },
      })
      const people = new Set(rows.map(r => r.visitorId))
      const wa = new Set(rows.filter(r => r.contactMethod === 'whatsapp').map(r => r.visitorId))
      const call = new Set(rows.filter(r => r.contactMethod === 'call').map(r => r.visitorId))
      return { people: people.size, contacts: rows.length, whatsapp: wa.size, call: call.size }
    }

    const parseDay = (s: string | null, end: boolean) => {
      if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
      const [y, m, d] = s.split('-').map(Number)
      return end ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0)
    }
    const from = parseDay(sp.get('from'), false)
    const to = parseDay(sp.get('to'), true)

    const [today, month, range] = await Promise.all([
      count(startOfToday),
      count(startOfMonth),
      from || to ? count(from || new Date(0), to || undefined) : Promise.resolve(null),
    ])

    return NextResponse.json({ today, month, range })
  } catch (error: any) {
    const msg = String(error?.message || '')
    if (msg === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (msg.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية غير كافية' }, { status: 403 })
    console.error('followups/contact-stats error:', error)
    return NextResponse.json({ error: 'فشل حساب التواصل' }, { status: 500 })
  }
}
