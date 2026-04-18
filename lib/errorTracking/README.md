# 🐛 نظام تتبع الأخطاء (Error Tracking System)

## نظرة عامة

نظام شامل لتتبع وتسجيل الأخطاء في التطبيق مع حفظ مزدوج (Supabase + SQLite).

## المميزات

✅ **Double Storage** - حفظ في Supabase (cloud) و SQLite (local backup)
✅ **Auto-categorization** - تصنيف تلقائي ذكي للأخطاء
✅ **Error Types** - Frontend, Backend API, Database, Authentication
✅ **Severity Levels** - LOW, MEDIUM, HIGH, CRITICAL
✅ **Data Sanitization** - حماية البيانات الحساسة
✅ **Non-blocking** - لا يؤثر على أداء التطبيق
✅ **Graceful Fallback** - إذا فشل Supabase، يحفظ في SQLite فقط

## البنية

```
lib/errorTracking/
├── errorTrackingService.ts    # الخدمة الأساسية
├── apiErrorMiddleware.ts      # Middleware للـ API routes
└── globalErrorHandlers.ts     # Frontend error handlers

components/
├── ErrorTrackingBoundary.tsx  # React Error Boundary
└── ErrorTrackingProvider.tsx  # Provider wrapper

app/api/error-tracking/
├── log/route.ts               # Frontend logging endpoint
└── stats/route.ts             # Statistics endpoint
```

## الاستخدام السريع

### 1. Backend API Errors (Automatic)

```typescript
import { withErrorTracking } from '@/lib/errorTracking/apiErrorMiddleware'

async function handler(request: Request) {
  const data = await prisma.member.findMany()
  return NextResponse.json(data)
}

export const GET = withErrorTracking(handler)
export const POST = withErrorTracking(handler)
```

### 2. Manual Logging (Backend)

```typescript
import { logBackendError, logDatabaseError } from '@/lib/errorTracking/errorTrackingService'

try {
  await prisma.member.create({ data })
} catch (error) {
  await logDatabaseError({
    error,
    operation: 'CREATE',
    model: 'Member',
    userId: user.userId,
  })
  throw error
}
```

### 3. Frontend Errors (Automatic)

تم تفعيل Error Tracking تلقائياً عبر:
- React Error Boundary
- `window.onerror`
- `unhandledrejection`
- Fetch wrapper

### 4. Manual Logging (Frontend)

```typescript
import { logFrontendError } from '@/lib/errorTracking/errorTrackingService'

try {
  const data = await fetchData()
} catch (error) {
  await logFrontendError({
    message: 'Failed to load data',
    error,
    additionalContext: { component: 'MemberList' }
  })
}
```

## Error Categories

| Category | Description | Severity |
|----------|-------------|----------|
| `PRISMA_ERROR` | Database errors (P2002, P2003, etc.) | MEDIUM/HIGH |
| `VALIDATION_ERROR` | Data validation failures | LOW |
| `NETWORK_ERROR` | Network/fetch errors | MEDIUM |
| `JWT_ERROR` | Authentication/token errors | HIGH |
| `PERMISSION_ERROR` | Authorization errors | LOW |
| `NOT_FOUND` | 404 errors | LOW |
| `RATE_LIMIT` | 429 errors | MEDIUM |
| `TIMEOUT` | Request timeouts | MEDIUM |
| `UNKNOWN` | Uncategorized errors | varies |

## Severity Levels

- **LOW** - أخطاء عادية (404, validation, permissions)
- **MEDIUM** - أخطاء متوسطة (network, rate limit)
- **HIGH** - أخطاء خطيرة (auth failures, database errors)
- **CRITICAL** - أخطاء حرجة (system failures) - يدوي فقط

## Stats API

للحصول على إحصائيات الأخطاء (Admin only):

```bash
GET /api/error-tracking/stats?days=7&limit=10
```

Response:
```json
{
  "summary": {
    "totalErrors": 123,
    "unresolvedErrors": 45,
    "unsyncedToSupabase": 0
  },
  "errorsByType": [...],
  "errorsBySeverity": [...],
  "criticalErrors": [...],
  "topErrorEndpoints": [...]
}
```

## Monitoring

### Supabase Dashboard
```sql
-- آخر 10 أخطاء
SELECT * FROM error_logs
ORDER BY created_at DESC LIMIT 10;

-- الأخطاء الحرجة غير المحلولة
SELECT * FROM error_logs
WHERE severity = 'CRITICAL' AND is_resolved = false;

-- أكثر الـ endpoints خطأً
SELECT endpoint, COUNT(*) as count
FROM error_logs
WHERE endpoint IS NOT NULL
GROUP BY endpoint
ORDER BY count DESC
LIMIT 10;
```

### Prisma Studio
```bash
npx prisma studio
# Navigate to ErrorLog model
```

## Background Sync

لمزامنة الأخطاء غير المحفوظة في Supabase:

```typescript
import { syncErrorsToSupabase } from '@/lib/errorTracking/errorTrackingService'

const { synced, failed } = await syncErrorsToSupabase()
console.log(`Synced: ${synced}, Failed: ${failed}`)
```

## Security

- ✅ كل الأخطاء تمر عبر `sanitizeErrorMessage()` و `sanitizeRequestData()`
- ✅ حقول حساسة (password, token, secret, apiKey) → `[REDACTED]`
- ✅ Stack traces تُنظّف من معلومات حساسة
- ✅ RLS policies في Supabase

## Testing

راجع [ERROR_TRACKING_TESTING.md](../../ERROR_TRACKING_TESTING.md) لدليل الاختبار الشامل.

## Notes

1. **Development**: Error Boundary يعرض Stack trace
2. **Production**: Error Boundary يخفي Stack trace (UI نظيف فقط)
3. **Performance**: كل العمليات non-blocking
4. **Cleanup**: احذف الأخطاء القديمة دورياً (> 90 يوم)

## Support

للمزيد من المعلومات، راجع:
- [Testing Guide](../../ERROR_TRACKING_TESTING.md)
- [Plan File](../../.claude/plans/hidden-kindling-widget.md)
