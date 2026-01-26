# إعداد IIS على Windows (بديل Nginx) 🪟

## مميزات استخدام IIS على Windows:
- ✅ موجود في Windows أصلاً (مش محتاج تنزيل)
- ✅ واجهة رسومية سهلة (GUI)
- ✅ مدعوم رسمياً من Microsoft
- ✅ أسهل من Nginx على Windows

---

## الطريقة 1: تفعيل IIS (خطوات بسيطة جداً)

### خطوة 1: تفعيل IIS
1. اضغط **Windows + R**
2. اكتب: `appwiz.cpl`
3. اضغط Enter
4. اضغط "Turn Windows features on or off" من الشمال
5. علّم على:
   - ✅ Internet Information Services
   - ✅ Internet Information Services > World Wide Web Services
   - ✅ Internet Information Services > Web Management Tools > IIS Management Console
6. اضغط OK واستنى التثبيت

### خطوة 2: تثبيت URL Rewrite و ARR
1. نزّل وثبت **URL Rewrite Module**:
   https://www.iis.net/downloads/microsoft/url-rewrite

2. نزّل وثبت **Application Request Routing (ARR)**:
   https://www.iis.net/downloads/microsoft/application-request-routing

### خطوة 3: تكوين ARR
1. افتح **IIS Manager** (اكتب "IIS" في Start Menu)
2. اضغط على اسم السيرفر (الجهاز) من الشمال
3. دبل كليك على **Application Request Routing Cache**
4. من اليمين، اضغط **Server Proxy Settings**
5. علّم على ✅ **Enable proxy**
6. اضغط **Apply**

### خطوة 4: إنشاء موقع للنظام الرئيسي

1. في IIS Manager، اضغط كليك يمين على **Sites**
2. اختر **Add Website**
3. املأ البيانات:
   - **Site name:** XGym-System
   - **Physical path:** `C:\Users\amran\Desktop\x gym`
   - **Binding:**
     - Type: http
     - IP: All Unassigned
     - Port: 80
     - Host name: `system.xgym.website`
4. اضغط **OK**

### خطوة 5: إضافة URL Rewrite للنظام الرئيسي

1. اضغط على موقع **XGym-System**
2. دبل كليك على **URL Rewrite**
3. من اليمين، اضغط **Add Rule(s)**
4. اختر **Reverse Proxy**
5. في خانة "Inbound Rules", اكتب: `localhost:4001`
6. اضغط **OK**

### خطوة 6: إنشاء موقع لبوابة العملاء

1. اضغط كليك يمين على **Sites** مرة تانية
2. اختر **Add Website**
3. املأ البيانات:
   - **Site name:** XGym-Client
   - **Physical path:** `C:\Users\amran\Desktop\x gym\client-portal`
   - **Binding:**
     - Type: http
     - IP: All Unassigned
     - Port: 80
     - Host name: `client.xgym.website`
4. اضغط **OK**

### خطوة 7: إضافة URL Rewrite لبوابة العملاء

1. اضغط على موقع **XGym-Client**
2. دبل كليك على **URL Rewrite**
3. من اليمين، اضغط **Add Rule(s)**
4. اختر **Reverse Proxy**
5. في خانة "Inbound Rules", اكتب: `localhost:3002`
6. اضغط **OK**

### خطوة 8: تشغيل المواقع

1. اضغط كليك يمين على **XGym-System**
2. اختر **Start** (أو **Restart** لو شغال)
3. نفس الشيء لـ **XGym-Client**

---

## ✅ تمام! دلوقتي:
- http://system.xgym.website → النظام الرئيسي
- http://client.xgym.website → بوابة العملاء

---

## الطريقة 2: سكريبت تلقائي لـ IIS

احفظ الكود ده في ملف `setup-iis.ps1`:

```powershell
# يجب تشغيله كـ Administrator
# Run as Administrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "إعداد IIS لنظام X Gym" -ForegroundColor Cyan
Write-Host "Setting up IIS for X Gym System" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# تفعيل IIS
Write-Host "[1/6] تفعيل IIS... Enabling IIS..." -ForegroundColor Yellow
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole -All -NoRestart
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServer -All -NoRestart
Enable-WindowsOptionalFeature -Online -FeatureName IIS-ManagementConsole -All -NoRestart
Write-Host "✅ تم تفعيل IIS" -ForegroundColor Green
Write-Host ""

# استيراد WebAdministration module
Write-Host "[2/6] تحميل IIS Module..." -ForegroundColor Yellow
Import-Module WebAdministration
Write-Host "✅ تم" -ForegroundColor Green
Write-Host ""

# إنشاء موقع النظام الرئيسي
Write-Host "[3/6] إنشاء موقع النظام الرئيسي... Creating main system site..." -ForegroundColor Yellow

# حذف الموقع إذا كان موجوداً
if (Get-Website -Name "XGym-System" -ErrorAction SilentlyContinue) {
    Remove-Website -Name "XGym-System"
}

# إنشاء الموقع
New-Website -Name "XGym-System" `
    -PhysicalPath "C:\Users\amran\Desktop\x gym" `
    -Port 80 `
    -HostHeader "system.xgym.website" `
    -ApplicationPool "DefaultAppPool"

Write-Host "✅ تم إنشاء موقع النظام الرئيسي" -ForegroundColor Green
Write-Host ""

# إنشاء موقع بوابة العملاء
Write-Host "[4/6] إنشاء موقع بوابة العملاء... Creating client portal site..." -ForegroundColor Yellow

# حذف الموقع إذا كان موجوداً
if (Get-Website -Name "XGym-Client" -ErrorAction SilentlyContinue) {
    Remove-Website -Name "XGym-Client"
}

# إنشاء الموقع
New-Website -Name "XGym-Client" `
    -PhysicalPath "C:\Users\amran\Desktop\x gym\client-portal" `
    -Port 80 `
    -HostHeader "client.xgym.website" `
    -ApplicationPool "DefaultAppPool"

Write-Host "✅ تم إنشاء موقع بوابة العملاء" -ForegroundColor Green
Write-Host ""

# إضافة URL Rewrite rules (يدوياً بعد تثبيت URL Rewrite Module)
Write-Host "[5/6] ملاحظة: يجب تثبيت URL Rewrite و ARR يدوياً" -ForegroundColor Yellow
Write-Host "Note: You need to install URL Rewrite and ARR manually" -ForegroundColor Yellow
Write-Host ""
Write-Host "نزّل من هنا - Download from:" -ForegroundColor White
Write-Host "1. URL Rewrite: https://www.iis.net/downloads/microsoft/url-rewrite" -ForegroundColor White
Write-Host "2. ARR: https://www.iis.net/downloads/microsoft/application-request-routing" -ForegroundColor White
Write-Host ""

# عرض الحالة
Write-Host "[6/6] حالة المواقع - Sites Status:" -ForegroundColor Yellow
Get-Website | Select-Object Name, State, PhysicalPath, @{n="Bindings";e={$_.bindings.Collection.bindingInformation}}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ اكتمل الإعداد!" -ForegroundColor Green
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "الخطوات التالية - Next Steps:" -ForegroundColor Yellow
Write-Host "1. ثبت URL Rewrite Module" -ForegroundColor White
Write-Host "2. ثبت Application Request Routing (ARR)" -ForegroundColor White
Write-Host "3. فعّل Server Proxy في ARR" -ForegroundColor White
Write-Host "4. أضف Reverse Proxy rules لكل موقع" -ForegroundColor White
Write-Host ""

Read-Host "اضغط Enter للخروج - Press Enter to exit"
```

**لتشغيله:**
```powershell
# اضغط كليك يمين على PowerShell واختر "Run as Administrator"
# Then run:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force
cd "C:\Users\amran\Desktop\x gym"
.\setup-iis.ps1
```

---

## الطريقة 3: بديل أسهل - Caddy Web Server

**Caddy أسهل كتير من Nginx ويشتغل على Windows بشكل ممتاز!**

### تثبيت Caddy:

1. نزّل Caddy من: https://caddyserver.com/download
2. اختر **Windows amd64**
3. فك الضغط واحفظ `caddy.exe` في: `C:\caddy\`

### إنشاء ملف Caddyfile:

احفظ الكود ده في `C:\caddy\Caddyfile`:

```
system.xgym.website {
    reverse_proxy localhost:4001
}

client.xgym.website {
    reverse_proxy localhost:3002
}
```

### تشغيل Caddy:

```cmd
cd C:\caddy
caddy run
```

### أو تثبيته كـ Service:

```cmd
cd C:\caddy
caddy install
caddy start
```

**تمام! Caddy شغال 🎉**

---

## مقارنة الخيارات

| الخيار | السهولة | المميزات | العيوب |
|--------|---------|-----------|---------|
| **IIS** | متوسطة | مدمج في Windows، واجهة رسومية | محتاج تثبيت modules إضافية |
| **Caddy** | سهلة جداً | تكوين بسيط جداً، HTTPS تلقائي | ملف تنفيذي خارجي |
| **Nginx** | صعبة على Windows | قوي ومشهور | غير مثالي لـ Windows |

---

## التوصية 🎯

**استخدم Caddy** - الأسهل والأسرع!

خطوات سريعة:
```cmd
# 1. نزّل caddy.exe
# 2. احفظه في C:\caddy\
# 3. انشئ Caddyfile بالمحتوى اللي فوق
# 4. شغله:
cd C:\caddy
caddy run
```

**وخلاص! 5 دقائق بس 🚀**

---

## الخيار الأخير: Port Forwarding فقط (بدون Reverse Proxy)

إذا عايز حل بدون أي برامج إضافية:

1. **شغل النظام الرئيسي على port 80 مباشرة:**
   ```json
   // في package.json
   "start": "next start -p 80"
   ```

2. **شغل بوابة العملاء على port 8080:**
   ```json
   // في client-portal/package.json
   "start": "next start -p 8080"
   ```

3. **Port forwarding في الراوتر:**
   - Port 80 → system.xgym.website
   - Port 8080 → client.xgym.website

**لكن ده مش recommended لأن محتاج تفتح أكتر من port**

---

**اختصار: استخدم Caddy، أسهل حل! 🎯**
