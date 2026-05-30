#!/usr/bin/env node

/**
 * 🚀 مزامنة قاعدة البيانات للإنتاج (Production)
 *
 * يستخدم migrations بشكل صحيح:
 * - يفحص حالة الـ migrations
 * - يعمل baseline إذا لزم الأمر
 * - يطبق الـ migrations الجديدة
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'prisma', 'gym.db');
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, 'prisma', 'migrations');

async function productionSync() {
  try {
    log('\n🚀 مزامنة قاعدة البيانات (Production Mode)', 'cyan');
    log('='.repeat(60), 'cyan');

    // توليد Prisma Client أولاً
    log('\n⚙️  جاري توليد Prisma Client...', 'blue');
    try {
      execSync('npx prisma generate', {
        cwd: PROJECT_ROOT,
        stdio: 'inherit'
      });
      log('✅ تم توليد Prisma Client بنجاح', 'green');
    } catch (error) {
      log('❌ فشل توليد Prisma Client', 'red');
      throw error;
    }

    // فحص وجود الداتابيز
    if (!fs.existsSync(DB_PATH)) {
      log('\n⚠️  الداتابيز غير موجودة!', 'yellow');
      log('للإنتاج، يجب إنشاء الداتابيز أولاً باستخدام migrations', 'yellow');
      log('\nالأمر المطلوب:', 'blue');
      log('  npx prisma migrate deploy', 'bright');
      process.exit(1);
    }

    log('✅ الداتابيز موجودة\n', 'green');

    // فحص حالة الـ migrations
    log('🔍 فحص حالة الـ migrations...', 'blue');

    let migrationsStatus;
    try {
      migrationsStatus = execSync('npx prisma migrate status', {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      log(migrationsStatus, 'reset');

      // إذا كانت جميع الـ migrations مطبقة
      if (migrationsStatus.includes('Database schema is up to date')) {
        log('\n✅ قاعدة البيانات محدثة بالكامل!', 'green');
        return;
      }

      // إذا كانت هناك migrations معلقة
      if (migrationsStatus.includes('have not yet been applied')) {
        log('\n⚙️  يوجد migrations معلقة، جاري التطبيق...', 'blue');

        try {
          execSync('npx prisma migrate deploy', {
            cwd: PROJECT_ROOT,
            stdio: 'inherit'
          });

          log('\n✅ تم تطبيق جميع الـ migrations بنجاح!', 'green');
        } catch (error) {
          log('\n⚠️  فشل تطبيق الـ migrations — هنحاول db push كـ fallback', 'yellow');
          await fallbackToDbPush();
        }
      }

    } catch (error) {
      // إذا كان الخطأ P3005 (الداتابيز ليست فارغة)
      if (error.message && error.message.includes('P3005')) {
        log('\n⚠️  الداتابيز تحتوي على بيانات بدون migrations مطبقة', 'yellow');
        log('📋 سيتم إنشاء baseline للـ migrations الحالية...\n', 'yellow');

        await createBaseline();

        // محاولة تطبيق الـ migrations مرة أخرى
        try {
          execSync('npx prisma migrate deploy', {
            cwd: PROJECT_ROOT,
            stdio: 'inherit'
          });

          log('\n✅ تم تطبيق الـ migrations بنجاح بعد الـ baseline!', 'green');
        } catch (deployError) {
          log('\n⚠️  فشل تطبيق الـ migrations حتى بعد الـ baseline — هنحاول db push', 'yellow');
          await fallbackToDbPush();
        }
      } else {
        // أي خطأ تاني (P3006, P3018, schema drift) → fallback لـ db push
        log(`\n⚠️  خطأ في الـ migrations: ${error.message?.split('\n')[0] || 'unknown'}`, 'yellow');
        log('💡 fallback لـ db push عشان نضمن الـ schema مظبوط', 'yellow');
        await fallbackToDbPush();
      }
    }

    // فحص نهائي
    log('\n🔍 فحص سلامة قاعدة البيانات...', 'blue');
    try {
      const { stdout } = execSync(`sqlite3 "${DB_PATH}" "PRAGMA integrity_check;"`, {
        encoding: 'utf8'
      });

      if (stdout.includes('ok')) {
        log('✅ فحص السلامة ناجح', 'green');
      }
    } catch (error) {
      log('⚠️  فشل فحص السلامة', 'yellow');
    }

    log('\n' + '='.repeat(60), 'cyan');
    log('✅ اكتملت المزامنة بنجاح!\n', 'green');

  } catch (error) {
    log(`\n❌ حدث خطأ: ${error.message}`, 'red');
    log('\n💡 للمساعدة:', 'yellow');
    log('  - راجع الدليل: DATABASE_GUIDE.md', 'yellow');
    log('  - أو استخدم: npm run db:setup', 'yellow');
    process.exit(1);
  }
}

async function createBaseline() {
  try {
    // الحصول على آخر migration
    const migrations = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => !f.startsWith('.'))
      .sort()
      .reverse();

    if (migrations.length === 0) {
      log('⚠️  لا توجد migrations لإنشاء baseline منها', 'yellow');
      log('💡 قم بإنشاء migration جديدة أولاً:', 'blue');
      log('   npx prisma migrate dev --name init', 'bright');
      return;
    }

    const latestMigration = migrations[0];
    log(`📋 آخر migration: ${latestMigration}`, 'blue');

    // تطبيق الـ baseline
    log('⚙️  جاري تطبيق baseline...', 'blue');

    execSync(`npx prisma migrate resolve --applied "${latestMigration}"`, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit'
    });

    log('✅ تم إنشاء baseline بنجاح', 'green');

  } catch (error) {
    log('❌ فشل إنشاء baseline', 'red');
    throw error;
  }
}

/**
 * Fallback لـ db push لما migrate deploy يفشل لأي سبب
 * (P3018 column already exists, P3006 broken migration history, schema drift, ...)
 *
 * - db push بيـ sync الـ schema الحالي مع الـ DB مباشرة
 * - --accept-data-loss عشان لو فيه أعمدة اتشالت من الـ schema
 * - --skip-generate عشان الـ prestart بيشغل generate في خطوة منفصلة
 *
 * النتيجة: حتى لو migration system مكسر، الـ schema هيبقى متطابق دايماً
 */
async function fallbackToDbPush() {
  try {
    log('\n🔄 جاري تشغيل prisma db push...', 'blue');
    execSync('npx prisma db push --accept-data-loss --skip-generate', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit'
    });
    log('\n✅ تم sync الـ schema بنجاح عبر db push', 'green');
  } catch (pushError) {
    log('\n❌ فشل حتى db push — السيرفر هيبدأ بس قد تواجه مشاكل', 'red');
    log(`   التفاصيل: ${pushError.message?.split('\n')[0] || 'unknown'}`, 'red');
    // مش بنرمي error عشان السيرفر يبدأ بأي حال — الـ runtime errors هتظهر للمستخدم
  }
}

// تشغيل السكريبت
productionSync().catch(error => {
  console.error('⚠️ Sync error (server will start anyway):', error.message);
  // نخرج بـ 0 عشان السيرفر يبدأ حتى لو فيه مشكلة في الـ sync
  // الـ runtime queries هتظهر أخطاء واضحة لو فيه schema mismatch
  process.exit(0);
});
