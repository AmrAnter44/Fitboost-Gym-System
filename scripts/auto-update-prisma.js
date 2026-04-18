#!/usr/bin/env node

/**
 * 🔄 Auto Prisma Update Script
 * يشتغل تلقائياً عند بدء التطبيق
 * يطبق التغييرات على قاعدة البيانات ويولد Prisma Client
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// التأكد من وجود ملف schema.prisma
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
if (!fs.existsSync(schemaPath)) {
  console.log('⚠️ ملف schema.prisma غير موجود');
  process.exit(0);
}

console.log('\n🔄 جاري تحديث Prisma...\n');

try {
  // تطبيق التغييرات على قاعدة البيانات
  console.log('📦 تطبيق التغييرات على قاعدة البيانات...');
  execSync('npx prisma db push --accept-data-loss', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  // توليد Prisma Client
  console.log('\n⚙️ توليد Prisma Client...');
  execSync('npx prisma generate', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  console.log('\n✅ تم تحديث Prisma بنجاح!\n');
} catch (error) {
  console.error('❌ خطأ في تحديث Prisma:', error.message);
  // لا نوقف التطبيق في حالة الخطأ
  console.log('⚠️ سيتم تشغيل التطبيق بدون تحديث Prisma\n');
}
