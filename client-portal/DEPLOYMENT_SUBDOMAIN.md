# نشر بوابة الأعضاء على Subdomain

## 🎯 الهدف
النظام الأساسي والبوابة في **نفس المجلد**، لكن على **دومينات مختلفة**:
- `system.xgym.website` → النظام الإداري
- `client.xgym.website` → بوابة الأعضاء

---

## 🏗️ الهيكل النهائي

```
/var/www/xgym/
├── app/              ← النظام الإداري
├── prisma/
│   └── gym.db        ← قاعدة بيانات مشتركة
├── client-portal/    ← بوابة الأعضاء
│   ├── app/
│   ├── lib/
│   └── package.json
└── package.json      ← النظام الأساسي
```

---

## 🚀 طرق النشر

### الطريقة 1: PM2 + Nginx (Recommended)

#### الخطوة 1: رفع المشروع على السيرفر

```bash
# رفع المشروع كامل
scp -r "x gym/" user@server:/var/www/xgym/
```

#### الخطوة 2: تثبيت Dependencies

```bash
# على السيرفر
cd /var/www/xgym

# النظام الأساسي
npm install
npm run build

# بوابة الأعضاء
cd client-portal
npm install
npx prisma generate
npm run build
```

#### الخطوة 3: تشغيل بـ PM2

```bash
# من المجلد الرئيسي
cd /var/www/xgym

# تشغيل النظام الأساسي على بورت 4001
pm2 start npm --name "xgym-admin" -- start

# تشغيل بوابة الأعضاء على بورت 3002
cd client-portal
pm2 start npm --name "xgym-client" -- start

# حفظ الإعدادات
pm2 save
pm2 startup
```

#### الخطوة 4: إعداد Nginx

**ملف `/etc/nginx/sites-available/xgym`:**

```nginx
# النظام الإداري - system.xgym.website
server {
    listen 80;
    listen [::]:80;
    server_name system.xgym.website;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name system.xgym.website;

    ssl_certificate /etc/letsencrypt/live/system.xgym.website/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/system.xgym.website/privkey.pem;

    location / {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# بوابة الأعضاء - client.xgym.website
server {
    listen 80;
    listen [::]:80;
    server_name client.xgym.website;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name client.xgym.website;

    ssl_certificate /etc/letsencrypt/live/client.xgym.website/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/client.xgym.website/privkey.pem;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### الخطوة 5: تفعيل الإعداد

```bash
# تفعيل الموقع
sudo ln -s /etc/nginx/sites-available/xgym /etc/nginx/sites-enabled/

# اختبار الإعداد
sudo nginx -t

# إعادة تشغيل Nginx
sudo systemctl restart nginx
```

#### الخطوة 6: SSL Certificates

```bash
# للنظام الإداري
sudo certbot --nginx -d system.xgym.website

# لبوابة الأعضاء
sudo certbot --nginx -d client.xgym.website
```

---

### الطريقة 2: Vercel (سهلة)

#### النظام الأساسي
```bash
cd /var/www/xgym
vercel --prod
# اضبط الدومين: system.xgym.website
```

#### بوابة الأعضاء
```bash
cd /var/www/xgym/client-portal
vercel --prod
# اضبط الدومين: client.xgym.website
```

**ملحوظة**: ستحتاج قاعدة بيانات بعيدة (PostgreSQL) مع Vercel.

---

### الطريقة 3: Docker Compose

**ملف `docker-compose.yml`:**

```yaml
version: '3.8'

services:
  # النظام الإداري
  admin:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "4001:4001"
    environment:
      - DATABASE_URL=file:/app/prisma/gym.db
      - NODE_ENV=production
    volumes:
      - ./prisma:/app/prisma
    restart: unless-stopped

  # بوابة الأعضاء
  client:
    build:
      context: ./client-portal
      dockerfile: Dockerfile
    ports:
      - "3002:3002"
    environment:
      - DATABASE_URL=file:/app/prisma/gym.db
      - JWT_SECRET=${JWT_SECRET}
      - NODE_ENV=production
    volumes:
      - ./prisma:/app/prisma:ro  # read-only
    restart: unless-stopped

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt
    depends_on:
      - admin
      - client
    restart: unless-stopped
```

---

## 🔧 إعداد DNS

في لوحة تحكم الدومين:

```
Type    Name      Value
A       system    [IP السيرفر]
A       client    [IP السيرفر]
```

أو:

```
Type    Name      Value
CNAME   system    your-server.com
CNAME   client    your-server.com
```

---

## ✅ التحقق من التشغيل

```bash
# تحقق من PM2
pm2 status

# يجب أن تشوف:
# ├─ xgym-admin  (port 4001)
# └─ xgym-client (port 3002)

# تحقق من Nginx
sudo systemctl status nginx

# اختبار الدومينات
curl https://system.xgym.website
curl https://client.xgym.website
```

---

## 🔄 التحديثات

```bash
# سحب آخر تحديثات
cd /var/www/xgym
git pull origin main

# تحديث النظام الأساسي
npm install
npm run build
pm2 restart xgym-admin

# تحديث بوابة الأعضاء
cd client-portal
npm install
npx prisma generate
npm run build
pm2 restart xgym-client
```

---

## 📊 المراقبة

```bash
# سجلات النظام الأساسي
pm2 logs xgym-admin

# سجلات بوابة الأعضاء
pm2 logs xgym-client

# استهلاك الموارد
pm2 monit
```

---

## 🔐 الأمان

### قاعدة البيانات
- ✅ النظام الأساسي: قراءة + كتابة
- ✅ بوابة الأعضاء: قراءة فقط (application-level)

### Firewall
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### حماية قاعدة البيانات
```bash
# تأكد من الصلاحيات
chmod 644 /var/www/xgym/prisma/gym.db
chown www-data:www-data /var/www/xgym/prisma/gym.db
```

---

## 📝 ملخص البورتات

```
النظام الأساسي:    localhost:4001  → system.xgym.website
بوابة الأعضاء:     localhost:3002  → client.xgym.website
Nginx:              :80, :443       → SSL Termination
```

---

## 🎉 تم!

الآن عندك:
- ✅ النظامين في نفس المجلد
- ✅ يشتغلوا على دومينات مختلفة
- ✅ يشاركوا نفس قاعدة البيانات
- ✅ منفصلين تماماً في الـ runtime

**للتجربة محلياً:**
```bash
# النظام الأساسي
npm run dev  # http://localhost:4001

# بوابة الأعضاء (في terminal تاني)
cd client-portal
npm run dev  # http://localhost:3002
```
