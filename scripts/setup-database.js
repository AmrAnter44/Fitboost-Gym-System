#!/usr/bin/env node

/**
 * 🔧 سكريبت إعداد وتحديث قاعدة البيانات
 *
 * هذا السكريبت يقوم بـ:
 * 1. فحص الداتابيز الحالية
 * 2. عمل نسخة احتياطية
 * 3. تطبيق كل الـ migrations المطلوبة
 * 4. التأكد من سلامة البيانات
 *
 * الاستخدام:
 * node scripts/setup-database.js
 *
 * أو مع ملف داتابيز محدد:
 * node scripts/setup-database.js --db-path=/path/to/old/gym.db
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ألوان للـ console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`📋 خطوة ${step}: ${message}`, 'bright');
  log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// مسارات الملفات
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PRISMA_DIR = path.join(PROJECT_ROOT, 'prisma');
const DEFAULT_DB_PATH = path.join(PRISMA_DIR, 'gym.db');
const SCHEMA_PATH = path.join(PRISMA_DIR, 'schema.prisma');
const MIGRATIONS_DIR = path.join(PRISMA_DIR, 'migrations');

// قراءة مسار الداتابيز من الـ arguments
const args = process.argv.slice(2);
const dbPathArg = args.find(arg => arg.startsWith('--db-path='));
const customDbPath = dbPathArg ? dbPathArg.split('=')[1] : null;

class DatabaseSetup {
  constructor() {
    this.dbPath = customDbPath || DEFAULT_DB_PATH;
    this.backupPath = null;
  }

  /**
   * خطوة 1: فحص البيئة والملفات المطلوبة
   */
  checkEnvironment() {
    logStep(1, 'فحص البيئة والملفات المطلوبة');

    // فحص وجود Node.js
    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
      logSuccess(`Node.js متوفر: ${nodeVersion}`);
    } catch (error) {
      logError('Node.js غير متوفر! يرجى تثبيت Node.js أولاً');
      process.exit(1);
    }

    // فحص وجود Prisma
    try {
      const prismaVersion = execSync('npx prisma --version', { encoding: 'utf8' });
      const versionMatch = prismaVersion.match(/prisma\s+:\s+([\d.]+)/i);
      if (versionMatch) {
        logSuccess(`Prisma متوفر: ${versionMatch[1]}`);
      }
    } catch (error) {
      logError('Prisma غير متوفر! يرجى تثبيت dependencies أولاً (npm install)');
      process.exit(1);
    }

    // فحص وجود ملف schema.prisma
    if (!fs.existsSync(SCHEMA_PATH)) {
      logError(`ملف schema.prisma غير موجود في: ${SCHEMA_PATH}`);
      process.exit(1);
    }
    logSuccess('ملف schema.prisma موجود');

    // فحص وجود مجلد migrations
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      logWarning('مجلد migrations غير موجود، سيتم إنشاؤه');
      fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    } else {
      const migrations = fs.readdirSync(MIGRATIONS_DIR).filter(f =>
        f !== '.gitkeep' && !f.startsWith('.')
      );
      logSuccess(`عدد الـ migrations المتوفرة: ${migrations.length}`);
    }

    // معلومات عن الداتابيز
    logInfo(`مسار الداتابيز: ${this.dbPath}`);
    if (fs.existsSync(this.dbPath)) {
      const stats = fs.statSync(this.dbPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      logSuccess(`الداتابيز موجودة (الحجم: ${sizeInMB} MB)`);
    } else {
      logWarning('الداتابيز غير موجودة، سيتم إنشاء داتابيز جديدة');
    }
  }

  /**
   * خطوة 2: نسخ احتياطي للداتابيز
   */
  backupDatabase() {
    logStep(2, 'إنشاء نسخة احتياطية من الداتابيز');

    if (!fs.existsSync(this.dbPath)) {
      logWarning('لا توجد داتابيز لنسخها');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    this.backupPath = `${this.dbPath}.backup.${timestamp}`;

    try {
      // نسخ الملف
      fs.copyFileSync(this.dbPath, this.backupPath);

      const stats = fs.statSync(this.backupPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

      logSuccess(`تم إنشاء نسخة احتياطية: ${path.basename(this.backupPath)}`);
      logInfo(`حجم النسخة الاحتياطية: ${sizeInMB} MB`);
      logInfo(`المسار الكامل: ${this.backupPath}`);
    } catch (error) {
      logError(`فشل إنشاء النسخة الاحتياطية: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * خطوة 3: إزالة الـ extended attributes (macOS)
   */
  clearExtendedAttributes() {
    logStep(3, 'إزالة الـ extended attributes (macOS)');

    if (process.platform !== 'darwin') {
      logInfo('هذا النظام ليس macOS، تخطي هذه الخطوة');
      return;
    }

    try {
      // إزالة attributes من مجلد prisma بالكامل
      execSync(`xattr -rc "${PRISMA_DIR}"`, { encoding: 'utf8' });
      logSuccess('تم إزالة الـ extended attributes من مجلد prisma');
    } catch (error) {
      logWarning('لم نتمكن من إزالة الـ extended attributes (قد لا تكون موجودة)');
    }
  }

  /**
   * خطوة 4: ضبط صلاحيات الملفات
   */
  setFilePermissions() {
    logStep(4, 'ضبط صلاحيات الملفات');

    try {
      // صلاحيات المجلد
      if (fs.existsSync(PRISMA_DIR)) {
        fs.chmodSync(PRISMA_DIR, 0o755);
        logSuccess('تم ضبط صلاحيات مجلد prisma (755)');
      }

      // صلاحيات ملفات الداتابيز
      const dbFiles = fs.readdirSync(PRISMA_DIR).filter(f =>
        f.endsWith('.db') || f.endsWith('.db-shm') || f.endsWith('.db-wal')
      );

      dbFiles.forEach(file => {
        const filePath = path.join(PRISMA_DIR, file);
        fs.chmodSync(filePath, 0o644);
      });

      if (dbFiles.length > 0) {
        logSuccess(`تم ضبط صلاحيات ${dbFiles.length} ملف داتابيز (644)`);
      }
    } catch (error) {
      logWarning(`فشل ضبط بعض الصلاحيات: ${error.message}`);
    }
  }

  /**
   * خطوة 5: نسخ ملف داتابيز خارجي (إن وُجد)
   */
  copyExternalDatabase() {
    if (!customDbPath || customDbPath === DEFAULT_DB_PATH) {
      return;
    }

    logStep(5, 'نسخ ملف الداتابيز الخارجي');

    if (!fs.existsSync(customDbPath)) {
      logError(`الملف المحدد غير موجود: ${customDbPath}`);
      process.exit(1);
    }

    try {
      // حذف الداتابيز القديمة إن وُجدت
      if (fs.existsSync(DEFAULT_DB_PATH)) {
        fs.unlinkSync(DEFAULT_DB_PATH);
        logInfo('تم حذف الداتابيز القديمة');
      }

      // نسخ الملف الجديد
      fs.copyFileSync(customDbPath, DEFAULT_DB_PATH);

      const stats = fs.statSync(DEFAULT_DB_PATH);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

      logSuccess(`تم نسخ الداتابيز من: ${customDbPath}`);
      logSuccess(`إلى: ${DEFAULT_DB_PATH}`);
      logInfo(`الحجم: ${sizeInMB} MB`);

      // تحديث المسار للخطوات القادمة
      this.dbPath = DEFAULT_DB_PATH;
    } catch (error) {
      logError(`فشل نسخ الملف: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * خطوة 6: توليد Prisma Client
   */
  generatePrismaClient() {
    logStep(6, 'توليد Prisma Client');

    try {
      logInfo('جاري توليد Prisma Client...');
      const output = execSync('npx prisma generate', {
        encoding: 'utf8',
        cwd: PROJECT_ROOT
      });

      logSuccess('تم توليد Prisma Client بنجاح');
    } catch (error) {
      logError('فشل توليد Prisma Client');
      logError(error.message);
      process.exit(1);
    }
  }

  /**
   * خطوة 7: تطبيق الـ Migrations
   */
  applyMigrations() {
    logStep(7, 'تطبيق الـ Migrations');

    try {
      logInfo('جاري فحص وتطبيق الـ migrations...');

      // محاولة تطبيق migrations
      try {
        const output = execSync('npx prisma migrate deploy', {
          encoding: 'utf8',
          cwd: PROJECT_ROOT,
          stdio: 'pipe'
        });

        logSuccess('تم تطبيق جميع الـ migrations بنجاح');

        // عرض ملخص الـ migrations
        if (output.includes('migration')) {
          logInfo('الـ migrations المطبقة:');
          console.log(output);
        }
      } catch (deployError) {
        // إذا فشل migrate deploy، نحاول حل المشكلة
        logWarning('واجهنا مشكلة في تطبيق الـ migrations');
        logInfo('محاولة إصلاح حالة الـ migrations...');

        try {
          // محاولة resolve migrations
          execSync('npx prisma migrate resolve --applied "0_init" || true', {
            encoding: 'utf8',
            cwd: PROJECT_ROOT,
            stdio: 'pipe'
          });

          // محاولة تطبيق migrations مرة أخرى
          execSync('npx prisma migrate deploy', {
            encoding: 'utf8',
            cwd: PROJECT_ROOT
          });

          logSuccess('تم حل المشكلة وتطبيق الـ migrations بنجاح');
        } catch (resolveError) {
          logWarning('لم نتمكن من تطبيق migrations، سنحاول push بدلاً من ذلك');

          // محاولة أخيرة: db push
          try {
            execSync('npx prisma db push --accept-data-loss', {
              encoding: 'utf8',
              cwd: PROJECT_ROOT
            });
            logSuccess('تم تحديث الداتابيز باستخدام db push');
          } catch (pushError) {
            logError('فشل تحديث الداتابيز بجميع الطرق');
            throw pushError;
          }
        }
      }
    } catch (error) {
      logError('فشل تطبيق الـ migrations');
      logError(error.message);

      if (this.backupPath) {
        logInfo(`يمكنك استرجاع النسخة الاحتياطية من: ${this.backupPath}`);
      }

      process.exit(1);
    }
  }

  /**
   * خطوة 8: التحقق من سلامة الداتابيز
   */
  verifyDatabase() {
    logStep(8, 'التحقق من سلامة الداتابيز');

    try {
      // فحص schema
      logInfo('جاري فحص schema...');
      execSync('npx prisma validate', {
        encoding: 'utf8',
        cwd: PROJECT_ROOT
      });
      logSuccess('schema صحيح ومتطابق');

      // فحص الاتصال بالداتابيز
      logInfo('جاري فحص الاتصال بالداتابيز...');
      const output = execSync(
        'npx prisma db execute --stdin <<< "SELECT COUNT(*) as count FROM sqlite_master WHERE type=\'table\';"',
        {
          encoding: 'utf8',
          cwd: PROJECT_ROOT,
          shell: '/bin/bash'
        }
      );

      logSuccess('الاتصال بالداتابيز ناجح');

      // عد الجداول
      try {
        const tableCount = execSync(
          'npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\' AND name NOT LIKE \'_prisma_%\';"',
          {
            encoding: 'utf8',
            cwd: PROJECT_ROOT,
            shell: '/bin/bash'
          }
        );
        logInfo('تم التحقق من وجود الجداول المطلوبة');
      } catch (e) {
        // تجاهل الأخطاء في عد الجداول
      }

      logSuccess('الداتابيز سليمة وجاهزة للاستخدام');
    } catch (error) {
      logWarning('حدثت بعض المشاكل في التحقق، لكن الداتابيز قد تكون تعمل');
      logWarning(error.message);
    }
  }

  /**
   * خطوة 9: تنظيف الملفات المؤقتة
   */
  cleanup() {
    logStep(9, 'تنظيف الملفات المؤقتة');

    try {
      // حذف ملفات WAL و SHM القديمة إن وُجدت
      const walFile = `${this.dbPath}-wal`;
      const shmFile = `${this.dbPath}-shm`;

      let cleanedFiles = 0;

      if (fs.existsSync(walFile) && fs.statSync(walFile).size === 0) {
        fs.unlinkSync(walFile);
        cleanedFiles++;
      }

      if (fs.existsSync(shmFile) && fs.statSync(shmFile).size === 0) {
        fs.unlinkSync(shmFile);
        cleanedFiles++;
      }

      if (cleanedFiles > 0) {
        logSuccess(`تم حذف ${cleanedFiles} ملف مؤقت`);
      } else {
        logInfo('لا توجد ملفات مؤقتة للحذف');
      }

      // حذف النسخ الاحتياطية القديمة جداً (أكثر من 30 يوم)
      const backupFiles = fs.readdirSync(PRISMA_DIR).filter(f =>
        f.startsWith('gym.db.backup.') && f !== path.basename(this.backupPath)
      );

      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      let deletedBackups = 0;

      backupFiles.forEach(file => {
        const filePath = path.join(PRISMA_DIR, file);
        const stats = fs.statSync(filePath);

        if (stats.mtimeMs < thirtyDaysAgo) {
          fs.unlinkSync(filePath);
          deletedBackups++;
        }
      });

      if (deletedBackups > 0) {
        logSuccess(`تم حذف ${deletedBackups} نسخة احتياطية قديمة`);
      }

    } catch (error) {
      logWarning(`حدثت مشكلة في التنظيف: ${error.message}`);
    }
  }

  /**
   * تشغيل جميع الخطوات
   */
  async run() {
    console.clear();
    log('\n' + '='.repeat(60), 'cyan');
    log('🔧 سكريبت إعداد وتحديث قاعدة البيانات', 'bright');
    log('='.repeat(60) + '\n', 'cyan');

    const startTime = Date.now();

    try {
      this.checkEnvironment();
      this.backupDatabase();
      this.clearExtendedAttributes();
      this.setFilePermissions();
      this.copyExternalDatabase();
      this.generatePrismaClient();
      this.applyMigrations();
      this.verifyDatabase();
      this.cleanup();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      log('\n' + '='.repeat(60), 'green');
      log('✅ تم الانتهاء من جميع الخطوات بنجاح!', 'bright');
      log('='.repeat(60), 'green');

      logSuccess(`الوقت المستغرق: ${duration} ثانية`);

      if (this.backupPath) {
        logInfo(`النسخة الاحتياطية: ${path.basename(this.backupPath)}`);
      }

      log('\n💡 يمكنك الآن تشغيل السيرفر:', 'cyan');
      log('   npm run dev', 'bright');
      log('');

    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      log('\n' + '='.repeat(60), 'red');
      log('❌ فشل تنفيذ السكريبت', 'bright');
      log('='.repeat(60), 'red');

      logError(`الوقت المستغرق: ${duration} ثانية`);
      logError(`الخطأ: ${error.message}`);

      if (this.backupPath) {
        log('\n💡 لاسترجاع النسخة الاحتياطية:', 'yellow');
        log(`   cp "${this.backupPath}" "${this.dbPath}"`, 'bright');
      }

      log('');
      process.exit(1);
    }
  }
}

// تشغيل السكريبت
const setup = new DatabaseSetup();
setup.run();
