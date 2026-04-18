# 🎂 نظام نقاط عيد الميلاد التلقائي

## نظرة عامة

النظام يمنح نقاط تلقائياً للأعضاء النشطين في يوم عيد ميلادهم. يمكن تشغيله بثلاث طرق:

---

## الطريقة الأولى: Vercel Cron (الأسهل - للمواقع المنشورة على Vercel)

### الإعداد:

1. **أضف Environment Variable في Vercel:**
   ```
   CRON_SECRET=birthday-points-secret-2024
   ```

2. **Deploy المشروع**:
   - ملف `vercel.json` موجود بالفعل
   - Vercel هيكتشف الـ cron job تلقائياً
   - هيشتغل كل يوم الساعة 12 صباحاً بتوقيت UTC

3. **اختبار**:
   - روح على Vercel Dashboard → Project → Settings → Crons
   - اضغط "Run Now" لتجربة الـ cron يدوياً

### Endpoint:
```
GET /api/birthday-points-cron
```

---

## الطريقة الثانية: cron-job.org (مجاني - يشتغل مع أي hosting)

### الإعداد:

1. **سجل على** https://console.cron-job.org/

2. **Create New Cronjob:**
   - **Title:** Birthday Points Daily
   - **URL:** `https://your-domain.com/api/birthday-points`
   - **Request Method:** POST
   - **Schedule:** `0 0 * * *` (كل يوم الساعة 12 صباحاً)
   - **Headers:** أضف header:
     ```
     Authorization: Bearer birthday-points-secret-2024
     ```

3. **Save & Enable**

### Endpoint:
```
POST /api/birthday-points
Headers: Authorization: Bearer birthday-points-secret-2024
```

---

## الطريقة الثالثة: GitHub Actions (للمطورين)

### الإعداد:

1. **أنشئ ملف** `.github/workflows/birthday-points.yml`:

```yaml
name: Birthday Points Daily

on:
  schedule:
    - cron: '0 0 * * *'  # كل يوم الساعة 12 صباحاً UTC
  workflow_dispatch:  # للتشغيل اليدوي

jobs:
  award-birthday-points:
    runs-on: ubuntu-latest
    steps:
      - name: Award Birthday Points
        run: |
          curl -X POST https://your-domain.com/api/birthday-points \
            -H "Authorization: Bearer birthday-points-secret-2024"
```

2. **أضف Secret في GitHub:**
   - Settings → Secrets → New repository secret
   - Name: `CRON_SECRET`
   - Value: `birthday-points-secret-2024`

3. **Commit & Push**

---

## التشغيل اليدوي (Manual)

يمكنك منح النقاط يدوياً من صفحة الإعدادات:

1. **Settings → Points**
2. **اضغط زرار "منح نقاط عيد الميلاد الآن"**
3. **أكد العملية**

---

## إعدادات نظام النقاط

في صفحة الإعدادات:

- ✅ **تفعيل نظام النقاط** (Points Enabled)
- 🎂 **نقاط عيد الميلاد** (Points Per Birthday) - القيمة الافتراضية: 10

---

## كيف يعمل النظام؟

1. **كل يوم الساعة 12 صباحاً:**
   - يفحص قاعدة البيانات عن الأعضاء النشطين
   - يقارن تاريخ ميلادهم مع اليوم الحالي (الشهر واليوم فقط، بدون السنة)
   - يمنح النقاط للأعضاء الذين اليوم هو عيد ميلادهم

2. **التسجيل:**
   - يضيف النقاط لحساب العضو
   - يسجل في `PointsHistory` بسبب "🎂 عيد ميلاد سعيد! نقاط تلقائية"
   - يطبع logs في console

---

## الأمان

- ✅ جميع endpoints محمية بـ **Authorization header**
- ✅ استخدم `CRON_SECRET` environment variable في production
- ✅ لا تشارك الـ secret key علناً

---

## المشاكل الشائعة

### المشكلة: "نظام نقاط عيد الميلاد غير مفعل"
**الحل:** تأكد من:
- نظام النقاط مفعل في Settings
- قيمة "Points Per Birthday" أكبر من 0

### المشكلة: "Unauthorized 401"
**الحل:**
- تأكد من إضافة Authorization header
- تأكد من صحة الـ secret key

### المشكلة: "لا توجد أعياد ميلاد اليوم"
**الحل:**
- هذا طبيعي! معناه لا يوجد أعضاء لديهم عيد ميلاد اليوم
- للاختبار: أضف عضو جديد بتاريخ ميلاد اليوم

---

## API Endpoints

### POST `/api/birthday-points`
منح النقاط تلقائياً (يحتاج Authorization header)

### GET `/api/birthday-points`
عرض الأعضاء الذين لديهم عيد ميلاد اليوم (بدون منح نقاط)

### GET `/api/birthday-points-cron`
Vercel Cron endpoint (محمي بـ CRON_SECRET)

---

## الدعم

للمشاكل والأسئلة، راجع:
- Logs في Vercel Dashboard
- Console logs في المتصفح
- Database → PointsHistory table
