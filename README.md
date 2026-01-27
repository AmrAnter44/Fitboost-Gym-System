# 🏋️ X Gym Management System

نظام إدارة شامل للجيم مع بوابة خاصة للأعضاء.

---

## 🚀 التشغيل السريع

### 1️⃣ تثبيت Caddy (مرة واحدة فقط)

```cmd
install-caddy.bat
```

**ملاحظة:** شغله كـ Administrator

---

### 2️⃣ تشغيل كل الخدمات

```cmd
start-all.bat
```

سيفتح 3 نوافذ:
- ✅ النظام الأساسي (Port 4001)
- ✅ بوابة الأعضاء (Port 3002)
- ✅ Caddy Web Server (اختياري)

---

### 3️⃣ تشغيل خدمة واحدة فقط (اختياري)

```cmd
start-system.bat  # النظام الأساسي فقط
start-client.bat  # بوابة الأعضاء فقط
start-caddy.bat   # Caddy فقط
```

---

## 🌐 الوصول للنظام

### محلي (Local):
- النظام الأساسي: http://localhost:4001
- بوابة الأعضاء: http://localhost:3002

### على الشبكة:
- النظام الأساسي: http://192.168.1.X:4001
- بوابة الأعضاء: http://192.168.1.X:3002

### Production (مع Caddy):
- النظام الأساسي: https://system.xgym.website
- بوابة الأعضاء: https://client.xgym.website

---

## ⚙️ المتطلبات

- ✅ Windows 10/11 أو Windows Server
- ✅ Node.js 20 أو أحدث
- ✅ صلاحيات Administrator (للـ Caddy)

---

## 📋 ملفات الإعداد

### `.env` (المجلد الرئيسي):
```env
DATABASE_URL="file:./prisma/gym.db"
JWT_SECRET="your-secret-key-here"
EMERGENCY_SIGNUP_SECRET="emergency-secret-here"
NODE_ENV="production"
NEXT_PUBLIC_DOMAIN="system.xgym.website"
NEXT_PUBLIC_WEBSITE_URL="https://system.xgym.website"
```

### `client-portal\.env`:
```env
NEXT_PUBLIC_API_URL="http://localhost:4001"
JWT_SECRET="same-as-main-system"
NODE_ENV="production"
```

---

## 🛑 إيقاف الخدمات

- اضغط `Ctrl+C` في نافذة الـ CMD
- أو أغلق النافذة مباشرة

---

## 🔄 التحديثات

```cmd
git pull
npm install
npm run build
cd client-portal
npm install
npm run build
```

---

## 📞 الدعم

للمساعدة أو الإبلاغ عن مشاكل، تواصل مع المطور.

---

**تم التطوير بواسطة Claude Code** 🤖
