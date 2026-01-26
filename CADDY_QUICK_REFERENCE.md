# ⚡ Caddy Quick Reference - مرجع سريع

## 🚀 إعداد سريع (Quick Setup)

### على جهاز جديد:
```bash
1. انسخ مجلد المشروع
2. حمّل caddy_windows_amd64.exe → ضعه في Desktop
3. كليك يمين setup-caddy.bat → Run as Administrator
4. كليك يمين setup-caddy-service.bat → Run as Administrator
```

---

## 📦 الملفات المطلوبة

| ملف | مصدر | موقع |
|-----|------|------|
| `Caddyfile` | مجلد المشروع | نفس مكان السكريبت |
| `caddy_windows_amd64.exe` | [caddyserver.com](https://caddyserver.com/download) | Desktop/Downloads |
| `nssm.exe` | [nssm.cc](https://nssm.cc/download) | Desktop/Downloads |

---

## 🎮 الأوامر الأساسية

### تشغيل يدوي:
```powershell
cd caddy
.\caddy.exe run                    # تشغيل
.\caddy.exe validate               # تحقق من Config
.\caddy.exe reload                 # إعادة تحميل Config
```

### Windows Service:
```powershell
cd caddy
.\nssm.exe start CaddyServer       # بدء
.\nssm.exe stop CaddyServer        # إيقاف
.\nssm.exe restart CaddyServer     # إعادة تشغيل
.\nssm.exe status CaddyServer      # الحالة
```

### السجلات (Logs):
```powershell
# عرض آخر 50 سطر
Get-Content caddy\logs\system-access.log -Tail 50
Get-Content caddy\logs\client-access.log -Tail 50

# متابعة مباشرة
Get-Content caddy\logs\system-access.log -Wait -Tail 10
```

---

## 🌐 إعدادات الشبكة

### Port Forwarding (Router):
```
External → Internal
80       → 80
443      → 443
```

### Cloudflare DNS:
```
Type: A
Name: system
Content: YOUR_PUBLIC_IP
Proxy: ✅ Enabled

Type: A
Name: client
Content: YOUR_PUBLIC_IP
Proxy: ✅ Enabled
```

### SSL/TLS (Cloudflare):
```
SSL/TLS → Overview → Full
```

---

## 🔥 Windows Firewall

### إنشاء يدوي:
```powershell
# كـ Administrator
netsh advfirewall firewall add rule name="Caddy HTTP" dir=in action=allow protocol=TCP localport=80
netsh advfirewall firewall add rule name="Caddy HTTPS" dir=in action=allow protocol=TCP localport=443
```

### حذف:
```powershell
netsh advfirewall firewall delete rule name="Caddy HTTP"
netsh advfirewall firewall delete rule name="Caddy HTTPS"
```

---

## 🧪 الاختبار

### محلي:
```powershell
curl http://localhost:80           # Caddy
curl http://localhost:4001         # Main System
curl http://localhost:3002         # Client Portal
```

### من الإنترنت:
```
https://system.xgym.website        # Main System
https://client.xgym.website        # Client Portal
```

---

## 🔧 Troubleshooting سريع

| مشكلة | حل |
|-------|-----|
| Caddy لا يبدأ | تحقق من Caddyfile: `caddy validate` |
| 502 Bad Gateway | تأكد من تشغيل port 4001 و 3002 |
| SSL Error | Cloudflare SSL/TLS = Full |
| Service لا يبدأ | شغّل يدوياً للتحقق: `caddy run` |
| Firewall | شغّل setup-caddy.bat كـ Admin |

---

## 📍 المسارات المهمة

```
المشروع/
├── caddy/
│   ├── caddy.exe           # البرنامج
│   ├── nssm.exe            # Service Manager
│   ├── Caddyfile           # الإعدادات
│   └── logs/               # السجلات
│       ├── system-access.log
│       └── client-access.log
├── setup-caddy.bat         # الإعداد الرئيسي
└── setup-caddy-service.bat # إعداد Service
```

---

## ⚡ نصائح سريعة

1. **Always run as Administrator** عند الإعداد
2. **تحقق من Logs** عند أي مشكلة
3. **Test locally first** قبل فتح الـ Ports
4. **Keep backups** من Caddyfile
5. **Document changes** في Caddyfile

---

## 🔄 تحديث Caddyfile

```powershell
# 1. عدّل Caddyfile
notepad caddy\Caddyfile

# 2. تحقق من الـ Syntax
cd caddy
.\caddy.exe validate --config Caddyfile

# 3. إعادة تحميل (بدون إعادة تشغيل)
.\caddy.exe reload --config Caddyfile
# أو
.\nssm.exe restart CaddyServer
```

---

## 📱 URLs النهائية

| نظام | URL | Port |
|------|-----|------|
| Main System | https://system.xgym.website | 4001 |
| Client Portal | https://client.xgym.website | 3002 |
| Caddy | localhost:80/443 | 80/443 |

---

**💡 Tip:** احفظ هذا الملف للرجوع السريع!
