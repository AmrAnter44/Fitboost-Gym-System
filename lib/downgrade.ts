// ⬇️ داون جريد الباقة — للعضو اللي عليه باقي ومدفعوش:
//  1) عليه باقي (remainingAmount > 0)
//  2) عدّى ميعاد الباقي اللي الريسيبشن حدده (remainingDueDate < النهارده)
//  3) عنده اشتراك (حتى لو منتهي) — الداون جريد مش بيطوّل الاشتراك أبداً
//  (عدد الكولات بيظهر للمعلومة بس — مش شرط)
//  الباقة المقترحة = أغلى باقة نشطة سعرها ≤ اللي دفعه فعلاً (سعر الاشتراك − الباقي)
import { prisma } from './prisma'

//  نفس منطق صفحة المتابعات: المحفوظ، ولو قديم (null) بنستنتجه من الملاحظة
export function isCallFollowUp(fu: { contactMethod?: string | null; notes?: string | null }) {
  if (fu.contactMethod === 'call') return true
  if (fu.contactMethod === 'whatsapp') return false
  return !/واتساب|واتس|whatsapp|السكريبت|script/i.test(fu.notes || '')
}

export async function getDowngradeInfo(memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true, phone: true, subscriptionPrice: true, remainingAmount: true, remainingDueDate: true,
      startDate: true, expiryDate: true, offerId: true, isBanned: true,
    } as any,
  }) as any
  if (!member) return null

  const now = new Date()
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0)
  const remaining = Number(member.remainingAmount) || 0
  const paid = Math.max(0, (Number(member.subscriptionPrice) || 0) - remaining)

  //  الكولات: متابعات "كول" متسجلة كـ تواصل، من بداية الاشتراك الحالي
  const visitors = await prisma.visitor.findMany({ where: { phone: member.phone }, select: { id: true } })
  const fus = visitors.length
    ? await prisma.followUp.findMany({
        where: {
          visitorId: { in: visitors.map(v => v.id) },
          contacted: true,
          ...(member.startDate ? { createdAt: { gte: new Date(member.startDate) } } : {}),
        },
        select: { contactMethod: true, notes: true } as any,
      })
    : []
  const calls = (fus as any[]).filter(isCallFollowUp).length

  const checks = {
    hasRemaining: remaining > 0,
    dueDatePassed: !!member.remainingDueDate && new Date(member.remainingDueDate) < startOfToday,
    hasSubscription: !!member.startDate,
    notBanned: !member.isBanned,
  }

  const options = checks.hasRemaining
    ? await prisma.offer.findMany({
        where: { isActive: true, price: { lte: paid }, ...(member.offerId ? { id: { not: member.offerId } } : {}) },
        orderBy: { price: 'desc' },
        select: { id: true, name: true, price: true, duration: true, icon: true },
      })
    : []

  return {
    member,
    paid,
    remaining,
    calls,
    checks,
    options,
    suggested: options[0] || null,
    eligible: Object.values(checks).every(Boolean) && options.length > 0,
  }
}
