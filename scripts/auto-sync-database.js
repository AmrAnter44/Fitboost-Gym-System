#!/usr/bin/env node

/**
 * 🔄 مزامنة تلقائية لقاعدة البيانات
 *
 * يعمل تلقائياً عند بدء السيرفر:
 * - يفحص وجود الداتابيز
 * - يتحقق من وجود جميع الجداول المطلوبة
 * - يطبق التحديثات تلقائياً إذا لزم الأمر
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
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'prisma', 'gym.db');

// الجداول المطلوبة في النظام الحالي
const REQUIRED_TABLES = [
  'Member',
  'PT',
  'Nutrition',
  'Physiotherapy',
  'GroupClass',
  'ClassSchedule',
  'ClassBooking',
  'BannedMember',
  'Staff',
  'User',
  'Offer',
  'Receipt',
  'SystemSettings',
];

async function checkAndSyncDatabase() {
  try {
    log('\n🔍 فحص قاعدة البيانات...', 'cyan');

    // فحص وجود الداتابيز
    if (!fs.existsSync(DB_PATH)) {
      log('⚠️  الداتابيز غير موجودة، سيتم إنشاؤها...', 'yellow');
      execSync('npx prisma db push', { cwd: PROJECT_ROOT, stdio: 'inherit' });
      log('✅ تم إنشاء الداتابيز بنجاح', 'green');
      return;
    }

    // فحص الجداول الموجودة
    let existingTables = [];
    try {
      const output = execSync(
        `sqlite3 "${DB_PATH}" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' ORDER BY name;"`,
        { encoding: 'utf8' }
      );
      existingTables = output.split('\n').filter(t => t.trim());
    } catch (error) {
      log('⚠️  فشل قراءة الجداول من الداتابيز', 'yellow');
      existingTables = [];
    }

    // البحث عن الجداول الناقصة
    const missingTables = REQUIRED_TABLES.filter(table => !existingTables.includes(table));

    if (missingTables.length > 0) {
      log(`\n📋 جداول ناقصة (${missingTables.length}):`, 'yellow');
      missingTables.forEach(table => {
        log(`   - ${table}`, 'yellow');
      });

      log('\n⚙️  جاري تطبيق التحديثات التلقائية...', 'blue');

      // تطبيق التحديثات
      try {
        execSync('npx prisma db push --accept-data-loss --skip-generate', {
          cwd: PROJECT_ROOT,
          stdio: 'inherit'
        });

        log('\n✅ تم تحديث الداتابيز بنجاح!', 'green');
        log(`✅ تمت إضافة ${missingTables.length} جدول جديد`, 'green');

        // إعادة توليد Prisma Client
        log('\n⚙️  جاري توليد Prisma Client...', 'blue');
        execSync('npx prisma generate', { cwd: PROJECT_ROOT, stdio: 'pipe' });
        log('✅ تم توليد Prisma Client', 'green');

      } catch (error) {
        log('\n❌ فشل تطبيق التحديثات', 'yellow');
        log('💡 يمكنك تطبيقها يدوياً باستخدام: npm run db:push', 'yellow');
      }
    } else {
      log('✅ الداتابيز محدثة ومتزامنة', 'green');
    }

    // فحص نهائي
    try {
      const { stdout } = execSync(`sqlite3 "${DB_PATH}" "PRAGMA integrity_check;"`, {
        encoding: 'utf8',
        cwd: PROJECT_ROOT
      });

      if (stdout.includes('ok')) {
        log('✅ فحص السلامة ناجح\n', 'green');
      }
    } catch (error) {
      // تجاهل أخطاء فحص السلامة
    }

  } catch (error) {
    log(`\n⚠️  حدث خطأ أثناء فحص الداتابيز: ${error.message}`, 'yellow');
    log('💡 السيرفر سيبدأ على أي حال، لكن قد تواجه مشاكل', 'yellow');
  }
}

// تشغيل الفحص
checkAndSyncDatabase().catch(error => {
  console.error('Error:', error);
  process.exit(0); // لا نريد إيقاف السيرفر حتى لو فشل الفحص
});
