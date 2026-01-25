// Complete Database Migration Script
// Adds all missing tables and columns for v1.1.5+

const { PrismaClient } = require('@prisma/client')

async function migrateDatabase() {
  const prisma = new PrismaClient()

  try {
    console.log('🔄 Starting comprehensive database migration...\n')

    // ==================== 1. AuditLog Table ====================
    console.log('📝 Checking AuditLog table...')
    try {
      await prisma.$queryRaw`SELECT id FROM AuditLog LIMIT 1`
      console.log('  ✅ AuditLog table exists\n')
    } catch (error) {
      console.log('  ⚠️  AuditLog table missing, creating...')
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS AuditLog (
          id TEXT PRIMARY KEY,
          userId TEXT,
          userEmail TEXT,
          userName TEXT,
          userRole TEXT,
          action TEXT NOT NULL,
          resource TEXT NOT NULL,
          resourceId TEXT,
          details TEXT,
          ipAddress TEXT,
          userAgent TEXT,
          status TEXT DEFAULT 'success',
          errorMessage TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `
      console.log('  ✅ AuditLog table created')

      // Create indexes
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_auditlog_userid ON AuditLog(userId)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_auditlog_action ON AuditLog(action)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_auditlog_resource ON AuditLog(resource)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_auditlog_status ON AuditLog(status)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_auditlog_createdat ON AuditLog(createdAt)`
      console.log('  ✅ AuditLog indexes created\n')
    }

    // ==================== 2. ActiveSession Table ====================
    console.log('📝 Checking ActiveSession table...')
    try {
      await prisma.$queryRaw`SELECT id FROM ActiveSession LIMIT 1`
      console.log('  ✅ ActiveSession table exists\n')
    } catch (error) {
      console.log('  ⚠️  ActiveSession table missing, creating...')
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS ActiveSession (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          userEmail TEXT NOT NULL,
          userName TEXT NOT NULL,
          userRole TEXT NOT NULL,
          loginAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          lastActivityAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          ipAddress TEXT,
          userAgent TEXT,
          isActive INTEGER DEFAULT 1
        )
      `
      console.log('  ✅ ActiveSession table created')

      // Create indexes
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_activesession_userid ON ActiveSession(userId)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_activesession_isactive ON ActiveSession(isActive)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_activesession_loginat ON ActiveSession(loginAt)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_activesession_lastactivityat ON ActiveSession(lastActivityAt)`
      console.log('  ✅ ActiveSession indexes created\n')
    }

    // ==================== 3. SpaBooking Table ====================
    console.log('📝 Checking SpaBooking table...')
    try {
      await prisma.$queryRaw`SELECT id FROM SpaBooking LIMIT 1`
      console.log('  ✅ SpaBooking table exists\n')
    } catch (error) {
      console.log('  ⚠️  SpaBooking table missing, creating...')
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS SpaBooking (
          id TEXT PRIMARY KEY,
          memberId TEXT NOT NULL,
          memberName TEXT NOT NULL,
          memberPhone TEXT,
          serviceType TEXT NOT NULL,
          bookingDate DATETIME NOT NULL,
          bookingTime TEXT NOT NULL,
          duration INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          notes TEXT,
          createdBy TEXT NOT NULL,
          createdByUserId TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (memberId) REFERENCES Member(id) ON DELETE CASCADE,
          FOREIGN KEY (createdByUserId) REFERENCES User(id) ON DELETE SET NULL
        )
      `
      console.log('  ✅ SpaBooking table created')

      // Create indexes
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_spabooking_memberid ON SpaBooking(memberId)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_spabooking_bookingdate ON SpaBooking(bookingDate)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_spabooking_status ON SpaBooking(status)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_spabooking_servicetype ON SpaBooking(serviceType)`
      console.log('  ✅ SpaBooking indexes created\n')
    }

    // ==================== 4. FollowUp Columns ====================
    console.log('📝 Checking FollowUp columns...')
    try {
      await prisma.$queryRaw`SELECT assignedTo FROM FollowUp LIMIT 1`
      console.log('  ✅ FollowUp columns exist\n')
    } catch (error) {
      console.log('  ⚠️  FollowUp columns missing, adding...')

      // Add columns one by one (SQLite doesn't support adding multiple columns at once)
      const columnsToAdd = [
        { name: 'assignedTo', type: 'TEXT' },
        { name: 'priority', type: 'TEXT' },
        { name: 'stage', type: 'TEXT DEFAULT "new"' },
        { name: 'lastContactedAt', type: 'DATETIME' },
        { name: 'contactCount', type: 'INTEGER DEFAULT 0' },
        { name: 'archived', type: 'INTEGER DEFAULT 0' },
        { name: 'archivedAt', type: 'DATETIME' },
        { name: 'archivedReason', type: 'TEXT' }
      ]

      for (const col of columnsToAdd) {
        try {
          await prisma.$executeRaw`ALTER TABLE FollowUp ADD COLUMN ${col.name} ${col.type}`
          console.log(`  ✓ Added ${col.name} column`)
        } catch (e) {
          // Column might already exist, skip
        }
      }

      // Update existing rows
      await prisma.$executeRaw`UPDATE FollowUp SET stage = 'new' WHERE stage IS NULL`
      await prisma.$executeRaw`UPDATE FollowUp SET contactCount = 0 WHERE contactCount IS NULL`
      await prisma.$executeRaw`UPDATE FollowUp SET archived = 0 WHERE archived IS NULL`

      // Create indexes
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_followup_assignedto ON FollowUp(assignedTo)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_followup_stage ON FollowUp(stage)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_followup_archived ON FollowUp(archived)`

      console.log('  ✅ FollowUp columns added\n')
    }

    // ==================== 5. FollowUpActivity Table ====================
    console.log('📝 Checking FollowUpActivity table...')
    try {
      await prisma.$queryRaw`SELECT id FROM FollowUpActivity LIMIT 1`
      console.log('  ✅ FollowUpActivity table exists\n')
    } catch (error) {
      console.log('  ⚠️  FollowUpActivity table missing, creating...')
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS FollowUpActivity (
          id TEXT PRIMARY KEY,
          followUpId TEXT NOT NULL,
          activityType TEXT NOT NULL,
          notes TEXT,
          createdBy TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (followUpId) REFERENCES FollowUp(id) ON DELETE CASCADE,
          FOREIGN KEY (createdBy) REFERENCES Staff(id)
        )
      `
      console.log('  ✅ FollowUpActivity table created')

      // Create indexes
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_followupactivity_followupid ON FollowUpActivity(followUpId)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_followupactivity_createdat ON FollowUpActivity(createdAt)`
      console.log('  ✅ FollowUpActivity indexes created\n')
    }

    // ==================== 6. Verify Migration ====================
    console.log('📊 Verifying migration...')

    const counts = {
      members: await prisma.member.count(),
      followUps: await prisma.followUp.count(),
      visitors: await prisma.visitor.count(),
      auditLogs: await prisma.auditLog.count(),
      spaBookings: await prisma.spaBooking.count()
    }

    console.log('\n✅ Migration completed successfully!')
    console.log('\n📊 Database Summary:')
    console.log(`  → Members: ${counts.members}`)
    console.log(`  → FollowUps: ${counts.followUps}`)
    console.log(`  → Visitors: ${counts.visitors}`)
    console.log(`  → AuditLogs: ${counts.auditLogs}`)
    console.log(`  → SpaBookings: ${counts.spaBookings}`)

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run migration
migrateDatabase()
  .then(() => {
    console.log('\n✅ All migrations completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error)
    process.exit(1)
  })
