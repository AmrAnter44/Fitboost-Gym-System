/**
 * أدوات مشتركة لحماية قاعدة البيانات وقت المزامنة التلقائية.
 *
 * الهدف: منع فقدان البيانات الصامت. `prisma db push --accept-data-loss`
 * بيقدر يحذف أعمدة/جداول عشان يطابق الـ schema. الدوال دي بتضمن:
 *   1. أخذ نسخة احتياطية مؤرّخة قبل أي push ممكن يفقد بيانات.
 *   2. عدم استخدام --accept-data-loss إلا لو المشغّل فعّلها صراحةً
 *      عن طريق ALLOW_DESTRUCTIVE_DB_PUSH=true.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// عدد النسخ الاحتياطية التلقائية اللي نحتفظ بيها قبل الحذف
const MAX_AUTO_BACKUPS = 10;

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * ياخد نسخة احتياطية من ملف قاعدة البيانات (مع ملفات WAL/SHM لو موجودة).
 * بيرجّع مسار النسخة أو null لو الداتابيز مش موجودة.
 */
function backupDatabase(dbPath) {
  if (!dbPath || !fs.existsSync(dbPath)) return null;

  const backupPath = `${dbPath}.autobackup.${ts()}.bak`;
  fs.copyFileSync(dbPath, backupPath);

  // انسخ ملفات WAL/SHM لو موجودة عشان النسخة تبقى متسقة
  for (const suffix of ['-wal', '-shm']) {
    const side = `${dbPath}${suffix}`;
    if (fs.existsSync(side)) {
      try { fs.copyFileSync(side, `${backupPath}${suffix}`); } catch { /* غير حرج */ }
    }
  }

  pruneOldBackups(dbPath);
  return backupPath;
}

/**
 * يمسح أقدم النسخ الاحتياطية التلقائية بحيث نحتفظ بآخر MAX_AUTO_BACKUPS بس.
 */
function pruneOldBackups(dbPath) {
  try {
    const dir = path.dirname(dbPath);
    const base = path.basename(dbPath);
    const backups = fs.readdirSync(dir)
      .filter(f => f.startsWith(`${base}.autobackup.`) && f.endsWith('.bak'))
      .sort();
    while (backups.length > MAX_AUTO_BACKUPS) {
      const oldest = backups.shift();
      try {
        fs.unlinkSync(path.join(dir, oldest));
        for (const suffix of ['-wal', '-shm']) {
          const side = path.join(dir, `${oldest}${suffix}`);
          if (fs.existsSync(side)) fs.unlinkSync(side);
        }
      } catch { /* تجاهل */ }
    }
  } catch { /* غير حرج */ }
}

/**
 * ينفّذ `prisma db push` بشكل آمن.
 *
 * - ياخد نسخة احتياطية أولاً (دايماً، لو الداتابيز موجودة).
 * - افتراضياً بيشغّل push بدون --accept-data-loss، فلو فيه فقدان بيانات
 *   Prisma هتفشل بصوت عالي بدل ما تحذف بيانات.
 * - --accept-data-loss بتتفعّل بس لو ALLOW_DESTRUCTIVE_DB_PUSH=true.
 *
 * @returns {boolean} نجاح العملية
 */
function safeDbPush({ dbPath, cwd, skipGenerate = false, logger = console.log } = {}) {
  const allowDestructive = process.env.ALLOW_DESTRUCTIVE_DB_PUSH === 'true';

  if (dbPath && fs.existsSync(dbPath)) {
    const backup = backupDatabase(dbPath);
    if (backup) logger(`🛟 نسخة احتياطية قبل الـ push: ${path.basename(backup)}`);
  }

  const flags = [
    allowDestructive ? '--accept-data-loss' : null,
    skipGenerate ? '--skip-generate' : null,
  ].filter(Boolean).join(' ');

  try {
    execSync(`npx prisma db push ${flags}`.trim(), { cwd, stdio: 'inherit' });
    return true;
  } catch (err) {
    if (!allowDestructive) {
      logger('❌ فشل db push (غالباً لأنه محتاج حذف بيانات).');
      logger('   البيانات محفوظة كما هي. لو التغيير مقصود شغّل يدوياً بعد نسخة احتياطية:');
      logger('   ALLOW_DESTRUCTIVE_DB_PUSH=true npm run db:push -- --accept-data-loss');
    } else {
      logger(`❌ فشل db push حتى مع --accept-data-loss: ${err.message?.split('\n')[0] || 'unknown'}`);
    }
    return false;
  }
}

module.exports = { backupDatabase, safeDbPush };
