# 📚 دليل إدارة قاعدة البيانات - Database Management Guide

## 📋 جدول المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [الأوامر السريعة](#الأوامر-السريعة)
3. [إصلاح المشاكل الشائعة](#إصلاح-المشاكل-الشائعة)
4. [نقل داتابيز قديمة](#نقل-داتابيز-قديمة)
5. [النسخ الاحتياطي والاسترجاع](#النسخ-الاحتياطي-والاسترجاع)
6. [الصيانة الدورية](#الصيانة-الدورية)

---

## 🎯 نظرة عامة

هذا النظام يستخدم **SQLite** كقاعدة بيانات مع **Prisma ORM**. الداتابيز موجودة في:
```
prisma/gym.db
```

---

## ⚡ الأوامر السريعة

### 1. إعداد داتابيز جديدة من الصفر
```bash
npm run db:setup
```
**متى تستخدمه:**
- أول مرة تشغل المشروع
- بعد حذف الداتابيز
- لتطبيق جميع الـ migrations على داتابيز موجودة

**ماذا يفعل:**
- ✅ يفحص البيئة (Node.js, Prisma)
- ✅ ينشئ نسخة احتياطية تلقائياً
- ✅ يزيل الـ extended attributes (macOS)
- ✅ يضبط صلاحيات الملفات
- ✅ يولد Prisma Client
- ✅ يطبق جميع الـ migrations
- ✅ يتحقق من سلامة البيانات

---

### 2. إصلاح سريع للمشاكل الشائعة
```bash
npm run db:fix
```
**متى تستخدمه:**
- خطأ "Unable to open database file"
- خطأ "Database is locked"
- بعد نقل المشروع من مكان لآخر
- بعد استرجاع من Git

**ماذا يفعل:**
- ✅ يزيل الـ extended attributes
- ✅ يضبط الصلاحيات
- ✅ يحذف ملفات WAL/SHM المؤقتة
- ✅ ينشئ نسخة احتياطية
- ✅ يولد Prisma Client
- ✅ يفحص الاتصال
- ✅ يحذف Next.js cache

**⏱️ سريع جداً: 5-10 ثواني فقط**

---

### 3. نقل داتابيز قديمة
```bash
npm run db:migrate /path/to/old/gym.db
```

**مثال:**
```bash
npm run db:migrate ~/Desktop/gym.db.backup
```

**متى تستخدمه:**
- عندك داتابيز من نظام قديم
- تريد نقل البيانات من جهاز آخر
- عندك نسخة احتياطية قديمة تريد استرجاعها

**ماذا يفعل:**
- ✅ ينسخ الداتابيز القديمة
- ✅ يعمل backup للداتابيز الحالية
- ✅ يطبق جميع الـ migrations المطلوبة
- ✅ يفحص سلامة البيانات
- ✅ يظبط الصلاحيات
- ✅ يجهز السيستم للعمل

---

### 4. نسخة احتياطية يدوية
```bash
npm run db:backup
```
ينشئ نسخة احتياطية في:
```
prisma/gym.db.backup.YYYYMMDD_HHMMSS
```

---

### 5. فحص سلامة الداتابيز
```bash
npm run db:validate
```
يفحص:
- ✅ صحة الـ schema
- ✅ الاتصال بالداتابيز
- ✅ وجود الجداول المطلوبة

---

### 6. فتح Prisma Studio (واجهة بصرية)
```bash
npm run db:studio
```
يفتح واجهة ويب على `http://localhost:5555` لعرض وتعديل البيانات بصرياً.

---

## 🔧 إصلاح المشاكل الشائعة

### ❌ خطأ: "Unable to open database file"

**الحل:**
```bash
npm run db:fix
```

أو يدوياً:
```bash
# 1. إزالة extended attributes (macOS)
xattr -rc ./prisma/

# 2. ضبط الصلاحيات
chmod -R 755 ./prisma/
chmod 644 ./prisma/*.db

# 3. توليد Prisma Client
npx prisma generate

# 4. حذف Next.js cache
rm -rf .next
```

---

### ❌ خطأ: "Database is locked"

**السبب:** عملية أخرى تستخدم الداتابيز

**الحل:**
```bash
# 1. أوقف السيرفر (Ctrl+C)

# 2. احذف ملفات WAL/SHM
rm -f ./prisma/gym.db-wal
rm -f ./prisma/gym.db-shm

# 3. شغل السيرفر مرة أخرى
npm run dev
```

---

### ❌ خطأ: "Migration failed"

**الحل:**
```bash
# الطريقة 1: إعادة تطبيق migrations
npm run db:setup

# الطريقة 2: استخدام db push (إذا فشلت الأولى)
npx prisma db push --accept-data-loss

# الطريقة 3: إعادة بناء الداتابيز من الصفر
# تحذير: هذا سيحذف جميع البيانات!
rm -f prisma/gym.db
npm run db:setup
```

---

### ❌ الداتابيز موجودة لكن فاضية

**الحل:**
```bash
# 1. فحص الجداول
npx prisma db execute --stdin <<< "SELECT name FROM sqlite_master WHERE type='table';"

# 2. إذا لم توجد جداول، طبق الـ schema
npx prisma db push
```

---

### ❌ بعد النسخ من جهاز آخر

```bash
# دائماً نفذ هذا الأمر:
npm run db:fix
```

---

## 🔄 نقل داتابيز قديمة

### السيناريو 1: عندك داتابيز من سيستم قديم

```bash
# 1. احفظ مسار الداتابيز القديمة
# مثلاً: ~/Desktop/old-gym.db

# 2. نفذ الأمر:
npm run db:migrate ~/Desktop/old-gym.db

# 3. انتظر حتى ينتهي (قد يستغرق دقيقة)

# 4. شغل السيرفر:
npm run dev
```

---

### السيناريو 2: استرجاع نسخة احتياطية

```bash
# النسخ الاحتياطية موجودة في:
# prisma/gym.db.backup.*

# لاسترجاع نسخة احتياطية:
npm run db:migrate prisma/gym.db.backup.20260220_143000
```

---

### السيناريو 3: دمج بيانات من عدة داتابيز

**يدوياً باستخدام SQLite:**
```bash
# 1. افتح الداتابيز الأساسية
sqlite3 prisma/gym.db

# 2. اربط الداتابيز الثانية
sqlite> ATTACH DATABASE 'path/to/other.db' AS other;

# 3. انسخ البيانات
sqlite> INSERT INTO Member SELECT * FROM other.Member WHERE id NOT IN (SELECT id FROM Member);

# 4. افصل
sqlite> DETACH DATABASE other;

# 5. أغلق
sqlite> .quit
```

---

## 💾 النسخ الاحتياطي والاسترجاع

### النسخ الاحتياطي التلقائي

السكريبتات تنشئ نسخ احتياطية تلقائياً:
- ✅ قبل تطبيق migrations
- ✅ قبل نقل داتابيز جديدة
- ✅ عند استخدام `db:setup`

الموقع: `prisma/gym.db.backup.*`

---

### نسخ احتياطي يدوي

```bash
# طريقة 1: باستخدام npm script
npm run db:backup

# طريقة 2: يدوياً
cp prisma/gym.db prisma/gym.db.backup.manual-$(date +%Y%m%d_%H%M%S)

# طريقة 3: نسخ لمكان آخر
cp prisma/gym.db ~/Desktop/gym-backup-$(date +%Y%m%d).db
```

---

### استرجاع نسخة احتياطية

```bash
# 1. أوقف السيرفر (Ctrl+C)

# 2. استرجع النسخة
cp prisma/gym.db.backup.20260220_120000 prisma/gym.db

# 3. نفذ إصلاح سريع
npm run db:fix

# 4. شغل السيرفر
npm run dev
```

---

## 🛠️ الصيانة الدورية

### 1. تحسين الأداء (كل أسبوع)

```bash
# تشغيل VACUUM لتقليل حجم الملف
sqlite3 prisma/gym.db "VACUUM;"

# إعادة بناء الـ indexes
sqlite3 prisma/gym.db "REINDEX;"

# أو استخدم السكريبت الجاهز:
npm run db:optimize
```

---

### 2. فحص سلامة البيانات (كل شهر)

```bash
# فحص integrity
sqlite3 prisma/gym.db "PRAGMA integrity_check;"

# يجب أن يطبع: ok
```

---

### 3. تنظيف النسخ الاحتياطية القديمة (كل شهر)

```bash
# حذف النسخ الأقدم من 30 يوم
find ./prisma -name "gym.db.backup.*" -mtime +30 -delete
```

---

## 📊 معلومات تقنية

### مسار الداتابيز في .env

```env
# Relative path (افتراضي)
DATABASE_URL="file:./prisma/gym.db?connection_limit=1&pool_timeout=20&journal_mode=WAL"

# Absolute path (أفضل للإنتاج)
DATABASE_URL="file:/full/path/to/prisma/gym.db?connection_limit=1&pool_timeout=20&journal_mode=WAL"
```

---

### إعدادات SQLite المستخدمة

```sql
PRAGMA busy_timeout = 5000;          -- انتظار 5 ثواني قبل خطأ "locked"
PRAGMA synchronous = NORMAL;         -- أسرع في الكتابة
PRAGMA cache_size = -65536;          -- 64MB ذاكرة كاش
PRAGMA temp_store = MEMORY;          -- جداول مؤقتة في الذاكرة
PRAGMA mmap_size = 268435456;        -- 256MB memory-mapped I/O
PRAGMA journal_mode = WAL;           -- Write-Ahead Logging
PRAGMA wal_autocheckpoint = 200;     -- checkpoint كل 200 صفحة
```

---

### حجم الداتابيز

```bash
# معرفة حجم الداتابيز
du -h prisma/gym.db

# معرفة حجم مع WAL files
du -sh prisma/gym.db*
```

---

## 🚨 تحذيرات مهمة

### ⚠️ لا تفعل:

❌ **لا تحذف مجلد migrations أبداً**
```bash
# NEVER DO THIS:
rm -rf prisma/migrations
```

❌ **لا تعدل الداتابيز مباشرة بدون migrations**

❌ **لا تستخدم `db push` في production** (استخدم `migrate deploy`)

❌ **لا تشغل عدة instances من السيرفر على نفس الداتابيز**

---

### ✅ افعل:

✅ **اعمل backup قبل أي تعديل مهم**
```bash
npm run db:backup
```

✅ **استخدم migrations لأي تغيير في الـ schema**
```bash
npx prisma migrate dev --name description_of_change
```

✅ **راجع الـ migrations قبل deploy**
```bash
npx prisma migrate status
```

---

## 📞 المساعدة

إذا واجهت مشكلة غير موجودة هنا:

1. **جرب الإصلاح السريع:**
   ```bash
   npm run db:fix
   ```

2. **فحص الـ logs:**
   ```bash
   npx prisma validate
   npx prisma migrate status
   ```

3. **استرجع نسخة احتياطية:**
   ```bash
   # انظر في:
   ls -lh prisma/gym.db.backup.*
   ```

---

## 🎓 أمثلة عملية

### مثال 1: نقل المشروع لجهاز جديد

```bash
# على الجهاز القديم:
1. cp prisma/gym.db ~/Desktop/gym-backup.db

# على الجهاز الجديد:
2. git clone [repository]
3. npm install
4. npm run db:migrate ~/Desktop/gym-backup.db
5. npm run dev
```

---

### مثال 2: تحديث الـ schema وإضافة جدول جديد

```bash
# 1. عدل schema.prisma (أضف الجدول الجديد)

# 2. أنشئ migration
npx prisma migrate dev --name add_new_table

# 3. في production، طبق الـ migration:
npx prisma migrate deploy
```

---

### مثال 3: الداتابيز تالفة - استرجاع كامل

```bash
# 1. أوقف السيرفر
Ctrl+C

# 2. احفظ الداتابيز الحالية للفحص
mv prisma/gym.db prisma/gym.db.corrupted

# 3. استرجع آخر نسخة احتياطية
npm run db:migrate prisma/gym.db.backup.20260220_120000

# 4. شغل السيرفر
npm run dev
```

---

## 📚 مراجع إضافية

- [Prisma Documentation](https://www.prisma.io/docs)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [SQLite WAL Mode](https://www.sqlite.org/wal.html)

---

**آخر تحديث:** فبراير 2026
**الإصدار:** 1.0.0
