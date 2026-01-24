// check-and-migrate.js
// Script to automatically update database schema on app startup
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

/**
 * تحقق من وجود عمود في جدول
 */
function columnExists(db, tableName, columnName) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return columns.some(col => col.name === columnName);
  } catch (error) {
    console.error(`Error checking column ${columnName}:`, error);
    return false;
  }
}

/**
 * تحديث قاعدة البيانات
 */
function migrateDatabase(dbPath) {
  console.log('🔍 Checking database schema...');

  if (!fs.existsSync(dbPath)) {
    console.log('⚠️ Database not found at:', dbPath);
    console.log('ℹ️ Database will be created on first run');
    return;
  }

  try {
    const db = new Database(dbPath);

    // ✅ فحص وجود remainingAmount في جدول PT
    if (!columnExists(db, 'PT', 'remainingAmount')) {
      console.log('📝 Adding remainingAmount column to PT table...');
      db.prepare('ALTER TABLE PT ADD COLUMN remainingAmount REAL NOT NULL DEFAULT 0').run();
      console.log('✅ Migration completed: remainingAmount added to PT table');
    } else {
      console.log('✅ PT.remainingAmount already exists');
    }

    // ✅ فحص وجود SPA Booking permissions في جدول Permission
    const spaPermissions = [
      'canViewSpaBookings',
      'canCreateSpaBooking',
      'canEditSpaBooking',
      'canCancelSpaBooking',
      'canViewSpaReports'
    ];

    for (const permission of spaPermissions) {
      if (!columnExists(db, 'Permission', permission)) {
        console.log(`📝 Adding ${permission} column to Permission table...`);
        db.prepare(`ALTER TABLE Permission ADD COLUMN ${permission} INTEGER NOT NULL DEFAULT 0`).run();
        console.log(`✅ Migration completed: ${permission} added to Permission table`);
      } else {
        console.log(`✅ Permission.${permission} already exists`);
      }
    }

    db.close();
    console.log('✅ Database schema check completed');
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }
}

/**
 * Main function
 */
function main() {
  try {
    // تحديد مسار قاعدة البيانات
    const possiblePaths = [
      // في Production (exe)
      path.join(process.resourcesPath, 'app', 'prisma', 'gym.db'),
      // في Development
      path.join(process.cwd(), 'prisma', 'gym.db'),
      // مسار بديل
      path.join(__dirname, '..', 'prisma', 'gym.db')
    ];

    let dbPath = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        dbPath = testPath;
        console.log('✓ Found database at:', dbPath);
        break;
      }
    }

    if (dbPath) {
      migrateDatabase(dbPath);
    } else {
      console.log('ℹ️ Database not found in any path. Will be created by Prisma.');
    }
  } catch (error) {
    console.error('❌ Migration script error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { migrateDatabase };
