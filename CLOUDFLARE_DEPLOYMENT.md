# دليل النشر الكامل مع Cloudflare 🚀

## 1️⃣ إعداد Cloudflare DNS

### الخطوة 1: افتح Cloudflare Dashboard
1. اذهب لـ https://dash.cloudflare.com
2. اختر الدومين: `xgym.website`
3. اذهب لتبويب **DNS** → **Records**

### الخطوة 2: أضف السجلات

#### السجل الأول - النظام الرئيسي:
```
Type:           A
Name:           system
IPv4 address:   [ضع IP السيرفر هنا]
Proxy status:   🟠 Proxied (مفعّل)
TTL:            Auto
```

#### السجل الثاني - بوابة العملاء:
```
Type:           A
Name:           client
IPv4 address:   [نفس IP السيرفر]
Proxy status:   🟠 Proxied (مفعّل)
TTL:            Auto
```

### النتيجة النهائية في Cloudflare:
```
Type    Name      Content              Proxy    TTL
────────────────────────────────────────────────────
A       system    xxx.xxx.xxx.xxx      🟠       Auto
A       client    xxx.xxx.xxx.xxx      🟠       Auto
```

---

## 2️⃣ إعداد Nginx على السيرفر

### تثبيت Nginx:
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# تشغيل Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### إنشاء ملف الإعداد:
```bash
sudo nano /etc/nginx/sites-available/xgym
```

### نسخ المحتوى:
انسخ محتوى ملف `nginx-setup.conf` (الموجود في نفس المجلد)

### تفعيل الإعداد:
```bash
# ربط الملف
sudo ln -s /etc/nginx/sites-available/xgym /etc/nginx/sites-enabled/

# حذف الإعداد الافتراضي (اختياري)
sudo rm /etc/nginx/sites-enabled/default

# اختبار الإعداد
sudo nginx -t

# إعادة تشغيل Nginx
sudo systemctl restart nginx
```

---

## 3️⃣ Port Forwarding على الراوتر

### المطلوب:
```
Port 80 (HTTP) → IP السيرفر المحلي
```

### خطوات Port Forwarding:
1. افتح صفحة إعدادات الراوتر (عادة: 192.168.1.1)
2. اذهب لـ Port Forwarding / Virtual Server
3. أضف قاعدة جديدة:
   - **External Port:** 80
   - **Internal IP:** [IP السيرفر المحلي]
   - **Internal Port:** 80
   - **Protocol:** TCP
   - **Enable:** Yes

---

## 4️⃣ تحديث Environment Variables

### النظام الرئيسي (.env):
```bash
cd /path/to/x gym
nano .env
```

أضف/عدّل:
```env
# Production URLs
NEXT_PUBLIC_API_URL="http://system.xgym.website"
NODE_ENV="production"
```

### بوابة العملاء (.env):
```bash
cd /path/to/x gym/client-portal
nano .env
```

أضف/عدّل:
```env
# Production URLs
NEXT_PUBLIC_API_URL="http://system.xgym.website"
JWT_SECRET="[استخدم secret قوي وعشوائي]"
NODE_ENV="production"
```

---

## 5️⃣ تشغيل التطبيقات

### الطريقة 1: استخدام PM2 (موصى به)

#### تثبيت PM2:
```bash
npm install -g pm2
```

#### تشغيل النظام الرئيسي:
```bash
cd /path/to/x gym
npm run build
pm2 start npm --name "xgym-system" -- start
```

#### تشغيل بوابة العملاء:
```bash
cd /path/to/x gym/client-portal
npm run build
pm2 start npm --name "xgym-client" -- start
```

#### حفظ الإعدادات:
```bash
pm2 save
pm2 startup
```

#### مراقبة التطبيقات:
```bash
pm2 status
pm2 logs
pm2 monit
```

### الطريقة 2: استخدام systemd

#### ملف النظام الرئيسي:
```bash
sudo nano /etc/systemd/system/xgym-system.service
```

```ini
[Unit]
Description=X Gym Main System
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/x gym
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

#### ملف بوابة العملاء:
```bash
sudo nano /etc/systemd/system/xgym-client.service
```

```ini
[Unit]
Description=X Gym Client Portal
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/x gym/client-portal
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

#### تفعيل الخدمات:
```bash
sudo systemctl daemon-reload
sudo systemctl enable xgym-system
sudo systemctl enable xgym-client
sudo systemctl start xgym-system
sudo systemctl start xgym-client

# التحقق من الحالة
sudo systemctl status xgym-system
sudo systemctl status xgym-client
```

---

## 6️⃣ إعداد SSL (HTTPS) - اختياري

### استخدام Cloudflare SSL (الأسهل):

#### في Cloudflare Dashboard:
1. اذهب لـ SSL/TLS → Overview
2. اختر: **Full** أو **Full (Strict)**
3. اذهب لـ Edge Certificates
4. فعّل:
   - ✅ Always Use HTTPS
   - ✅ Automatic HTTPS Rewrites
   - ✅ Minimum TLS Version: 1.2

#### تحديث Nginx:
```bash
sudo nano /etc/nginx/sites-available/xgym
```

غيّر `listen 80;` لـ:
```nginx
listen 443 ssl http2;
ssl_certificate /etc/ssl/cloudflare/cert.pem;
ssl_certificate_key /etc/ssl/cloudflare/key.pem;
```

---

## 7️⃣ اختبار النظام

### اختبر الروابط:
```
✅ http://system.xgym.website (النظام الرئيسي)
✅ http://client.xgym.website (بوابة العملاء)
```

### اختبر الوظائف:
1. ✅ تسجيل دخول في النظام الرئيسي
2. ✅ تسجيل دخول في بوابة العملاء
3. ✅ جلب البيانات من APIs
4. ✅ التجميد يعمل
5. ✅ تبديل اللغة

---

## 8️⃣ Firewall (جدار الحماية)

### إعداد UFW (Ubuntu):
```bash
# السماح بالمنافذ المطلوبة
sudo ufw allow 22     # SSH
sudo ufw allow 80     # HTTP
sudo ufw allow 443    # HTTPS

# حظر الوصول المباشر للبورتات الداخلية
sudo ufw deny 4001
sudo ufw deny 3002

# تفعيل الجدار الناري
sudo ufw enable
sudo ufw status
```

---

## 9️⃣ النسخ الاحتياطي

### نسخ احتياطي للقاعدة:
```bash
# إنشاء نسخة احتياطية
cp /path/to/x gym/prisma/gym.db /backups/gym-$(date +%Y%m%d).db

# Cron Job للنسخ التلقائي (يومياً الساعة 2 صباحاً)
crontab -e
```

أضف:
```cron
0 2 * * * cp /path/to/x gym/prisma/gym.db /backups/gym-$(date +\%Y\%m\%d).db
```

---

## 🔟 استكشاف الأخطاء

### المشكلة: الموقع لا يعمل
```bash
# تحقق من Nginx
sudo nginx -t
sudo systemctl status nginx

# تحقق من التطبيقات
pm2 status
pm2 logs

# تحقق من المنافذ
sudo netstat -tlnp | grep -E '4001|3002|80'
```

### المشكلة: API لا يستجيب
```bash
# تحقق من NEXT_PUBLIC_API_URL
cat /path/to/x gym/client-portal/.env

# تحقق من Logs
pm2 logs xgym-system
pm2 logs xgym-client
```

### المشكلة: SSL لا يعمل
- تأكد من Cloudflare SSL mode = Full
- تأكد من Always Use HTTPS مفعّل
- امسح cache المتصفح

---

## ✅ Checklist النشر

### Pre-deployment:
- [ ] تثبيت Node.js و npm
- [ ] تثبيت Nginx
- [ ] الحصول على IP السيرفر الخارجي
- [ ] إعداد Port Forwarding للبورت 80

### Cloudflare:
- [ ] إضافة A Record لـ system
- [ ] إضافة A Record لـ client
- [ ] تفعيل Proxy (🟠)
- [ ] (اختياري) تفعيل SSL

### السيرفر:
- [ ] إعداد Nginx
- [ ] تحديث Environment Variables
- [ ] بناء التطبيقات (npm run build)
- [ ] تشغيل التطبيقات (PM2 أو systemd)
- [ ] إعداد Firewall
- [ ] إعداد النسخ الاحتياطي التلقائي

### الاختبار:
- [ ] اختبار system.xgym.website
- [ ] اختبار client.xgym.website
- [ ] اختبار تسجيل الدخول
- [ ] اختبار APIs
- [ ] اختبار على الموبايل

---

**جاهز للنشر!** 🎉
