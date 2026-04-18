# WhatsApp للبرودكشن - دليل سريع 🚀

## ✅ التحقق من الإعداد

```bash
npm run whatsapp:check
```

هذا الأمر سيتحقق من:
- ✅ تثبيت whatsapp-web.js
- ✅ تثبيت puppeteer
- ✅ وجود whatsapp-manager.js
- ✅ إعدادات electron-builder الصحيحة

---

## 📦 البناء للبرودكشن

### الطريقة السريعة (All-in-One)

```bash
# تثبيت المكتبات
npm install

# التحقق من الإعداد
npm run whatsapp:check

# البناء
npm run electron:build:win
```

### الطريقة التفصيلية

```bash
# 1. تثبيت المكتبات
npm install

# 2. التحقق من الإعداد
npm run whatsapp:check

# 3. تحميل Chromium (اختياري - سيتم تلقائياً في أول استخدام)
npm run whatsapp:install-chromium

# 4. البناء
npm run electron:build:win
```

---

## 🔧 استخدام WhatsApp في التطبيق

### 1. التهيئة الأولى

بعد تشغيل التطبيق المبني:

1. اذهب إلى **الإعدادات → WhatsApp**
2. اضغط على **"تهيئة الاتصال"**
3. سيظهر QR Code
4. افتح WhatsApp على هاتفك → **الأجهزة المتصلة** → **ربط جهاز**
5. امسح QR Code

✅ **تم!** الجلسة محفوظة وسيتصل تلقائياً في المرات القادمة.

### 2. إرسال رسالة تجريبية

في صفحة الإعدادات:

1. أدخل رقم الهاتف (مثال: `201234567890`)
2. اكتب رسالة تجريبية
3. اضغط **"إرسال رسالة تجريبية"**

---

## 📁 مواقع ملفات WhatsApp

### في Development

```
.wwebjs_auth/     # جلسة WhatsApp
.wwebjs_cache/    # الكاش المؤقت
```

### في Production

**Windows:**
```
C:\Users\[Username]\AppData\Roaming\Gym Management\.wwebjs_auth\
C:\Users\[Username]\AppData\Roaming\Gym Management\.wwebjs_cache\
```

**Mac:**
```
~/Library/Application Support/Gym Management/.wwebjs_auth/
~/Library/Application Support/Gym Management/.wwebjs_cache/
```

---

## 🎯 الميزات المتاحة

### ✅ في الإصدار الحالي

- ✅ إرسال الإيصالات تلقائياً
- ✅ إرسال باركود العضوية
- ✅ رسائل المتابعة من قوالب
- ✅ إرسال الصور والنصوص
- ✅ حفظ الجلسة تلقائياً
- ✅ إعادة الاتصال التلقائي
- ✅ آلية إعادة المحاولة عند الفشل

### 🔄 قيد التطوير

- 🔄 رسائل انتهاء الاشتراكات
- 🔄 إشعارات الحضور
- 🔄 رسائل جماعية (Bulk Messages)

---

## ⚠️ ملاحظات هامة

### ✅ افعل

- ✅ احتفظ بنسخة احتياطية من `.wwebjs_auth` قبل التحديث
- ✅ تأكد من اتصال الإنترنت المستقر
- ✅ استخدم رقم واحد فقط

### ❌ لا تفعل

- ❌ لا تحذف `.wwebjs_auth` (ستحتاج إعادة المسح)
- ❌ لا تفتح WhatsApp Web على نفس الرقم
- ❌ لا تشغل أكثر من نسخة من التطبيق

---

## 🐛 حل المشاكل الشائعة

### المشكلة: QR Code لا يظهر

**الحل:**
```bash
# احذف الكاش وأعد المحاولة
# في Windows
del /s /q "%APPDATA%\Gym Management\.wwebjs_cache"

# في Mac
rm -rf ~/Library/Application\ Support/Gym\ Management/.wwebjs_cache
```

### المشكلة: "WhatsApp not initialized"

**الحل:** اذهب للإعدادات واضغط "تهيئة الاتصال"

### المشكلة: "Session closed"

**الحل:**
1. افتح WhatsApp على الهاتف
2. اذهب لـ **الأجهزة المتصلة**
3. إذا لم يكن التطبيق موجوداً، أعد المسح

### المشكلة: الرسائل لا تُرسل

**الحل:**
1. تحقق من الاتصال بالإنترنت
2. تحقق من حالة الاتصال في الإعدادات
3. جرب إرسال رسالة تجريبية
4. تأكد من تنسيق الرقم: `2010xxxxxxxx` (بدون +)

---

## 📞 الدعم

للمزيد من المعلومات، راجع:
- 📄 [WHATSAPP_PRODUCTION_SETUP.md](./WHATSAPP_PRODUCTION_SETUP.md) - دليل شامل
- 📝 [check-whatsapp-setup.js](./check-whatsapp-setup.js) - أداة الفحص

---

## 🎉 جاهز للاستخدام!

بعد اتباع الخطوات أعلاه، ستتمكن من:

1. ✅ إرسال الإيصالات للعملاء تلقائياً
2. ✅ إرسال باركود العضوية
3. ✅ إرسال رسائل متابعة
4. ✅ العمل بدون اتصال بعد التهيئة الأولى

**استمتع بتجربة WhatsApp المدمجة! 🚀**
