#!/usr/bin/env node
/**
 * 🎭 يولّد قاعدة بيانات تجريبية مليانة بيانات وهمية للنسخة التجريبية (البيتا).
 *
 * الهدف: حد يفتح اللينك ويلاقي السيستم "عايش" — أعضاء، إيصالات، حضور، PT،
 * مصاريف، زوار، موظفين — من غير أي بيانات جيم حقيقي.
 *
 * الاستخدام:
 *   node scripts/seed-demo-data.js                      -> prisma/demo.db بـ 120 عضو
 *   node scripts/seed-demo-data.js --members=300
 *   node scripts/seed-demo-data.js --out=prisma/gym.db --force
 *   node scripts/seed-demo-data.js --password=mypass    -> باسورد حسابات الديمو
 *
 * الناتج ديتيرمينيستك (نفس البذرة = نفس البيانات) عشان الـ reset اليومي يرجّع
 * نفس النسخة بالظبط.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------- args
const args = process.argv.slice(2);
const argVal = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : def;
};

const OUT_REL = argVal('out', 'prisma/demo.db');
const OUT_ABS = path.isAbsolute(OUT_REL) ? OUT_REL : path.join(ROOT, OUT_REL);
const MEMBER_COUNT = parseInt(argVal('members', '120'), 10);
const DEMO_PASSWORD = argVal('password', 'demo1234');

// ---------------------------------------------------------------- rng (deterministic)
let _seed = 20260820;
function rnd() {
  _seed |= 0; _seed = (_seed + 0x6d2b79f5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const money = (min, max, step = 50) => Math.round(int(min, max) / step) * step;

// تاريخ ثابت كنقطة صفر عشان الناتج ما يتغيرش بين التشغيلات في نفس اليوم
const NOW = new Date();
NOW.setHours(12, 0, 0, 0);
const day = 86400000;
const daysAgo = (n, h = 10, m = 0) => {
  const d = new Date(NOW.getTime() - n * day);
  d.setHours(h, m, 0, 0);
  return d;
};
const daysAhead = (n, h = 10, m = 0) => daysAgo(-n, h, m);

// ---------------------------------------------------------------- fake arabic identities
const FIRST_M = ['أحمد', 'محمد', 'محمود', 'مصطفى', 'كريم', 'عمرو', 'يوسف', 'خالد', 'طارق', 'إسلام',
  'حسن', 'عبدالله', 'زياد', 'مروان', 'شريف', 'باسم', 'هيثم', 'وليد', 'سامح', 'رامي'];
const FIRST_F = ['سارة', 'منى', 'ندى', 'هبة', 'مريم', 'دينا', 'ياسمين', 'نورهان', 'شيماء', 'إيمان',
  'رنا', 'لمياء', 'أميرة', 'فاطمة', 'حبيبة', 'سلمى', 'نيرة', 'رحمة'];
const LAST = ['السيد', 'عبدالرحمن', 'فتحي', 'الشناوي', 'زكي', 'العدل', 'رمضان', 'الجندي', 'سليم',
  'عبدالعزيز', 'الشربيني', 'منصور', 'حجازي', 'الديب', 'شعبان', 'قنديل', 'الطوخي', 'بدوي'];

const usedPhones = new Set();
function fakePhone() {
  for (;;) {
    const p = '01' + pick(['0', '1', '2', '5']) + String(int(10000000, 99999999));
    if (!usedPhones.has(p)) { usedPhones.add(p); return p; }
  }
}
const fakeName = (female = chance(0.35)) =>
  `${pick(female ? FIRST_F : FIRST_M)} ${pick(FIRST_M)} ${pick(LAST)}`;

// ---------------------------------------------------------------- safety guard
// حماية: منمسحش قاعدة بيانات شغالة بالغلط. الكتابة فوق ملف موجود لازم --force.
if (fs.existsSync(OUT_ABS) && !args.includes('--force')) {
  console.error(`❌ الملف موجود بالفعل: ${OUT_REL}`);
  console.error('   لو متأكد إنك عايز تمسحه وتولّد داتا تجريبية مكانه، ضيف --force');
  process.exit(1);
}

// ---------------------------------------------------------------- db bootstrap
for (const suffix of ['', '-wal', '-shm', '-journal']) {
  try { fs.rmSync(OUT_ABS + suffix, { force: true }); } catch { /* ignore */ }
}

console.log(`🧱 توليد الـ schema في ${OUT_REL} ...`);
execSync('npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss', {
  cwd: ROOT,
  stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, DATABASE_URL: `file:${OUT_ABS}` },
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${OUT_ABS}` } } });

// ---------------------------------------------------------------- seed
async function main() {
  console.log('🎭 توليد البيانات التجريبية ...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ---- إعدادات النظام
  await prisma.systemSettings.create({
    data: {
      id: 'singleton',
      gymName: 'FitBoost Demo',
      // اللون الأساسي للسيستم (الأصفر بتاع FitBoost) — بيتخزّن هنا عشان يفضل
      // ثابت بعد كل تصفير للداتا التجريبية بدل ما يترجع فاضي كل مرة
      primaryColor: '#fbe003',
      primaryTextColor: 'auto',
      pointsEnabled: true,
      remainingEnabled: true,
      ptFreezeEnabled: true,
      ptUpgradeEnabled: true,
      showWebsiteOnReceipts: false,
      cloudBackupEnabled: false,
      salesDailyCallTarget: 30,
    },
  });

  // ---- تصنيفات المصاريف
  const CATEGORIES = ['مرتبات', 'كهرباء ومياه', 'صيانة', 'نظافة', 'تسويق', 'مشتريات بار', 'إيجار'];
  await prisma.expenseCategory.createMany({
    data: CATEGORIES.map((name) => ({ id: `demo_cat_${CATEGORIES.indexOf(name)}`, name })),
  });

  // ---- الباقات (Offers)
  const OFFERS = [
    { name: 'شهر', duration: 30, price: 700, freePTSessions: 1, inBodyScans: 1, invitations: 1, freezeDays: 3, icon: '📅' },
    { name: '3 شهور', duration: 90, price: 1800, freePTSessions: 2, inBodyScans: 2, invitations: 2, freezeDays: 7, icon: '🗓️' },
    { name: '6 شهور', duration: 180, price: 3200, freePTSessions: 4, inBodyScans: 4, invitations: 4, freezeDays: 14, icon: '📆' },
    { name: 'سنة', duration: 365, price: 5500, freePTSessions: 8, inBodyScans: 6, invitations: 8, freezeDays: 30, icon: '🏆' },
    { name: '12 حصة', duration: 60, price: 600, maxCheckIns: 12, icon: '🎟️' },
  ];
  const offers = [];
  for (let i = 0; i < OFFERS.length; i++) {
    offers.push(await prisma.offer.create({
      data: { id: `demo_offer_${i}`, minPrice: Math.round(OFFERS[i].price * 0.85), ...OFFERS[i] },
    }));
  }

  // ---- باقات الخدمات
  await prisma.servicePackage.createMany({
    data: [
      { id: 'demo_sp_1', name: 'PT - 8 حصص', serviceType: 'PT', sessions: 8, price: 2400, durationDays: 30 },
      { id: 'demo_sp_2', name: 'PT - 12 حصة', serviceType: 'PT', sessions: 12, price: 3300, durationDays: 45 },
      { id: 'demo_sp_3', name: 'PT - 24 حصة', serviceType: 'PT', sessions: 24, price: 6000, durationDays: 90 },
      { id: 'demo_sp_4', name: 'تغذية - شهر', serviceType: 'Nutrition', sessions: 4, price: 1200, durationDays: 30 },
      { id: 'demo_sp_5', name: 'حصص جماعية - 8', serviceType: 'GroupClass', sessions: 8, price: 900, durationDays: 30 },
      { id: 'demo_sp_6', name: 'مزيد - باقة شهرية', serviceType: 'More', sessions: 8, price: 1000, durationDays: 30, moreCommission: 60 },
    ],
  });

  // ---- الموظفين
  const STAFF_DEF = [
    { name: 'أحمد الجندي', position: 'مدير', salary: 12000 },
    { name: 'مروان فتحي', position: 'مدرب', salary: 7000, coach: true },
    { name: 'كريم الشناوي', position: 'مدرب', salary: 6500, coach: true },
    { name: 'سارة العدل', position: 'مدربة', salary: 6500, coach: true },
    { name: 'هبة زكي', position: 'مدربة', salary: 6000, coach: true },
    { name: 'ندى منصور', position: 'ريسبشن', salary: 5000, reception: true },
    { name: 'محمود رمضان', position: 'ريسبشن', salary: 5000, reception: true },
    { name: 'دينا سليم', position: 'سيلز', salary: 5500, sales: true },
    { name: 'زياد بدوي', position: 'سيلز', salary: 5500, sales: true },
    { name: 'عم سيد قنديل', position: 'عامل نظافة', salary: 3500 },
  ];
  const staff = [];
  for (let i = 0; i < STAFF_DEF.length; i++) {
    const d = STAFF_DEF[i];
    staff.push(await prisma.staff.create({
      data: {
        id: `demo_staff_${i}`,
        staffCode: `S${String(i + 1).padStart(3, '0')}`,
        name: d.name,
        phone: fakePhone(),
        position: d.position,
        salary: d.salary,
        workingHours: 8,
        monthlyVacationDays: 4,
        shiftStartTime: d.reception ? '08:00' : '10:00',
        shiftEndTime: d.reception ? '16:00' : '18:00',
        isActive: true,
        joinedDate: daysAgo(int(120, 900)),
        salesTarget: d.sales ? 60000 : 0,
        salesCommissionType: d.sales ? 'fixed' : null,
        salesCommissionRate: d.sales ? 3 : null,
        coachTarget: d.coach ? 40000 : 0,
      },
    }));
    staff[i]._def = d;
  }
  const coaches = staff.filter((s) => s._def.coach);
  const salesStaff = staff.filter((s) => s._def.sales);
  const reception = staff.filter((s) => s._def.reception);

  // ---- حسابات الدخول
  const USERS = [
    { email: 'owner@demo.local', name: 'مالك النظام (ديمو)', role: 'OWNER' },
    { email: 'manager@demo.local', name: 'مدير الجيم (ديمو)', role: 'MANAGER', staff: staff[0] },
    { email: 'reception@demo.local', name: 'ريسبشن (ديمو)', role: 'STAFF', staff: reception[0] },
    { email: 'coach@demo.local', name: 'كوتش (ديمو)', role: 'COACH', staff: coaches[0] },
    { email: 'sales@demo.local', name: 'سيلز (ديمو)', role: 'STAFF', staff: salesStaff[0], isSales: true },
  ];
  for (let i = 0; i < USERS.length; i++) {
    const u = USERS[i];
    await prisma.user.create({
      data: {
        id: `demo_user_${i}`,
        email: u.email,
        name: u.name,
        password: passwordHash,
        role: u.role,
        isActive: true,
        isSales: !!u.isSales,
        staffId: u.staff ? u.staff.id : null,
      },
    });
  }

  // ---- الأعضاء
  const SOURCES = ['walk-in', 'facebook', 'instagram', 'friend_referral', 'website'];
  const members = [];
  const checkIns = [];
  const receipts = [];
  let receiptNo = 0;
  const nextReceipt = () => ++receiptNo;

  for (let i = 0; i < MEMBER_COUNT; i++) {
    const id = `demo_member_${String(i + 1).padStart(4, '0')}`;
    const offer = pick(offers);
    const female = chance(0.35);
    const name = fakeName(female);
    const phone = fakePhone();

    // حالة العضو: نشط / منتهي / مجمّد
    const roll = rnd();
    const state = roll < 0.68 ? 'active' : roll < 0.9 ? 'expired' : 'frozen';

    const startedDaysAgo = state === 'expired' ? int(offer.duration + 5, offer.duration + 120) : int(1, offer.duration - 1);
    const startDate = daysAgo(startedDaysAgo);
    const expiryDate = new Date(startDate.getTime() + offer.duration * day);

    const price = money(offer.price * 0.85, offer.price * 1.05);
    const hasRemaining = state !== 'expired' && chance(0.14);
    const remainingAmount = hasRemaining ? money(price * 0.15, price * 0.4, 50) : 0;

    const coach = chance(0.55) ? pick(coaches) : null;
    const sales = pick(salesStaff);

    members.push({
      id,
      memberNumber: String(i + 1),
      name,
      phone,
      email: chance(0.25) ? `member${i + 1}@demo.local` : null,
      birthDate: daysAgo(int(6570, 18250)),
      source: pick(SOURCES),
      inBodyScans: offer.inBodyScans || 0,
      invitations: offer.invitations || 0,
      freePTSessions: chance(0.5) ? offer.freePTSessions || 0 : 0,
      remainingFreezeDays: offer.freezeDays || 0,
      remainingCheckIns: offer.maxCheckIns ? int(0, offer.maxCheckIns) : null,
      subscriptionPrice: price,
      remainingAmount,
      remainingDueDate: hasRemaining ? daysAhead(int(3, 25)) : null,
      points: int(0, 180),
      isActive: state !== 'expired',
      isFrozen: state === 'frozen',
      isBanned: false,
      startDate,
      expiryDate,
      coachId: coach ? coach.id : null,
      coachAssignedAt: coach ? startDate : null,
      salesStaffId: sales.id,
      offerId: offer.id,
      createdAt: startDate,
    });

    // إيصال الاشتراك
    receipts.push({
      id: `demo_rcpt_m_${i}`,
      receiptNumber: nextReceipt(),
      type: 'Member',
      amount: price - remainingAmount,
      paymentMethod: chance(0.75) ? 'cash' : 'instapay',
      staffName: pick(reception).name,
      memberId: id,
      createdAt: startDate,
      itemDetails: JSON.stringify({
        memberNumber: String(i + 1),
        memberName: name,
        phone,
        subscriptionPrice: price,
        paidAmount: price - remainingAmount,
        remainingAmount,
        freePTSessions: offer.freePTSessions || 0,
        inBodyScans: offer.inBodyScans || 0,
        invitations: offer.invitations || 0,
        remainingFreezeDays: offer.freezeDays || 0,
        startDate: startDate.toISOString(),
        expiryDate: expiryDate.toISOString(),
        subscriptionDays: offer.duration,
        offerName: offer.name,
        staffName: pick(reception).name,
        salesPersonName: sales.name,
      }),
    });

    // دخلات الجيم لآخر 45 يوم
    if (state === 'active') {
      const visits = int(0, 22);
      for (let v = 0; v < visits; v++) {
        checkIns.push({
          id: `demo_ci_${i}_${v}`,
          memberId: id,
          checkInTime: daysAgo(int(0, 44), int(7, 21), int(0, 59)),
          checkInMethod: chance(0.8) ? 'scan' : 'manual',
        });
      }
    }
  }

  for (let i = 0; i < members.length; i += 200) {
    await prisma.member.createMany({ data: members.slice(i, i + 200) });
  }
  for (let i = 0; i < checkIns.length; i += 500) {
    await prisma.memberCheckIn.createMany({ data: checkIns.slice(i, i + 500) });
  }
  console.log(`   ✓ ${members.length} عضو / ${checkIns.length} دخلة`);

  // ---- اشتراكات PT + حصصها
  const PT_COUNT = Math.max(12, Math.round(MEMBER_COUNT * 0.22));
  const ptSessions = [];
  for (let i = 0; i < PT_COUNT; i++) {
    const src = pick(members);
    const coach = pick(coaches);
    const purchased = pick([8, 12, 16, 24]);
    const attendedCount = int(0, purchased);
    const pricePerSession = pick([250, 275, 300, 350]);
    const start = daysAgo(int(5, 100));
    const ptNumber = i + 1;

    await prisma.pT.create({
      data: {
        ptNumber,
        clientName: src.name,
        phone: src.phone,
        sessionsPurchased: purchased,
        sessionsRemaining: purchased - attendedCount,
        coachName: coach.name,
        pricePerSession,
        startDate: start,
        expiryDate: new Date(start.getTime() + 60 * day),
        coachUserId: coach.id,
        remainingAmount: chance(0.15) ? money(200, 800, 50) : 0,
        isFrozen: chance(0.06),
        createdAt: start,
      },
    });

    for (let s = 0; s < purchased; s++) {
      const attended = s < attendedCount;
      ptSessions.push({
        id: `demo_pts_${i}_${s}`,
        ptNumber,
        clientName: src.name,
        coachName: coach.name,
        sessionDate: new Date(start.getTime() + s * 3 * day),
        attended,
        attendedAt: attended ? new Date(start.getTime() + s * 3 * day) : null,
        attendedBy: attended ? coach.name : null,
        createdAt: start,
      });
    }

    receipts.push({
      id: `demo_rcpt_pt_${i}`,
      receiptNumber: nextReceipt(),
      type: 'newPT',
      amount: purchased * pricePerSession,
      paymentMethod: chance(0.7) ? 'cash' : 'instapay',
      staffName: pick(reception).name,
      ptNumber,
      createdAt: start,
      itemDetails: JSON.stringify({
        ptNumber,
        clientName: src.name,
        phone: src.phone,
        coachName: coach.name,
        sessionsPurchased: purchased,
        pricePerSession,
        totalPrice: purchased * pricePerSession,
        startDate: start.toISOString(),
      }),
    });
  }
  for (let i = 0; i < ptSessions.length; i += 500) {
    await prisma.pTSession.createMany({ data: ptSessions.slice(i, i + 500) });
  }
  console.log(`   ✓ ${PT_COUNT} اشتراك PT / ${ptSessions.length} حصة`);

  // ---- أنواع الاستخدامات (يديرها الأدمن) + سجلات يوم الاستخدام
  const DAY_USE_SERVICES = [
    { name: 'يوم استخدام', price: 100, isBase: true, sortOrder: 0 },
    { name: 'InBody', price: 150, sortOrder: 1 },
    { name: 'ساونا', price: 120, sortOrder: 2 },
    { name: 'حصة جماعية', price: 150, sortOrder: 3 },
    { name: 'تأجير لوكر', price: 50, sortOrder: 4 },
  ];
  await prisma.dayUseService.createMany({
    data: DAY_USE_SERVICES.map((s, i) => ({
      id: `demo_dus_${i}`,
      name: s.name,
      price: s.price,
      isBase: !!s.isBase,
      isActive: true,
      sortOrder: s.sortOrder,
    })),
  });

  const dayUseCount = Math.round(MEMBER_COUNT * 0.35);
  for (let i = 0; i < dayUseCount; i++) {
    const svc = pick(DAY_USE_SERVICES);
    const service = svc.name;
    // السعر الافتراضي للنوع، مع تفاوت بسيط زي الواقع (خصم/زيادة وقت التسجيل)
    const price = chance(0.8) ? svc.price : money(svc.price * 0.7, svc.price * 1.3, 25);
    const when = daysAgo(int(0, 45), int(9, 20), int(0, 59));
    const name = fakeName();
    const phone = fakePhone();
    const id = `demo_du_${i}`;
    const sales = pick(salesStaff);

    await prisma.dayUseInBody.create({
      data: { id, name, phone, serviceType: service, price, staffName: pick(reception).name, salesStaffId: sales.id, createdAt: when },
    });

    receipts.push({
      id: `demo_rcpt_du_${i}`,
      receiptNumber: nextReceipt(),
      type: 'dayUse',
      amount: price,
      paymentMethod: chance(0.85) ? 'cash' : 'instapay',
      staffName: pick(reception).name,
      dayUseId: id,
      createdAt: when,
      itemDetails: JSON.stringify({ name, phone, serviceType: service, price, salesPersonName: sales.name }),
    });
  }
  console.log(`   ✓ ${DAY_USE_SERVICES.length} نوع استخدام / ${dayUseCount} سجل`);

  // ---- الإيصالات (بعد ما اتجمعت كلها) + إلغاء نسبة صغيرة
  receipts.sort((a, b) => a.createdAt - b.createdAt);
  receipts.forEach((r, idx) => { r.receiptNumber = idx + 1; });
  for (const r of receipts) {
    if (chance(0.02)) {
      r.isCancelled = true;
      r.cancelledAt = new Date(r.createdAt.getTime() + int(1, 48) * 3600000);
      r.cancelledBy = pick(staff).name;
      r.cancelReason = pick(['العميل غيّر رأيه', 'خطأ في الإدخال', 'تم الاسترجاع']);
      r.refundMethod = 'cash';
    }
  }
  for (let i = 0; i < receipts.length; i += 300) {
    await prisma.receipt.createMany({ data: receipts.slice(i, i + 300) });
  }
  await prisma.receiptCounter.create({ data: { id: 1, current: receipts.length } });
  await prisma.memberCounter.create({ data: { id: 1, current: MEMBER_COUNT + 1 } });
  console.log(`   ✓ ${receipts.length} إيصال`);

  // ---- الزوار والمتابعات
  const VISITOR_STATUS = ['pending', 'contacted', 'converted', 'not_interested'];
  const STAGES = ['new', 'contacted', 'interested', 'negotiation', 'won', 'lost'];
  const visitorCount = Math.round(MEMBER_COUNT * 0.5);
  for (let i = 0; i < visitorCount; i++) {
    const created = daysAgo(int(0, 60), int(10, 20), int(0, 59));
    const status = pick(VISITOR_STATUS);
    const vid = `demo_visitor_${i}`;
    await prisma.visitor.create({
      data: {
        id: vid,
        name: fakeName(),
        phone: fakePhone(),
        source: pick(['walk-in', 'facebook', 'instagram', 'phone', 'friend_referral']),
        interestedIn: pick(['اشتراك شهري', 'PT', 'حصص جماعية', 'InBody', 'باقة سنوية']),
        status,
        notes: chance(0.4) ? pick(['طلب يشوف المكان', 'بيقارن أسعار', 'هيرجع آخر الشهر', 'مهتم بالبرايفت']) : null,
        createdAt: created,
      },
    });

    if (chance(0.7)) {
      const contacts = int(1, 3);
      for (let f = 0; f < contacts; f++) {
        await prisma.followUp.create({
          data: {
            id: `demo_fu_${i}_${f}`,
            visitorId: vid,
            notes: pick(['اتكلمنا وهيعدي بكرة', 'مردش على التليفون', 'طلب عرض الأسعار', 'هيشترك بعد المرتب', 'مش مهتم دلوقتي']),
            contacted: chance(0.75),
            nextFollowUpDate: chance(0.6) ? daysAhead(int(1, 14)) : null,
            salesName: pick(salesStaff).name,
            assignedTo: pick(salesStaff).id,
            priority: pick(['high', 'medium', 'low']),
            stage: pick(STAGES),
            lastContactedAt: daysAgo(int(0, 20)),
            contactCount: f + 1,
            createdAt: new Date(created.getTime() + f * day),
          },
        });
      }
    }
  }
  console.log(`   ✓ ${visitorCount} زائر + متابعات`);

  // ---- المصاريف
  const EXPENSE_TYPES = ['gym_expense', 'salary_advance', 'maintenance', 'purchase'];
  const expenses = [];
  for (let i = 0; i < 70; i++) {
    const type = pick(EXPENSE_TYPES);
    const isAdvance = type === 'salary_advance';
    const amount = isAdvance ? money(500, 3000, 100) : money(200, 6000, 50);
    expenses.push({
      id: `demo_exp_${i}`,
      type,
      amount,
      description: isAdvance
        ? 'سلفة موظف'
        : pick(['فاتورة كهرباء', 'صيانة أجهزة كارديو', 'مستلزمات نظافة', 'إعلان ممول', 'مشتريات بار', 'قطع غيار', 'إيجار الشهر']),
      category: isAdvance ? 'مرتبات' : pick(CATEGORIES),
      paymentMethod: chance(0.8) ? 'cash' : 'instapay',
      staffId: isAdvance ? pick(staff).id : null,
      isPaid: isAdvance ? chance(0.5) : true,
      paidAmount: isAdvance ? (chance(0.5) ? amount : 0) : amount,
      createdAt: daysAgo(int(0, 60), int(9, 19), int(0, 59)),
    });
  }
  await prisma.expense.createMany({ data: expenses });
  console.log(`   ✓ ${expenses.length} مصروف`);

  // ---- حضور الموظفين (آخر 30 يوم)
  const attendance = [];
  for (const s of staff) {
    for (let d = 0; d < 30; d++) {
      if (chance(0.12)) continue; // إجازة / غياب
      const inH = s._def.reception ? 8 : 10;
      const checkIn = daysAgo(d, inH, int(0, 25));
      const hours = int(7, 10);
      const checkOut = new Date(checkIn.getTime() + hours * 3600000);
      attendance.push({
        id: `demo_att_${s.id}_${d}`,
        staffId: s.id,
        checkIn,
        checkOut,
        duration: hours * 60,
        createdAt: checkIn,
      });
    }
  }
  for (let i = 0; i < attendance.length; i += 500) {
    await prisma.attendance.createMany({ data: attendance.slice(i, i + 500) });
  }
  console.log(`   ✓ ${attendance.length} سجل حضور موظفين`);
}

main()
  .then(async () => {
    await prisma.$executeRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)').catch(() => {});
    await prisma.$disconnect();
    for (const suffix of ['-wal', '-shm']) {
      try { fs.rmSync(OUT_ABS + suffix, { force: true }); } catch { /* ignore */ }
    }
    const mb = fs.statSync(OUT_ABS).size / 1048576;
    console.log(`\n✅ تمت التهيئة: ${OUT_REL} (${mb.toFixed(2)} MB)`);
    console.log('\n🔑 حسابات الدخول للنسخة التجريبية:');
    console.log('   owner@demo.local      (مالك)');
    console.log('   manager@demo.local    (مدير)');
    console.log('   reception@demo.local  (ريسبشن)');
    console.log('   coach@demo.local      (كوتش)');
    console.log('   sales@demo.local      (سيلز)');
    console.log(`   الباسورد للكل: ${DEMO_PASSWORD}\n`);
  })
  .catch(async (e) => {
    console.error('\n❌ فشل التوليد:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
