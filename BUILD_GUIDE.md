# 📦 دليل البناء للنظام - Build Guide

## 🎯 نظرة عامة
هذا الدليل يشرح كيفية بناء تطبيق Fitboost System للإنتاج (Production).

---

## ⚙️ المتطلبات الأساسية

1. **Node.js** - الإصدار 18 أو أحدث
2. **npm** - يأتي مع Node.js
3. **Windows** - للبناء على Windows
4. **مساحة القرص** - على الأقل 2 GB مساحة خالية

---

## 🏗️ خطوات البناء

### 1️⃣ تثبيت المكتبات (Dependencies)

```bash
npm install
```

### 2️⃣ بناء Next.js (اختياري - يتم تلقائياً)

```bash
npm run build
```

هذا الأمر:
- يولد Prisma Client
- يبني Next.js مع standalone output
- ينسخ الملفات الضرورية (static, public, database)

### 3️⃣ بناء تطبيق Electron

#### للبناء على Windows:
```bash
npm run build:electron:win
```

#### للبناء على جميع المنصات:
```bash
npm run build:electron
```

---

## 📁 الملفات الناتجة

بعد البناء، ستجد الملفات في مجلد `dist/`:

```
dist/
├── Gym Management Setup X.X.X.exe    # المثبت
├── win-unpacked/                      # النسخة غير المضغوطة
│   └── Gym Management.exe            # الملف التنفيذي
└── builder-debug.yml                  # معلومات البناء
```

---

## 🔍 التحقق من البناء

### تحقق من وجود الملفات الضرورية:

```bash
node preelectron-build.js
```

يجب أن ترى:
```
✅ .next/standalone directory exists
✅ server.js exists
✅ Static files exist
✅ Public files exist
✅ Database file exists
✅ Icon file exists
```

---

## 🐛 حل المشاكل الشائعة

### ❌ المشكلة: "Next.js files not found"

**السبب**: لم يتم بناء Next.js أولاً

**الحل**:
```bash
# بناء Next.js أولاً
npm run build

# ثم التحقق من الملفات
node preelectron-build.js

# ثم بناء Electron
npm run build:electron:win
```

### ❌ المشكلة: "server.js not found in standalone"

**السبب**: إعدادات next.config.js غير صحيحة

**الحل**: تأكد من أن `next.config.js` يحتوي على:
```javascript
output: 'standalone'
```

### ❌ المشكلة: "Database path error"

**السبب**: قاعدة البيانات غير موجودة

**الحل**:
```bash
# إنشاء قاعدة بيانات جديدة
npm run db:setup

# أو نسخ من backup
npm run db:backup
```

### ❌ المشكلة: "Port 4001 already in use"

**السبب**: هناك عملية تعمل على المنفذ 4001

**الحل**:
```bash
# Windows
netstat -ano | findstr :4001
taskkill /PID <PID> /F

# أو أعد تشغيل الجهاز
```

---

## 🚀 تشغيل التطبيق المبني

بعد البناء، يمكنك تشغيل التطبيق:

### من المثبت:
1. قم بتشغيل `Gym Management Setup X.X.X.exe`
2. اتبع خطوات التثبيت
3. افتح التطبيق من قائمة Start أو سطح المكتب

### من النسخة غير المضغوطة:
```bash
cd dist/win-unpacked
"Gym Management.exe"
```

---

## 📊 معلومات إضافية

### حجم البناء المتوقع:
- **المثبت**: ~200-300 MB
- **التطبيق المثبت**: ~400-500 MB

### وقت البناء المتوقع:
- **البناء الأول**: 5-10 دقائق
- **البناء التالي**: 2-5 دقائق

---

## 🔐 الأمان

- التطبيق المبني يستخدم قاعدة بيانات منفصلة في:
  ```
  C:\Users\<username>\AppData\Roaming\fitboost-system\database\gym.db
  ```
- الصور المرفوعة تحفظ في:
  ```
  C:\Users\<username>\AppData\Roaming\fitboost-system\uploads\
  ```

---

## 📞 الدعم

إذا واجهت أي مشكلة:
1. تحقق من ملف `BUILD_GUIDE.md` (هذا الملف)
2. راجع سجلات الأخطاء (logs)
3. تواصل مع المطور

---

**آخر تحديث**: 2026-02-21
**الإصدار**: 5.6.2
