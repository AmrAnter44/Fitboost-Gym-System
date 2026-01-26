# أسهل طريقة للنشر على Windows 🚀

## الحل الأسهل: Caddy (5 دقائق فقط!)

### الخطوات:

#### 1. نزّل Caddy
اذهب إلى: https://github.com/caddyserver/caddy/releases/latest

ابحث عن: `caddy_X.X.X_windows_amd64.zip`

نزّله وفك الضغط

#### 2. انشئ مجلد
```cmd
mkdir C:\caddy
```

انقل ملف `caddy.exe` للمجلد `C:\caddy\`

#### 3. انشئ ملف Caddyfile
انشئ ملف نصي جديد في `C:\caddy\` اسمه `Caddyfile` (بدون امتداد)

احفظ فيه:
```
system.xgym.website {
    reverse_proxy localhost:4001
}

client.xgym.website {
    reverse_proxy localhost:3002
}
```

#### 4. شغّل Caddy
```cmd
cd C:\caddy
caddy run
```

**تمام! خلصنا 🎉**

---

## تثبيت Caddy كـ Windows Service (يشتغل تلقائياً)

### الطريقة 1: باستخدام NSSM

#### 1. نزّل NSSM
من: https://nssm.cc/download

فك الضغط واحفظ `nssm.exe` في `C:\caddy\`

#### 2. ثبت Caddy كـ Service
افتح CMD **كـ Administrator** واكتب:
```cmd
cd C:\caddy
nssm install Caddy
```

#### 3. في النافذة اللي هتفتح:
- **Path:** `C:\caddy\caddy.exe`
- **Startup directory:** `C:\caddy`
- **Arguments:** `run`

اضغط **Install Service**

#### 4. شغّل الـ Service:
```cmd
nssm start Caddy
```

#### 5. خلي Caddy يشتغل تلقائياً مع Windows:
```cmd
nssm set Caddy Start SERVICE_AUTO_START
```

**تمام! Caddy هيشتغل تلقائياً مع كل إعادة تشغيل 🎉**

---

### الطريقة 2: باستخدام Task Scheduler (بدون برامج إضافية)

#### 1. افتح Task Scheduler
اضغط **Windows + R** واكتب: `taskschd.msc`

#### 2. انشئ Task جديدة
- اضغط **Create Task** من اليمين
- **Name:** Caddy Server
- ✅ علّم على **Run whether user is logged on or not**
- ✅ علّم على **Run with highest privileges**
- ✅ علّم على **Hidden**

#### 3. في تبويب Triggers:
- اضغط **New**
- **Begin the task:** At startup
- اضغط **OK**

#### 4. في تبويب Actions:
- اضغط **New**
- **Action:** Start a program
- **Program/script:** `C:\caddy\caddy.exe`
- **Add arguments:** `run`
- **Start in:** `C:\caddy`
- اضغط **OK**

#### 5. في تبويب Settings:
- ❌ ألغِ تعليم **Stop the task if it runs longer than**
- ✅ علّم على **If the task fails, restart every:** 1 minute
- اضغط **OK**

#### 6. شغّل الـ Task:
اضغط كليك يمين على **Caddy Server** واختر **Run**

**تمام! Caddy شغال 🎉**

---

## أوامر Caddy المفيدة

```cmd
# تشغيل Caddy
cd C:\caddy
caddy run

# إيقاف Caddy (اضغط Ctrl+C)

# تحقق من الإعدادات
caddy validate

# إعادة تحميل الإعدادات بدون إيقاف
caddy reload

# عرض معلومات عن Caddy
caddy version

# إذا كنت مثبته كـ Service بـ NSSM:
nssm start Caddy
nssm stop Caddy
nssm restart Caddy
nssm status Caddy
```

---

## التحقق من أن Caddy شغال

### 1. تحقق من المنفذ 80
```cmd
netstat -ano | findstr ":80"
```
يجب أن تشوف Caddy شغال على port 80

### 2. اختبر الروابط
افتح في المتصفح:
- http://system.xgym.website
- http://client.xgym.website

---

## في حالة وجود مشكلة

### المشكلة: Port 80 is already in use

**الحل 1:** أوقف IIS إذا كان شغال
```cmd
# افتح CMD كـ Administrator
iisreset /stop
```

**الحل 2:** استخدم port مختلف
عدّل `Caddyfile`:
```
:8080 {
    reverse_proxy localhost:4001
}

:8081 {
    reverse_proxy localhost:3002
}
```

ثم في الراوتر، اعمل port forwarding:
- 80 → 8080
- 81 → 8081

---

## مقارنة الحلول

| الحل | الصعوبة | الوقت | المميزات |
|-----|---------|-------|----------|
| **Caddy** | سهل جداً ⭐ | 5 دقائق | HTTPS تلقائي، تكوين بسيط |
| **IIS** | متوسط | 20 دقيقة | مدمج في Windows |
| **Nginx** | صعب على Windows | 30 دقيقة | قوي لكن معقد |

---

## التوصية النهائية 🎯

**استخدم Caddy مع NSSM** - أسهل وأسرع حل!

الخطوات باختصار:
1. نزّل Caddy
2. انشئ Caddyfile
3. نزّل NSSM
4. ثبت Caddy كـ Service
5. خلاص! 🎉

**Total time: 10 دقائق فقط**

---

## ملف Setup تلقائي

احفظ ده في `setup-caddy.bat`:

```batch
@echo off
echo ========================================
echo إعداد Caddy لنظام X Gym
echo ========================================
echo.

REM إنشاء المجلد
if not exist "C:\caddy" mkdir C:\caddy

REM تحقق من وجود caddy.exe
if not exist "C:\caddy\caddy.exe" (
    echo ❌ لم يتم العثور على caddy.exe
    echo يرجى تنزيل Caddy من:
    echo https://github.com/caddyserver/caddy/releases/latest
    echo ونسخ caddy.exe إلى C:\caddy\
    pause
    exit /b 1
)

REM إنشاء Caddyfile
echo system.xgym.website { > C:\caddy\Caddyfile
echo     reverse_proxy localhost:4001 >> C:\caddy\Caddyfile
echo } >> C:\caddy\Caddyfile
echo. >> C:\caddy\Caddyfile
echo client.xgym.website { >> C:\caddy\Caddyfile
echo     reverse_proxy localhost:3002 >> C:\caddy\Caddyfile
echo } >> C:\caddy\Caddyfile

echo ✅ تم إنشاء Caddyfile
echo.

REM تحقق من الإعدادات
echo جاري التحقق من الإعدادات...
cd C:\caddy
caddy validate

if %errorlevel% equ 0 (
    echo ✅ الإعدادات صحيحة
    echo.
    echo لتشغيل Caddy:
    echo   cd C:\caddy
    echo   caddy run
    echo.
    echo أو لتثبيته كـ Service، استخدم NSSM
) else (
    echo ❌ خطأ في الإعدادات
)

pause
```

---

**تم! الآن لديك أسهل طريقة للنشر 🚀**
