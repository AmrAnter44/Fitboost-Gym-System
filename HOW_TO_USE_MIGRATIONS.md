# 🚀 كيفية استخدام نظام Migrations

## دليل سريع للمطورين والمستخدمين

---

## 📋 للمطورين (في Development):

### السيناريو: عايز تضيف جدول أو حقل جديد

#### الطريقة 1: Auto-Generate (الأسرع) ⚡

```bash
# 1. عدّل schema.prisma (أضف model أو field جديد)
# مثال: أضف model StaffPerformance في schema.prisma

# 2. ولّد migration تلقائياً
npm run db:migrate:create

# سيسألك عن اسم الـ migration
# أدخل: add_staff_performance

# 3. هيولد ملف:
# migrations/003_add_staff_performance.sql ✅

# 4. راجع الـ SQL
code migrations/003_add_staff_performance.sql

# 5. جربه في development
npm run dev
# افتح Settings → Database → تطبيق التحديثات

# 6. commit
git add migrations/003_add_staff_performance.sql
git commit -m "Add staff performance tracking"
git push
```

#### الطريقة 2: يدوي (Full Control) ✍️

```bash
# 1. أنشئ ملف migration
touch migrations/003_add_staff_performance.sql

# 2. اكتب SQL:
cat > migrations/003_add_staff_performance.sql << 'EOF'
-- Migration: Add staff performance tracking
-- Created: 2026-03-15

CREATE TABLE IF NOT EXISTS "StaffPerformance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "staffId" TEXT NOT NULL,
  "hoursWorked" REAL NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "StaffPerformance_staffId_idx"
ON "StaffPerformance"("staffId");
EOF

# 3. جربه
npm run dev
# Settings → Database → تطبيق التحديثات

# 4. commit
git add migrations/
git commit -m "Add staff performance"
```

---

## 👨‍💼 للمستخدمين (في Production):

### السيناريو: حصل تحديث للنظام

```
1. Update التطبيق (تحميل نسخة جديدة أو git pull)

2. افتح التطبيق

3. اذهب إلى: الإعدادات ⚙️ → قاعدة البيانات 💾

4. اضغط زر: "🔄 تطبيق التحديثات على قاعدة البيانات"

5. انتظر رسالة النجاح: "تم تطبيق X migrations بنجاح! ✅"

6. أعد تشغيل التطبيق

7. التحديثات مطبقة! ✅
```

---

## ⚠️ مشكلة: readonly database

### إذا ظهر خطأ "attempt to write a readonly database":

```
1. أغلق Prisma Studio (إذا كان مفتوحاً)

2. في Settings → Database:
   اضغط زر: "🔧 إصلاح صلاحيات قاعدة البيانات"

3. انتظر رسالة النجاح

4. جرب "تطبيق التحديثات" مرة أخرى
```

---

## 🔄 السيناريو الكامل (من Dev إلى Production):

### في Development (عند المطور):

```bash
# اليوم 1: تطوير feature جديد
vim prisma/schema.prisma  # أضف model StaffPerformance

npm run db:migrate:create
# → Enter name: add_staff_performance
# → Creates: migrations/003_add_staff_performance.sql ✅

git add .
git commit -m "Add staff performance tracking"
git push origin main
```

### في Production (عند العميل):

```
# اليوم 2: تحديث التطبيق
1. تحميل نسخة جديدة من التطبيق
   (أو git pull إذا كان عنده access)

2. افتح التطبيق

3. Settings → Database → "تطبيق التحديثات"

4. رسالة: "تم تطبيق 1 migrations بنجاح! ✅"

5. Restart التطبيق

6. الـ StaffPerformance table موجود الآن! 🎉
```

---

## 📊 أمثلة عملية:

### مثال 1: إضافة عمود جديد

```sql
-- migrations/004_add_member_birth_date.sql
-- Migration: Add birth date to members
-- Created: 2026-03-15

ALTER TABLE "Member" ADD COLUMN "birthDate" DATETIME;
```

### مثال 2: إضافة جدول جديد

```sql
-- migrations/005_add_points_system.sql
-- Migration: Add points and rewards
-- Created: 2026-03-15

CREATE TABLE IF NOT EXISTS "MemberPoints" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "memberId" TEXT NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "MemberPoints_memberId_idx"
ON "MemberPoints"("memberId");
```

### مثال 3: إضافة بيانات افتراضية

```sql
-- migrations/006_add_default_settings.sql
-- Migration: Add default app settings
-- Created: 2026-03-15

CREATE TABLE IF NOT EXISTS "AppSettings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "value" TEXT
);

INSERT OR IGNORE INTO "AppSettings" (id, key, value)
VALUES
  ('setting-1', 'app_name', 'Gym System'),
  ('setting-2', 'currency', 'EGP'),
  ('setting-3', 'timezone', 'Africa/Cairo');
```

---

## 🛠️ أوامر مفيدة:

```bash
# إنشاء migration من schema.prisma
npm run db:migrate:create

# عرض schema الحالي
npx prisma studio

# Validate schema
npx prisma validate

# نسخة احتياطية
npm run db:backup

# تطبيق migrations (في development)
npm run dev
# ثم: Settings → Database → تطبيق التحديثات
```

---

## ❓ FAQ (أسئلة شائعة):

### Q: هل ممكن أتراجع عن migration؟
**A:** Migrations لا يمكن التراجع عنها تلقائياً. لكن يمكنك:
1. إنشاء migration جديد يعكس التغيير (reverse migration)
2. أو استرجاع backup

### Q: لو عملت migration ومتطبقش في production؟
**A:** تأكد من:
1. الملف موجود في `migrations/` folder
2. اسم الملف صحيح (يبدأ برقم ويXنتهي بـ .sql)
3. ضغطت زر "تطبيق التحديثات"

### Q: هل migrations آمنة؟
**A:** نعم! طالما:
1. تستخدم `CREATE TABLE IF NOT EXISTS`
2. تستخدم `INSERT OR IGNORE`
3. لا تستخدم `DROP` commands
4. تختبر في development أولاً

### Q: لو حصل خطأ أثناء التطبيق؟
**A:** النظام هيوقف تلقائياً ويعرض رسالة الخطأ. صلّح الـ SQL وجرب تاني.

---

## 🎯 Best Practices:

1. **اختبر في Development أولاً**: دايماً جرب الـ migration في dev قبل production
2. **احفظ backup**: قبل تطبيق migrations جديدة في production
3. **اكتب migrations صغيرة**: كل migration لشيء واحد محدد
4. **استخدم تعليقات واضحة**: اكتب وصف للـ migration
5. **لا تعدّل migrations قديمة**: بمجرد تطبيق migration، لا تعدّله

---

## 📞 في حالة المشاكل:

1. **اقرأ رسالة الخطأ** - عادةً بتوضح المشكلة
2. **تحقق من الصلاحيات** - استخدم زر "إصلاح الصلاحيات"
3. **أغلق Prisma Studio** - قد يكون سبب readonly error
4. **استرجع backup** - إذا حصل خطأ كبير
5. **راجع التوثيق** - `migrations/README.md`

---

تم إنشاء الملف: 2026-03-15
آخر تحديث: 2026-03-15
