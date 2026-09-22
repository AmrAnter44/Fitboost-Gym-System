//  🔁 تجديد PT مؤجّل — الباقة الجديدة تفضل معلّقة لحد ما حصص الباقة الحالية تخلص،
//  وأول ما الرصيد يوصل صفر تتفعّل الباقة المعلّقة تلقائيًا.
//  بنستخدم raw SQL لعمود pendingRenewalData لأن الـ Prisma client ممكن يكون قديم عنه.

export interface PendingRenewal {
  sessions: number
  pricePerSession: number
  startDate?: string | null
  expiryDate?: string | null
  coachName?: string | null
  subscriptionDays?: number | null
  remainingAmount?: number | null //  باقي الباقة الجديدة — يتطبّق وقت التفعيل
  createdAt?: string
}

//  db = prisma أو tx (الاتنين عندهم $queryRawUnsafe / $executeRawUnsafe / pT)
export async function stashPendingRenewal(db: any, ptNumber: number, pending: PendingRenewal): Promise<void> {
  await db.$executeRawUnsafe(
    `UPDATE PT SET pendingRenewalData = ? WHERE ptNumber = ?`,
    JSON.stringify(pending),
    ptNumber
  )
}

//  بيقرا الباقة المعلّقة (لو موجودة) لعرضها في الواجهة — بدون تفعيل
export async function readPendingRenewal(db: any, ptNumber: number): Promise<PendingRenewal | null> {
  try {
    const rows: any = await db.$queryRawUnsafe(
      `SELECT pendingRenewalData FROM PT WHERE ptNumber = ? LIMIT 1`,
      ptNumber
    )
    const raw = Array.isArray(rows) && rows.length ? rows[0].pendingRenewalData : null
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

//  بيفعّل الباقة المعلّقة لو الحصص الحالية خلصت (sessionsRemaining <= 0).
//  بيتنادى بعد أي خصم حصة. آمن يتنادى دايمًا — لو مفيش معلّق أو لسه فيه حصص مايعملش حاجة.
export async function activatePendingPTIfNeeded(db: any, ptNumber: number): Promise<boolean> {
  try {
    const rows: any = await db.$queryRawUnsafe(
      `SELECT sessionsRemaining, remainingAmount, pendingRenewalData FROM PT WHERE ptNumber = ? LIMIT 1`,
      ptNumber
    )
    const row = Array.isArray(rows) && rows.length ? rows[0] : null
    if (!row) return false
    if ((Number(row.sessionsRemaining) || 0) > 0) return false
    if (!row.pendingRenewalData) return false

    let p: PendingRenewal
    try { p = JSON.parse(row.pendingRenewalData) } catch { return false }
    if (!p || !Number(p.sessions)) {
      //  داتا تالفة — نمسحها عشان ما تفضلش عالقة
      await db.$executeRawUnsafe(`UPDATE PT SET pendingRenewalData = NULL WHERE ptNumber = ?`, ptNumber)
      return false
    }

    //  الباقي وقت التفعيل = أي باقي قديم لسه على الاشتراك + باقي الباقة الجديدة
    const currentRemaining = Number(row.remainingAmount) || 0
    const pendingRemaining = Number(p.remainingAmount) || 0
    const newRemainingAmount = Math.round(currentRemaining + pendingRemaining)

    //  تفعيل الباقة المعلّقة على الحقول القياسية (الـ client بيعرفها)
    await db.pT.update({
      where: { ptNumber },
      data: {
        sessionsPurchased: Number(p.sessions),
        sessionsRemaining: Number(p.sessions),
        pricePerSession: Number(p.pricePerSession) || 0,
        remainingAmount: newRemainingAmount,
        ...(p.coachName ? { coachName: p.coachName } : {}),
        ...(p.startDate ? { startDate: new Date(p.startDate) } : {}),
        ...(p.expiryDate ? { expiryDate: new Date(p.expiryDate) } : {}),
      },
    })
    //  مسح المعلّق (raw SQL — عمود جديد)
    await db.$executeRawUnsafe(`UPDATE PT SET pendingRenewalData = NULL WHERE ptNumber = ?`, ptNumber)
    return true
  } catch (e) {
    //  غير حرج — الخصم نفسه اتم، التفعيل هيتأجّل لأقرب خصم/قراءة تانية
    console.error('activatePendingPTIfNeeded error (non-critical):', e)
    return false
  }
}
