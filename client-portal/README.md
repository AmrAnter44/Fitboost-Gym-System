# X Gym Client Portal 🏋️

## 🎯 **Frontend Only + PWA**

بوابة الأعضاء - **بدون قاعدة بيانات** - تستدعي APIs من النظام الأساسي

---

## 🏗️ **Architecture**

```
Client Portal (هذا المشروع)
├── Frontend Only (Next.js + PWA)
├── NO Database ✅
├── NO Prisma ✅
└── يستدعي APIs من النظام الأساسي
           ↓
    System APIs (النظام الأساسي)
    ├── قاعدة البيانات
    └── Prisma
```

---

## ✅ **ما يحتويه هذا المشروع**

### Frontend
- ✅ صفحة تسجيل دخول (memberNumber + phone)
- ✅ لوحة تحكم الأعضاء
- ✅ PWA Support (قابل للتثبيت)
- ✅ RTL Support (العربية)
- ✅ Responsive Design

### Security
- ✅ JWT Authentication
- ✅ HTTP-Only Cookies
- ✅ Rate Limiting
- ✅ لا يصل للـ database مباشرة

### NO Database Access
- ❌ لا يوجد Prisma
- ❌ لا يوجد اتصال بقاعدة البيانات
- ✅ كل البيانات تأتي من APIs

---

## 🚀 **Quick Start**

### 1. Install Dependencies
```bash
cd client-portal
npm install
```

### 2. Configure Environment
```bash
# .env
NEXT_PUBLIC_API_URL="http://localhost:4001"
JWT_SECRET="your-secret-key"
```

### 3. Run Development Server
```bash
npm run dev
```

Open: http://localhost:3002

---

## 🔌 **Required APIs**

يجب إنشاء الـ APIs التالية في النظام الأساسي (`x gym/app/api/public/`):

### ✅ Authentication
```
POST /api/public/auth/verify
→ التحقق من memberNumber + phoneNumber
```

### ✅ Member Data
```
GET /api/public/member/:id/profile
GET /api/public/member/:id/checkins
GET /api/public/member/:id/receipts
GET /api/public/member/:id/spa
```

**راجع:** [ARCHITECTURE.md](./ARCHITECTURE.md) للتفاصيل الكاملة

---

## 📁 **Project Structure**

```
client-portal/
├── app/
│   ├── login/              # Login page
│   ├── dashboard/          # Dashboard pages
│   └── api/
│       └── auth/           # فقط login/logout محلياً
├── lib/
│   ├── api-client.ts       # للاتصال بالنظام الأساسي ✨
│   ├── auth.ts             # JWT utilities
│   ├── rate-limit.ts       # Rate limiter
│   └── utils.ts            # Helpers
├── public/
│   └── manifest.json       # PWA manifest
├── .env                    # Environment variables
└── package.json            # بدون Prisma dependencies
```

---

## 🌐 **Domains**

```
system.xgym.website  → النظام الأساسي (APIs + Admin)
client.xgym.website  → بوابة الأعضاء (Frontend Only)
```

---

## 📚 **Documentation**

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - البنية المعمارية الكاملة
- **[START_HERE_AR.md](./START_HERE_AR.md)** - دليل البدء السريع
- **[DEPLOYMENT_SUBDOMAIN.md](./DEPLOYMENT_SUBDOMAIN.md)** - دليل النشر

---

## ⚙️ **Development**

```bash
# Install
npm install

# Dev server (port 3002)
npm run dev

# Build
npm run build

# Start production
npm start
```

---

## 🎯 **Status**

| Component | Status |
|-----------|--------|
| **Client Portal Frontend** | ✅ جاهز |
| **Login System** | ✅ جاهز |
| **Dashboard UI** | ✅ جاهز |
| **PWA Configuration** | ✅ جاهز |
| **Main System APIs** | ⏳ يجب إنشاؤها |

---

## 🔐 **Security Features**

- ✅ Passwordless login
- ✅ Rate limiting (5 attempts / 15 min)
- ✅ JWT with 7-day expiry
- ✅ HTTP-only cookies
- ✅ No direct database access
- ✅ All data via protected APIs

---

## 📱 **PWA Features**

- ✅ Installable on mobile
- ✅ Offline support
- ✅ App icons
- ✅ Splash screen
- ✅ Manifest configured

---

## 🚀 **Deployment**

### Development
```bash
npm run dev
# http://localhost:3002
```

### Production (Same Server)
```nginx
# Nginx config
server {
    server_name client.xgym.website;
    location / {
        proxy_pass http://localhost:3002;
    }
}
```

### Production (Vercel)
```bash
vercel --prod
# Configure domain: client.xgym.website
```

---

## 🔄 **Workflow**

1. **Member logs in** → Client Portal validates + calls System API
2. **System API verifies** → Returns member data
3. **JWT generated** → Client Portal creates session
4. **Member browses** → All data fetched from System APIs
5. **No direct DB access** → Everything through APIs

---

## 💡 **Advantages**

### Frontend Only
- ✅ No database complexity
- ✅ Easy to deploy on CDN
- ✅ Fast and lightweight

### API-Based
- ✅ Complete separation
- ✅ Secure by design
- ✅ Scalable architecture

### PWA
- ✅ Works offline
- ✅ Installable app
- ✅ Native-like experience

---

## 📞 **Next Steps**

1. ✅ Client Portal is ready
2. ⏳ Create APIs in main system ([ARCHITECTURE.md](./ARCHITECTURE.md))
3. ⏳ Test integration
4. ⏳ Deploy both systems

---

**Version:** 2.0.0 (Frontend Only)
**Created:** 2026-01-25
**Domain:** client.xgym.website
