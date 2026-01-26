# تشغيل النظامين معاً داخل Electron ⚡

## الفكرة 💡

بدلاً من استخدام Nginx أو Caddy، Electron نفسه هيشغل الاتنين:
- **النظام الرئيسي** على port 4001
- **بوابة العملاء** على port 3002

كل حاجة في تطبيق واحد! 🎉

---

## التعديلات اللي عملناها ✅

### 1. ملف `electron/main.js`

أضفنا:
```javascript
let clientPortalProcess; // متغير لبوابة العملاء

// Function جديدة لتشغيل بوابة العملاء
async function startClientPortalServer() {
  // تشغيل client-portal على port 3002
  clientPortalProcess = spawn('npx', ['next', 'start', '-p', '3002'], {
    cwd: clientPortalPath,
    // ...
  });
}

// في app.whenReady():
if (!isDev) {
  await startProductionServer(); // port 4001
  await startClientPortalServer(); // port 3002
}

// Cleanup عند الإغلاق:
if (clientPortalProcess) clientPortalProcess.kill();
```

### 2. ملف `package.json`

أضفنا `client-portal` في الـ build files:
```json
"files": [
  "electron/**/*",
  ".next/standalone/**/*",
  "client-portal/**/*",  // ✅ جديد
  // ...
],
"asarUnpack": [
  ".next/standalone/**/*",
  "client-portal/**/*",  // ✅ جديد
  // ...
]
```

---

## كيفية الاستخدام 🚀

### في Development Mode:

#### الطريقة 1: ملف واحد (الأسهل)
```cmd
# دبل كليك على:
start-both-dev.bat
```

هيفتح نافذتين:
- نافذة للنظام الرئيسي (port 4001)
- نافذة لبوابة العملاء (port 3002)

#### الطريقة 2: يدوياً
```cmd
# Terminal 1 - النظام الرئيسي
cd "C:\Users\amran\Desktop\x gym"
npm run dev

# Terminal 2 - بوابة العملاء
cd "C:\Users\amran\Desktop\x gym\client-portal"
npm run dev
```

#### الطريقة 3: مع Electron
```cmd
cd "C:\Users\amran\Desktop\x gym"
npm run electron:dev
```

**ملحوظة:** في dev mode، Electron مش هيشغل client-portal تلقائياً، لازم تشغله في terminal منفصل.

---

### في Production Mode:

عند بناء الـ Electron app:

```cmd
# 1. بناء النظام الرئيسي
cd "C:\Users\amran\Desktop\x gym"
npm run build

# 2. بناء بوابة العملاء
cd client-portal
npm run build
cd ..

# 3. بناء Electron
npm run electron:build:win
```

**الآن عند تشغيل الـ exe:**
- الاتنين هيشتغلوا تلقائياً! 🎉
- النظام الرئيسي على port 4001
- بوابة العملاء على port 3002

---

## الوصول للتطبيقات 🌐

### في الشبكة المحلية (Local Network):

افتح موجه الأوامر واكتب:
```cmd
ipconfig
```

شوف الـ IPv4 Address (مثلاً: `192.168.1.100`)

**من أي جهاز في نفس الشبكة:**
- النظام الرئيسي: `http://192.168.1.100:4001`
- بوابة العملاء: `http://192.168.1.100:3002`

### على الإنترنت (مع Router Port Forwarding):

في إعدادات الراوتر:
1. Port 4001 → IP جهازك
2. Port 3002 → IP جهازك

**من خارج الشبكة:**
- النظام الرئيسي: `http://your-public-ip:4001`
- بوابة العملاء: `http://your-public-ip:3002`

---

## مع Domain Names (اختياري) 🌍

### الخيار 1: استخدام Cloudflare Tunnel (مجاني + بدون port forwarding)

1. ثبت Cloudflare Tunnel
2. أضف 2 tunnels:
   ```
   system.xgym.website → localhost:4001
   client.xgym.website → localhost:3002
   ```

**مميزات:**
- ✅ HTTPS تلقائي
- ✅ مش محتاج port forwarding
- ✅ مش محتاج Nginx ولا Caddy
- ✅ يشتغل من خلف أي firewall

### الخيار 2: استخدام Caddy (محلي)

إذا عايز تستخدم domain محلي بدون ports:

```
# Caddyfile
system.xgym.local {
    reverse_proxy localhost:4001
}

client.xgym.local {
    reverse_proxy localhost:3002
}
```

عدّل ملف `hosts`:
```
127.0.0.1 system.xgym.local
127.0.0.1 client.xgym.local
```

---

## الفوائد 🎯

### مقارنة مع Nginx/Caddy:

| الميزة | Electron (الحل الحالي) | Nginx/Caddy |
|--------|----------------------|-------------|
| التثبيت | ✅ لا شيء (مدمج) | ❌ محتاج تثبيت منفصل |
| الإعداد | ✅ تلقائي | ❌ محتاج تكوين يدوي |
| الصيانة | ✅ بسيطة | ⚠️ محتاج خبرة |
| Port forwarding | محتاج 2 ports | محتاج 1 port فقط |
| التشغيل | ✅ تلقائي مع الـ app | ❌ service منفصل |

### متى تستخدم Nginx/Caddy:

استخدمهم إذا:
- ❗ عايز domain بدون ports (system.xgym.website بدلاً من ip:4001)
- ❗ عايز HTTPS certificates
- ❗ عايز Load Balancing
- ❗ عندك أكتر من سيرفر

### الحل الحالي (Electron فقط) كويس لو:

- ✅ هتستخدم IP:Port مباشرة
- ✅ شبكة محلية (Local Network)
- ✅ عايز حل بسيط بدون تعقيدات
- ✅ مش عايز تثبت برامج إضافية

---

## الأوامر المفيدة 📝

### التحقق من التطبيقات الشغالة:
```cmd
# شوف إيه الشغال على المنافذ
netstat -ano | findstr "4001 3002"
```

### إيقاف المنافذ:
```cmd
# إيقاف port 4001
for /f "tokens=5" %a in ('netstat -ano ^| findstr :4001') do taskkill /F /PID %a

# إيقاف port 3002
for /f "tokens=5" %a in ('netstat -ano ^| findstr :3002') do taskkill /F /PID %a
```

### اختبار الاتصال:
```cmd
# اختبار النظام الرئيسي
curl http://localhost:4001

# اختبار بوابة العملاء
curl http://localhost:3002
```

---

## Troubleshooting 🔧

### المشكلة: Port already in use

**الحل:**
```cmd
# أوقف التطبيق الموجود
netstat -ano | findstr :3002
taskkill /F /PID [رقم الـ PID]
```

### المشكلة: Client Portal لا يعمل في Production

**الحل:**
1. تأكد من بناء client-portal قبل electron build:
   ```cmd
   cd client-portal
   npm run build
   cd ..
   npm run electron:build:win
   ```

2. تحقق من الـ logs في Console

### المشكلة: Cannot connect from other devices

**الحل:**
1. تأكد من Firewall يسمح بالمنافذ 4001 و 3002
2. تحقق من أن السيرفرات بتستمع على 0.0.0.0 (مش 127.0.0.1)

---

## الخلاصة 🎉

**الحل الحالي:**
- ✅ Electron بيشغل الاتنين تلقائياً
- ✅ مش محتاج Nginx ولا Caddy
- ✅ بسيط وسهل
- ⚠️ محتاج port forwarding لـ 2 ports

**إذا كنت عايز domains بدون ports:**
- استخدم Cloudflare Tunnel (الأسهل)
- أو استخدم Caddy (محلي)

**كل حاجة شغالة دلوقتي! 🚀**
