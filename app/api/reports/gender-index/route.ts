// app/api/reports/gender-index/route.ts
// 🚻 فهرس الجنس لفلتر التقارير: عدد الأعضاء + جنس كل إيصال في الفترة + جنس كل رقم تليفون
//  الربط بنفس ترتيب revenue-by-gender: العضو ← تليفون الإيصال ← الـ PT ← يوم الاستخدام
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAnyPermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

type Bucket = 'male' | 'female' | 'unknown'
const bucketOf = (g: string | null | undefined): Bucket => (g === 'male' || g === 'female' ? g : 'unknown')
const phoneSig = (phone: string | null | undefined) => (phone ? phone.replace(/\D/g, '').slice(-9) : '')

//  YYYY-MM-DD بالتوقيت المحلي + يوم زيادة من كل ناحية (الواجهة هي اللي بتحدد الفترة بالظبط)
function localDay(s: string | null, shift: number): Date | null {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})/.exec(s) : null
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + shift) : null
}

export async function GET(request: Request) {
  try {
    await requireAnyPermission(request, ['canViewReports', 'canViewFinancials'])
    const { searchParams } = new URL(request.url)
    const from = localDay(searchParams.get('startDate'), -1)
    const to = localDay(searchParams.get('endDate'), 2)

    const members = await prisma.member.findMany({ select: { id: true, phone: true, gender: true } })
    const counts = { all: members.length, male: 0, female: 0, unknown: 0 }
    const idToBucket = new Map<string, Bucket>()
    const phones: Record<string, Bucket> = {}
    for (const m of members) {
      const b = bucketOf(m.gender)
      counts[b]++
      idToBucket.set(m.id, b)
      const sig = phoneSig(m.phone)
      if (sig) phones[sig] = b
    }

    const where: any = {}
    if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) }
    const rows = await prisma.receipt.findMany({
      where,
      select: { id: true, memberId: true, itemDetails: true, ptNumber: true, moreNumber: true, dayUseId: true },
    })

    const ptNums = Array.from(new Set(rows.map(r => r.ptNumber).filter((n): n is number => n != null)))
    const moreNums = Array.from(new Set(rows.map(r => r.moreNumber).filter((n): n is number => n != null)))
    const dayUseIds = Array.from(new Set(rows.map(r => r.dayUseId).filter((s): s is string => !!s)))
    const [pts, mores, dayUses] = await Promise.all([
      ptNums.length ? prisma.pT.findMany({ where: { ptNumber: { in: ptNums } }, select: { ptNumber: true, phone: true } }) : Promise.resolve([]),
      moreNums.length ? prisma.more.findMany({ where: { moreNumber: { in: moreNums } }, select: { moreNumber: true, phone: true } }) : Promise.resolve([]),
      dayUseIds.length ? prisma.dayUseInBody.findMany({ where: { id: { in: dayUseIds } }, select: { id: true, memberId: true, phone: true } }) : Promise.resolve([]),
    ])
    const ptPhone = new Map(pts.map(p => [p.ptNumber, p.phone]))
    const morePhone = new Map(mores.map(m => [m.moreNumber, m.phone]))
    const dayUseById = new Map(dayUses.map(d => [d.id, d]))
    const byPhone = (p: string | null | undefined): Bucket | undefined => phones[phoneSig(p)]

    const receipts: Record<string, Bucket> = {}
    for (const r of rows) {
      let b: Bucket | undefined = r.memberId ? idToBucket.get(r.memberId) : undefined
      if (!b) { try { b = byPhone(JSON.parse(r.itemDetails)?.phone) } catch { /* itemDetails مش JSON */ } }
      if (!b && r.ptNumber != null) b = byPhone(ptPhone.get(r.ptNumber))
      if (!b && r.moreNumber != null) b = byPhone(morePhone.get(r.moreNumber))
      if (!b && r.dayUseId) {
        const d = dayUseById.get(r.dayUseId)
        b = (d?.memberId ? idToBucket.get(d.memberId) : undefined) ?? byPhone(d?.phone)
      }
      receipts[r.id] = b ?? 'unknown'
    }

    return NextResponse.json({ counts, phones, receipts })
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || String(error?.message || '').includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }
    console.error('gender-index error:', error)
    return NextResponse.json({ error: 'فشل التحميل' }, { status: 500 })
  }
}
