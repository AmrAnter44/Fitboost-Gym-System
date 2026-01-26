# 🏗️ Client Portal Architecture

## ✅ **النظام الجديد - Frontend Only + APIs**

```
┌─────────────────────────────────────────────┐
│  النظام الأساسي (system.xgym.website)      │
│                                             │
│  ├── Electron App                           │
│  ├── Admin Web Interface                    │
│  ├── Prisma + SQLite Database               │
│  └── Public APIs (جديد) ✨                  │
│      ├── POST /api/public/auth/verify       │
│      ├── GET /api/public/member/:id/profile │
│      ├── GET /api/public/member/:id/checkins│
│      ├── GET /api/public/member/:id/receipts│
│      └── GET /api/public/member/:id/spa     │
└─────────────────────────────────────────────┘
                    ↓ HTTP/HTTPS
┌─────────────────────────────────────────────┐
│  بوابة الأعضاء (client.xgym.website)       │
│                                             │
│  ├── Next.js Frontend (PWA)                 │
│  ├── Login Page                             │
│  ├── Dashboard Pages                        │
│  ├── NO Prisma ✅                            │
│  ├── NO Database Access ✅                   │
│  └── يستدعي APIs من النظام الأساسي ✅        │
└─────────────────────────────────────────────┘
```

---

## 📁 **Client Portal Structure**

```
client-portal/
├── app/
│   ├── login/              # صفحة تسجيل الدخول
│   ├── dashboard/          # لوحة التحكم
│   └── api/
│       └── auth/
│           ├── login/      # يستدعي API للتحقق
│           └── logout/     # تسجيل خروج محلي
├── lib/
│   ├── api-client.ts       # للاتصال بالنظام الأساسي ✨
│   ├── auth.ts             # JWT utilities
│   ├── rate-limit.ts       # Rate limiting
│   └── utils.ts            # Helpers
├── NO prisma/ ✅
├── NO lib/prisma.ts ✅
└── package.json (بدون @prisma/client)
```

---

## 🔌 **APIs Required in Main System**

يجب إنشاء الـ APIs التالية في النظام الأساسي:

### 📍 Location
```
x gym/app/api/public/
```

### 1️⃣ **Verify Member Credentials**

**Endpoint:** `POST /api/public/auth/verify`

**Request:**
```json
{
  "memberNumber": 1001,
  "phoneNumber": "01234567890"
}
```

**Response:**
```json
{
  "success": true,
  "member": {
    "id": "cuid...",
    "memberNumber": 1001,
    "name": "Ahmed Ali",
    "profileImage": "/path/to/image.jpg"
  }
}
```

---

### 2️⃣ **Get Member Profile**

**Endpoint:** `GET /api/public/member/:memberId/profile`

**Response:**
```json
{
  "member": {
    "id": "cuid...",
    "memberNumber": 1001,
    "name": "Ahmed Ali",
    "phone": "01234567890",
    "profileImage": null,
    "subscriptionPrice": 500,
    "startDate": "2024-01-01",
    "expiryDate": "2024-02-01",
    "isActive": true,
    "isFrozen": false,
    "remainingDays": 15,
    "status": "active",
    "inBodyScans": 2,
    "invitations": 3,
    "freePTSessions": 5,
    "remainingFreezeDays": 10,
    "_count": {
      "receipts": 10,
      "checkIns": 50,
      "spaBookings": 3
    }
  }
}
```

---

### 3️⃣ **Get Member Check-ins**

**Endpoint:** `GET /api/public/member/:memberId/checkins?limit=50&offset=0`

**Response:**
```json
{
  "checkIns": [
    {
      "id": "cuid...",
      "checkInTime": "2024-01-25T10:30:00Z",
      "checkInMethod": "scan"
    }
  ],
  "stats": {
    "total": 100,
    "thisMonth": 15,
    "thisWeek": 4
  },
  "pagination": {
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### 4️⃣ **Get Member Receipts**

**Endpoint:** `GET /api/public/member/:memberId/receipts?limit=50&offset=0`

**Response:**
```json
{
  "receipts": [
    {
      "id": "cuid...",
      "receiptNumber": 1000,
      "amount": 500,
      "paymentMethod": "cash",
      "staffName": "Manager",
      "itemDetails": "...",
      "type": "membership",
      "createdAt": "2024-01-25T10:00:00Z"
    }
  ],
  "stats": {
    "total": 10,
    "totalPaid": 5000
  },
  "pagination": {
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

---

### 5️⃣ **Get Member Spa Bookings**

**Endpoint:** `GET /api/public/member/:memberId/spa?limit=50&offset=0&status=pending`

**Response:**
```json
{
  "bookings": [
    {
      "id": "cuid...",
      "bookingDate": "2024-02-01",
      "bookingTime": "10:00",
      "serviceType": "massage",
      "status": "pending",
      "duration": 60,
      "notes": "..."
    }
  ],
  "stats": {
    "total": 5,
    "upcoming": 2
  },
  "pagination": {
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

---

## 🔐 **Security**

### Client Portal
- ✅ Rate limiting على Login
- ✅ JWT Tokens (HTTP-only cookies)
- ✅ لا يوجد اتصال مباشر بقاعدة البيانات
- ✅ كل الطلبات تمر عبر APIs النظام الأساسي

### Main System APIs
- ✅ التحقق من الصلاحيات
- ✅ Validate memberNumber + phone together
- ✅ Return only member's own data
- ✅ Read-only operations
- ✅ Rate limiting on public endpoints

---

## 🚀 **Deployment**

### Development

**النظام الأساسي:**
```bash
cd "x gym"
npm run dev  # http://localhost:4001
```

**بوابة الأعضاء:**
```bash
cd "x gym/client-portal"
npm run dev  # http://localhost:3002
```

### Production

**Nginx Configuration:**
```nginx
# النظام الأساسي
server {
    server_name system.xgym.website;
    location / {
        proxy_pass http://localhost:4001;
    }
}

# بوابة الأعضاء
server {
    server_name client.xgym.website;
    location / {
        proxy_pass http://localhost:3002;
    }
}
```

---

## 📊 **Advantages**

### ✅ **Separation of Concerns**
- Frontend منفصل عن Backend
- سهل الصيانة والتطوير

### ✅ **Security**
- Client Portal لا يصل للـ database مباشرة
- كل الـ data access عبر APIs محمية

### ✅ **Scalability**
- يمكن نشر Client Portal على CDN
- يمكن عمل caching للـ APIs
- يمكن استخدام Load Balancers

### ✅ **Flexibility**
- يمكن تغيير الـ database بدون تأثير على Client Portal
- يمكن إضافة Mobile App يستخدم نفس الـ APIs
- يمكن تحسين الـ APIs بشكل مستقل

---

## 📝 **Next Steps**

### 1. Create APIs in Main System
```
x gym/app/api/public/
├── auth/
│   └── verify/route.ts
└── member/
    └── [memberId]/
        ├── profile/route.ts
        ├── checkins/route.ts
        ├── receipts/route.ts
        └── spa/route.ts
```

### 2. Test APIs
```bash
# Test verify endpoint
curl -X POST http://localhost:4001/api/public/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"memberNumber": 1001, "phoneNumber": "01234567890"}'
```

### 3. Update Client Portal
بوابة الأعضاء جاهزة! فقط تحتاج الـ APIs في النظام الأساسي.

---

## 🎯 **Summary**

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Client Portal** | Next.js + PWA | Frontend فقط |
| **Main System** | Next.js + Prisma + Electron | Backend + Admin + APIs |
| **Database** | SQLite | يستخدمه النظام الأساسي فقط |
| **Communication** | REST APIs | HTTP/HTTPS |

---

**Created:** 2026-01-25
**Status:** ✅ Client Portal Ready - Waiting for Main System APIs
