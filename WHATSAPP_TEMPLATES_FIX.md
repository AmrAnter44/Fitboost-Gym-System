# 🔧 إصلاح مشكلة قوالب WhatsApp في Production

## 🐛 المشكلة

```
Error: The table `main.WhatsAppTemplate` does not exist in the current database.
```

هذا الخطأ يظهر في Production لأن جدول `WhatsAppTemplate` غير موجود في قاعدة البيانات.

---

## ✅ الحل السريع (Quick Fix)

### الطريقة 1: تشغيل Script التصليح

```bash
# في مجلد المشروع
cd /Users/amranter200444/Desktop/Gyms/More/Fitboost-System

# تشغيل script الإصلاح
node scripts/fix-whatsapp-templates-table.js
```

**ملاحظة:** هذا الـ script سيجد قاعدة البيانات تلقائياً (سواء في Development أو Production) ويضيف الجدول الناقص.

---

### الطريقة 2: استخدام Prisma (للتطوير)

إذا كنت في بيئة التطوير:

```bash
# تطبيق التغييرات على قاعدة البيانات
npx prisma db push

# إعادة توليد Prisma Client
npx prisma generate
```

---

### الطريقة 3: إصلاح يدوي (Advanced)

إذا كنت تفضل الإصلاح اليدوي:

1. **حدد موقع قاعدة البيانات:**
   - **Development:** `prisma/gym.db`
   - **Production (Windows):** `C:\Users\<YourUsername>\AppData\Roaming\gym-management\gym.db`
   - **Production (Mac):** `~/Library/Preferences/gym-management/gym.db`
   - **Production (Linux):** `~/.local/share/gym-management/gym.db`

2. **افتح قاعدة البيانات باستخدام SQLite:**
   ```bash
   # استخدم Prisma Studio
   npx prisma studio

   # أو استخدم sqlite3 command line
   sqlite3 path/to/gym.db
   ```

3. **قم بتنفيذ SQL التالي:**
   ```sql
   CREATE TABLE IF NOT EXISTS "WhatsAppTemplate" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "title" TEXT NOT NULL,
     "icon" TEXT NOT NULL DEFAULT '💬',
     "message" TEXT NOT NULL,
     "isCustom" INTEGER NOT NULL DEFAULT 1,
     "isDefault" INTEGER NOT NULL DEFAULT 0,
     "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
   );

   -- إضافة القوالب الافتراضية
   INSERT INTO WhatsAppTemplate (id, title, icon, message, isCustom, isDefault, createdAt, updatedAt)
   VALUES
   ('default-1', 'تواصل أول', '👋', 'مرحباً {name}! 🏋️

شكراً لزيارتك لـ Gym System

نحن سعداء باهتمامك بالانضمام إلينا!

📞 للاستفسارات: {phone}
📍 العنوان: {address}

💪 ننتظرك!', 0, 1, datetime('now'), datetime('now')),

   ('default-2', 'متابعة ثانية', '📞', 'أهلاً {name}! 😊

مر بعض الوقت منذ زيارتك الأخيرة

هل لديك أي استفسارات؟

🎁 لدينا عروض جديدة قد تناسبك!

💪 نحن في انتظارك', 0, 1, datetime('now'), datetime('now')),

   ('default-3', 'عرض خاص', '🎁', '{name} عزيزي! 🎉

🔥 عرض خاص لفترة محدودة!

✨ خصم {discount}% على جميع الاشتراكات

⏰ العرض ساري حتى: {endDate}

📞 للحجز: {phone}

💪 لا تفوت الفرصة!', 0, 1, datetime('now'), datetime('now')),

   ('default-4', 'تذكير بالموعد', '⏰', 'مرحباً {name}! 🏋️

📅 تذكير بموعد حصتك:
🕐 الوقت: {time}
📍 المكان: {location}

💪 نراك قريباً!', 0, 1, datetime('now'), datetime('now'));
   ```

---

## 📦 للإنتاج (Production Build)

عند بناء نسخة جديدة للإنتاج:

```bash
# 1. تطبيق التغييرات على قاعدة البيانات
npx prisma db push

# 2. توليد Prisma Client
npx prisma generate

# 3. بناء المشروع
npm run build

# 4. بناء Electron
npm run build:electron
```

---

## 🔄 منع المشكلة في المستقبل

### إضافة Migration Script تلقائي

أضف هذا الكود في `scripts/production-sync-database.js`:

```javascript
// في بداية الملف
const fixWhatsAppTemplates = require('./fix-whatsapp-templates-table')

// قبل بدء التطبيق
fixWhatsAppTemplates()
```

هذا سيضمن تشغيل الإصلاح تلقائياً عند كل بدء للتطبيق في Production.

---

## 🧪 التحقق من الإصلاح

بعد تشغيل الإصلاح:

1. أعد تشغيل التطبيق
2. افتح صفحة المتابعات (`/followups`)
3. اضغط على "إدارة القوالب"
4. يجب أن ترى القوالب الافتراضية

إذا ظهرت القوالب بنجاح، فالمشكلة تم حلها! ✅

---

## 📞 في حالة استمرار المشكلة

إذا استمرت المشكلة:

1. **تحقق من مسار قاعدة البيانات:**
   ```bash
   node -e "console.log(require('path').join(process.env.APPDATA || '~/.local/share', 'gym-management', 'gym.db'))"
   ```

2. **تحقق من وجود الجدول:**
   ```bash
   npx prisma studio
   # ابحث عن جدول WhatsAppTemplate
   ```

3. **أعد بناء قاعدة البيانات:**
   ```bash
   # احذف قاعدة البيانات (احفظ نسخة احتياطية أولاً!)
   npm run db:backup

   # أعد إنشاء قاعدة البيانات
   npx prisma db push
   ```

---

## 📝 ملاحظات

- ✅ هذا الإصلاح آمن ولن يؤثر على البيانات الموجودة
- ✅ الـ script يتحقق من وجود الجدول قبل إنشائه
- ✅ القوالب الافتراضية يتم إضافتها فقط إذا لم تكن موجودة
- ⚠️ دائماً احفظ نسخة احتياطية قبل تعديل قاعدة البيانات

---

تاريخ الإنشاء: 2026-03-15
آخر تحديث: 2026-03-15
