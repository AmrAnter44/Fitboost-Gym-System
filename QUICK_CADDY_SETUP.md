# 🚀 إعداد Caddy - خطوات سريعة

## ✅ الخطوات المطلوبة:

### 1️⃣ تحميل Caddy (5 دقائق)
```
https://caddyserver.com/download
→ Windows amd64
```

### 2️⃣ إعداد Caddy
```powershell
mkdir C:\caddy
mkdir C:\caddy\logs
move Downloads\caddy_windows_amd64.exe C:\caddy\caddy.exe
copy Caddyfile C:\caddy\Caddyfile
```

### 3️⃣ إعداد الراوتر
```
Port Forward:
- Port 80  → جهازك
- Port 443 → جهازك
(احذف port forward 4001 القديم)
```

### 4️⃣ إعداد Cloudflare DNS
```
في Cloudflare:
1. Add Record:
   Type: A
   Name: client
   Content: YOUR_PUBLIC_IP (نفس الـ IP الحالي)
   Proxy: ON (برتقالي)

2. SSL/TLS → Full
```

### 5️⃣ Windows Firewall
```powershell
# PowerShell as Administrator
New-NetFirewallRule -DisplayName "Caddy HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Caddy HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
```

### 6️⃣ تشغيل Caddy (اختبار)
```powershell
cd C:\caddy
.\caddy.exe run
```

يجب أن تشوف: "Caddy serving"

### 7️⃣ اختبار
```
https://system.xgym.website → النظام الرئيسي
https://client.xgym.website → بوابة العملاء
```

---

## 🔧 تشغيل كـ Windows Service

### تحميل NSSM:
```
https://nssm.cc/download
→ فك الضغط → نسخ nssm.exe إلى C:\caddy\
```

### إنشاء Service:
```powershell
cd C:\caddy
.\nssm.exe install CaddyServer "C:\caddy\caddy.exe" "run" "--config" "C:\caddy\Caddyfile"
.\nssm.exe set CaddyServer AppDirectory "C:\caddy"
.\nssm.exe set CaddyServer Start SERVICE_AUTO_START
.\nssm.exe start CaddyServer
```

---

## 📋 الهيكل النهائي

```
Internet → Cloudflare → Router (80/443) → Caddy
                                           ├─ system.xgym.website → :4001
                                           └─ client.xgym.website → :3002
```

---

## ⚠️ مهم

1. تأكد النظامين شغالين قبل اختبار Caddy
2. بعد ما تتأكد Caddy شغال، احذف port forward 4001
3. Caddy هيشتغل تلقائياً مع Windows

---

للتفاصيل الكاملة: اقرأ CADDY_SETUP.md
