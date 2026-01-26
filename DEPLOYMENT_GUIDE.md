# 🚀 دليل النشر - X Gym System + Client Portal

## 🌐 الدومينات المطلوبة

```
system.xgym.website  → النظام الأساسي (Admin + APIs)
client.xgym.website  → بوابة الأعضاء (Frontend Only)
```

---

## 📋 **الخطوات:**

### 1️⃣ **إعداد DNS**

في لوحة تحكم الدومين (GoDaddy, Namecheap, etc.):

```
Type    Name      Value
A       system    [IP السيرفر]
A       client    [IP السيرفر]
```

أو:

```
Type    Name      Value
CNAME   system    your-server.example.com
CNAME   client    your-server.example.com
```

---

### 2️⃣ **رفع الملفات على السيرفر**

```bash
# رفع المشروع كامل
scp -r "x gym/" user@server:/var/www/xgym/
```

---

### 3️⃣ **تثبيت Dependencies**

```bash
# على السيرفر
cd /var/www/xgym

# النظام الأساسي
npm install
npm run build

# بوابة الأعضاء
cd client-portal
npm install
npm run build
cd ..
```

---

### 4️⃣ **إعداد Environment Variables**

#### النظام الأساسي (.env):
```env
DATABASE_URL="file:./prisma/gym.db"
JWT_SECRET="your-super-secret-key"
NODE_ENV="production"
NEXT_PUBLIC_DOMAIN="system.xgym.website"
```

#### بوابة الأعضاء (client-portal/.env):
```env
NEXT_PUBLIC_API_URL="https://system.xgym.website"
JWT_SECRET="different-secret-key"
NODE_ENV="production"
```

---

### 5️⃣ **تشغيل بـ PM2**

```bash
cd /var/www/xgym

# تشغيل النظام الأساسي على بورت 4001
pm2 start npm --name "xgym-system" -- start

# تشغيل بوابة الأعضاء على بورت 3002
cd client-portal
pm2 start npm --name "xgym-client" -- start

# حفظ الإعدادات
pm2 save
pm2 startup
```

---

### 6️⃣ **إعداد Nginx**

#### ملف `/etc/nginx/sites-available/xgym`:

```nginx
# النظام الأساسي - system.xgym.website
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

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

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

#### تفعيل الإعداد:

```bash
# تفعيل الموقع
sudo ln -s /etc/nginx/sites-available/xgym /etc/nginx/sites-enabled/

# اختبار الإعداد
sudo nginx -t

# إعادة تشغيل Nginx
sudo systemctl restart nginx
```

---

### 7️⃣ **SSL Certificates (Let's Encrypt)**

```bash
# تثبيت Certbot
sudo apt install certbot python3-certbot-nginx

# للنظام الأساسي
sudo certbot --nginx -d system.xgym.website

# لبوابة الأعضاء
sudo certbot --nginx -d client.xgym.website

# تجديد تلقائي
sudo certbot renew --dry-run
```

---

## ✅ **التحقق من التشغيل**

```bash
# تحقق من PM2
pm2 status

# يجب أن تشوف:
# ├─ xgym-system  (port 4001) ✅
# └─ xgym-client  (port 3002) ✅

# تحقق من Nginx
sudo systemctl status nginx

# اختبار الدومينات
curl https://system.xgym.website/api/health
curl https://client.xgym.website
```

---

## 🔄 **التحديثات المستقبلية**

```bash
# سحب آخر تحديثات
cd /var/www/xgym
git pull origin main

# تحديث النظام الأساسي
npm install
npm run build
pm2 restart xgym-system

# تحديث بوابة الأعضاء
cd client-portal
npm install
npm run build
pm2 restart xgym-client
```

---

## 📊 **المراقبة**

```bash
# سجلات النظام الأساسي
pm2 logs xgym-system

# سجلات بوابة الأعضاء
pm2 logs xgym-client

# استهلاك الموارد
pm2 monit
```

---

## 🔐 **الأمان**

### Firewall
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### صلاحيات قاعدة البيانات
```bash
chmod 644 /var/www/xgym/prisma/gym.db
chown www-data:www-data /var/www/xgym/prisma/gym.db
```

---

## 📱 **الطريقة البديلة: Vercel**

### نشر النظام الأساسي:
```bash
cd /var/www/xgym
vercel --prod
# اضبط الدومين: system.xgym.website
```

### نشر بوابة الأعضاء:
```bash
cd /var/www/xgym/client-portal
vercel --prod
# اضبط الدومين: client.xgym.website
```

⚠️ **ملحوظة:** مع Vercel، ستحتاج قاعدة بيانات بعيدة (PostgreSQL على Supabase أو PlanetScale).

---

## 🎯 **الملخص**

| Service | Domain | Port | Location |
|---------|--------|------|----------|
| **Admin System** | system.xgym.website | 4001 | /var/www/xgym |
| **Client Portal** | client.xgym.website | 3002 | /var/www/xgym/client-portal |
| **Database** | - | - | /var/www/xgym/prisma/gym.db |

---

**تم الإعداد!** 🎉

الآن النظامين شغالين على:
- ✅ https://system.xgym.website (Admin + APIs)
- ✅ https://client.xgym.website (Member Portal)
