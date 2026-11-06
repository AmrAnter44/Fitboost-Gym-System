// lib/memberLookup.ts
// 🔎 رقم عضوية العميل من تليفونه — لإيصالات البي تي (والخدمات اللي مالهاش memberId).
// المطابقة بآخر 10 أرقام (بيتجاهل المسافات / الشرط / +20) وبيدوّر في التليفون الاحتياطي كمان.
// مابترميش خطأ أبداً — لو مالقيناش عضو بترجع null والإيصال بيتعمل عادي.

export async function memberNumberForPhone(db: any, phone: string | null | undefined): Promise<string | null> {
  try {
    const tail = String(phone || '').replace(/\D/g, '').slice(-10)
    if (tail.length !== 10) return null
    const candidates: Array<{ memberNumber: string | null; phone: string | null; backupPhone: string | null; isActive: boolean }> =
      await db.member.findMany({
        where: { OR: [{ phone: { endsWith: tail.slice(-4) } }, { backupPhone: { endsWith: tail.slice(-4) } }] },
        select: { memberNumber: true, phone: true, backupPhone: true, isActive: true },
      })
    const same = (p: string | null) => !!p && p.replace(/\D/g, '').slice(-10) === tail
    const matches = candidates.filter(m => m.memberNumber && (same(m.phone) || same(m.backupPhone)))
    if (matches.length === 0) return null
    //  الأفضلية: نفس التليفون الأساسي + العضو النشط
    matches.sort((a, b) => Number(same(b.phone)) - Number(same(a.phone)) || Number(b.isActive) - Number(a.isActive))
    return matches[0].memberNumber
  } catch {
    return null
  }
}

/**
 * 🧾 الإيصالات القديمة للبي تي (قبل ما نبدأ نسجّل رقم العضوية فيها) — بنضيف رقم العضوية وقت العرض
 * من تليفون العميل، عشان مايبانش رقم البي تي لوحده ويتفهم إنه الـ ID. مابيعدّلش الداتابيز.
 */
export async function withMemberNumbers<T extends { ptNumber?: number | null; itemDetails: string }>(db: any, receipts: T[]): Promise<T[]> {
  try {
    const need: Array<{ r: T; d: any; tail: string }> = []
    for (const r of receipts) {
      if (!r.ptNumber || r.ptNumber < 0) continue
      let d: any
      try { d = JSON.parse(r.itemDetails) } catch { continue }
      if (!d || d.memberNumber) continue
      const tail = String(d.phone || '').replace(/\D/g, '').slice(-10)
      if (tail.length === 10) need.push({ r, d, tail })
    }
    if (need.length === 0) return receipts
    const ends = Array.from(new Set(need.map(n => n.tail.slice(-4))))
    const members: Array<{ memberNumber: string | null; phone: string | null; backupPhone: string | null }> = await db.member.findMany({
      where: { memberNumber: { not: null }, OR: ends.flatMap(e => [{ phone: { endsWith: e } }, { backupPhone: { endsWith: e } }]) },
      select: { memberNumber: true, phone: true, backupPhone: true },
    })
    const byTail = new Map<string, string>()
    for (const m of members) {
      for (const p of [m.phone, m.backupPhone]) {
        const t = String(p || '').replace(/\D/g, '').slice(-10)
        if (t.length === 10 && m.memberNumber && !byTail.has(t)) byTail.set(t, m.memberNumber)
      }
    }
    for (const n of need) {
      const num = byTail.get(n.tail)
      if (num) (n.r as any).itemDetails = JSON.stringify({ ...n.d, memberNumber: num })
    }
    return receipts
  } catch {
    return receipts
  }
}
