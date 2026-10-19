// app/api/reports/full-export/route.ts
// 📊 بيانات «تقرير Excel شامل» من صفحة التقارير — في طلب واحد:
//   receipts → إيصالات الفترة + بيانات العميل (كود العضوية، النوع، المصدر، السيلز، إجمالي/مدفوع/باقي، المدة)
//   expired  → كل الأعضاء اللي اشتراكهم خلص (لحد النهارده)
//   debtors  → كل اللي عليهم باقي + اسم السيلز
//   visitors → كل الزوار + آخر متابعة
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAnyPermission } from '../../../../lib/auth'
import { normalizePaymentMethod } from '../../../../lib/paymentHelpers'
import { countsAsRevenue } from '../../../../lib/revenueFilters'

export const dynamic = 'force-dynamic'

//  آخر 9 أرقام معنوية للتليفون — للمطابقة رغم اختلاف الصيغة (مسافات / 20+)
function phoneSig(phone: string | null | undefined): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '').slice(-9)
}

function parseDetails(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {}
  try {
    const d = JSON.parse(raw)
    return d && typeof d === 'object' ? d : {}
  } catch {
    return {}
  }
}

const num = (v: any): number | null => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v))

//  مدة الاشتراك بالشهور من تاريخ البداية/الانتهاء
function monthsBetween(start: any, end: any): number | null {
  if (!start || !end) return null
  const s = new Date(start), e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (30.44 * 86400000)))
}

export async function GET(request: Request) {
  try {
    const user = await requireAnyPermission(request, ['canViewReports', 'canViewFinancials'])
    //  🔒 التقرير الشامل للأونر/الأدمن بس (فيه تليفونات وفلوس كل الأعضاء والزوار)
    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'التقرير الشامل للأدمن بس' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startParam = searchParams.get('startDate')
    const endParam = searchParams.get('endDate')
    const createdAt: any = {}
    if (startParam) createdAt.gte = new Date(startParam.length === 10 ? `${startParam}T00:00:00` : startParam)
    if (endParam) createdAt.lte = new Date(endParam.length === 10 ? `${endParam}T23:59:59.999` : endParam)

    const [members, staff] = await Promise.all([
      prisma.member.findMany({
        select: {
          id: true, memberNumber: true, name: true, phone: true, backupPhone: true, gender: true, source: true,
          startDate: true, expiryDate: true, subscriptionPrice: true, remainingAmount: true, remainingDueDate: true,
          isActive: true, isFrozen: true, isBanned: true, notes: true, coachId: true, salesStaffId: true,
        },
      }),
      prisma.staff.findMany({ select: { id: true, name: true } }),
    ])
    const staffName = new Map(staff.map(s => [s.id, s.name]))
    const byId = new Map(members.map(m => [m.id, m]))
    const byNumber = new Map(members.filter(m => m.memberNumber).map(m => [String(m.memberNumber), m]))
    const bySig = new Map<string, (typeof members)[number]>()
    for (const m of members) {
      for (const p of [m.phone, m.backupPhone]) {
        const sig = phoneSig(p)
        if (sig && !bySig.has(sig)) bySig.set(sig, m)
      }
    }

    // ── 1) إيصالات الفترة ──
    const receipts = await prisma.receipt.findMany({
      where: Object.keys(createdAt).length ? { createdAt } : undefined,
      orderBy: { receiptNumber: 'asc' },
      select: {
        id: true, receiptNumber: true, type: true, amount: true, paymentMethod: true, itemDetails: true, createdAt: true,
        staffName: true, memberId: true, ptNumber: true, dayUseId: true, isCancelled: true, refundMethod: true,
      },
    })
    const ptNums = Array.from(new Set(receipts.map(r => r.ptNumber).filter((n): n is number => n != null)))
    const dayUseIds = Array.from(new Set(receipts.map(r => r.dayUseId).filter((s): s is string => !!s)))
    const [pts, dayUses] = await Promise.all([
      ptNums.length ? prisma.pT.findMany({ where: { ptNumber: { in: ptNums } }, select: { ptNumber: true, phone: true, clientName: true } }) : Promise.resolve([]),
      dayUseIds.length ? prisma.dayUseInBody.findMany({ where: { id: { in: dayUseIds } }, select: { id: true, memberId: true, phone: true, name: true } }) : Promise.resolve([]),
    ])
    const ptMap = new Map(pts.map(p => [p.ptNumber, p]))
    const dayUseMap = new Map(dayUses.map(d => [d.id, d]))

    const receiptRows = receipts.map(r => {
      const d = parseDetails(r.itemDetails)
      const pt = r.ptNumber != null ? ptMap.get(r.ptNumber) : undefined
      const du = r.dayUseId ? dayUseMap.get(r.dayUseId) : undefined
      const phone: string | null = d.phone || pt?.phone || du?.phone || null
      const member =
        (r.memberId && byId.get(r.memberId)) ||
        (du?.memberId && byId.get(du.memberId)) ||
        (d.memberNumber != null && byNumber.get(String(d.memberNumber))) ||
        (phone && bySig.get(phoneSig(phone))) ||
        null

      //  توزيع المبلغ على وسايل الدفع (يدعم الدفع المتعدد)
      const pay: Record<string, number> = { cash: 0, visa: 0, instapay: 0, wallet: 0, points: 0 }
      try {
        for (const m of normalizePaymentMethod(r.paymentMethod || 'cash', r.amount || 0).methods) {
          const key = String(m.method || 'cash').toLowerCase()
          const k = key === 'card' ? 'visa' : key
          pay[k] = (pay[k] || 0) + (Number(m.amount) || 0)
        }
      } catch {
        pay.cash += r.amount || 0
      }

      const startDate = d.startDate || null
      const expiryDate = d.expiryDate || d.newExpiryDate || null
      return {
        receiptNumber: r.receiptNumber,
        createdAt: r.createdAt,
        type: r.type,
        amount: r.amount || 0,
        pay,
        status: r.isCancelled ? (r.refundMethod ? 'refunded' : 'cancelled') : 'ok',
        countsAsRevenue: countsAsRevenue(r),
        staffName: r.staffName || d.staffName || null,
        clientName: d.memberName || d.clientName || d.name || pt?.clientName || du?.name || member?.name || null,
        phone: phone || member?.phone || null,
        memberId: member?.id || null,
        memberNumber: member?.memberNumber ?? d.memberNumber ?? null,
        gender: member?.gender || null,
        source: member?.source || null,
        salesName: member?.salesStaffId ? staffName.get(member.salesStaffId) || null : (d.salesPersonName || null),
        subscriptionPrice: num(d.subscriptionPrice) ?? num(d.totalPrice) ?? null,
        paidAmount: num(d.paidAmount) ?? r.amount ?? 0,
        remainingAmount: num(d.remainingAmount),
        packageName: d.packageName || d.offerName || null,
        months: monthsBetween(startDate, expiryDate),
        startDate,
        expiryDate,
      }
    })

    // ── 2) منتهي الاشتراك (لحد النهارده) ──
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const memberRow = (m: (typeof members)[number]) => ({
      memberNumber: m.memberNumber, name: m.name, phone: m.phone, backupPhone: m.backupPhone, gender: m.gender,
      source: m.source, startDate: m.startDate, expiryDate: m.expiryDate,
      daysSinceExpiry: m.expiryDate ? Math.max(0, Math.floor((today.getTime() - new Date(m.expiryDate).setHours(0, 0, 0, 0)) / 86400000)) : null,
      subscriptionPrice: m.subscriptionPrice, remainingAmount: m.remainingAmount, remainingDueDate: m.remainingDueDate,
      coachName: m.coachId ? staffName.get(m.coachId) || null : null,
      salesName: m.salesStaffId ? staffName.get(m.salesStaffId) || null : null,
      isFrozen: m.isFrozen, isBanned: m.isBanned, notes: m.notes,
    })
    const expired = members
      .filter(m => m.expiryDate && new Date(m.expiryDate) < today)
      .sort((a, b) => new Date(b.expiryDate!).getTime() - new Date(a.expiryDate!).getTime())
      .map(memberRow)

    // ── 3) عليهم باقي ──
    const debtors = members
      .filter(m => (m.remainingAmount || 0) > 0)
      .sort((a, b) => (b.remainingAmount || 0) - (a.remainingAmount || 0))
      .map(memberRow)

    // ── 4) الزوار + آخر متابعة ──
    const visitorsRaw = await prisma.visitor.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, phone: true, gender: true, source: true, interestedIn: true, status: true, notes: true, createdAt: true,
        followUps: {
          orderBy: { createdAt: 'desc' }, take: 1,
          select: { notes: true, createdAt: true, nextFollowUpDate: true, contacted: true, assignedTo: true },
        },
      },
    })
    const visitors = visitorsRaw.map(v => {
      const f = v.followUps[0]
      return {
        name: v.name, phone: v.phone, gender: v.gender, source: v.source, interestedIn: v.interestedIn, status: v.status,
        notes: v.notes, createdAt: v.createdAt,
        lastFollowUpAt: f?.createdAt || null, lastFollowUpNotes: f?.notes || null, nextFollowUpDate: f?.nextFollowUpDate || null,
        contacted: f?.contacted ?? null,
        salesName: f?.assignedTo ? staffName.get(f.assignedTo) || null : null,
      }
    })

    return NextResponse.json({ receipts: receiptRows, expired, debtors, visitors })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (String(error?.message || '').includes('Forbidden')) return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    console.error('full-export error:', error)
    return NextResponse.json({ error: 'فشل تجهيز التقرير' }, { status: 500 })
  }
}
