# 🔄 نظام Migrations للـ Database

## نظام تحديث قاعدة البيانات بزرار واحد (يشتغل في Production!)

---

## 🎯 المشكلة التي تم حلها:

### قبل:
- ❌ `npx prisma db push` لا يشتغل في Electron Production (Prisma CLI مش موجود)
- ❌ تحتاج command line لتطبيق تحديثات على قاعدة البيانات
- ❌ صعوبة في sync الـ schema مع Production database

### بعد:
- ✅ زر واحد في الإعدادات يطبق جميع التحديثات
- ✅ يشتغل في Development و Production بدون مشاكل
- ✅ تتبع تلقائي للـ migrations المطبقة
- ✅ آمن تماماً - كل migration يُطبق مرة واحدة فقط

---

## 📋 كيف يعمل النظام؟

```
migrations/
├── 001_create_migrations_table.sql      ← جدول التتبع
├── 002_create_whatsapp_templates.sql    ← WhatsApp قوالب
├── 003_add_new_feature.sql              ← تحديث جديد
└── README.md                            ← التوثيق
```

### الخطوات:
1. **قراءة**: النظام يقرأ جميع ملفات `.sql` في مجلد `migrations/`
2. **مقارنة**: يقارن بالـ migrations المطبقة في جدول `_migrations`
3. **تطبيق**: يطبق الـ migrations الجديدة فقط بالترتيب
4. **تسجيل**: يحفظ اسم الـ migration في `_migrations` لتجنب تكراره

---

## 🚀 كيفية الاستخدام:

### من واجهة النظام (الطريقة الرئيسية):

1. افتح **الإعدادات** (⚙️)
2. اذهب إلى **قاعدة البيانات** (💾)
3. اضغط على **"تطبيق التحديثات على قاعدة البيانات"** 🔄
4. أكّد التطبيق
5. انتظر رسالة النجاح ✅
6. أعد تشغيل التطبيق (في Production)

**يشتغل في:**
- ✅ Development (npm run dev)
- ✅ Production (Electron app)

---

## 🆕 كيفية إضافة تحديث جديد؟

### السيناريو: عايز تضيف جدول جديد أو عمود جديد

#### 1. أنشئ ملف Migration جديد:

```bash
# في مجلد المشروع
cd migrations/

# أنشئ ملف جديد بترقيم تالي
touch 003_add_hr_analytics.sql
```

#### 2. اكتب الـ SQL:

```sql
-- Migration: Add HR Analytics feature
-- Created: 2026-03-15

-- إنشاء جدول جديد
CREATE TABLE IF NOT EXISTS "StaffPerformance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "staffId" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "hoursWorked" REAL NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- إضافة index
CREATE INDEX IF NOT EXISTS "StaffPerformance_staffId_idx"
ON "StaffPerformance"("staffId");
```

#### 3. طبّق الـ Migration:

**في Development:**
- اضغط الزر في Settings → Database
- أو استخدم API endpoint مباشرة

**في Production:**
- افتح التطبيق
- Settings → Database
- اضغط "تطبيق التحديثات"
- أعد تشغيل التطبيق

---

## 📡 API Endpoints:

### POST `/api/database/migrate`
تطبيق جميع الـ migrations الجديدة

**Response:**
```json
{
  "success": true,
  "message": "تم تطبيق 2 migrations بنجاح!",
  "migrationsApplied": 2,
  "results": [
    { "name": "003_add_hr_analytics.sql", "status": "success" }
  ],
  "isProduction": true,
  "totalMigrations": 3,
  "previouslyApplied": 1
}
```

### GET `/api/database/migrate`
عرض حالة الـ Migrations

**Response:**
```json
{
  "appliedMigrations": [
    { "name": "001_create_migrations_table.sql", "appliedAt": "2026-03-15T10:00:00Z" },
    { "name": "002_create_whatsapp_templates.sql", "appliedAt": "2026-03-15T10:01:00Z" }
  ],
  "pendingMigrations": [
    "003_add_hr_analytics.sql"
  ],
  "totalMigrations": 3,
  "appliedCount": 2,
  "pendingCount": 1
}
```

---

## 🔒 الأمان والحماية:

### ✅ ما هو آمن:
- تطبيق الـ migrations أكثر من مرة (idempotent)
- استخدام `CREATE TABLE IF NOT EXISTS`
- استخدام `INSERT OR IGNORE` للبيانات الافتراضية
- إضافة أعمدة جديدة بـ `ALTER TABLE ADD COLUMN`

### ⚠️ احذر من:
- `DROP TABLE` - يحذف الجدول وجميع البيانات!
- `ALTER TABLE DROP COLUMN` - يحذف العمود وجميع البيانات!
- عدم استخدام `IF NOT EXISTS`

### 📝 Best Practice:
```sql
-- ✅ جيد - آمن
CREATE TABLE IF NOT EXISTS "MyTable" (...);
ALTER TABLE "Member" ADD COLUMN "newField" TEXT DEFAULT '';
INSERT OR IGNORE INTO "Settings" VALUES (...);

-- ❌ سيء - خطر
DROP TABLE "MyTable";  -- يحذف البيانات!
ALTER TABLE "Member" DROP COLUMN "oldField";  -- يحذف البيانات!
```

---

## 📊 أمثلة عملية:

### مثال 1: إضافة جدول جديد

```sql
-- migrations/003_add_points_system.sql
-- Migration: Add points and rewards system
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

### مثال 2: إضافة عمود جديد

```sql
-- migrations/004_add_member_birth_date.sql
-- Migration: Add birth date to members
-- Created: 2026-03-15

-- SQLite doesn't support ADD COLUMN with FOREIGN KEY directly
-- So we use simple column addition
ALTER TABLE "Member" ADD COLUMN "birthDate" DATETIME;
```

### مثال 3: إضافة بيانات افتراضية

```sql
-- migrations/005_add_default_settings.sql
-- Migration: Add default app settings
-- Created: 2026-03-15

INSERT OR IGNORE INTO "Settings" (id, key, value)
VALUES
  ('setting-1', 'app_name', 'Gym System'),
  ('setting-2', 'currency', 'EGP'),
  ('setting-3', 'timezone', 'Africa/Cairo');
```

---

## 🔧 Troubleshooting:

### مشكلة: "Database not found"
**الحل:**
- تأكد من وجود قاعدة البيانات في المسار الصحيح
- في Production: تأكد من تشغيل التطبيق مرة واحدة على الأقل

### مشكلة: Migration فشل في التطبيق
**الحل:**
1. تحقق من الـ error message
2. تأكد من صحة الـ SQL syntax
3. تحقق من عدم وجود conflicts مع البيانات الموجودة
4. استخدم `IF NOT EXISTS` و `INSERT OR IGNORE`

### مشكلة: التغييرات مش ظاهرة
**الحل:**
- في Development: أعد تشغيل `npm run dev`
- في Production: أغلق وأعد فتح التطبيق
- تأكد من أن الـ migration طُبق (شوف جدول `_migrations`)

### مشكلة: عايز أتراجع عن Migration
**الحل:**
- Migrations لا يمكن التراجع عنها تلقائياً
- لو ضروري:
  1. احفظ نسخة احتياطية من قاعدة البيانات
  2. اعمل migration جديد يعكس التغيير (reverse migration)
  3. مثال: `006_remove_unwanted_column.sql`

---

## 🎓 نصائح للمطورين:

### 1. اختبر في Development أولاً
```bash
# Development
npm run dev
# افتح Settings → Database
# اضغط "تطبيق التحديثات"
# تحقق من النتيجة
```

### 2. احفظ نسخة احتياطية
```bash
# في Production قبل تطبيق migrations جديدة
cp ~/Library/Preferences/gym-management/gym.db ~/gym-backup.db
```

### 3. اكتب Migrations صغيرة ومركزة
```sql
-- ✅ جيد - migration واحد لكل feature
-- migrations/003_add_points.sql
-- migrations/004_add_rewards.sql

-- ❌ سيء - migration واحد كبير
-- migrations/003_add_everything.sql (100+ lines)
```

### 4. استخدم تعليقات واضحة
```sql
-- Migration: Add points and rewards system
-- Created: 2026-03-15
-- Author: Dev Team
-- Description: Enable points collection for member check-ins
```

---

## 📈 الفرق بين الطريقة القديمة والجديدة:

### الطريقة القديمة (Prisma CLI):
```bash
# Development
npx prisma db push        # ✅ يشتغل
npx prisma generate

# Production (Electron)
npx prisma db push        # ❌ لا يشتغل (Prisma CLI مش موجود)
```

### الطريقة الجديدة (Migrations System):
```bash
# Development
Settings → Database → "تطبيق التحديثات"  # ✅ يشتغل

# Production (Electron)
Settings → Database → "تطبيق التحديثات"  # ✅ يشتغل! 🎉
```

---

## 🎯 الخلاصة:

1. **زر واحد** يحدّث قاعدة البيانات في Development و Production
2. **Migrations منظمة** في مجلد واحد
3. **تتبع تلقائي** للـ migrations المطبقة
4. **آمن** - كل migration يُطبق مرة واحدة فقط
5. **مرن** - سهل إضافة تحديثات جديدة

**لا تحتاج Prisma CLI في Production!** 🚀

---

تاريخ الإنشاء: 2026-03-15
آخر تحديث: 2026-03-15
الإصدار: 1.0
