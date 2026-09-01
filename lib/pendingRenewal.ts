// lib/pendingRenewal.ts
//  🔁 تجديد مجدول (Scheduled Renewal)
//  لما العضو يجدد واشتراكه القديم لسه شغّال، بنخزّن التجديد في أعمدة pendingRenewal* بدل ما نكتب
//  على الاشتراك الحالي. أول ما نوصل لتاريخ بداية التجديد (pendingRenewalStartDate) بيتفعّل تلقائي:
//  التاريخ + المزايا + السعر كلهم مع بعض.
//
//  ملاحظة: الأعمدة الجديدة (pendingRenewal*) بنتعامل معاها بـ raw SQL دايمًا لأن الـ Prisma client
//  ممكن يكون لسه outdated (EPERM على prisma generate وقت ما التطبيق شغّال). بنخزّن التواريخ كـ
//  epoch ms (رقم) عشان المقارنة تبقى واضحة.

import { prisma } from './prisma'

//  بيانات التجديد المؤجل المخزّنة في pendingRenewalData (JSON)
export interface PendingRenewalData {
  subscriptionPrice: number
  remainingAmount?: number
  remainingDueDate?: string | null
  additionalFreePT?: number
  additionalNutrition?: number
  additionalPhysio?: number
  additionalGroupClass?: number
  additionalInBody?: number
  additionalInvitations?: number
  additionalFreezeDays?: number
  renewOfferMaxCheckIns?: number
  renewEntriesOnly?: boolean
  resetBenefits?: boolean
  source?: string | null
  offerId?: string | null
  notes?: string | null
  offerName?: string | null
}

//  يقرأ حالة التجديد المؤجل لعضو (raw SQL) — بيرجّع null لو مفيش
export async function readPendingRenewal(memberId: string): Promise<{
  startDate: Date
  expiryDate: Date | null
  data: PendingRenewalData
} | null> {
  const rows: any = await prisma.$queryRawUnsafe(
    `SELECT pendingRenewalStartDate AS startMs, pendingRenewalExpiryDate AS expiryMs, pendingRenewalData AS data
     FROM Member WHERE id = ? LIMIT 1`,
    memberId
  )
  const row = Array.isArray(rows) ? rows[0] : null
  if (!row || row.startMs == null || !row.data) return null
  let data: PendingRenewalData
  try { data = JSON.parse(row.data) } catch { return null }
  return {
    startDate: new Date(Number(row.startMs)),
    expiryDate: row.expiryMs != null ? new Date(Number(row.expiryMs)) : null,
    data,
  }
}

//  يخزّن تجديد مؤجل لعضو (raw SQL) — بيستخدمه راوت التجديد
export async function writePendingRenewal(
  memberId: string,
  startDate: Date,
  expiryDate: Date | null,
  data: PendingRenewalData,
  tx?: any
): Promise<void> {
  const client = tx || prisma
  await client.$executeRawUnsafe(
    `UPDATE Member SET pendingRenewalStartDate = ?, pendingRenewalExpiryDate = ?, pendingRenewalData = ? WHERE id = ?`,
    startDate.getTime(),
    expiryDate ? expiryDate.getTime() : null,
    JSON.stringify(data),
    memberId
  )
}

//  يلغي التجديد المؤجل لعضو (raw SQL)
export async function clearPendingRenewal(memberId: string, tx?: any): Promise<void> {
  const client = tx || prisma
  await client.$executeRawUnsafe(
    `UPDATE Member SET pendingRenewalStartDate = NULL, pendingRenewalExpiryDate = NULL, pendingRenewalData = NULL WHERE id = ?`,
    memberId
  )
}

//  يفعّل التجديد المؤجل لو وصل ميعاده (now >= startDate). بيرجّع true لو اتفعّل فعلاً.
export async function activatePendingRenewalForMember(memberId: string): Promise<boolean> {
  const pending = await readPendingRenewal(memberId)
  if (!pending) return false

  //  لسه بدري — استنى لحد تاريخ البداية
  if (Date.now() < pending.startDate.getTime()) return false

  const member = await prisma.member.findUnique({ where: { id: memberId } })
  if (!member) return false

  const d = pending.data
  const resetBenefits = !!d.resetBenefits
  const accumulate = (current: number, additional: number) =>
    resetBenefits ? additional : (current + additional)

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const entriesOnly = !!d.renewEntriesOnly
  const expiryMid = pending.expiryDate ? new Date(pending.expiryDate) : null
  if (expiryMid) expiryMid.setHours(0, 0, 0, 0)
  const isActive = entriesOnly ? true : (!expiryMid || expiryMid >= today)

  const maxCheckIns = Number(d.renewOfferMaxCheckIns) || 0
  const currentCheckIns = typeof (member as any).remainingCheckIns === 'number' ? (member as any).remainingCheckIns : 0
  const totalCheckIns: number | null = maxCheckIns > 0 ? accumulate(currentCheckIns, maxCheckIns) : null

  await prisma.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: memberId },
      data: {
        subscriptionPrice: d.subscriptionPrice,
        remainingAmount: d.remainingAmount || 0,
        remainingDueDate: d.remainingDueDate ? new Date(d.remainingDueDate) : null,
        freePTSessions: accumulate(member.freePTSessions || 0, d.additionalFreePT || 0),
        freeNutritionSessions: accumulate(member.freeNutritionSessions || 0, d.additionalNutrition || 0),
        freePhysioSessions: accumulate(member.freePhysioSessions || 0, d.additionalPhysio || 0),
        freeGroupClassSessions: accumulate(member.freeGroupClassSessions || 0, d.additionalGroupClass || 0),
        inBodyScans: accumulate(member.inBodyScans || 0, d.additionalInBody || 0),
        invitations: accumulate(member.invitations || 0, d.additionalInvitations || 0),
        remainingFreezeDays: accumulate(member.remainingFreezeDays || 0, d.additionalFreezeDays || 0),
        startDate: pending.startDate,
        expiryDate: pending.expiryDate,
        isActive,
        remainingCheckIns: totalCheckIns,
        ...(d.notes ? { notes: d.notes } : {}),
        ...(d.source !== undefined ? { source: d.source || null } : {}),
        ...(d.offerId ? { offerId: d.offerId } : {}),
      } as any,
    })
    await clearPendingRenewal(memberId, tx)
  })

  return true
}

//  يفعّل كل التجديدات المؤجلة اللي وصل ميعادها (sweep) — بيرجّع عدد اللي اتفعّل
export async function sweepDuePendingRenewals(): Promise<number> {
  const rows: any = await prisma.$queryRawUnsafe(
    `SELECT id FROM Member WHERE pendingRenewalStartDate IS NOT NULL AND pendingRenewalStartDate <= ?`,
    Date.now()
  )
  const ids: string[] = Array.isArray(rows) ? rows.map((r: any) => r.id) : []
  let n = 0
  for (const id of ids) {
    try { if (await activatePendingRenewalForMember(id)) n++ } catch { /* skip */ }
  }
  return n
}
