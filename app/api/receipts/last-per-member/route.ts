// app/api/receipts/last-per-member/route.ts
// آخر إيصال عضوية لكل عضو (لبادج كروت الأعضاء) — استعلام تجميعي واحد
// بدل تحميل كل الإيصالات وفلترتها في المتصفح
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const rows = await prisma.$queryRaw<
      Array<{ memberId: string; receiptNumber: number; amount: number; createdAt: bigint }>
    >`
      SELECT memberId, receiptNumber, amount, createdAt FROM (
        SELECT memberId, receiptNumber, amount, createdAt,
               ROW_NUMBER() OVER (PARTITION BY memberId ORDER BY createdAt DESC) AS rn
        FROM Receipt
        WHERE memberId IS NOT NULL
          AND type IN ('Member', 'membershipRenewal', 'تجديد عضويه')
      ) WHERE rn = 1
    `

    const map: Record<string, { receiptNumber: number; amount: number; createdAt: string }> = {}
    for (const row of rows) {
      map[row.memberId] = {
        receiptNumber: Number(row.receiptNumber),
        amount: Number(row.amount),
        createdAt: new Date(Number(row.createdAt)).toISOString(),
      }
    }

    return NextResponse.json(map)
  } catch (error) {
    console.error('Error fetching last receipts per member:', error)
    return NextResponse.json({}, { status: 200 }) // البادج اختياري — فشله لا يكسر الصفحة
  }
}
