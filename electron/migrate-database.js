// migrate-database.js
// Production-safe migration engine for Electron
// Uses better-sqlite3 directly — no npx/prisma CLI needed
// Features: lock file, backup + retention, version tracking, enhanced logging

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

// ==================== Logging ====================

let _logDir = null;

function getLogDir() {
  if (_logDir) return _logDir;
  try {
    // In Electron, app is available
    const { app } = require('electron');
    _logDir = path.join(app.getPath('userData'), 'logs');
  } catch {
    // Fallback for non-Electron (testing)
    _logDir = path.join(process.cwd(), 'logs');
  }
  if (!fs.existsSync(_logDir)) fs.mkdirSync(_logDir, { recursive: true });
  return _logDir;
}

function logMigration(message) {
  const logDir = getLogDir();
  const logFile = path.join(logDir, 'migrations.log');
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  fs.appendFileSync(logFile, line + '\n');
  console.log(line);
}

// ==================== App Version ====================

function getAppVersion() {
  try {
    const { app } = require('electron');
    return app.getVersion();
  } catch {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      return pkg.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }
}

// ==================== Lock File ====================

function acquireLock(dbPath) {
  const lockFile = path.join(path.dirname(dbPath), '.migration.lock');

  if (fs.existsSync(lockFile)) {
    const lockAge = Date.now() - fs.statSync(lockFile).mtimeMs;
    // Stale lock (older than 5 minutes) = previous crash, safe to override
    if (lockAge > 5 * 60 * 1000) {
      logMigration('⚠️ Stale lock detected (>' + Math.round(lockAge / 1000) + 's), overriding');
      fs.unlinkSync(lockFile);
    } else {
      logMigration('🔒 Migration lock held by another process, skipping migration');
      return false;
    }
  }

  fs.writeFileSync(lockFile, JSON.stringify({
    pid: process.pid,
    timestamp: new Date().toISOString()
  }));
  return true;
}

function releaseLock(dbPath) {
  const lockFile = path.join(path.dirname(dbPath), '.migration.lock');
  try {
    if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
  } catch (err) {
    logMigration('⚠️ Failed to release lock: ' + err.message);
  }
}

// ==================== Backup ====================

function createBackup(dbPath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '').replace('T', '_').slice(0, 15);
  const backupPath = dbPath + '.backup.' + timestamp;

  try {
    fs.copyFileSync(dbPath, backupPath);

    // Also backup WAL and SHM files if they exist
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    if (fs.existsSync(walPath)) fs.copyFileSync(walPath, backupPath + '-wal');
    if (fs.existsSync(shmPath)) fs.copyFileSync(shmPath, backupPath + '-shm');

    const sizeMB = (fs.statSync(backupPath).size / 1024 / 1024).toFixed(2);
    logMigration(`💾 Backup created: ${path.basename(backupPath)} (${sizeMB} MB)`);
    return backupPath;
  } catch (err) {
    logMigration('❌ Backup failed: ' + err.message);
    return null;
  }
}

function restoreBackup(dbPath, backupPath) {
  try {
    fs.copyFileSync(backupPath, dbPath);

    // Restore WAL and SHM if backup had them
    const walBackup = backupPath + '-wal';
    const shmBackup = backupPath + '-shm';
    if (fs.existsSync(walBackup)) fs.copyFileSync(walBackup, dbPath + '-wal');
    if (fs.existsSync(shmBackup)) fs.copyFileSync(shmBackup, dbPath + '-shm');

    logMigration('✅ Database restored from backup: ' + path.basename(backupPath));
  } catch (err) {
    logMigration('❌ CRITICAL: Backup restore failed: ' + err.message);
  }
}

function cleanOldBackups(dbPath) {
  const dbDir = path.dirname(dbPath);
  const dbName = path.basename(dbPath);

  try {
    const backups = fs.readdirSync(dbDir)
      .filter(f => f.startsWith(dbName + '.backup.') && !f.endsWith('-wal') && !f.endsWith('-shm'))
      .sort()
      .reverse(); // newest first

    // Keep last 3, delete the rest
    const toDelete = backups.slice(3);
    for (const file of toDelete) {
      const filePath = path.join(dbDir, file);
      fs.unlinkSync(filePath);
      // Also clean associated WAL/SHM
      try { fs.unlinkSync(filePath + '-wal'); } catch {}
      try { fs.unlinkSync(filePath + '-shm'); } catch {}
      logMigration('🗑️ Deleted old backup: ' + file);
    }

    if (toDelete.length > 0) {
      logMigration(`📦 Backup cleanup: kept ${Math.min(backups.length, 3)}, deleted ${toDelete.length}`);
    }
  } catch (err) {
    logMigration('⚠️ Backup cleanup warning: ' + err.message);
  }
}

// ==================== Migration Path Resolution ====================

function getMigrationsDir() {
  const paths = [
    // Production: unpacked from asar
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'prisma', 'migrations'),
    // Production alt: direct in resources
    path.join(process.resourcesPath || '', 'app', 'prisma', 'migrations'),
    // Development
    path.join(process.cwd(), 'prisma', 'migrations'),
    path.join(__dirname, '..', 'prisma', 'migrations')
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) {
      logMigration('📁 Migrations directory: ' + p);
      return p;
    }
  }

  logMigration('⚠️ No migrations directory found');
  return null;
}

// ==================== Checksum (Prisma-compatible) ====================

function calculateChecksum(sql) {
  return crypto.createHash('sha256').update(sql).digest('hex');
}

// ==================== SQL Statement Splitter ====================

/**
 * Split a SQL file into individual statements.
 * Handles multi-line statements, ignores comments and empty lines.
 * Keeps CREATE TRIGGER and other compound statements intact.
 */
function splitSQLStatements(sql) {
  const statements = [];
  let current = '';
  let inTrigger = false;

  const lines = sql.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('--')) continue;

    // Track if we're inside a CREATE TRIGGER (ends with END;)
    if (/^CREATE\s+TRIGGER/i.test(trimmed)) {
      inTrigger = true;
    }

    current += line + '\n';

    // End of trigger
    if (inTrigger && /^END\s*;/i.test(trimmed)) {
      statements.push(current.trim());
      current = '';
      inTrigger = false;
      continue;
    }

    // Normal statement ends with ;
    if (!inTrigger && trimmed.endsWith(';')) {
      const stmt = current.trim();
      if (stmt && stmt !== ';') {
        statements.push(stmt);
      }
      current = '';
    }
  }

  // Any remaining SQL
  const remaining = current.trim();
  if (remaining && remaining !== ';') {
    statements.push(remaining);
  }

  return statements;
}

// ==================== Core Migration Engine ====================

/**
 * Run all pending migrations on the database
 * @param {string} dbPath - Absolute path to the SQLite database file
 * @returns {{ applied: string[], skipped: string[], errors: string[] }}
 */
function runMigrations(dbPath) {
  const startTime = Date.now();
  const appVersion = getAppVersion();
  const result = { applied: [], skipped: [], errors: [] };

  logMigration('');
  logMigration('=== Migration Run Start ===');
  logMigration('App version: ' + appVersion);

  // Validate database exists
  if (!fs.existsSync(dbPath)) {
    logMigration('⚠️ Database not found: ' + dbPath);
    logMigration('=== Migration Run End (no database) ===');
    return result;
  }

  // Acquire lock
  if (!acquireLock(dbPath)) {
    result.errors.push('Could not acquire migration lock — another instance may be running');
    logMigration('=== Migration Run End (locked) ===');
    return result;
  }

  let db = null;

  try {
    // Open database
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Integrity check (non-blocking — log warning but continue)
    try {
      const integrity = db.pragma('integrity_check');
      const checkResult = integrity?.[0]?.integrity_check ?? integrity?.[0] ?? 'unknown';
      if (checkResult !== 'ok' && checkResult !== 'unknown') {
        logMigration('⚠️ Database integrity check returned: ' + JSON.stringify(integrity));
        logMigration('⚠️ Continuing anyway — database may have minor issues');
      } else {
        logMigration('✅ Database integrity check passed');
      }
    } catch (integrityErr) {
      logMigration('⚠️ Could not run integrity check: ' + integrityErr.message);
    }

    // Create _prisma_migrations table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS _prisma_migrations (
        id TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        finished_at TEXT,
        migration_name TEXT NOT NULL,
        logs TEXT,
        rolled_back_at TEXT,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        applied_steps_count INTEGER NOT NULL DEFAULT 1
      );
    `);

    // Create _db_version table
    db.exec(`
      CREATE TABLE IF NOT EXISTS _db_version (
        id INTEGER PRIMARY KEY DEFAULT 1,
        version TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // Get current DB version
    let dbVersionBefore = 'none';
    try {
      const row = db.prepare('SELECT version FROM _db_version WHERE id = 1').get();
      if (row) dbVersionBefore = row.version;
    } catch {}
    logMigration('DB version before: ' + dbVersionBefore);

    // Get applied migrations
    const appliedMigrations = new Set();
    try {
      const rows = db.prepare('SELECT migration_name FROM _prisma_migrations WHERE rolled_back_at IS NULL').all();
      rows.forEach(r => appliedMigrations.add(r.migration_name));
    } catch {}

    // ==================== Baseline Detection ====================
    // If _prisma_migrations is empty BUT the database already has tables,
    // this is an existing database that predates the migration engine.
    // Baseline: mark all existing migrations as applied without running them.
    if (appliedMigrations.size === 0) {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' AND name NOT LIKE '_db_%' AND name NOT LIKE 'sqlite_%'"
      ).all();

      if (tables.length > 0) {
        logMigration('📋 Existing database detected with ' + tables.length + ' tables but no migration history');
        logMigration('📋 Baselining all existing migrations as already applied...');

        // Find migrations directory early for baselining
        const baselineMigrationsDir = getMigrationsDir();
        if (baselineMigrationsDir) {
          const allFolders = fs.readdirSync(baselineMigrationsDir)
            .filter(f => {
              const fullPath = path.join(baselineMigrationsDir, f);
              return fs.statSync(fullPath).isDirectory() && f !== 'migration_lock';
            })
            .sort();

          for (const migrationName of allFolders) {
            const sqlPath = path.join(baselineMigrationsDir, migrationName, 'migration.sql');
            let checksum = 'baseline';
            if (fs.existsSync(sqlPath)) {
              checksum = calculateChecksum(fs.readFileSync(sqlPath, 'utf8'));
            }

            const id = crypto.randomUUID();
            db.prepare(`
              INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count)
              VALUES (?, ?, datetime('now'), ?, 'Baselined — existing database', datetime('now'), 1)
            `).run(id, checksum, migrationName);

            appliedMigrations.add(migrationName);
            logMigration('✅ Baselined: ' + migrationName);
          }

          logMigration('📋 Baseline complete — ' + allFolders.length + ' migrations marked as applied');
        }
      }
    }

    // Find migrations directory
    const migrationsDir = getMigrationsDir();
    if (!migrationsDir) {
      logMigration('✅ No migrations directory — nothing to do');
      // Still update version
      updateDbVersion(db, appVersion);
      db.close();
      releaseLock(dbPath);
      logMigration('=== Migration Run End (no migrations dir) ===');
      return result;
    }

    // Read migration folders (sorted chronologically)
    const migrationFolders = fs.readdirSync(migrationsDir)
      .filter(f => {
        const fullPath = path.join(migrationsDir, f);
        return fs.statSync(fullPath).isDirectory() && f !== 'migration_lock';
      })
      .sort();

    // Filter pending migrations
    const pending = migrationFolders.filter(f => !appliedMigrations.has(f));
    const skippedCount = migrationFolders.length - pending.length;

    logMigration(`📊 Total migrations: ${migrationFolders.length}, Applied: ${skippedCount}, Pending: ${pending.length}`);

    // Add skipped to result
    migrationFolders.filter(f => appliedMigrations.has(f)).forEach(f => result.skipped.push(f));

    if (pending.length === 0) {
      logMigration('✅ Database schema is up to date');
      updateDbVersion(db, appVersion);
      db.close();
      releaseLock(dbPath);
      logMigration('Total time: ' + (Date.now() - startTime) + 'ms');
      logMigration('=== Migration Run End (up to date) ===');
      return result;
    }

    // Create backup before applying migrations
    const backupPath = createBackup(dbPath);
    if (!backupPath) {
      logMigration('❌ Cannot proceed without backup — skipping migrations');
      result.errors.push('Backup creation failed. Migrations skipped for safety.');
      db.close();
      releaseLock(dbPath);
      logMigration('=== Migration Run End (backup failed) ===');
      return result;
    }

    // Apply each pending migration (safe incremental — statement by statement)
    for (const migrationName of pending) {
      const sqlPath = path.join(migrationsDir, migrationName, 'migration.sql');

      if (!fs.existsSync(sqlPath)) {
        logMigration('⚠️ Skipping ' + migrationName + ' — no migration.sql found');
        continue;
      }

      const sql = fs.readFileSync(sqlPath, 'utf8');
      const checksum = calculateChecksum(sql);
      const migrationStart = Date.now();

      logMigration('⚙️ Applying: ' + migrationName + '...');

      // Split SQL into individual statements
      const statements = splitSQLStatements(sql);
      let applied = 0;
      let skippedSafe = 0;
      let fatalError = null;

      for (const stmt of statements) {
        try {
          db.exec(stmt);
          applied++;
        } catch (err) {
          const msg = err.message.toLowerCase();

          // Safe to skip — object already exists from previous partial run or baseline
          if (
            msg.includes('already exists') ||
            msg.includes('duplicate column') ||
            msg.includes('table') && msg.includes('already') ||
            msg.includes('index') && msg.includes('already')
          ) {
            skippedSafe++;
            logMigration('  ↳ Skipped (already exists): ' + err.message);
          } else {
            // Real error — stop this migration
            fatalError = err;
            break;
          }
        }
      }

      if (fatalError) {
        const duration = Date.now() - migrationStart;
        logMigration('❌ Failed: ' + migrationName + ' — ERROR (' + duration + 'ms): ' + fatalError.message);
        logMigration('  ↳ Applied ' + applied + ' statements, skipped ' + skippedSafe + ' (safe), then hit fatal error');
        result.errors.push(migrationName + ': ' + fatalError.message);

        // Restore from backup
        logMigration('🔄 Restoring database from backup...');
        db.close();
        db = null;
        restoreBackup(dbPath, backupPath);

        // Stop applying further migrations
        break;
      }

      // Record in _prisma_migrations
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count)
        VALUES (?, ?, datetime('now'), ?, ?, datetime('now'), 1)
      `).run(id, checksum, migrationName, `Applied: ${applied}, Skipped (safe): ${skippedSafe}`);

      const duration = Date.now() - migrationStart;
      logMigration('✅ Applied: ' + migrationName + ' — SUCCESS (' + duration + 'ms) [' + applied + ' executed, ' + skippedSafe + ' skipped]');
      result.applied.push(migrationName);
    }

    // Update DB version
    if (db) {
      updateDbVersion(db, appVersion);
    }

    // Clean old backups
    cleanOldBackups(dbPath);

  } catch (err) {
    logMigration('❌ Migration engine error: ' + err.message);
    result.errors.push('Migration engine error: ' + err.message);
  } finally {
    // Close database
    if (db) {
      try { db.close(); } catch {}
    }
    // Release lock
    releaseLock(dbPath);
  }

  const totalTime = Date.now() - startTime;
  logMigration('📊 Results — Applied: ' + result.applied.length + ', Skipped: ' + result.skipped.length + ', Errors: ' + result.errors.length);
  logMigration('Total migration time: ' + totalTime + 'ms');
  logMigration('DB version after: ' + appVersion);
  logMigration('=== Migration Run End ===');
  logMigration('');

  return result;
}

// ==================== Version Tracking ====================

function updateDbVersion(db, version) {
  try {
    const existing = db.prepare('SELECT id FROM _db_version WHERE id = 1').get();
    if (existing) {
      db.prepare("UPDATE _db_version SET version = ?, updated_at = datetime('now') WHERE id = 1").run(version);
    } else {
      db.prepare('INSERT INTO _db_version (id, version) VALUES (1, ?)').run(version);
    }
  } catch (err) {
    logMigration('⚠️ Failed to update DB version: ' + err.message);
  }
}

// ==================== Exports ====================

module.exports = { runMigrations };
