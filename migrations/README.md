# 📁 Database Migrations

هذا المجلد يحتوي على ملفات SQL للـ migrations (التحديثات) على قاعدة البيانات.

---

## 🎯 كيف يعمل نظام الـ Migrations؟

1. **الملفات**: كل ملف `.sql` هو migration منفصل
2. **الترتيب**: الملفات تُطبق بالترتيب الأبجدي (001, 002, 003...)
3. **التتبع**: يتم حفظ الـ migrations المطبقة في جدول `_migrations`
4. **الأمان**: كل migration يُطبق مرة واحدة فقط

---

## ✅ كيفية تطبيق الـ Migrations؟

### من داخل النظام (UI):
1. اذهب إلى **الإعدادات** → **قاعدة البيانات**
2. اضغط على **"تطبيق التحديثات على قاعدة البيانات"**
3. ستُطبق جميع الـ migrations الجديدة تلقائياً

### من Command Line (اختياري):
```bash
# لتطبيق Migrations جديدة
curl -X POST http://localhost:3000/api/database/migrate

# لعرض حالة الـ Migrations
curl http://localhost:3000/api/database/migrate
```

---

## 📝 كيفية إضافة Migration جديد؟

### الطريقة 1: كتابة SQL يدوياً (الأسرع)

1. أنشئ ملف SQL جديد بترتيب تالي (مثلاً `003_add_new_feature.sql`)
2. اكتب الـ SQL المطلوب:

```sql
-- Migration: Add new feature
-- Created: 2026-03-15

CREATE TABLE IF NOT EXISTS "NewTable" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- أو إضافة عمود لجدول موجود
ALTER TABLE "Member" ADD COLUMN "newField" TEXT;
```

3. احفظ الملف
4. طبق الـ migrations من Settings → Database

---

### الطريقة 2: استخدام Prisma (للتطوير فقط)

إذا كنت في Development وعدلت `schema.prisma`:

```bash
# 1. توليد SQL diff من Prisma
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma \
  --script > migrations/003_new_migration.sql

# 2. عدّل الملف يدوياً إذا لزم الأمر
# 3. طبق الـ migration من Settings → Database
```

---

## 🔍 الملفات الموجودة:

### `001_create_migrations_table.sql`
- إنشاء جدول `_migrations` لتتبع الـ migrations المطبقة

### `002_create_whatsapp_templates.sql`
- إنشاء جدول `WhatsAppTemplate`
- إضافة 4 قوالب افتراضية

---

## ⚠️ ملاحظات هامة:

1. **لا تعدّل ملفات Migrations موجودة**: بمجرد تطبيق migration، لا تعدّله!
2. **استخدم `IF NOT EXISTS`**: عشان الـ migration يكون idempotent (يمكن تشغيله أكثر من مرة)
3. **استخدم `INSERT OR IGNORE`**: للبيانات الافتراضية
4. **التسمية**: استخدم تسمية واضحة مثل `003_add_hr_analytics.sql`
5. **التعليقات**: اكتب تعليق في بداية كل ملف يشرح ماذا يفعل

---

## 📊 مثال كامل لـ Migration:

```sql
-- Migration: Add HR Analytics feature
-- Created: 2026-03-15
-- Description: Add table for tracking staff performance

-- 1. Create table
CREATE TABLE IF NOT EXISTS "StaffPerformance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "staffId" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "hoursWorked" REAL NOT NULL DEFAULT 0,
  "daysAttended" INTEGER NOT NULL DEFAULT 0,
  "performanceScore" REAL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE
);

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS "StaffPerformance_staffId_idx" ON "StaffPerformance"("staffId");
CREATE INDEX IF NOT EXISTS "StaffPerformance_month_year_idx" ON "StaffPerformance"("month", "year");

-- 3. Insert default data (if needed)
-- INSERT OR IGNORE INTO ...
```

---

## 🐛 Troubleshooting

### مشكلة: Migration فشل في التطبيق
- **الحل**: تحقق من الـ logs في Console
- تأكد من صحة الـ SQL syntax
- تحقق من عدم وجود conflicts مع البيانات الموجودة

### مشكلة: Migration طُبق لكن التغييرات مش ظاهرة
- **الحل**: أعد تشغيل التطبيق (في Production)
- أعد تشغيل الـ dev server (في Development)

---

## 🎓 Best Practices

1. **اختبر في Development أولاً**: قبل نشر migration جديد للـ production
2. **احفظ نسخة احتياطية**: قبل تطبيق migrations جديدة
3. **اجعل الـ Migrations صغيرة**: كل migration يعمل شيء واحد محدد
4. **استخدم Transactions**: لو الـ migration معقد
5. **وثّق التغييرات**: اكتب تعليقات واضحة

---

تاريخ الإنشاء: 2026-03-15
آخر تحديث: 2026-03-15
