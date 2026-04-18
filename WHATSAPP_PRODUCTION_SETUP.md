# إعداد WhatsApp للبرودكشن

## 📦 المكتبات المطلوبة

تم إضافة جميع المكتبات الضرورية في `package.json`:

```json
{
  "dependencies": {
    "whatsapp-web.js": "^1.34.6",
    "puppeteer": "^24.39.0",
    "qrcode-terminal": "^0.12.0"
  }
}
```

## 🔧 إعدادات Electron Builder

### 1. ملفات مضمّنة في البناء (files)

```json
"files": [
  "electron/**/*",                          // جميع ملفات Electron بما فيها whatsapp-manager.js
  "node_modules/whatsapp-web.js/**/*",     // مكتبة WhatsApp
  "node_modules/puppeteer/**/*",           // Puppeteer مع Chromium
  "node_modules/qrcode-terminal/**/*",     // مكتبة QR Code (اختيارية)
  // ... باقي الملفات
]
```

### 2. ملفات خارج ASAR (asarUnpack)

```json
"asarUnpack": [
  "node_modules/puppeteer/**/*",           // ملفات Binary لـ Puppeteer
  "node_modules/whatsapp-web.js/**/*",     // ملفات WhatsApp
  // ... باقي الملفات
]
```

## 📁 المجلدات التلقائية

عند تشغيل التطبيق، سيتم إنشاء المجلدات التالية تلقائياً في `app.getPath('userData')`:

1. **`.wwebjs_auth/`** - لحفظ جلسة WhatsApp (Session Storage)
2. **`.wwebjs_cache/`** - للكاش المؤقت

### مواقع المجلدات حسب نظام التشغيل:

- **Windows**: `%APPDATA%/Gym Management/`
- **Mac**: `~/Library/Application Support/Gym Management/`
- **Linux**: `~/.config/Gym Management/`

## 🚀 خطوات البناء للبرودكشن

### 1. تثبيت المكتبات

```bash
npm install
```

### 2. تحميل Chromium لـ Puppeteer

```bash
# تشغيل Puppeteer مرة واحدة لتحميل Chromium
node -e "const puppeteer = require('puppeteer'); (async () => { const browser = await puppeteer.launch(); await browser.close(); })()"
```

> **ملاحظة**: puppeteer v24+ يحفظ Chromium في `~/.cache/puppeteer` بدلاً من `node_modules`.
> سيتم تحميل Chromium تلقائياً في المرة الأولى عند استخدام WhatsApp في production.

### 3. توليد Prisma Client

```bash
npx prisma generate
```

### 4. بناء Next.js

```bash
npm run build
```

### 5. بناء Electron

```bash
# لبناء ويندوز
npm run electron:build:win

# أو لجميع المنصات
npm run electron:build
```

## ✅ التحقق من الإعداد

قبل البناء، يتم التحقق تلقائياً من:

1. ✅ وجود `whatsapp-web.js` في node_modules
2. ✅ وجود `puppeteer` في node_modules
3. ✅ توليد Prisma Client
4. ✅ بناء Next.js standalone

يتم هذا التحقق عبر ملف `preelectron-build.js`

## 🔄 كيفية عمل WhatsApp في Production

### 1. التهيئة الأولى

```javascript
// في electron/main.js
const WhatsAppManager = require('./whatsapp-manager');
const userDataPath = app.getPath('userData');
const whatsappManager = new WhatsAppManager(userDataPath);
```

### 2. الاتصال

```javascript
// من صفحة الإعدادات
await window.electron.whatsapp.init();
// سيتم عرض QR Code للمسح
```

### 3. حفظ الجلسة

بعد المسح الأول، يتم حفظ الجلسة في `.wwebjs_auth/` وسيتم الاتصال تلقائياً في المرات القادمة.

### 4. إرسال الرسائل

```javascript
// إرسال رسالة نصية
await window.electron.whatsapp.send({
  phone: '201234567890',
  message: 'مرحباً!'
});

// إرسال صورة (مثل باركود العضوية)
await window.electron.whatsapp.sendImage({
  phone: '201234567890',
  imageBase64: 'data:image/png;base64,...',
  caption: 'باركود العضوية'
});
```

## 🐛 معالجة الأخطاء

### 1. Retry Mechanism

تم تطبيق آلية إعادة المحاولة (3 مرات) للأخطاء المؤقتة:

- `detached Frame`
- `Target closed`
- `Session closed`
- `Navigation failed`

### 2. فحص حالة الاتصال

قبل إرسال أي رسالة، يتم التحقق من:

```javascript
const state = await this.client.getState();
if (state !== 'CONNECTED') {
  // انتظار 2 ثانية ثم إعادة المحاولة
}
```

## 📝 ملاحظات هامة

### ✅ يجب

1. ✅ الاحتفاظ بملفات `.wwebjs_auth/` عند التحديث
2. ✅ التأكد من وجود اتصال إنترنت مستقر
3. ✅ عدم تشغيل أكثر من نسخة واحدة من التطبيق على نفس الجهاز

### ❌ لا يجب

1. ❌ حذف مجلد `.wwebjs_auth/` (سيطلب إعادة المسح)
2. ❌ تشغيل WhatsApp Web على نفس الرقم من متصفح آخر (سيتم قطع الاتصال)
3. ❌ استخدام نفس الرقم على أكثر من تطبيق

## 🔒 الأمان

- الجلسة محفوظة محلياً في جهاز المستخدم
- لا يتم إرسال بيانات الجلسة لأي خادم خارجي
- يستخدم LocalAuth من whatsapp-web.js (آمن ومشفر)

## 🆘 استكشاف الأخطاء

### المشكلة: "WhatsApp not initialized"

**الحل**: قم بالذهاب لصفحة الإعدادات وضغط "تهيئة الاتصال"

### المشكلة: QR Code لا يظهر

**الحل**:
1. تحقق من اتصال الإنترنت
2. أعد تشغيل التطبيق
3. احذف مجلد `.wwebjs_cache/` وأعد المحاولة

### المشكلة: "Session closed"

**الحل**:
1. افتح WhatsApp على الهاتف
2. تأكد من أن الأجهزة المتصلة تتضمن "WhatsApp Web"
3. إذا لم يكن موجوداً، قم بإعادة المسح

### المشكلة: الرسائل لا تُرسل

**الحل**:
1. تحقق من حالة الاتصال في صفحة الإعدادات
2. جرب إرسال رسالة تجريبية أولاً
3. تأكد من تنسيق رقم الهاتف الصحيح (2010xxxxxxxx)

## 📚 مراجع

- [whatsapp-web.js Documentation](https://docs.wwebjs.dev/)
- [Puppeteer Documentation](https://pptr.dev/)
- [Electron Builder Configuration](https://www.electron.build/)
