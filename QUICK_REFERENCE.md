# 📋 بطاقة مرجعية سريعة - Quick Reference Card

## 🎯 الأوامر الأكثر استخداماً - Most Used Commands

### تشغيل وإيقاف - Start/Stop
```bash
# تشغيل جميع التطبيقات
pm2 start all

# إيقاف جميع التطبيقات
pm2 stop all

# إعادة تشغيل جميع التطبيقات
pm2 restart all

# إعادة تشغيل تطبيق واحد
pm2 restart xgym-system
pm2 restart xgym-client
```

### المراقبة - Monitoring
```bash
# عرض حالة التطبيقات
pm2 status

# عرض الـ logs مباشرة
pm2 logs

# عرض logs لتطبيق معين
pm2 logs xgym-system
pm2 logs xgym-client

# عرض آخر 50 سطر من الـ logs
pm2 logs --lines 50

# مراقبة الأداء والذاكرة
pm2 monit

# معلومات تفصيلية عن تطبيق
pm2 info xgym-system
```

### النسخ الاحتياطي - Backup
```bash
# نسخ احتياطي يدوي
backup.bat

# استعادة نسخة سابقة
rollback.bat
```

### التحديث - Update
```bash
# تحديث تلقائي كامل
update.bat

# أو يدوياً:
pm2 stop all
npm install
npm run build
cd client-portal
npm install
npm run build
cd ..
pm2 restart all
```

---

## 🔧 إصلاح المشاكل - Troubleshooting

### المشكلة: التطبيق لا يعمل
```bash
# 1. تحقق من الحالة
pm2 status

# 2. شاهد الأخطاء
pm2 logs xgym-system --err

# 3. أعد التشغيل
pm2 restart xgym-system

# 4. إذا لم ينفع، أعد بناء التطبيق
cd "C:\Users\amran\Desktop\x gym"
npm run build
pm2 restart xgym-system
```

### المشكلة: بوابة العملاء لا تعمل
```bash
# 1. تحقق من الحالة
pm2 logs xgym-client

# 2. أعد التشغيل
pm2 restart xgym-client

# 3. إذا لم ينفع
cd "C:\Users\amran\Desktop\x gym\client-portal"
npm run build
cd ..
pm2 restart xgym-client
```

### المشكلة: خطأ في قاعدة البيانات
```bash
# استعادة نسخة احتياطية
rollback.bat

# أو يدوياً
cd "C:\Users\amran\Desktop\x gym\prisma\backups"
dir /b gym-backup-*.db
copy gym-backup-[تاريخ].db ..\gym.db
pm2 restart all
```

### المشكلة: الموقع بطيء
```bash
# تحقق من استهلاك الموارد
pm2 monit

# أعد تشغيل التطبيقات
pm2 restart all

# امسح الـ logs القديمة
pm2 flush

# أعد تشغيل الخادم (كحل أخير)
shutdown /r /t 0
```

---

## 📁 مسارات مهمة - Important Paths

```
النظام الرئيسي:
C:\Users\amran\Desktop\x gym

بوابة العملاء:
C:\Users\amran\Desktop\x gym\client-portal

قاعدة البيانات:
C:\Users\amran\Desktop\x gym\prisma\gym.db

النسخ الاحتياطية:
C:\Users\amran\Desktop\x gym\prisma\backups

Logs:
C:\Users\amran\.pm2\logs
```

---

## 🔐 ملفات البيئة - Environment Files

### النظام الرئيسي (.env)
```bash
cd "C:\Users\amran\Desktop\x gym"
notepad .env
```

### بوابة العملاء (.env)
```bash
cd "C:\Users\amran\Desktop\x gym\client-portal"
notepad .env
```

بعد تعديل .env:
```bash
pm2 restart all
```

---

## 🌐 الروابط - URLs

- **النظام الرئيسي:** http://system.xgym.website
- **بوابة العملاء:** http://client.xgym.website
- **النظام المحلي:** http://localhost:4001
- **البوابة المحلية:** http://localhost:3002

---

## 📊 تحقق من الحالة - Health Check

### سكريبت سريع للتحقق من الصحة
```bash
@echo off
echo ========================================
echo فحص صحة النظام - System Health Check
echo ========================================
echo.

echo [1] حالة التطبيقات - Application Status:
pm2 status
echo.

echo [2] استهلاك المنافذ - Port Usage:
netstat -ano | findstr "4001 3002 80"
echo.

echo [3] آخر 10 أسطر من logs:
pm2 logs --lines 10 --nostream
echo.

echo [4] استهلاك الذاكرة - Memory Usage:
pm2 list
echo.

echo ========================================
pause
```

احفظ في `healthcheck.bat` وشغله عند الحاجة

---

## 🚨 أوامر الطوارئ - Emergency Commands

```bash
# إذا تعطل كل شيء - كل التطبيقات
pm2 kill
pm2 resurrect

# إذا لم ينفع، أعد تشغيل الخادم
shutdown /r /t 0

# نسخ احتياطي فوري قبل أي شيء
backup.bat

# استعادة آخر نسخة احتياطية
rollback.bat
```

---

## 📞 معلومات الدعم - Support Info

### الملفات المرجعية:
- **دليل التحديث الكامل:** [UPDATE_GUIDE.md](UPDATE_GUIDE.md)
- **دليل النشر:** [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md)
- **النشر البسيط:** [SIMPLE_DEPLOYMENT.md](SIMPLE_DEPLOYMENT.md)

### السكريبتات الجاهزة:
- **تحديث تلقائي:** `update.bat`
- **نسخ احتياطي:** `backup.bat`
- **استعادة:** `rollback.bat`

---

## 🎯 نصائح يومية - Daily Tips

### كل صباح:
```bash
# تحقق من الحالة
pm2 status

# شاهد الـ logs
pm2 logs --lines 20 --nostream
```

### كل أسبوع:
```bash
# نسخ احتياطي يدوي
backup.bat

# تحديث المكتبات
cd "C:\Users\amran\Desktop\x gym"
npm update
cd client-portal
npm update
cd ..

# إعادة تشغيل
pm2 restart all
```

### كل شهر:
```bash
# مسح الـ logs القديمة
pm2 flush

# حذف النسخ الاحتياطية القديمة (أكثر من 30 يوم)
cd "C:\Users\amran\Desktop\x gym\prisma\backups"
forfiles /M gym-backup-*.db /D -30 /C "cmd /c del @path"
```

---

## ⌨️ اختصارات لوحة المفاتيح - Keyboard Shortcuts

في PM2 Monit (عند تشغيل `pm2 monit`):
- **↑↓** - التنقل بين التطبيقات
- **Ctrl+C** - الخروج
- **r** - إعادة تشغيل التطبيق المحدد
- **s** - إيقاف التطبيق المحدد

---

## 📈 مؤشرات الأداء - Performance Indicators

### حالة صحية:
- ✅ Status: **online**
- ✅ Uptime: **> 1 hour**
- ✅ Restarts: **0**
- ✅ CPU: **< 50%**
- ✅ Memory: **< 500MB**

### حالة تحتاج انتباه:
- ⚠️ Status: **stopping/errored**
- ⚠️ Restarts: **> 5**
- ⚠️ CPU: **> 80%**
- ⚠️ Memory: **> 1GB**

إذا رأيت ⚠️:
```bash
pm2 logs [app-name]
pm2 restart [app-name]
```

---

**احفظ هذا الملف واطبعه للرجوع إليه بسرعة! 📌**
