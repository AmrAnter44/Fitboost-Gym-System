# 🧪 دليل اختبار نظام Error Tracking

## ✅ المكونات المُنشأة

### 1. Database Schema
- ✅ **Prisma Schema** - `ErrorLog` model في SQLite
- ⏳ **Supabase Table** - يحتاج تنفيذ يدوي (راجع القسم أدناه)

### 2. Core Services
- ✅ `lib/errorTracking/errorTrackingService.ts` - الخدمة الأساسية
- ✅ `lib/errorTracking/apiErrorMiddleware.ts` - API middleware
- ✅ `lib/errorTracking/globalErrorHandlers.ts` - Frontend handlers

### 3. Components
- ✅ `components/ErrorTrackingBoundary.tsx` - React Error Boundary
- ✅ `components/ErrorTrackingProvider.tsx` - Provider wrapper

### 4. API Endpoints
- ✅ `app/api/error-tracking/log/route.ts` - Frontend logging
- ✅ `app/api/error-tracking/stats/route.ts` - Statistics

### 5. Integration
- ✅ تم إضافة `ErrorTrackingProvider` في `ClientLayout`

---

## 🔧 الخطوات المطلوبة قبل الاختبار

### 1️⃣ إنشاء جدول Supabase

افتح **Supabase Dashboard** → **SQL Editor** ونفّذ:

```sql
-- ==========================================
-- Error Tracking System - Supabase Schema
-- ==========================================

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- معلومات الخطأ
  error_type TEXT NOT NULL,
  error_category TEXT,
  severity TEXT NOT NULL DEFAULT 'MEDIUM',

  -- رسائل الخطأ
  message TEXT NOT NULL,
  sanitized_message TEXT,
  error_code TEXT,
  stack_trace TEXT,

  -- معلومات السياق
  endpoint TEXT,
  http_method TEXT,
  status_code INTEGER,

  -- معلومات المستخدم
  user_id TEXT,
  user_email TEXT,
  user_name TEXT,
  user_role TEXT,
  staff_id TEXT,

  -- معلومات الطلب
  request_body JSONB,
  request_headers JSONB,
  ip_address TEXT,
  user_agent TEXT,

  -- سياق إضافي
  additional_context JSONB,
  browser_info JSONB,

  -- معلومات النظام
  environment TEXT DEFAULT 'production',
  app_version TEXT,

  -- التوقيت
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  is_resolved BOOLEAN DEFAULT FALSE,

  -- Generated columns
  is_critical BOOLEAN GENERATED ALWAYS AS (severity = 'CRITICAL') STORED,
  error_date DATE GENERATED ALWAYS AS (created_at::DATE) STORED
);

-- Indexes
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX idx_error_logs_severity ON error_logs(severity);
CREATE INDEX idx_error_logs_is_critical ON error_logs(is_critical) WHERE is_critical = TRUE;
CREATE INDEX idx_error_logs_error_date ON error_logs(error_date);
CREATE INDEX idx_error_logs_endpoint ON error_logs(endpoint);
CREATE INDEX idx_error_logs_user_id ON error_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_error_logs_is_resolved ON error_logs(is_resolved) WHERE is_resolved = FALSE;

-- RLS Policies
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access" ON error_logs
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Allow read access" ON error_logs
  FOR SELECT
  USING (true);
```

### 2️⃣ التحقق من Environment Variables

تأكد من وجود المتغيرات في `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3️⃣ Build & Start

```bash
# في terminal
npm run dev
```

---

## 🧪 سيناريوهات الاختبار

### ✅ Test 1: Health Check

**الخطوة:**
```bash
curl http://localhost:3000/api/error-tracking/log
```

**النتيجة المتوقعة:**
```json
{
  "status": "ok",
  "message": "Error tracking endpoint is active",
  "timestamp": "2026-03-03T..."
}
```

---

### ✅ Test 2: Frontend Error Boundary

**الخطوة:**

1. افتح المتصفح: `http://localhost:3000`
2. افتح **Console** (F12)
3. اكتب:

```javascript
throw new Error('Test Error Boundary')
```

**النتيجة المتوقعة:**

- ✅ تظهر صفحة خطأ من Error Boundary (مع أيقونة تحذير)
- ✅ يظهر في Console: `[ErrorTracking] ✅ Error tracking initialized`
- ✅ يُرسل POST request إلى `/api/error-tracking/log`
- ✅ يُحفظ الخطأ في SQLite (تحقق من `npx prisma studio`)
- ✅ يُحفظ الخطأ في Supabase (تحقق من Supabase Dashboard)

---

### ✅ Test 3: Uncaught Error (window.onerror)

**الخطوة:**

في **Browser Console**:

```javascript
setTimeout(() => {
  throw new Error('Test uncaught error')
}, 1000)
```

**النتيجة المتوقعة:**

- ✅ يُرسل POST request إلى `/api/error-tracking/log`
- ✅ يظهر في Console: `[ErrorTracking] Failed to log error:` (اختياري إذا فشل)
- ✅ يُحفظ في SQLite و Supabase مع `errorType = FRONTEND`

---

### ✅ Test 4: Unhandled Promise Rejection

**الخطوة:**

في **Browser Console**:

```javascript
Promise.reject('Test promise rejection')
```

**النتيجة المتوقعة:**

- ✅ يُرسل POST request إلى `/api/error-tracking/log`
- ✅ يُحفظ مع message: `Unhandled Promise Rejection: Test promise rejection`

---

### ✅ Test 5: Failed API Request (404)

**الخطوة:**

في **Browser Console**:

```javascript
fetch('/api/nonexistent-endpoint')
```

**النتيجة المتوقعة:**

- ✅ يُرسل POST request إلى `/api/error-tracking/log`
- ✅ يُحفظ مع `errorCategory = NOT_FOUND`
- ✅ `severity = LOW`

---

### ✅ Test 6: API Error Middleware (Backend)

**الخطوة:**

افتح أي API endpoint لا يوجد (مثلاً):

```bash
curl http://localhost:3000/api/test-error-404
```

**النتيجة المتوقعة:**

- ✅ يُحفظ الخطأ في SQLite و Supabase
- ✅ `errorType = BACKEND_API`
- ✅ `statusCode = 404`
- ✅ `errorCategory = NOT_FOUND`

---

### ✅ Test 7: Database Error (Prisma)

**الخطوة:**

قم بإنشاء عضو بـ `barcode` مكرر (لتسبب Prisma P2002 error):

1. افتح `/members`
2. أضف عضو جديد مع barcode موجود مسبقاً
3. اضغط حفظ

**النتيجة المتوقعة:**

- ✅ يظهر toast error للمستخدم
- ✅ يُحفظ في Error Tracking
- ✅ `errorCategory = PRISMA_ERROR`
- ✅ `errorCode = P2002`
- ✅ `severity = MEDIUM`

---

### ✅ Test 8: Error Stats API

**الخطوة:**

```bash
curl -H "Cookie: auth-token=YOUR_TOKEN" \
  http://localhost:3000/api/error-tracking/stats?days=7&limit=10
```

**النتيجة المتوقعة:**

```json
{
  "summary": {
    "totalErrors": 5,
    "unresolvedErrors": 5,
    "unsyncedToSupabase": 0,
    "dateRange": { ... }
  },
  "errorsByType": [
    { "type": "FRONTEND", "count": 3 },
    { "type": "BACKEND_API", "count": 2 }
  ],
  "errorsBySeverity": [...],
  "criticalErrors": [...],
  ...
}
```

---

## 🔍 التحقق من الأخطاء المُسجّلة

### 1. SQLite (Prisma Studio)

```bash
npx prisma studio
```

- افتح **ErrorLog** model
- تحقق من الأعمدة: `message`, `errorType`, `errorCategory`, `severity`
- تحقق من `syncedToSupabase` = `true` (إذا نجح الحفظ في Supabase)

### 2. Supabase Dashboard

1. افتح Supabase Dashboard
2. اذهب إلى **Table Editor** → `error_logs`
3. تحقق من البيانات المحفوظة

**Query مفيد:**

```sql
-- آخر 10 أخطاء
SELECT
  id,
  error_type,
  error_category,
  severity,
  sanitized_message,
  created_at
FROM error_logs
ORDER BY created_at DESC
LIMIT 10;

-- عدد الأخطاء حسب النوع
SELECT error_type, COUNT(*) as count
FROM error_logs
GROUP BY error_type;

-- الأخطاء الحرجة
SELECT *
FROM error_logs
WHERE severity = 'CRITICAL'
ORDER BY created_at DESC;
```

---

## 🛠️ استكشاف الأخطاء (Troubleshooting)

### ❌ لا يُحفظ في Supabase

**السبب المحتمل:**
- Environment variables غير صحيحة
- Supabase table لم يُنشأ بعد
- RLS policies تمنع الحفظ

**الحل:**
1. تحقق من `.env.local`
2. نفّذ SQL في Supabase SQL Editor
3. تحقق من Service Role Key (ليس Anon Key)

**Fallback:**
- سيُحفظ في SQLite فقط
- استخدم `syncErrorsToSupabase()` للمزامنة لاحقاً

### ❌ Errors لا تُسجّل من Frontend

**السبب المحتمل:**
- Global handlers لم تُفعّل
- CORS issue
- Endpoint لا يعمل

**الحل:**
1. تحقق من Console: يجب أن ترى `[ErrorTracking] ✅ Error tracking initialized`
2. تحقق من Network tab - يجب أن ترى POST requests إلى `/api/error-tracking/log`
3. افتح `/api/error-tracking/log` في المتصفح للتحقق من الـ health check

### ❌ Cannot find module '@/lib/errorTracking/...'

**الحل:**
```bash
# Restart development server
npm run dev
```

---

## 🎯 Integration في API Routes (اختياري)

إذا أردت استخدام Middleware في API routes موجودة:

### قبل:

```typescript
// app/api/members/route.ts
export async function GET(request: Request) {
  try {
    const members = await prisma.member.findMany()
    return NextResponse.json(members)
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

### بعد:

```typescript
// app/api/members/route.ts
import { withErrorTracking } from '@/lib/errorTracking/apiErrorMiddleware'

async function handler(request: Request) {
  const members = await prisma.member.findMany()
  return NextResponse.json(members)
}

export const GET = withErrorTracking(handler)
```

**الفائدة:**
- تسجيل تلقائي لكل الأخطاء (4xx, 5xx, exceptions)
- استخراج user info من request
- استخراج request body
- تنظيف رسائل الأخطاء

---

## 📊 مراقبة الأخطاء (Monitoring)

### Via Supabase Dashboard

1. افتح Supabase → Table Editor → `error_logs`
2. استخدم Filters لعرض:
   - Unresolved errors: `is_resolved = false`
   - Critical errors: `severity = CRITICAL`
   - Recent errors: `created_at > (NOW() - INTERVAL '1 day')`

### Via Stats API

```bash
# عرض إحصائيات آخر 7 أيام
curl -H "Cookie: auth-token=..." \
  http://localhost:3000/api/error-tracking/stats?days=7
```

### Via Prisma Studio

```bash
npx prisma studio
# Navigate to ErrorLog model
# View, filter, search errors
```

---

## 🔄 Background Sync (اختياري)

لمزامنة الأخطاء غير المحفوظة في Supabase:

```typescript
import { syncErrorsToSupabase } from '@/lib/errorTracking/errorTrackingService'

// Manual sync
const result = await syncErrorsToSupabase()
console.log(`Synced: ${result.synced}, Failed: ${result.failed}`)
```

أو عبر Cron Job (يُنشأ لاحقاً إذا لزم الأمر).

---

## ✅ Checklist - النظام جاهز

قبل الانتقال إلى Production:

- [ ] ✅ Supabase table `error_logs` created
- [ ] ✅ RLS policies enabled في Supabase
- [ ] ✅ Environment variables configured
- [ ] ✅ Test all error types (Frontend, Backend, Database)
- [ ] ✅ Verify errors saved in SQLite
- [ ] ✅ Verify errors saved in Supabase
- [ ] ✅ Test Error Boundary UI
- [ ] ✅ Test Stats API (for admins)
- [ ] ✅ No sensitive data في error logs (passwords, tokens)
- [ ] ✅ `ErrorTrackingProvider` في ClientLayout

---

## 📝 Notes

1. **Development vs Production:**
   - في Development: `showDetails={true}` في Error Boundary
   - في Production: `showDetails={false}` (default)

2. **Data Sanitization:**
   - كل الأخطاء تمر عبر `sanitizeErrorMessage()` و `sanitizeRequestData()`
   - حقول حساسة (password, token, secret) → `[REDACTED]`

3. **Performance:**
   - Error logging هو **non-blocking**
   - لا يؤثر على performance الطلبات
   - يستخدم `async/await` و `.catch()` للتعامل مع الأخطاء

4. **Cleanup:**
   - احذف الأخطاء القديمة دورياً (مثلاً > 90 يوم)
   - Query في Supabase:
     ```sql
     DELETE FROM error_logs
     WHERE created_at < NOW() - INTERVAL '90 days';
     ```

---

## 🎉 خلاصة

تم بناء نظام Error Tracking شامل يتضمن:

✅ **Double storage** - Supabase (cloud) + SQLite (local backup)
✅ **Auto-categorization** - تصنيف ذكي للأخطاء
✅ **Frontend tracking** - Error Boundary + global handlers
✅ **Backend tracking** - API middleware
✅ **Non-blocking** - لا يؤثر على الأداء
✅ **Secure** - تنظيف البيانات الحساسة
✅ **Stats API** - إحصائيات للإدارة

**الخطوة التالية:** نفّذ Supabase SQL في Dashboard ثم ابدأ الاختبار! 🚀
