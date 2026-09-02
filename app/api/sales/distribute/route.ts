// app/api/sales/distribute/route.ts
//  إدارة السيلز: توزيع الليدز/الزوار غير المُسنّين على السيلز بالتساوي أو بنسب مخصصة،
//  مع فلترة بالتاريخ (شهر/مدى) والجندر (ذكر/أنثى/غير معروف).
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

type Gender = 'male' | 'female' | 'unknown' | 'all'

async function requireSalesManager(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return { error: 'يجب تسجيل الدخول أولاً', status: 401 as const, user: null }
  const role = user.role
  const allowed = role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER'
    || (user as any).permissions?.canManageSales === true
    || (user as any).permissions?.canEditMembers === true
  if (!allowed) return { error: 'ليس لديك صلاحية إدارة السيلز', status: 403 as const, user: null }
  return { error: null, status: 200 as const, user }
}

//  يرجّع IDs الليدز غير المُسنّين المطابقين للفلتر
async function getUnassignedLeadIds(startDate?: string | null, endDate?: string | null, gender?: Gender, source?: string | null): Promise<string[]> {
  const where: any = {
    isDeleted: false,
    status: { notIn: ['subscribed', 'rejected'] },
    //  غير مُسنّد = مفيش أي متابعة ليها assignedTo
    followUps: { none: { assignedTo: { not: null } } },
  }
  if (source && source !== 'all') where.source = source
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = new Date(startDate)
    if (endDate) {
      const end = endDate.length === 10 ? new Date(`${endDate}T23:59:59.999`) : new Date(endDate)
      where.createdAt.lte = end
    }
  }
  const candidates = await prisma.visitor.findMany({ where, select: { id: true } })
  let ids = candidates.map(c => c.id)

  //  فلتر الجندر — عمود جديد (raw SQL عشان الـ Prisma client ممكن يكون outdated)
  if (gender && gender !== 'all' && ids.length) {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, gender FROM Visitor WHERE id IN (${ids.map(() => '?').join(',')})`,
      ...ids
    )
    const gmap = new Map(rows.map(r => [r.id, (r.gender || '').toLowerCase()]))
    ids = ids.filter(id => {
      const g = gmap.get(id)
      if (gender === 'unknown') return !g
      return g === gender
    })
  }
  return ids
}

//  GET — معاينة: عدد الليدز المطابقين + قايمة السيلز
export async function GET(request: Request) {
  const auth = await requireSalesManager(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const gender = (searchParams.get('gender') || 'all') as Gender
  const source = searchParams.get('source')

  try {
    const ids = await getUnassignedLeadIds(startDate, endDate, gender, source)
    const salesStaff = await prisma.staff.findMany({
      where: { isActive: true, position: { contains: 'sales' } },
      select: { id: true, name: true, staffCode: true },
      orderBy: { name: 'asc' },
    })
    //  حمولة كل سيلز: عدد الليدز المفتوحة (مش منتهية) المسنّدة له حاليًا
    let loadMap = new Map<string, number>()
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT f.assignedTo AS id, COUNT(DISTINCT f.visitorId) AS c
         FROM FollowUp f JOIN Visitor v ON v.id = f.visitorId
         WHERE f.assignedTo IS NOT NULL AND v.isDeleted = 0 AND v.status NOT IN ('subscribed','rejected')
         GROUP BY f.assignedTo`
      )
      loadMap = new Map(rows.map(r => [r.id, Number(r.c) || 0]))
    } catch { /* ignore */ }
    const staffWithLoad = salesStaff.map(s => ({ ...s, load: loadMap.get(s.id) || 0 }))
    return NextResponse.json({ count: ids.length, salesStaff: staffWithLoad })
  } catch (error) {
    console.error('distribute preview error:', error)
    return NextResponse.json({ error: 'فشل جلب البيانات' }, { status: 500 })
  }
}

//  POST — التوزيع الفعلي
export async function POST(request: Request) {
  const auth = await requireSalesManager(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const startDate: string | null = body.startDate || null
    const endDate: string | null = body.endDate || null
    const gender: Gender = body.gender || 'all'
    const source: string | null = body.source || null
    const limit: number = Number(body.limit) > 0 ? Math.floor(Number(body.limit)) : 0
    const reps: Array<{ staffId: string; percentage: number }> = Array.isArray(body.reps) ? body.reps : []

    const validReps = reps.filter(r => r.staffId && Number(r.percentage) > 0)
    if (validReps.length === 0) {
      return NextResponse.json({ error: 'اختار سيلز واحد على الأقل بنسبة أكبر من صفر' }, { status: 400 })
    }
    const sumPct = validReps.reduce((s, r) => s + Number(r.percentage), 0)
    if (sumPct <= 0) {
      return NextResponse.json({ error: 'مجموع النسب لازم يكون أكبر من صفر' }, { status: 400 })
    }

    let ids = await getUnassignedLeadIds(startDate, endDate, gender, source)
    if (ids.length === 0) {
      return NextResponse.json({ error: 'مفيش ليدز غير مُسنّين مطابقين للفلتر' }, { status: 400 })
    }

    //  خلط عشوائي عشان التوزيع يبقى عادل (مش مرتّب بالتاريخ)
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
    }

    //  توزيع عدد محدد بس (لو المستخدم حدّد عدد أقل من الإجمالي)
    if (limit > 0 && limit < ids.length) ids = ids.slice(0, limit)

    //  حساب نصيب كل سيلز حسب النسب (weights)
    const total = ids.length
    let assignedSoFar = 0
    const buckets = validReps.map((r, i) => {
      const n = i === validReps.length - 1
        ? total - assignedSoFar
        : Math.round(total * (Number(r.percentage) / sumPct))
      assignedSoFar += n
      return { staffId: r.staffId, ids: [] as string[], count: Math.max(0, n) }
    })

    //  توزيع الـ ids على الـ buckets بالتسلسل
    let cursor = 0
    for (const b of buckets) {
      b.ids = ids.slice(cursor, cursor + b.count)
      cursor += b.count
    }

    //  مين من الليدز عنده متابعة أصلاً (نحدّثها) ومين لأ (ننشئ له متابعة)
    const withFU = await prisma.followUp.findMany({ where: { visitorId: { in: ids } }, select: { visitorId: true } })
    const hasFU = new Set(withFU.map(f => f.visitorId))

    const results: Array<{ staffId: string; assigned: number }> = []
    for (const b of buckets) {
      if (b.ids.length === 0) { results.push({ staffId: b.staffId, assigned: 0 }); continue }
      const updateIds = b.ids.filter(id => hasFU.has(id))
      const createIds = b.ids.filter(id => !hasFU.has(id))
      try {
        if (updateIds.length) {
          await prisma.followUp.updateMany({
            where: { visitorId: { in: updateIds } },
            data: { assignedTo: b.staffId },
          })
        }
        if (createIds.length) {
          await prisma.followUp.createMany({
            data: createIds.map(vid => ({
              visitorId: vid,
              assignedTo: b.staffId,
              notes: 'توزيع تلقائي من إدارة السيلز',
              contacted: false,
              priority: 'medium',
              stage: 'new',
            })),
          })
        }
        results.push({ staffId: b.staffId, assigned: b.ids.length })
      } catch (e) {
        console.error('distribute bucket error:', e)
        results.push({ staffId: b.staffId, assigned: 0 })
      }
    }

    const totalAssigned = results.reduce((s, r) => s + r.assigned, 0)
    return NextResponse.json({ success: true, totalAssigned, results })
  } catch (error) {
    console.error('distribute error:', error)
    return NextResponse.json({ error: 'فشل توزيع الليدز' }, { status: 500 })
  }
}
