# 🌐 دليل ربط الدومين system.xgym.website

## 📋 المعلومات الحالية

- **الدومين الأساسي**: xgym.website
- **الـ Subdomain المطلوب**: system.xgym.website
- **الـ IP المحلي**: 192.168.1.94
- **البورت المحلي**: 4001
- **البورت الخارجي**: 80 (HTTP), 443 (HTTPS)

---

## 🔧 الخطوة 1: الحصول على الـ Public IP

1. افتح المتصفح واذهب إلى: https://whatismyipaddress.com/
2. انسخ الـ **IPv4 Address** (مثال: `41.234.56.78`)
3. احتفظ بهذا الرقم - ستحتاجه في الخطوة التالية

---

## 🌍 الخطوة 2: إعدادات DNS على GoDaddy

### تسجيل الدخول:
1. اذهب إلى: https://dnsmanagement.godaddy.com/
2. سجل دخول بحسابك
3. اختر دومين `xgym.website`

### إضافة A Record:

| الحقل | القيمة |
|------|--------|
| **Type** | A |
| **Host** | system |
| **Points to** | [ضع الـ Public IP هنا] |
| **TTL** | 600 seconds (أو default) |

**مثال:**
```
Type: A
Host: system
Points to: 41.234.56.78
TTL: 600
```

### حذف السجلات المتعارضة:
- احذف أي سجل قديم لـ `system` إذا كان موجود
- احذف أي CNAME record لـ `system`

### الانتظار:
⏰ **DNS Propagation** يستغرق من 5 دقائق إلى 48 ساعة (عادة 15-30 دقيقة)

### التحقق:
```bash
# Windows Command Prompt
nslookup system.xgym.website

# يجب أن يظهر الـ IP العام الخاص بك
```

---

## 🔌 الخطوة 3: Port Forwarding على الراوتر

### إعدادات الراوتر:

#### Port 80 (HTTP):
```
Service Name: Gym-HTTP
External Port: 80
Internal Port: 4001
Internal IP: 192.168.1.94
Protocol: TCP
```

#### Port 443 (HTTPS):
```
Service Name: Gym-HTTPS
External Port: 443
Internal Port: 4001
Internal IP: 192.168.1.94
Protocol: TCP
```

### ⚠️ ملاحظات مهمة:
- تأكد أن **Firewall** على الجهاز يسمح بالـ ports
- بعض مزودي الإنترنت يغلقون Port 80 - اتصل بهم للتأكد

---

## 🚀 الخطوة 4: تشغيل السيرفر

### Option A: تشغيل مباشر على Port 80

**⚠️ يحتاج صلاحيات Administrator**

```bash
# تعديل الـ port في package.json
# غير من 4001 إلى 80

# ثم شغل:
npm run dev
```

### Option B: استخدام Reverse Proxy (موصى به) ✅

استخدم **nginx** أو **caddy** كـ reverse proxy:

#### تثبيت Caddy (الأسهل):

1. **تحميل Caddy:**
   - اذهب إلى: https://caddyserver.com/download
   - حمل النسخة لـ Windows

2. **إنشاء Caddyfile:**

```bash
# احفظ هذا في ملف اسمه Caddyfile

system.xgym.website {
    reverse_proxy localhost:4001

    # SSL تلقائي من Let's Encrypt
    tls {
        email your-email@gmail.com
    }

    # Headers
    header {
        # Security headers
        Strict-Transport-Security "max-age=31536000;"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # Logging
    log {
        output file access.log
    }
}
```

3. **تشغيل Caddy:**

```bash
# Terminal 1: شغل Next.js
npm run dev

# Terminal 2: شغل Caddy
caddy run --config Caddyfile
```

**مميزات Caddy:**
- ✅ SSL certificate تلقائي (HTTPS)
- ✅ Auto-renewal للـ certificates
- ✅ سهل جداً في الإعداد
- ✅ Reverse proxy احترافي

---

## 🔐 الخطوة 5: SSL Certificate (HTTPS)

### باستخدام Caddy (تلقائي):
Caddy يعمل SSL تلقائياً! ما تحتاج تعمل حاجة.

### بدون Caddy (يدوي):
استخدم **Certbot** من Let's Encrypt:

```bash
# تثبيت Certbot
# اتبع التعليمات على: https://certbot.eff.org/
```

---

## ✅ الخطوة 6: اختبار الاتصال

### 1. اختبار محلي:
```bash
# افتح المتصفح
http://localhost:4001
```

### 2. اختبار بالـ IP المحلي:
```bash
http://192.168.1.94:4001
```

### 3. اختبار بالـ Public IP:
```bash
http://[Your-Public-IP]
```

### 4. اختبار بالدومين:
```bash
http://system.xgym.website
# أو
https://system.xgym.website
```

---

## 🔍 حل المشاكل الشائعة

### المشكلة 1: "This site can't be reached"
**الحل:**
- تأكد من DNS settings صحيحة
- انتظر DNS propagation (15-30 دقيقة)
- تأكد Port Forwarding شغال

### المشكلة 2: "ERR_CONNECTION_REFUSED"
**الحل:**
- تأكد السيرفر شغال على Port 4001
- تأكد Firewall يسمح بالاتصالات
- تأكد Port Forwarding على الراوتر صحيح

### المشكلة 3: "ERR_SSL_PROTOCOL_ERROR"
**الحل:**
- استخدم Caddy للـ SSL التلقائي
- أو استخدم Certbot لإصدار certificate

### المشكلة 4: الصفحة تظهر 404
**الحل:**
- تأكد السيرفر شغال بشكل صحيح
- تأكد من next.config.js موجود
- راجع الـ logs للأخطاء

---

## 📝 Checklist النهائي

قبل ما تبدأ، تأكد من:

- [ ] حصلت على الـ Public IP
- [ ] أضفت A Record على GoDaddy
- [ ] عملت Port Forwarding للـ ports 80 و 443
- [ ] السيرفر شغال على Port 4001
- [ ] Firewall يسمح بالاتصالات
- [ ] DNS propagation خلص (15-30 دقيقة)
- [ ] نصبت Caddy أو reverse proxy
- [ ] SSL certificate شغال
- [ ] اختبرت الدومين

---

## 🆘 الدعم

إذا واجهت مشاكل:

1. **تحقق من Logs:**
   ```bash
   # Next.js logs
   npm run dev

   # Caddy logs
   cat access.log
   ```

2. **اختبر DNS:**
   ```bash
   nslookup system.xgym.website
   ```

3. **اختبر Port:**
   ```bash
   # من جهاز آخر خارج الشبكة
   telnet [Your-Public-IP] 80
   ```

---

## 🎯 الحل السريع (Recommended)

**الطريقة الأسهل والأسرع:**

1. ✅ ضع الـ Public IP في GoDaddy DNS
2. ✅ نصب Caddy
3. ✅ شغل Next.js: `npm run dev`
4. ✅ شغل Caddy: `caddy run --config Caddyfile`
5. ✅ افتح: `https://system.xgym.website`

**خلاص! 🎉**

---

## 📞 معلومات إضافية

- **Caddy Download**: https://caddyserver.com/download
- **Let's Encrypt**: https://letsencrypt.org/
- **GoDaddy DNS Help**: https://www.godaddy.com/help/manage-dns-680

---

**بالتوفيق! 🚀**
