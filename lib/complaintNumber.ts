//  🔢 أرقام الشكاوى — عمود جديد، فبنقراه ونكتبه بـ raw SQL (الـ Prisma client ممكن يكون أقدم من الداتابيز)
import { prisma } from './prisma'

//  الشكاوى اللي ملهاش رقم (القديمة) تاخد أرقام بالترتيب حسب تاريخها، بعد آخر رقم موجود
export async function ensureComplaintNumbers(): Promise<void> {
  const missing: Array<{ id: string }> = await prisma.$queryRawUnsafe(
    'SELECT id FROM Complaint WHERE complaintNumber IS NULL ORDER BY createdAt ASC, id ASC'
  )
  if (missing.length === 0) return
  await prisma.$transaction(async (tx) => {
    const row: Array<{ m: number | bigint | null }> = await tx.$queryRawUnsafe('SELECT MAX(complaintNumber) AS m FROM Complaint')
    let next = Number(row[0]?.m || 0)
    for (const { id } of missing) {
      next += 1
      await tx.$executeRawUnsafe('UPDATE Complaint SET complaintNumber = ? WHERE id = ? AND complaintNumber IS NULL', next, id)
    }
  })
}

//  رقم الشكوى الجديدة = آخر رقم + 1 (في جملة واحدة عشان شكوتين في نفس اللحظة مياخدوش نفس الرقم)
export async function assignComplaintNumber(id: string): Promise<number | null> {
  await prisma.$executeRawUnsafe(
    'UPDATE Complaint SET complaintNumber = (SELECT COALESCE(MAX(complaintNumber), 0) + 1 FROM Complaint) WHERE id = ? AND complaintNumber IS NULL',
    id
  )
  return getComplaintNumber(id)
}

export async function getComplaintNumber(id: string): Promise<number | null> {
  const rows: Array<{ n: number | bigint | null }> = await prisma.$queryRawUnsafe('SELECT complaintNumber AS n FROM Complaint WHERE id = ?', id)
  return rows[0]?.n == null ? null : Number(rows[0].n)
}

export async function getComplaintNumbers(ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (ids.length === 0) return map
  const rows: Array<{ id: string; n: number | bigint | null }> = await prisma.$queryRawUnsafe(
    `SELECT id, complaintNumber AS n FROM Complaint WHERE id IN (${ids.map(() => '?').join(',')})`,
    ...ids
  )
  for (const r of rows) if (r.n != null) map.set(r.id, Number(r.n))
  return map
}
