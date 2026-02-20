# 🚀 تشغيل FitBoost - الطريقة الأبسط (بدون Caddy)

## ✨ الفرق بين الطريقتين:

| الميزة | مع Caddy | بدون Caddy (Node.js Proxy) |
|--------|----------|----------------------------|
| **السهولة** | متوسط | سهل جداً ⭐ |
| **التثبيت** | محتاج تثبيت Caddy | مش محتاج حاجة إضافية ✅ |
| **HTTPS** | تلقائي | محتاج إعداد يدوي |
| **السرعة** | سريع | سريع |
| **الاستخدام** | Production | Development/Production |

---

## 🎯 التشغيل السريع (على الديسكتوب):

### 1️⃣ لتشغيل كل حاجة:
```
Double Click على: START XGYM.bat
```

### 2️⃣ لإيقاف كل حاجة:
```
Double Click على: STOP XGYM.bat
```

---

## 📋 كيف يعمل النظام:

```
الإنترنت
    ↓
http://system.xgym.website
    ↓
  localhost:4001 (Main System)
```

---

## 🔧 الملفات المستخدمة:

### على الديسكتوب:
- `START XGYM.bat` - تشغيل بضغطة واحدة ⭐
- `STOP XGYM.bat` - إيقاف بضغطة واحدة

### في مجلد المشروع:
- `simple-proxy.js` - السيرفر اللي بيوزع الطلبات
- `start-proxy.bat` - تشغيل الـ proxy لوحده
- `start-all-simple.bat` - تشغيل كل حاجة مع نوافذ منفصلة

---

## 🌐 الوصول للنظام:

بعد التشغيل، افتح المتصفح:

- **النظام الأساسي:** http://system.xgym.website

أو محلي:
- http://localhost:4001

---

## ⚙️ المتطلبات:

- ✅ Node.js مثبت
- ✅ npm install تم تشغيله
- ✅ DNS Records مظبوطة (system و client يشيروا لـ IP السيرفر)
- ✅ Port 80 مفتوح في الـ Firewall

---

## 🔥 لفتح Port 80 في Firewall:

افتح CMD as Administrator وشغل:

```cmd
netsh advfirewall firewall add rule name="HTTP-XGYM" dir=in action=allow protocol=TCP localport=80
```

---

## 🚀 التشغيل التلقائي مع Windows:

1. اضغط `Win + R`
2. اكتب: `shell:startup`
3. اعمل Shortcut لـ `START XGYM.bat` في المجلد ده

---

## ❓ لو عايز ترجع لـ Caddy:

استخدم الملفات القديمة:
- `start-caddy.bat`
- `start-all.bat`

---

**الطريقة دي أسهل وأسرع! 🎯**
