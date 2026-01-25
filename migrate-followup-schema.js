// Migration script to add new FollowUp columns
// This fixes the "assignedTo column does not exist" error

const { PrismaClient } = require('@prisma/client')

async function migrate() {
  const prisma = new PrismaClient()

  try {
    console.log('🔄 Starting FollowUp schema migration...')

    // Check if columns already exist by trying to query them
    try {
      await prisma.$queryRaw`SELECT assignedTo FROM FollowUp LIMIT 1`
      console.log('✅ Columns already exist. Migration not needed.')
      return
    } catch (error) {
      // Columns don't exist, continue with migration
      console.log('📝 Adding new columns to FollowUp table...')
    }

    // Add new columns to FollowUp table
    await prisma.$executeRaw`
      ALTER TABLE FollowUp ADD COLUMN assignedTo TEXT;
    `
    console.log('✓ Added assignedTo column')

    await prisma.$executeRaw`
      ALTER TABLE FollowUp ADD COLUMN priority TEXT;
    `
    console.log('✓ Added priority column')

    await prisma.$executeRaw`
      ALTER TABLE FollowUp ADD COLUMN stage TEXT DEFAULT 'new';
    `
    console.log('✓ Added stage column')

    await prisma.$executeRaw`
      ALTER TABLE FollowUp ADD COLUMN lastContactedAt DATETIME;
    `
    console.log('✓ Added lastContactedAt column')

    await prisma.$executeRaw`
      ALTER TABLE FollowUp ADD COLUMN contactCount INTEGER DEFAULT 0;
    `
    console.log('✓ Added contactCount column')

    await prisma.$executeRaw`
      ALTER TABLE FollowUp ADD COLUMN archived INTEGER DEFAULT 0;
    `
    console.log('✓ Added archived column')

    await prisma.$executeRaw`
      ALTER TABLE FollowUp ADD COLUMN archivedAt DATETIME;
    `
    console.log('✓ Added archivedAt column')

    await prisma.$executeRaw`
      ALTER TABLE FollowUp ADD COLUMN archivedReason TEXT;
    `
    console.log('✓ Added archivedReason column')

    // Update existing rows to have default values
    await prisma.$executeRaw`
      UPDATE FollowUp SET stage = 'new' WHERE stage IS NULL;
    `

    await prisma.$executeRaw`
      UPDATE FollowUp SET contactCount = 0 WHERE contactCount IS NULL;
    `

    await prisma.$executeRaw`
      UPDATE FollowUp SET archived = 0 WHERE archived IS NULL;
    `

    console.log('✅ Migration completed successfully!')
    console.log('📊 Verifying migration...')

    // Verify the migration
    const count = await prisma.followUp.count()
    console.log(`✅ Found ${count} FollowUp records`)

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('✅ All done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  })
