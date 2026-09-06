// app/api/reports/revenue-by-gender/route.ts
// 🚻 إيرادات الرجالة مقابل السيدات — كل إيرادات الأعضاء حسب الجنس في فترة
//  بنربط الجنس عن طريق memberId أو رقم التليفون (عشان نشمل PT ويوم الاستخدام
//  اللي إيصالاتها مالهاش memberId — بتترتبط برقم الـ PT/التليفون)
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAnyPermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

//  آخر 9 أرقام معنوية للتليفون — للمطابقة رغم اختلاف الصيغة
function phoneSig(phone: string | null | undefined): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '').slice(-9)
}

export async function GET(request: Request) {
  try {
    await requireAnyPermission(request, ['canViewReports', 'canViewFinancials'])

    const { searchParams } = new URL(request.url)
    const startParam = searchParams.get('startDate')
    const endParam = searchParams.get('endDate')

    const where: any = { isCancelled: false }
    if (startParam || endParam) {
      where.createdAt = {}
      if (startParam) where.createdAt.gte = new Date(startParam)
      if (endParam) {
        const endRaw = endParam.length === 10 ? `${endParam}T23:59:59.999` : endParam
        where.createdAt.lte = new Date(endRaw)
      }
    }

    //  خرايط العضو: id→الجنس + تليفون→(الجنس,id) — للربط عن طريق أي منهم
    const members = await prisma.member.findMany({ select: { id: true, phone: true, gender: true } })
    const idToGender = new Map<string, string | null>()
    const sigToMember = new Map<string, { gender: string | null; id: string }>()
    for (const m of members) {
      idToGender.set(m.id, m.gender ?? null)
      const sig = phoneSig(m.phone)
      if (sig) sigToMember.set(sig, { gender: m.gender ?? null, id: m.id })
    }

    const receipts = await prisma.receipt.findMany({
      where,
      select: { amount: true, memberId: true, itemDetails: true, ptNumber: true, dayUseId: true },
    })

    //  خرايط مساعدة: رقم الـ PT → تليفون، و dayUseId → (عضو/تليفون)
    const ptNums = Array.from(new Set(receipts.map(r => r.ptNumber).filter((n): n is number => n != null)))
    const dayUseIds = Array.from(new Set(receipts.map(r => r.dayUseId).filter((s): s is string => !!s)))
    const [pts, dayUses] = await Promise.all([
      ptNums.length ? prisma.pT.findMany({ where: { ptNumber: { in: ptNums } }, select: { ptNumber: true, phone: true } }) : Promise.resolve([]),
      dayUseIds.length ? prisma.dayUseInBody.findMany({ where: { id: { in: dayUseIds } }, select: { id: true, memberId: true, phone: true } }) : Promise.resolve([]),
    ])
    const ptNumToPhone = new Map<number, string>()
    pts.forEach(p => { if (p.phone) ptNumToPhone.set(p.ptNumber, p.phone) })
    const dayUseMap = new Map<string, { memberId: string | null; phone: string | null }>()
    dayUses.forEach(d => dayUseMap.set(d.id, { memberId: d.memberId ?? null, phone: d.phone ?? null }))

    const buckets: Record<string, { revenue: number; members: Set<string> }> = {
      male: { revenue: 0, members: new Set() },
      female: { revenue: 0, members: new Set() },
      unknown: { revenue: 0, members: new Set() },
      unset: { revenue: 0, members: new Set() },
    }

    const bySig = (phone: string | null | undefined) => {
      const sig = phoneSig(phone)
      return sig ? sigToMember.get(sig) : undefined
    }

    for (const r of receipts) {
      let gender: string | null | undefined
      let memberKey: string | undefined

      //  1) الإيصال مربوط بعضو مباشرة
      if (r.memberId && idToGender.has(r.memberId)) {
        gender = idToGender.get(r.memberId)
        memberKey = r.memberId
      }
      //  2) عن طريق التليفون في itemDetails
      if (memberKey === undefined) {
        try {
          const d = JSON.parse(r.itemDetails)
          const hit = bySig(d?.phone)
          if (hit) { gender = hit.gender; memberKey = hit.id }
        } catch { /* itemDetails مش JSON */ }
      }
      //  3) إيصال PT → رقم الـ PT → تليفونه → العضو
      if (memberKey === undefined && r.ptNumber != null) {
        const hit = bySig(ptNumToPhone.get(r.ptNumber))
        if (hit) { gender = hit.gender; memberKey = hit.id }
      }
      //  4) إيصال يوم استخدام → dayUseId → العضو (بالـ memberId أو التليفون)
      if (memberKey === undefined && r.dayUseId) {
        const du = dayUseMap.get(r.dayUseId)
        if (du) {
          if (du.memberId && idToGender.has(du.memberId)) { gender = idToGender.get(du.memberId); memberKey = du.memberId }
          else { const hit = bySig(du.phone); if (hit) { gender = hit.gender; memberKey = hit.id } }
        }
      }

      //  مش متربط بأي عضو → مش إيراد عضو، نتجاهله
      if (memberKey === undefined) continue

      const key = gender === 'male' ? 'male' : gender === 'female' ? 'female' : gender === 'unknown' ? 'unknown' : 'unset'
      buckets[key].revenue += r.amount
      buckets[key].members.add(memberKey)
    }

    const total = buckets.male.revenue + buckets.female.revenue + buckets.unknown.revenue + buckets.unset.revenue
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0)

    return NextResponse.json({
      total,
      male: { revenue: buckets.male.revenue, members: buckets.male.members.size, percentage: pct(buckets.male.revenue) },
      female: { revenue: buckets.female.revenue, members: buckets.female.members.size, percentage: pct(buckets.female.revenue) },
      unknown: { revenue: buckets.unknown.revenue, members: buckets.unknown.members.size, percentage: pct(buckets.unknown.revenue) },
      unset: { revenue: buckets.unset.revenue, members: buckets.unset.members.size, percentage: pct(buckets.unset.revenue) },
    })
  } catch (error: any) {
    console.error('revenue-by-gender error:', error)
    if (error.message === 'Unauthorized' || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }
    return NextResponse.json({ error: 'فشل تحميل التقرير' }, { status: 500 })
  }
}
