#!/usr/bin/env node
/**
 * 🛡️ فحص وإصلاح تلقائي لقاعدة البيانات
 *
 * بيشتغل قبل كل تشغيل للسيستم. التطورات:
 *  1. لو better-sqlite3 native module mismatch (Node update) → نـ rebuild أوتوماتيك
 *  2. لو فيه أعمدة ناقصة من schema (بعد update فيه ALTER TABLE) → نشغّل prisma db push
 *  3. لو في corruption حقيقي → نـ recover عن طريق .recover
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { safeDbPush } = require('./lib/safe-db');

const DB_PATH = path.join(__dirname, '..', 'prisma', 'gym.db');
const BACKUP_PATH = DB_PATH + '.integrity_backup';
const RECOVERED_SQL = DB_PATH + '.recovered.sql';
const NEW_DB_PATH = DB_PATH + '.new';
const PROJECT_ROOT = path.resolve(__dirname, '..');

const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';

function log(msg, color = RESET)  { console.log(`${color}${msg}${RESET}`); }
function info(msg)    { log(`  ℹ️  ${msg}`); }
function success(msg) { log(`  ✅ ${msg}`, GREEN); }
function warn(msg)    { log(`  ⚠️  ${msg}`, YELLOW); }
function error(msg)   { log(`  ❌ ${msg}`, RED); }
function action(msg)  { log(`  🔧 ${msg}`, CYAN); }

function sqlite(db, sql) {
  const result = spawnSync('sqlite3', [db, sql], { encoding: 'utf8' });
  return { stdout: result.stdout?.trim(), stderr: result.stderr?.trim(), code: result.status };
}

/**
 *  محاولة تحميل better-sqlite3.
 *  - لو الـ binding تالف (Node version mismatch)، بنرجّع 'rebuild_needed' عشان نـ rebuild ونحاول تاني
 */
function loadBetterSqlite3() {
  try {
    return require('better-sqlite3');
  } catch (e) {
    const msg = String(e?.message || '');
    if (
      msg.includes('NODE_MODULE_VERSION') ||
      msg.includes('was compiled against a different Node.js') ||
      msg.includes('ERR_DLOPEN_FAILED')
    ) {
      return 'rebuild_needed';
    }
    throw e;
  }
}

/**
 *  rebuild لـ better-sqlite3 لو فشل التحميل بسبب Node version mismatch
 */
function rebuildBetterSqlite3() {
  action('better-sqlite3 module mismatch — جاري rebuild...');
  try {
    execSync('npm rebuild better-sqlite3', {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
    });
    success('تم rebuild بنجاح');
    return true;
  } catch (e) {
    error('فشل rebuild: ' + (e?.message || e));
    return false;
  }
}

/**
 *  Integrity check — بنحاول better-sqlite3 الأول، ولو فشل + الـ CLI مش موجود، بنعتبر الـ DB سليمة
 *  (الـ approach الصح: مش يمسح DB سليمة عشان مش قادرين نفحصها)
 */
function checkIntegrity(dbPath) {
  let Database = loadBetterSqlite3();

  //  لو الـ module محتاج rebuild، نـ rebuild ونعيد التحميل
  if (Database === 'rebuild_needed') {
    if (!rebuildBetterSqlite3()) {
      //  rebuild فشل — نحاول CLI fallback
      const result = sqlite(dbPath, 'PRAGMA integrity_check;');
      if (result.code !== 0) {
        //  مفيش CLI sqlite3 + better-sqlite3 fails → نعتبرها سليمة بدل ما نمسحها بالغلط
        warn('متعذر فحص السلامة (لا better-sqlite3 ولا sqlite3 CLI) — تخطي الفحص');
        return 'unknown';
      }
      return result.stdout === 'ok';
    }
    //  rebuild نجح، نعيد تحميل
    delete require.cache[require.resolve('better-sqlite3')];
    Database = loadBetterSqlite3();
    if (typeof Database !== 'function') {
      warn('فشل إعادة تحميل better-sqlite3 — تخطي الفحص');
      return 'unknown';
    }
  }

  //  استخدام better-sqlite3 للفحص
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      const rows = db.prepare('PRAGMA integrity_check').all();
      return rows.length === 1 && rows[0].integrity_check === 'ok';
    } finally {
      db.close();
    }
  } catch (e) {
    //  لو فشل لأي سبب تاني، نفترض سليمة بدل ما نـ wipe DB سليمة
    warn('تعذّر فحص السلامة: ' + (e?.message || e).slice(0, 100));
    return 'unknown';
  }
}

/**
 *  فحص الـ schema — هل فيه أعمدة موجودة في الـ Prisma client مش موجودة في الـ DB؟
 *  لو نعم، نشغّل `prisma db push` عشان نضيفها أوتوماتيك (مفيش data loss).
 */
function syncSchemaIfNeeded(dbPath) {
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch {
    return; //  تخطّي (الـ rebuild اللي فوق هيتعامل معاها)
  }

  //  جلب أعمدة Member و Permission من DB
  let memberCols = [];
  let permCols = [];
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      memberCols = db.prepare("PRAGMA table_info('Member')").all().map(c => c.name);
      permCols = db.prepare("PRAGMA table_info('Permission')").all().map(c => c.name);
    } finally {
      db.close();
    }
  } catch {
    return;
  }

  //  الحقول اللي مفروض تكون موجودة (ضفناها في sessions أخيرة)
  // ⚠️ مهم: لو أضفت أعمدة جديدة في schema، حدّث القايمة دي عشان الـ auto-sync يكتشفها
  const REQUIRED_MEMBER_COLUMNS = [
    'coachConversionNote',
    'coachConversionNoteAt',
    'coachAssignedAt',
  ];
  const REQUIRED_PERMISSION_COLUMNS = [
    'canViewAllPT',
  ];

  const missingMember = REQUIRED_MEMBER_COLUMNS.filter(c => !memberCols.includes(c));
  const missingPerm = REQUIRED_PERMISSION_COLUMNS.filter(c => !permCols.includes(c));
  const missing = [...missingMember.map(c => `Member.${c}`), ...missingPerm.map(c => `Permission.${c}`)];
  if (missing.length === 0) return;

  warn(`الـ DB ناقصة ${missing.length} عمود: ${missing.join(', ')}`);
  action('جاري تطبيق التحديثات على الـ DB (prisma db push)...');

  // إضافة أعمدة ناقصة لا تحتاج حذف بيانات؛ safeDbPush ياخد نسخة احتياطية أولاً
  // وميحذفش أي بيانات إلا لو ALLOW_DESTRUCTIVE_DB_PUSH=true.
  const ok = safeDbPush({
    dbPath: DB_PATH,
    cwd: PROJECT_ROOT,
    skipGenerate: true,
    logger: (m) => log(`  ${m}`, CYAN),
  });
  if (ok) {
    success('تم تحديث الـ DB — الأعمدة الجديدة اتضافت بدون فقد بيانات');
  } else {
    warn('حاول يدوياً: npx prisma db push --skip-generate');
  }
}

function checkpointWAL(dbPath) {
  const walPath = dbPath + '-wal';
  if (!fs.existsSync(walPath)) return;
  info('فحص الـ WAL file...');
  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath);
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } finally {
      db.close();
    }
  } catch {
    sqlite(dbPath, 'PRAGMA wal_checkpoint(TRUNCATE);');
  }
}

function recoverDB() {
  warn('الداتابيز فيها corruption حقيقي - جاري الإصلاح التلقائي...');

  try {
    fs.copyFileSync(DB_PATH, BACKUP_PATH);
    info('تم إنشاء backup');
  } catch (e) {
    error('فشل إنشاء backup: ' + e.message);
  }

  sqlite(DB_PATH, 'PRAGMA wal_checkpoint(TRUNCATE);');

  info('جاري استخراج البيانات...');
  const dumpResult = spawnSync('sqlite3', [DB_PATH, '.recover'], {
    encoding: 'utf8',
    maxBuffer: 500 * 1024 * 1024,
  });

  if (!dumpResult.stdout || dumpResult.stdout.trim().length === 0) {
    error('فشل استخراج البيانات - الداتابيز تالفة بالكامل');
    if (fs.existsSync(BACKUP_PATH)) {
      fs.copyFileSync(BACKUP_PATH, DB_PATH);
      warn('تم استعادة الـ backup');
    }
    return false;
  }

  fs.writeFileSync(RECOVERED_SQL, dumpResult.stdout);
  const lineCount = dumpResult.stdout.split('\n').length;
  info(`تم استخراج ${lineCount.toLocaleString()} سطر`);

  info('جاري إنشاء داتابيز جديدة...');
  if (fs.existsSync(NEW_DB_PATH)) fs.unlinkSync(NEW_DB_PATH);
  if (fs.existsSync(NEW_DB_PATH + '-shm')) fs.unlinkSync(NEW_DB_PATH + '-shm');
  if (fs.existsSync(NEW_DB_PATH + '-wal')) fs.unlinkSync(NEW_DB_PATH + '-wal');

  spawnSync('sqlite3', [NEW_DB_PATH], {
    input: dumpResult.stdout,
    encoding: 'utf8',
    maxBuffer: 500 * 1024 * 1024,
  });

  if (checkIntegrity(NEW_DB_PATH) !== true) {
    error('فشل إنشاء داتابيز سليمة');
    if (fs.existsSync(NEW_DB_PATH)) fs.unlinkSync(NEW_DB_PATH);
    return false;
  }

  const oldCount = sqlite(DB_PATH, 'SELECT COUNT(*) FROM Member;').stdout;
  const newCount = sqlite(NEW_DB_PATH, 'SELECT COUNT(*) FROM Member;').stdout;

  if (parseInt(newCount) < parseInt(oldCount) * 0.9) {
    warn(`تحذير: عدد الأعضاء تغير (${oldCount} → ${newCount})`);
  }

  for (const ext of ['', '-shm', '-wal']) {
    const f = DB_PATH + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  fs.renameSync(NEW_DB_PATH, DB_PATH);

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

checkpointWAL(DB_PATH);

const integrityResult = checkIntegrity(DB_PATH);

if (integrityResult === true) {
  //  الـ DB سليمة، نتحقق من الـ schema sync
  syncSchemaIfNeeded(DB_PATH);
  success('قاعدة البيانات سليمة ✓');
  process.exit(0);
}

if (integrityResult === 'unknown') {
  //  مش قادرين نفحص لكن منمسحش DB سليمة بالغلط
  //  نحاول schema sync برضوا (لو الـ Prisma client متاح)
  syncSchemaIfNeeded(DB_PATH);
  warn('تخطي فحص السلامة لكن الـ DB موجودة — هنكمّل');
  process.exit(0);
}

//  corruption حقيقي
const fixed = recoverDB();

if (fixed) {
  syncSchemaIfNeeded(DB_PATH);
  success('تم إصلاح قاعدة البيانات بنجاح ✓');
  process.exit(0);
} else {
  error('فشل الإصلاح التلقائي - يرجى التواصل مع الدعم الفني');
  process.exit(1);
}
