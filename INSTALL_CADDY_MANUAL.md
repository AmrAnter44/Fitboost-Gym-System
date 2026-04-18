# 📦 تثبيت Caddy يدوياً - خطوة بخطوة

## الطريقة 1: التحميل المباشر (الأسهل)

### 1️⃣ تحميل Caddy:

1. افتح المتصفح واذهب إلى:
   ```
   https://caddyserver.com/download
   ```

2. اختر:
   - **Platform:** Windows
   - **Architecture:** amd64
   - اضغط **Download**

3. سيتم تحميل ملف `caddy_windows_amd64.exe`

---

### 2️⃣ نقل الملف:

1. افتح مجلد التحميلات (Downloads)
2. اعمل مجلد جديد: `C:\Caddy`
3. انقل ملف `caddy_windows_amd64.exe` إلى `C:\Caddy`
4. أعد تسمية الملف إلى: `caddy.exe`

---

### 3️⃣ إضافة Caddy إلى PATH:

**الطريقة السهلة:**

1. اضغط `Win + R`
2. اكتب: `sysdm.cpl` واضغط Enter
3. اذهب إلى تاب **Advanced**
4. اضغط **Environment Variables**
5. في **System variables**، ابحث عن `Path` واضغط **Edit**
6. اضغط **New**
7. اكتب: `C:\Caddy`
8. اضغط **OK** على كل النوافذ

---

### 4️⃣ تأكيد التثبيت:

افتح **Command Prompt جديد** واكتب:

```cmd
caddy version
```

يجب أن يظهر رقم الإصدار (مثل: `v2.10.2`)

---

## الطريقة 2: باستخدام PowerShell (أسرع)

افتح **PowerShell as Administrator** وشغل:

```powershell
# إنشاء المجلد
New-Item -ItemType Directory -Path "C:\Caddy" -Force

# تحميل Caddy
Invoke-WebRequest -Uri "https://caddyserver.com/api/download?os=windows&arch=amd64" -OutFile "C:\Caddy\caddy.exe"

# إضافة للـ PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
if ($currentPath -notlike "*C:\Caddy*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;C:\Caddy", "Machine")
}

# التحقق من التثبيت
& "C:\Caddy\caddy.exe" version
```

---

## الطريقة 3: باستخدام Chocolatey

إذا كان عندك Chocolatey مثبت:

```cmd
choco install caddy
```

---

## 🔍 التحقق من التثبيت:

بعد أي طريقة من الطرق السابقة:

1. **أغلق** كل نوافذ CMD أو PowerShell المفتوحة
2. **افتح** نافذة جديدة
3. شغل:
   ```cmd
   caddy version
   ```

لو ظهر رقم الإصدار، يبقى كده تمام! ✅

---

## ❌ حل المشاكل:

### لو الأمر `caddy` مش شغال:

استخدم المسار الكامل:
```cmd
C:\Caddy\caddy.exe version
```

### لو PATH مش شغال:

قفل كل النوافذ وافتح CMD جديد as Administrator

---

## 🚀 الخطوة التالية:

بعد ما Caddy يتثبت، ارجع لمجلد المشروع وشغل:

```cmd
cd "C:\Users\amran\Desktop\x gym"
start-all.bat
```

---

**أي طريقة من دول أسهل ليك؟** 🎯
