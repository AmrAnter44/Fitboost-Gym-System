// One-time fix: convert createdAt from SQLite format to ISO 8601 format
// SQLite CURRENT_TIMESTAMP stores "2026-04-03 20:42:39.000"
// Prisma needs "2026-04-03T20:42:39.000Z"

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function fix() {
  console.log('🔧 Fixing datetime format in Member and Receipt tables...')

  const memberResult = await prisma.$executeRaw`
    UPDATE "Member"
    SET "createdAt" = REPLACE("createdAt", ' ', 'T') || 'Z'
    WHERE "createdAt" NOT LIKE '%T%'
  `
  console.log(`✅ Fixed ${memberResult} Member rows`)

  const receiptResult = await prisma.$executeRaw`
    UPDATE "Receipt"
    SET "createdAt" = REPLACE("createdAt", ' ', 'T') || 'Z'
    WHERE "createdAt" NOT LIKE '%T%'
  `
  console.log(`✅ Fixed ${receiptResult} Receipt rows`)

  // Verify
  const badMembers = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Member" WHERE "createdAt" NOT LIKE '%T%'`
  const badReceipts = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Receipt" WHERE "createdAt" NOT LIKE '%T%'`
  console.log('🔍 Remaining bad rows - Members:', badMembers[0].count, '| Receipts:', badReceipts[0].count)

  await prisma.$disconnect()
  console.log('Done.')
}

fix().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
