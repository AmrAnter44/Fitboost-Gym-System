#!/usr/bin/env node

/**
 * 🔄 Auto Prisma Update Script
 * يشتغل تلقائياً عند بدء التطبيق
 * يطبق التغييرات على قاعدة البيانات ويولد Prisma Client
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { safeDbPush } = require('./lib/safe-db');

const PROJECT_ROOT = path.join(__dirname, '..');

// التأكد من وجود ملف schema.prisma
const schemaPath = path.join(PROJECT_ROOT, 'prisma', 'schema.prisma');
if (!fs.existsSync(schemaPath)) {
  console.log('⚠️ ملف schema.prisma غير موجود');
  process.exit(0);
}

console.log('\n🔄 جاري تحديث Prisma...\n');

try {
  // تطبيق التغييرات على قاعدة البيانات (بأمان: نسخة احتياطية أولاً، بدون حذف بيانات
  // إلا لو ALLOW_DESTRUCTIVE_DB_PUSH=true)
  console.log('📦 تطبيق التغييرات على قاعدة البيانات...');
  safeDbPush({
    dbPath: path.join(PROJECT_ROOT, 'prisma', 'gym.db'),
    cwd: PROJECT_ROOT,
  });

  // توليد Prisma Client
  console.log('\n⚙️ توليد Prisma Client...');
  execSync('npx prisma generate', {
    stdio: 'inherit',
    cwd: PROJECT_ROOT
  });

  console.log('\n✅ تم تحديث Prisma بنجاح!\n');
} catch (error) {
  console.error('❌ خطأ في تحديث Prisma:', error.message);
  // لا نوقف التطبيق في حالة الخطأ
  console.log('⚠️ سيتم تشغيل التطبيق بدون تحديث Prisma\n');
}
