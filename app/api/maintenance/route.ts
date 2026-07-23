import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyAuth } from '../../../lib/auth'

export const dynamic = 'force-dynamic'

const STATUSES = ['reported', 'fixed']

const parseDateLocal = (s: string | null): Date | null => {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  const dt = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
  return isNaN(dt.getTime()) ? null : dt
}

//  GET — سجلات الصيانة + ملخص + تجميع لكل جهاز
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const deviceName = searchParams.get('deviceName')
    const q = searchParams.get('q')?.trim()
    const fromP = parseDateLocal(searchParams.get('from') || searchParams.get('dateFrom'))
    const toP = parseDateLocal(searchParams.get('to') || searchParams.get('dateTo'))

    const where: any = {}
    if (status && STATUSES.includes(status)) where.status = status
    if (deviceName) where.deviceName = deviceName
    if (q) where.OR = [{ deviceName: { contains: q } }, { issue: { contains: q } }, { notes: { contains: q } }]
    if (fromP || toP) {
      where.createdAt = {}
      if (fromP) where.createdAt.gte = new Date(fromP.getFullYear(), fromP.getMonth(), fromP.getDate(), 0, 0, 0, 0)
      if (toP) where.createdAt.lte = new Date(toP.getFullYear(), toP.getMonth(), toP.getDate(), 23, 59, 59, 999)
    }

    const records = await prisma.maintenanceRecord.findMany({ where, orderBy: { createdAt: 'desc' }, take: 800 })

    //  ملخص الفترة
    const summary = {
      totalCost: records.reduce((s, r) => s + (r.cost || 0), 0),
      fixedCount: records.filter((r) => r.status === 'fixed').length,
      openCount: records.filter((r) => r.status === 'reported').length,
      count: records.length,
    }

    //  تجميع لكل جهاز
    const map = new Map<string, { deviceName: string; repairs: number; open: number; totalCost: number }>()
    for (const r of records) {
      const cur = map.get(r.deviceName) || { deviceName: r.deviceName, repairs: 0, open: 0, totalCost: 0 }
      if (r.status === 'fixed') cur.repairs++
      else cur.open++
      cur.totalCost += r.cost || 0
      map.set(r.deviceName, cur)
    }
    const byDevice = [...map.values()].sort((a, b) => b.totalCost - a.totalCost)

    //  كل أسماء الأجهزة (للفلتر/الاقتراح) — من غير فلتر التاريخ
    const allDevices = await prisma.maintenanceRecord.findMany({ select: { deviceName: true }, distinct: ['deviceName'], orderBy: { deviceName: 'asc' } })

    return NextResponse.json({ records, summary, byDevice, devices: allDevices.map((d) => d.deviceName) })
  } catch (error) {
    console.error('Load maintenance error:', error)
    return NextResponse.json({ error: 'فشل تحميل سجلات الصيانة' }, { status: 500 })
  }
}

//  POST — تسجيل عطل/إصلاح جديد
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

    const b = await request.json()
    const deviceName = (b.deviceName || '').trim()
    const issue = (b.issue || '').trim()
    if (!deviceName) return NextResponse.json({ error: 'اسم الجهاز مطلوب' }, { status: 400 })
    if (!issue) return NextResponse.json({ error: 'وصف العطل مطلوب' }, { status: 400 })

    const status = STATUSES.includes(b.status) ? b.status : 'fixed'
    const cost = Number(b.cost) || 0

    const record = await prisma.maintenanceRecord.create({
      data: {
        deviceName,
        issue,
        cost: cost < 0 ? 0 : cost,
        status,
        fixedAt: status === 'fixed' ? new Date() : null,
        notes: (b.notes || '').trim() || null,
        createdBy: user.name || null,
      },
    })

    return NextResponse.json({ record }, { status: 201 })
  } catch (error) {
    console.error('Create maintenance error:', error)
    return NextResponse.json({ error: 'فشل تسجيل الصيانة' }, { status: 500 })
  }
}
