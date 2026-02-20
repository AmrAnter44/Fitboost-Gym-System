/**
 * One-time sync: sets isBanned=true on all Member records
 * that match an existing BannedMember by phone or nationalId.
 *
 * Run: npx sucrase-node scripts/sync-banned.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const bannedList = await prisma.bannedMember.findMany({
    select: { phone: true, nationalId: true }
  })

  console.log(`Found ${bannedList.length} BannedMember records`)

  let updated = 0
  for (const b of bannedList) {
    const ph = b.phone?.trim() || null
    const ni = b.nationalId?.trim() || null
    const orConditions: any[] = []
    if (ph) orConditions.push({ phone: ph })
    if (ni) orConditions.push({ nationalId: ni })
    if (orConditions.length === 0) continue

    const result = await prisma.member.updateMany({
      where: { OR: orConditions },
      data: { isBanned: true }
    })
    updated += result.count
  }

  console.log(`Updated ${updated} Member records → isBanned = true`)
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
