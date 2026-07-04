#!/usr/bin/env node
/**
 * يولّد قاعدة بيانات فاضية (schema فقط، بدون أي بيانات) عشان تتحزّم في الـ installer
 * كـ seed للتثبيتات الجديدة. ده بيمنع تسريب بيانات جيم حقيقي داخل نسخ العملاء الجدد.
 *
 * بيتشغّل تلقائياً قبل electron-builder (شوف package.json build:electron).
 * الناتج: prisma/seed-empty.db (مُتجاهَل في git عبر prisma/*.db).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEED = path.join(ROOT, 'prisma', 'seed-empty.db');

// نظّف أي نسخة قديمة أولاً عشان نضمن إنها فاضية بالكامل
for (const suffix of ['', '-wal', '-shm']) {
  try { fs.rmSync(SEED + suffix, { force: true }); } catch { /* ignore */ }
}

console.log('🌱 توليد قاعدة بيانات فاضية للـ installer (schema فقط, بدون بيانات)...');
execSync('npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss', {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: 'file:./seed-empty.db' },
});

if (!fs.existsSync(SEED)) {
  console.error('❌ فشل توليد seed-empty.db');
  process.exit(1);
}

const mb = fs.statSync(SEED).size / 1048576;
console.log(`✅ تم: prisma/seed-empty.db (${mb.toFixed(2)} MB — جداول فقط بدون أي صفوف)`);
