// ⬇️ داون جريد الباقة — للعضو اللي عليه باقي وعدّى ميعاده
//  GET  ?memberId=…  → الأهلية + الباقة المقترحة (أقرب باقة لسعر اللي دفعه)
//  POST { memberId, offerId } → ينقله للباقة دي، ويشيل الباقي، وإيصال بصفر للسجل
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { formatDateYMD } from '../../../../lib/dateFormatter'
import { getNextReceiptNumber, runReceiptTransaction } from '../../../../lib/receiptHelpers'
import { getDowngradeInfo } from '../../../../lib/downgrade'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

function deny(e: any) {
  const unauth = e?.message === 'Unauthorized'
  return NextResponse.json({ error: unauth ? 'يجب تسجيل الدخول' : 'ليس لديك صلاحية' }, { status: unauth ? 401 : 403 })
}

export async function GET(request: Request) {
  try { await requirePermission(request, 'canCreateMembers') } catch (e) { return deny(e) }
  const memberId = new URL(request.url).searchParams.get('memberId') || ''
  const info = await getDowngradeInfo(memberId)
  if (!info) return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
  const { member, ...rest } = info
  return NextResponse.json({ ...rest, remainingDueDate: member.remainingDueDate })
}

export async function POST(request: Request) {
  let user
  try { user = await requirePermission(request, 'canCreateMembers') } catch (e) { return deny(e) }
  const body = await request.json().catch(() => null)
  const memberId = String(body?.memberId || '')
  const offerId = String(body?.offerId || '')

  const info = await getDowngradeInfo(memberId)
  if (!info) return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
  if (!info.eligible) return NextResponse.json({ error: 'العضو مش مستحق داون جريد دلوقتي' }, { status: 422 })
  const offer = info.options.find(o => o.id === offerId)
  if (!offer) return NextResponse.json({ error: 'الباقة دي مش متاحة للداون جريد (لازم سعرها ≤ اللي دفعه)' }, { status: 422 })

  const full = await prisma.offer.findUnique({ where: { id: offer.id } }) as any
  const m = await prisma.member.findUnique({ where: { id: memberId }, include: { salesStaff: { select: { name: true } } } }) as any

  //  تاريخ النهاية الجديد من نفس تاريخ البداية — باقة دخلات بس (maxCheckIns>0 و duration<=0) مفيهاش انتهاء
  const entriesOnly = (Number(full.maxCheckIns) || 0) > 0 && (Number(full.duration) || 0) <= 0
  //  🛡️ الداون جريد مايطوّلش الاشتراك: الأقل بين (البداية + مدة الباقة الجديدة) والانتهاء القديم
  const newExpiry: Date | null = entriesOnly ? (m.expiryDate ? new Date(m.expiryDate) : null) : (() => {
    const d = new Date(m.startDate); d.setDate(d.getDate() + full.duration)
    return m.expiryDate && new Date(m.expiryDate) < d ? new Date(m.expiryDate) : d
  })()
  //  المميزات: الأقل بين اللي فاضل معاه واللي في الباقة الجديدة (مايكسبش حاجة من الداون جريد)
  const cap = (cur: unknown, next: unknown) => Math.max(0, Math.min(Number(cur) || 0, Number(next) || 0))
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const itemDetails = {
    memberNumber: m.memberNumber, memberName: m.name, phone: m.phone,
    packageName: full.name,
    isDowngrade: true,
    oldPackagePrice: m.subscriptionPrice,
    oldExpiryDate: m.expiryDate ? formatDateYMD(m.expiryDate) : null,
    paidAmount: info.paid,
    waivedRemaining: info.remaining,
    newPackageName: full.name,
    newPackagePrice: full.price,
    newExpiryDate: newExpiry ? formatDateYMD(newExpiry) : null,
    startDate: m.startDate ? formatDateYMD(m.startDate) : null,
    subscriptionDays: full.duration,
    callsBeforeDowngrade: info.calls,
    staffName: user.name || 'غير محدد',
    salesPersonName: m.salesStaff?.name || null,
  }

  const { receiptNumber } = await runReceiptTransaction(prisma, async (tx) => {
    await tx.member.update({
      where: { id: memberId },
      data: {
        offerId: full.id,
        subscriptionPrice: full.price,
        remainingAmount: 0,
        remainingDueDate: null,
        expiryDate: newExpiry,
        isActive: !newExpiry || newExpiry >= today,
        freePTSessions: cap(m.freePTSessions, full.freePTSessions),
        freeNutritionSessions: cap(m.freeNutritionSessions, full.freeNutritionSessions),
        freePhysioSessions: cap(m.freePhysioSessions, full.freePhysioSessions),
        freeGroupClassSessions: cap(m.freeGroupClassSessions, full.freeGroupClassSessions),
        freePoolSessions: cap(m.freePoolSessions, full.freePoolSessions),
        freePadelSessions: cap(m.freePadelSessions, full.freePadelSessions),
        freeAssessmentSessions: cap(m.freeAssessmentSessions, full.freeAssessmentSessions),
        inBodyScans: cap(m.inBodyScans, full.inBodyScans),
        invitations: cap(m.invitations, full.invitations),
        remainingFreezeDays: cap(m.remainingFreezeDays, full.freezeDays),
        ...((Number(full.maxCheckIns) || 0) > 0
          ? { remainingCheckIns: m.remainingCheckIns == null ? Number(full.maxCheckIns) : cap(m.remainingCheckIns, full.maxCheckIns) }
          : {}),
      } as any,
    })
    const rn = await getNextReceiptNumber(tx)
    await tx.receipt.create({
      data: {
        receiptNumber: rn,
        type: 'داون جريد باكدج',
        amount: 0,
        itemDetails: JSON.stringify(itemDetails),
        paymentMethod: 'cash',
        memberId,
        staffName: user.name || 'غير محدد',
      },
    })
    return { receiptNumber: rn }
  })

  createAuditLog({
    userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
    action: 'UPDATE', resource: 'Member', resourceId: memberId,
    details: { operation: 'Downgrade', memberNumber: m.memberNumber, memberName: m.name, oldPackagePrice: m.subscriptionPrice, newPackage: full.name, newPackagePrice: full.price, paid: info.paid, waivedRemaining: info.remaining, calls: info.calls, receiptNumber },
    ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success',
  })

  return NextResponse.json({ ok: true, receiptNumber, newPackage: full.name, newExpiryDate: newExpiry })
}
