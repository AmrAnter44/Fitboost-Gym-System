#!/usr/bin/env node
/**
 * 🛡️ فحص وإصلاح تلقائي لقاعدة البيانات
 * يشتغل قبل كل تشغيل للسيستم - يكتشف الـ corruption ويصلحه أوتوماتيك
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'prisma', 'gym.db');
const BACKUP_PATH = DB_PATH + '.integrity_backup';
const RECOVERED_SQL = DB_PATH + '.recovered.sql';
const NEW_DB_PATH = DB_PATH + '.new';

const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const RESET  = '\x1b[0m';

function log(msg, color = RESET)  { console.log(`${color}${msg}${RESET}`); }
function info(msg)    { log(`  ℹ️  ${msg}`); }
function success(msg) { log(`  ✅ ${msg}`, GREEN); }
function warn(msg)    { log(`  ⚠️  ${msg}`, YELLOW); }
function error(msg)   { log(`  ❌ ${msg}`, RED); }

function sqlite(db, sql) {
  const result = spawnSync('sqlite3', [db, sql], { encoding: 'utf8' });
  return { stdout: result.stdout?.trim(), stderr: result.stderr?.trim(), code: result.status };
}

function checkIntegrity(dbPath) {
  const result = sqlite(dbPath, 'PRAGMA integrity_check;');
  if (result.code !== 0 || result.stderr?.includes('malformed')) return false;
  return result.stdout === 'ok';
}

function checkpointWAL(dbPath) {
  const walPath = dbPath + '-wal';
  if (!fs.existsSync(walPath)) return;
  info('فحص الـ WAL file...');
  sqlite(dbPath, 'PRAGMA wal_checkpoint(FULL);');
}

function recoverDB() {
  warn('الداتابيز فيها corruption - جاري الإصلاح التلقائي...');

  // 1. إنشاء backup
  try {
    fs.copyFileSync(DB_PATH, BACKUP_PATH);
    info('تم إنشاء backup');
  } catch (e) {
    error('فشل إنشاء backup: ' + e.message);
  }

  // 2. WAL checkpoint أولاً
  sqlite(DB_PATH, 'PRAGMA wal_checkpoint(TRUNCATE);');

  // 3. dump البيانات
  info('جاري استخراج البيانات...');
  const dumpResult = spawnSync('sqlite3', [DB_PATH, '.recover'], {
    encoding: 'utf8',
    maxBuffer: 500 * 1024 * 1024, // 500MB
  });

  if (!dumpResult.stdout || dumpResult.stdout.trim().length === 0) {
    error('فشل استخراج البيانات - الداتابيز تالفة بالكامل');
    // استعادة الـ backup لو موجود
    if (fs.existsSync(BACKUP_PATH)) {
      fs.copyFileSync(BACKUP_PATH, DB_PATH);
      warn('تم استعادة الـ backup');
    }
    return false;
  }

  fs.writeFileSync(RECOVERED_SQL, dumpResult.stdout);
  const lineCount = dumpResult.stdout.split('\n').length;
  info(`تم استخراج ${lineCount.toLocaleString()} سطر`);

  // 4. إنشاء داتابيز جديدة نضيفة
  info('جاري إنشاء داتابيز جديدة...');
  if (fs.existsSync(NEW_DB_PATH)) fs.unlinkSync(NEW_DB_PATH);
  if (fs.existsSync(NEW_DB_PATH + '-shm')) fs.unlinkSync(NEW_DB_PATH + '-shm');
  if (fs.existsSync(NEW_DB_PATH + '-wal')) fs.unlinkSync(NEW_DB_PATH + '-wal');

  const importResult = spawnSync('sqlite3', [NEW_DB_PATH], {
    input: dumpResult.stdout,
    encoding: 'utf8',
    maxBuffer: 500 * 1024 * 1024,
  });

  // 5. التحقق من الداتابيز الجديدة
  if (!checkIntegrity(NEW_DB_PATH)) {
    error('فشل إنشاء داتابيز سليمة');
    if (fs.existsSync(NEW_DB_PATH)) fs.unlinkSync(NEW_DB_PATH);
    return false;
  }

  // 6. التحقق من البيانات
  const oldCount = sqlite(DB_PATH, 'SELECT COUNT(*) FROM Member;').stdout;
  const newCount = sqlite(NEW_DB_PATH, 'SELECT COUNT(*) FROM Member;').stdout;

  if (parseInt(newCount) < parseInt(oldCount) * 0.9) {
    warn(`تحذير: عدد الأعضاء تغير (${oldCount} → ${newCount})`);
  }

  // 7. استبدال الداتابيز
  for (const ext of ['', '-shm', '-wal']) {
    const f = DB_PATH + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  fs.renameSync(NEW_DB_PATH, DB_PATH);

  // 8. تنظيف
  if (fs.existsSync(RECOVERED_SQL)) fs.unlinkSync(RECOVERED_SQL);

  success(`تم الإصلاح! الأعضاء: ${newCount}`);
  return true;
}

// ===== التشغيل الرئيسي =====
console.log('\n🛡️  فحص سلامة قاعدة البيانات...');

if (!fs.existsSync(DB_PATH)) {
  info('الداتابيز غير موجودة - سيتم إنشاؤها');
  process.exit(0);
}

// Checkpoint WAL قبل الفحص
checkpointWAL(DB_PATH);

// فحص السلامة
const isHealthy = checkIntegrity(DB_PATH);

if (isHealthy) {
  success('قاعدة البيانات سليمة ✓');
  process.exit(0);
}

// محاولة الإصلاح
const fixed = recoverDB();

if (fixed) {
  success('تم إصلاح قاعدة البيانات بنجاح ✓');
  process.exit(0);
} else {
  error('فشل الإصلاح التلقائي - يرجى التواصل مع الدعم الفني');
  process.exit(1); // وقف التشغيل لو الداتابيز تالفة
}
