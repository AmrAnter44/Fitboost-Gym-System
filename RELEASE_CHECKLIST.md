# Release Checklist — قبل كل إصدار جديد

## 1. لو ضفت عمود جديد في `prisma/schema.prisma`

افتح `electron/check-and-migrate.js` وضيف الفحص في الأرّاي المناسبة:

### أعمدة جداول موجودة (ALTER TABLE)

```js
// مثال: لو ضفت عمود في Member
{ col: 'اسم_العمود', def: 'TEXT' }                    // نص اختياري
{ col: 'اسم_العمود', def: 'INTEGER NOT NULL DEFAULT 0' } // رقم صحيح إجباري
{ col: 'اسم_العمود', def: 'REAL DEFAULT 0' }            // رقم عشري
{ col: 'اسم_العمود', def: 'DATETIME' }                  // تاريخ اختياري
```

**الأرّايات الموجودة في check-and-migrate.js:**

| الجدول | الأرّاي |
|--------|---------|
| `Member` | `memberCols` |
| `Staff` | `staffHrCols` أو `commissionCols` |
| `User` | `userCols` |
| `Permission` | `morePermissions` أو `whatsappPermissions` |
| `SystemSettings` | `settingsCols` |
| `Receipt` | `receiptCols` |
| `Offer` | `offerCols` |
| `FollowUp` | `followUpCols` |
| `PT` | block مستقل |

---

## 2. لو ضفت جدول جديد بالكامل

ضيف block زي ده في نهاية `migrateDatabase()` قبل `db.close()`:

```js
if (!tableExists(db, 'اسم_الجدول')) {
  console.log('📝 Creating اسم_الجدول table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS اسم_الجدول (
      id TEXT PRIMARY KEY,
      -- باقي الأعمدة من schema.prisma
      createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
      updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS اسم_الجدول_fieldName_idx ON اسم_الجدول(fieldName);
  `);
  console.log('✅ Migration completed: اسم_الجدول table created');
} else {
  console.log('✅ اسم_الجدول table already exists');
}
```

**تحويل أنواع Prisma → SQLite:**

| Prisma | SQLite |
|--------|--------|
| `String` | `TEXT` |
| `Int` | `INTEGER` |
| `Float` | `REAL` |
| `Boolean` | `INTEGER` (0/1) |
| `DateTime` | `DATETIME` |
| `String?` (nullable) | `TEXT` بدون `NOT NULL` |

---

## 3. لو ضفت permission جديدة في `Permission` model

ضيف اسمها في الأرّاي المناسبة في `check-and-migrate.js`:

```js
// لصلاحيات WhatsApp
const whatsappPermissions = ['canViewWhatsAppInbox', ...]

// لصلاحيات More/Deductions
const morePermissions = ['canViewMore', ...]

// لصلاحيات SPA
const spaPermissions = ['canViewSpaBookings', ...]
```

كمان لازم تضيفها في:
- `types/permissions.ts` — `DEFAULT_PERMISSIONS` لكل role
- `hooks/usePermissions.ts` — لو بتستخدمها في الفرونتيند

---

## 4. الـ Build Checklist قبل الإصدار

```
[ ] npx prisma db push  (في development لتحديث gym.db المحلي)
[ ] npm run build       (أو الأمر المناسب للبيلد)
[ ] تحقق إن check-and-migrate.js فيه كل الأعمدة الجديدة
[ ] تحقق إن الجداول الجديدة مضافة بـ CREATE TABLE IF NOT EXISTS
[ ] تحقق إن permissions جديدة مضافة في DEFAULT_PERMISSIONS
```

---

## 5. كيف تتحقق إن مفيش حاجة ناقصة

شغّل ده لو عندك قاعدة بيانات قديمة locally:

```bash
node electron/check-and-migrate.js
```

بيطبع كل عمود: إما `✅ already exists` أو `📝 Adding...`
أي خطأ `❌` معناه في مشكلة لازم تتحل قبل البيلد.

---

## 6. لو المشكلة ظهرت عند العميل بعد الأبديت

الخطوات:

1. اطلب منه يبعت الملف ده: `%LOCALAPPDATA%\{AppName}\logs\migrations.log`
2. فيه تفاصيل كل migration اتشغلت ولا لأ
3. لو فيه `❌ Migration error` → معناه في عمود بيحاول يتضاف وبيفشل
4. لو مفيش logs → معناه check-and-migrate مش بيتشغل أصلاً (مشكلة في main.js)
