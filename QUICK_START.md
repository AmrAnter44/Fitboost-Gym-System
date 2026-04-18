# ⚡ دليل البدء السريع - Quick Start Guide

## 🎯 السيناريوهات الشائعة

### 🆕 أول مرة تشغل المشروع؟
```bash
npm install
npm run db:setup
npm run dev
```
**وقت التنفيذ:** ~1 دقيقة
**النتيجة:** ✅ المشروع جاهز للعمل

---

### ❌ عندك مشكلة في الداتابيز؟
```bash
npm run db:fix
npm run dev
```
**وقت التنفيذ:** ~10 ثواني
**يصلح:**
- ❌ "Unable to open database file"
- ❌ "Database is locked"
- ❌ Permission errors

---

### 🔄 عايز تنقل داتابيز قديمة؟
```bash
npm run db:migrate /path/to/old/gym.db
npm run dev
```
**مثال:**
```bash
npm run db:migrate ~/Desktop/gym.db.backup
npm run dev
```
**وقت التنفيذ:** ~2 دقيقة
**النتيجة:** ✅ البيانات القديمة منقولة وشغالة

---

### 💾 عايز نسخة احتياطية؟
```bash
npm run db:backup
```
**النسخة تتحفظ في:** `prisma/gym.db.backup.YYYYMMDD_HHMMSS`

---

## 📋 جدول الأوامر الكامل

| الأمر | الوصف | متى تستخدمه |
|-------|-------|-------------|
| `npm run db:setup` | إعداد كامل للداتابيز | أول مرة أو إعداد شامل |
| `npm run db:fix` | إصلاح سريع | مشاكل شائعة في الداتابيز |
| `npm run db:migrate <path>` | نقل داتابيز قديمة | استيراد من نظام قديم |
| `npm run db:backup` | نسخ احتياطي | قبل أي تغيير مهم |
| `npm run db:validate` | فحص السلامة | صيانة دورية |
| `npm run db:studio` | واجهة بصرية | عرض/تعديل البيانات |
| `npm run db:optimize` | تحسين الأداء | صيانة أسبوعية |

---

## 🚨 حل المشاكل الطارئة

### الداتابيز مش شغالة خالص؟
```bash
# 1. حاول الإصلاح السريع
npm run db:fix

# 2. لو مش نافع، استرجع نسخة احتياطية
ls prisma/gym.db.backup.*
npm run db:migrate prisma/gym.db.backup.20260220_120000

# 3. شغل السيرفر
npm run dev
```

---

### السيرفر بيقول "Migration failed"؟
```bash
npm run db:setup
npm run dev
```

---

### الداتابيز فاضية؟
```bash
npx prisma db push
npm run dev
```

---

## 💡 نصائح مهمة

✅ **اعمل backup قبل أي تغيير كبير:**
```bash
npm run db:backup
```

✅ **بعد نقل المشروع من مكان لآخر:**
```bash
npm run db:fix
```

✅ **صيانة أسبوعية:**
```bash
npm run db:optimize
npm run db:backup
```

---

## 📚 مراجع إضافية

- **دليل شامل بالعربي:** [DATABASE_GUIDE.md](DATABASE_GUIDE.md)
- **وثائق السكريبتات:** [scripts/README.md](scripts/README.md)
- **Prisma Docs:** https://www.prisma.io/docs

---

## 📞 محتاج مساعدة؟

1. **شوف الدليل الشامل:** [DATABASE_GUIDE.md](DATABASE_GUIDE.md)
2. **جرب الإصلاح السريع:** `npm run db:fix`
3. **فحص السلامة:** `npm run db:validate`

---

**آخر تحديث:** فبراير 2026
