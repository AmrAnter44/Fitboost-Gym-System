# 🏋️ FitBoost Management System

نظام إدارة شامل للجيم.

---

## 🚀 التشغيل السريع

### 1️⃣ تثبيت Caddy (مرة واحدة فقط)

```cmd
install-caddy.bat
```

**ملاحظة:** شغله كـ Administrator

---

### 2️⃣ تشغيل النظام

```cmd
npm run dev
```

---

## 🌐 الوصول للنظام

### محلي (Local):
- http://localhost:4001

### على الشبكة:
- http://192.168.1.X:4001

---

## ⚙️ المتطلبات

- ✅ Windows 10/11 أو Windows Server
- ✅ Node.js 20 أو أحدث
- ✅ صلاحيات Administrator (للـ Caddy)

---

## 📋 ملفات الإعداد

### `.env`:
```env
DATABASE_URL="file:./prisma/gym.db"
JWT_SECRET="your-secret-key-here"
EMERGENCY_SIGNUP_SECRET="emergency-secret-here"
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
```

---

## 📞 الدعم

للمساعدة أو الإبلاغ عن مشاكل، تواصل مع المطور.

---

**تم التطوير بواسطة Claude Code** 🤖
