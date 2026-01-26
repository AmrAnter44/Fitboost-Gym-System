# 🚀 Portable Caddy Setup - دليل التشغيل على أي جهاز

تم إنشاء سكريبتات محمولة (Portable) لإعداد Caddy على **أي جهاز Windows** بدون الحاجة لتعديل المسارات.

---

## 📦 الملفات المطلوبة

عشان تنقل الإعداد لجهاز تاني، محتاج الملفات دي:

### ✅ من مجلد المشروع:
```
x gym/
├── Caddyfile                      # ← ملف إعداد Caddy
├── setup-caddy.bat                # ← سكريبت التثبيت الرئيسي
├── setup-caddy-service.bat        # ← سكريبت إنشاء Windows Service
└── PORTABLE_CADDY_SETUP.md        # ← هذا الملف (الدليل)
```

### 📥 ملفات خارجية (هتحتاج تحمّلها):
1. **caddy_windows_amd64.exe**
   - من: https://caddyserver.com/download
   - اختر: Windows amd64

2. **nssm.exe** (اختياري - للـ Windows Service)
   - من: https://nssm.cc/download
   - استخرج `nssm.exe` من مجلد `win64`

---

## 🎯 طريقة الاستخدام على جهاز جديد

### الخطوة 1: نقل الملفات
1. انسخ المجلد كامل `x gym` للجهاز الجديد
2. ضعه في أي مكان (Desktop, Documents, أي مكان)

### الخطوة 2: تحميل Caddy و NSSM
1. حمّل `caddy_windows_amd64.exe`
2. ضعه في **Desktop** أو **Downloads**
3. حمّل `nssm.exe` (اختياري)
4. ضعه في **Desktop** أو **Downloads**

### الخطوة 3: تشغيل الإعداد
```powershell
# 1. افتح مجلد المشروع
cd "C:\path\to\x gym"

# 2. شغّل سكريبت الإعداد (كليك يمين → Run as Administrator)
setup-caddy.bat
```

السكريبت هيعمل:
- ✅ إنشاء مجلد `caddy` في نفس مكان السكريبت
- ✅ البحث عن Caddy في Desktop/Downloads
- ✅ نسخ Caddy للمجلد الجديد
- ✅ نسخ Caddyfile
- ✅ إنشاء قواعد Windows Firewall
- ✅ اختبار الإعداد

### الخطوة 4: إنشاء Windows Service (اختياري)
```powershell
# شغّل سكريبت Service (كليك يمين → Run as Administrator)
setup-caddy-service.bat
```

السكريبت هيعمل:
- ✅ البحث عن NSSM في Desktop/Downloads
- ✅ إنشاء Windows Service اسمه "CaddyServer"
- ✅ ضبط الـ Service للتشغيل التلقائي مع Windows
- ✅ تشغيل الـ Service

---

## 🔍 كيف تشتغل السكريبتات؟

### الميزات الذكية:

#### 1. المسارات النسبية (Relative Paths):
```batch
REM السكريبت يعرف مكانه تلقائياً
set "SCRIPT_DIR=%~dp0"
set "CADDY_DIR=%SCRIPT_DIR%caddy"
```
- `%~dp0` = مسار المجلد اللي فيه السكريبت
- كل الملفات بتتنشئ **نسبةً لمكان السكريبت**
- مش محتاج تعدّل أي حاجة!

#### 2. البحث التلقائي:
```batch
REM البحث في Desktop
if exist "%USERPROFILE%\Desktop\caddy_windows_amd64.exe" ...

REM البحث في Downloads
if exist "%USERPROFILE%\Downloads\caddy_windows_amd64.exe" ...
```
- `%USERPROFILE%` = مجلد المستخدم الحالي (يشتغل على أي جهاز)
- يبحث في Desktop ثم Downloads
- ينسخ الملف للمكان الصحيح تلقائياً

#### 3. التحقق من الصلاحيات:
```batch
REM كشف Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ⚠️ WARNING: Not running as Administrator
)
```
- يتحقق إذا كان السكريبت شغال كـ Administrator
- لو مش Admin: يحذّر ويكمل
- لو Admin: ينشئ Firewall rules و Service

---

## 📂 الهيكل بعد الإعداد

```
x gym/
├── Caddyfile
├── setup-caddy.bat
├── setup-caddy-service.bat
├── PORTABLE_CADDY_SETUP.md
├── caddy/                          # ← يتم إنشاؤه تلقائياً
│   ├── caddy.exe                   # ← نسخة من caddy_windows_amd64.exe
│   ├── nssm.exe                    # ← نسخة من nssm.exe (إذا استخدمت Service)
│   ├── Caddyfile                   # ← نسخة من Caddyfile
│   └── logs/                       # ← مجلد السجلات
│       ├── system-access.log
│       └── client-access.log
└── [باقي ملفات المشروع...]
```

---

## 🎬 سيناريوهات الاستخدام

### السيناريو 1: نقل لجهاز جديد في نفس الشبكة
```
1. انسخ مجلد "x gym" كامل لجهاز USB
2. الصق المجلد في الجهاز الجديد (أي مكان)
3. حمّل Caddy وضعه في Desktop
4. شغّل setup-caddy.bat (as Administrator)
5. شغّل setup-caddy-service.bat (as Administrator)
6. غيّر Port Forward في الراوتر للـ IP الجديد
```

### السيناريو 2: تحديث Caddy
```
1. حمّل أحدث نسخة من Caddy
2. ضعها في Desktop/Downloads
3. شغّل setup-caddy.bat (سيستبدل النسخة القديمة)
4. إعادة تشغيل Service: nssm restart CaddyServer
```

### السيناريو 3: تغيير Caddyfile
```
1. عدّل ملف Caddyfile في مجلد المشروع
2. شغّل setup-caddy.bat (سينسخ Caddyfile المحدّث)
3. إعادة تحميل Config: cd caddy && caddy reload --config Caddyfile
   أو إعادة تشغيل Service: nssm restart CaddyServer
```

---

## 🔧 الأوامر المفيدة

### إدارة Caddy يدوياً (بدون Service):
```powershell
# التشغيل
cd "C:\path\to\x gym\caddy"
.\caddy.exe run

# التحقق من Config
.\caddy.exe validate --config Caddyfile

# إعادة تحميل Config (بدون إعادة تشغيل)
.\caddy.exe reload --config Caddyfile

# إيقاف (Ctrl+C)
```

### إدارة Windows Service:
```powershell
# بدء Service
cd "C:\path\to\x gym\caddy"
.\nssm.exe start CaddyServer

# إيقاف Service
.\nssm.exe stop CaddyServer

# إعادة تشغيل Service
.\nssm.exe restart CaddyServer

# حالة Service
.\nssm.exe status CaddyServer

# حذف Service
.\nssm.exe remove CaddyServer confirm
```

### عرض السجلات (Logs):
```powershell
# آخر 50 سطر من سجل النظام الرئيسي
Get-Content "C:\path\to\x gym\caddy\logs\system-access.log" -Tail 50

# آخر 50 سطر من سجل بوابة العملاء
Get-Content "C:\path\to\x gym\caddy\logs\client-access.log" -Tail 50

# متابعة السجل مباشرة (Live)
Get-Content "C:\path\to\x gym\caddy\logs\system-access.log" -Wait -Tail 10
```

---

## ⚠️ تنبيهات مهمة

### 1. الصلاحيات (Administrator):
- **setup-caddy.bat**: يفضّل تشغيله كـ Administrator (للـ Firewall)
- **setup-caddy-service.bat**: **لازم** يشتغل كـ Administrator

### 2. Port Forwarding:
- لو نقلت لجهاز تاني، لازم تعدّل Port Forward في الراوتر
- غيّر Internal IP للـ IP الجديد
- Ports تفضل نفسها: 80 و 443

### 3. Cloudflare DNS:
- DNS Records هتفضل نفسها (مش محتاجة تعديل)
- بس غيّر Public IP إذا تغيّر

### 4. Firewall:
- Windows Firewall rules بتتنشئ لـ ports 80 و 443
- إذا عندك Firewall تاني (مثل Kaspersky), افتح الـ ports يدوياً

---

## 🧪 اختبار الإعداد

### 1. اختبار محلي (Local):
```powershell
# اختبر Caddy شغال
curl http://localhost:80

# اختبر النظام الرئيسي
curl http://localhost:4001

# اختبر بوابة العملاء
curl http://localhost:3002
```

### 2. اختبار من الشبكة المحلية:
```
http://LOCAL_IP  (يجب أن يفتح النظام الرئيسي)
```

### 3. اختبار من الإنترنت:
```
https://system.xgym.website
https://client.xgym.website
```

---

## 🔍 Troubleshooting

### ❌ مشكلة: السكريبت لا يجد Caddy
**الحل:**
1. تأكد من اسم الملف: `caddy_windows_amd64.exe` (بالظبط)
2. ضعه في Desktop أو Downloads
3. أعد تشغيل السكريبت

### ❌ مشكلة: السكريبت لا يجد NSSM
**الحل:**
1. استخرج `nssm.exe` من مجلد `win64`
2. ضعه في Desktop أو Downloads
3. أعد تشغيل `setup-caddy-service.bat`

### ❌ مشكلة: Firewall rules لم يتم إنشاؤها
**الحل:**
1. كليك يمين على `setup-caddy.bat`
2. اختر "Run as administrator"
3. أعد التشغيل

### ❌ مشكلة: Service لا يبدأ
**الحل:**
```powershell
# تحقق من Logs
cd "C:\path\to\x gym\caddy"
Get-Content logs\system-access.log -Tail 50

# اختبر Caddy يدوياً
.\caddy.exe run

# إذا اشتغل يدوياً، أعد إنشاء Service
.\nssm.exe remove CaddyServer confirm
# ثم شغّل setup-caddy-service.bat
```

---

## ✅ Checklist للنقل لجهاز جديد

- [ ] نسخ مجلد "x gym" كامل
- [ ] تحميل caddy_windows_amd64.exe
- [ ] وضع Caddy في Desktop/Downloads
- [ ] تشغيل setup-caddy.bat (as Admin)
- [ ] تحميل nssm.exe (اختياري)
- [ ] وضع NSSM في Desktop/Downloads
- [ ] تشغيل setup-caddy-service.bat (as Admin)
- [ ] تعديل Port Forward في الراوتر
- [ ] اختبار المواقع

---

## 🎯 الفوائد الرئيسية

✅ **Portable**: شغال على أي جهاز Windows بدون تعديل
✅ **No Hardcoded Paths**: كل المسارات نسبية
✅ **Automatic Detection**: يكتشف الملفات تلقائياً
✅ **Smart Search**: يبحث في Desktop و Downloads
✅ **Safe**: يتحقق من الأخطاء قبل التنفيذ
✅ **User-Friendly**: رسائل واضحة بالعربي
✅ **Professional**: Logging, validation, error handling

---

**🎉 الآن عندك setup محمول (Portable) يشتغل على أي جهاز!**

**📝 نصيحة:** احتفظ بنسخة من السكريبتات في USB أو Cloud للنقل السريع لأجهزة جديدة.
