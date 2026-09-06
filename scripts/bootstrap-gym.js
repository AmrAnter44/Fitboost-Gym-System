#!/usr/bin/env node
/**
 * scripts/bootstrap-gym.js
 * ---------------------------------------------------------------
 * تجهيز داتابيز جيم جديدة فاضية للشغل الحقيقي.
 *
 * بيعمل حاجتين بس — الباقي التطبيق بيعمله لوحده:
 *   1. صف SystemSettings (الـ singleton) باسم الجيم.
 *   2. حساب OWNER واحد بباسورد عشوائي قوي بيتطبع مرة واحدة.
 *
 * دور OWNER بيتخطى فحص الصلاحيات في lib/auth.ts، فمش محتاج صف
 * Permission. باقي الحسابات بتتعمل من الواجهة بعد أول دخول.
 *
 * العدّادات (ReceiptCounter / MemberCounter) مابنعملهاش هنا —
 * التطبيق بيعملها upsert لوحده أول ما يحتاجها.
 *
 * الاستخدام:
 *   node scripts/bootstrap-gym.js --gym="جيم النور"
 *   node scripts/bootstrap-gym.js --gym="..." --email=owner@gym.com
 *   node scripts/bootstrap-gym.js --password='...'   # بدل العشوائي
 *
 * بيرفض يشتغل لو في مستخدمين موجودين، إلا مع --force.
 * ---------------------------------------------------------------
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const argVal = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const FORCE = process.argv.includes('--force');

const GYM_NAME = argVal('gym', 'جيم');
const EMAIL = argVal('email', 'owner@gym.local').trim().toLowerCase();
const NAME = argVal('name', 'مالك النظام');

// باسورد عشوائي مستوفي شروط النظام: حروف + أرقام + رمز، ١٦ خانة.
function makePassword() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const a = 'abcdefghijkmnopqrstuvwxyz';
  const d = '23456789';
  const s = '!@#%^&*+-=?';
  const all = A + a + d + s;
  const pick = (set) => set[crypto.randomInt(set.length)];
  // نضمن نوع من كل فئة الأول، وبعدين نكمّل ونخلط
  const chars = [pick(A), pick(a), pick(d), pick(s)];
  while (chars.length < 16) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function main() {
  const users = await prisma.user.count();
  if (users > 0 && !FORCE) {
    console.log(`✓ في ${users} حساب موجود بالفعل — مش هعمل حاجة (استخدم --force لو متأكد).`);
    return;
  }

  // اسم الجيم بيتحفظ في الـ singleton؛ باقي الأعمدة ليها defaults في السكيما.
  await prisma.systemSettings.upsert({
    where: { id: 'singleton' },
    update: { gymName: GYM_NAME },
    create: { id: 'singleton', gymName: GYM_NAME },
  });

  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log(`✓ حساب ${EMAIL} موجود بالفعل — سايبه زي ما هو.`);
    return;
  }

  const password = argVal('password', null) || makePassword();
  await prisma.user.create({
    data: {
      email: EMAIL,
      name: NAME,
      password: await bcrypt.hash(password, 12),
      role: 'OWNER',
      isActive: true,
    },
  });

  console.log('');
  console.log('  ✅ الداتابيز اتجهّزت.');
  console.log('');
  console.log(`     الجيم    : ${GYM_NAME}`);
  console.log(`     الإيميل  : ${EMAIL}`);
  console.log(`     الباسورد : ${password}`);
  console.log('');
  console.log('  ⚠️  الباسورد ده مش هيتطبع تاني — احفظه دلوقتي وغيّره من');
  console.log('     الإعدادات بعد أول دخول.');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ فشل التجهيز:', e?.message || e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
