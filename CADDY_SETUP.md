# 🚀 إعداد Caddy لتشغيل النظامين على دومينات مختلفة

## 📋 المتطلبات الحالية

✅ عندك:
- Router port forward: 4001 → جهازك
- Public IP مربوط بـ Cloudflare
- system.xgym.website شغال

❓ عايز:
- client.xgym.website على نفس الجهاز (port 3002)

---

## 🎯 الحل: Caddy Reverse Proxy

### لماذا Caddy؟
- ✅ سهل جداً (أسهل من Nginx)
- ✅ SSL تلقائي (Let's Encrypt)
- ✅ Config بسيط
- ✅ يشتغل على Windows بدون مشاكل
- ✅ إدارة أكثر من دومين

---

## 📥 الخطوة 1: تحميل Caddy

### التحميل:
1. روح [https://caddyserver.com/download](https://caddyserver.com/download)
2. اختر **Windows amd64**
3. حمّل الملف: `caddy_windows_amd64.exe`

### الإعداد:
```powershell
# إنشاء مجلد Caddy
mkdir C:\caddy
mkdir C:\caddy\logs

# نقل الملف المحمّل
move Downloads\caddy_windows_amd64.exe C:\caddy\caddy.exe

# نسخ Caddyfile
copy "C:\Users\amran\Desktop\x gym\Caddyfile" C:\caddy\Caddyfile
```

---

## ⚙️ الخطوة 2: إعداد الراوتر

### Port Forward الجديد:

| Service | External Port | Internal Port | Internal IP | Protocol |
|---------|--------------|---------------|-------------|----------|
| HTTP    | 80           | 80            | جهازك       | TCP      |
| HTTPS   | 443          | 443           | جهازك       | TCP      |

**ملاحظة:** احذف port forward الـ 4001 القديم (مش محتاجينه بعد كده)

---

## 🌐 الخطوة 3: إعداد Cloudflare DNS

### في Cloudflare Dashboard:

#### 1. إضافة Record للـ Client Portal:
```
Type: A
Name: client
Content: YOUR_PUBLIC_IP (نفس الـ IP)
Proxy: ✅ Proxied (البرتقالي)
TTL: Auto
```

#### 2. التحقق من Record الحالي:
```
Type: A
Name: system
Content: YOUR_PUBLIC_IP
Proxy: ✅ Proxied (البرتقالي)
TTL: Auto
```

#### 3. إعدادات SSL/TLS:
- **SSL/TLS → Overview**
- اختر: **Full** أو **Full (strict)**

---

## 🚀 الخطوة 4: تشغيل Caddy

### تشغيل يدوي (للاختبار):

```powershell
# افتح PowerShell as Administrator
cd C:\caddy
.\caddy.exe run
```

يجب أن تشوف:
```
[INFO] Caddy serving
[INFO] Serving system.xgym.website
[INFO] Serving client.xgym.website
```

---

## 🔧 الخطوة 5: تشغيل كـ Windows Service

### استخدام NSSM (Non-Sucking Service Manager):

#### التحميل:
```powershell
# حمّل NSSM من https://nssm.cc/download
# فك الضغط واستخرج nssm.exe

# نقل nssm
copy nssm.exe C:\caddy\nssm.exe
```

#### إنشاء Service:
```powershell
# افتح PowerShell as Administrator
cd C:\caddy

# إنشاء Service
.\nssm.exe install CaddyServer "C:\caddy\caddy.exe" "run" "--config" "C:\caddy\Caddyfile"

# ضبط الخصائص
.\nssm.exe set CaddyServer AppDirectory "C:\caddy"
.\nssm.exe set CaddyServer DisplayName "Caddy Web Server"
.\nssm.exe set CaddyServer Description "Reverse proxy for X Gym System"
.\nssm.exe set CaddyServer Start SERVICE_AUTO_START

# تشغيل Service
.\nssm.exe start CaddyServer
```

#### إدارة Service:
```powershell
# إيقاف
.\nssm.exe stop CaddyServer

# إعادة تشغيل
.\nssm.exe restart CaddyServer

# حالة Service
.\nssm.exe status CaddyServer

# حذف Service (إذا احتجت)
.\nssm.exe remove CaddyServer confirm
```

---

## 🧪 الخطوة 6: الاختبار

### 1. التحقق من Caddy شغال:
```powershell
# افتح PowerShell
curl http://localhost:80

# يجب أن يرجع response
```

### 2. التحقق من الدومينات:

#### من المتصفح:
```
https://system.xgym.website  → يجب أن يفتح النظام الرئيسي
https://client.xgym.website  → يجب أن يفتح بوابة العملاء
```

### 3. التحقق من SSL:
- افتح المتصفح على https://system.xgym.website
- اضغط على القفل 🔒 في شريط العنوان
- يجب أن يقول "Secure" ✅

---

## 📊 هيكل الاتصال النهائي

```
الإنترنت
    ↓
Cloudflare CDN (SSL Termination)
    ↓
Public IP (Router)
    ↓
Port Forward: 80 → Caddy:80
Port Forward: 443 → Caddy:443
    ↓
Caddy Reverse Proxy (Windows)
    ├─ system.xgym.website → localhost:4001 (Main System)
    └─ client.xgym.website → localhost:3002 (Client Portal)
```

---

## 🔍 Troubleshooting

### ❌ مشكلة: Caddy مش شغال

**الحل:**
```powershell
# تحقق من Logs
Get-Content C:\caddy\logs\system-access.log -Tail 50
Get-Content C:\caddy\logs\client-access.log -Tail 50

# تحقق من Caddy شغال
Get-Process caddy

# اختبر الـ Config
cd C:\caddy
.\caddy.exe validate --config Caddyfile
```

---

### ❌ مشكلة: SSL مش شغال

**الحل:**
1. تأكد من Cloudflare SSL/TLS = **Full**
2. تحقق من port 443 مفتوح في الراوتر
3. تحقق من Windows Firewall:
```powershell
# افتح PowerShell as Administrator
New-NetFirewallRule -DisplayName "Caddy HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Caddy HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
```

---

### ❌ مشكلة: client.xgym.website مش شغال

**الحل:**
```powershell
# تحقق من Client Portal شغال
curl http://localhost:3002

# تحقق من Caddy config
cd C:\caddy
.\caddy.exe fmt --overwrite Caddyfile

# إعادة تشغيل Caddy
.\nssm.exe restart CaddyServer
```

---

### ❌ مشكلة: 502 Bad Gateway

**الحل:**
- تأكد من النظامين شغالين:
```powershell
# تحقق من Main System
curl http://localhost:4001

# تحقق من Client Portal
curl http://localhost:3002

# إذا مش شغالين، شغّلهم
cd "C:\Users\amran\Desktop\x gym"
npm run start  # أو npm run electron:start
```

---

## 🔄 التحديث المستقبلي

### عند تحديث الـ Config:
```powershell
# 1. عدّل Caddyfile
notepad C:\caddy\Caddyfile

# 2. تحقق من الـ syntax
.\caddy.exe validate --config Caddyfile

# 3. إعادة تحميل Config (بدون إعادة تشغيل)
.\caddy.exe reload --config Caddyfile
```

---

## 📝 ملاحظات مهمة

1. **Port 4001 Port Forward:**
   - احذفه من الراوتر بعد ما تتأكد Caddy شغال
   - مش محتاجينه بعد كده

2. **Auto-Start:**
   - Caddy Service هيشتغل تلقائياً مع Windows
   - لازم النظامين (4001 و 3002) يشتغلوا تلقائياً كمان

3. **Logs:**
   - Logs موجودة في `C:\caddy\logs\`
   - استخدمها للـ debugging

4. **Cloudflare:**
   - لازم يكون Proxy مفعّل (البرتقالي) ✅
   - SSL/TLS = Full

5. **Windows Firewall:**
   - تأكد port 80 و 443 مفتوحين

---

## ✅ Checklist

- [ ] تحميل Caddy
- [ ] إنشاء Caddyfile
- [ ] Port Forward (80, 443) في الراوتر
- [ ] إضافة client DNS record في Cloudflare
- [ ] ضبط SSL/TLS في Cloudflare
- [ ] فتح Windows Firewall (80, 443)
- [ ] تشغيل Caddy يدوياً (اختبار)
- [ ] إنشاء Windows Service
- [ ] اختبار system.xgym.website
- [ ] اختبار client.xgym.website
- [ ] حذف port forward القديم (4001)

---

## 🎯 النتيجة النهائية

✅ **system.xgym.website** → النظام الرئيسي (port 4001)
✅ **client.xgym.website** → بوابة العملاء (port 3002)
✅ SSL تلقائي من Cloudflare
✅ تشغيل تلقائي مع Windows
✅ Reverse proxy احترافي

---

**🎉 دلوقتي عندك setup احترافي للنظامين على دومينات مختلفة!**
