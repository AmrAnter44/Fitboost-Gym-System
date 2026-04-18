# 🧪 Automated Testing with Playwright

اختبارات تلقائية شاملة لنظام إدارة الجيم باستخدام Playwright.

## 📋 ما هو Playwright؟

Playwright هو أداة اختبار تلقائية تفتح المتصفح وتتصرف مثل المستخدم الحقيقي:
- ✅ يفتح الصفحات
- ✅ يملأ الحقول
- ✅ يضغط الأزرار
- ✅ يتحقق من النتائج
- ✅ يصور screenshots وvideos عند الأخطاء

---

## 🚀 كيفية التشغيل

### 1. تأكد أن النظام شغال

أولاً، شغل النظام في terminal منفصل:

```bash
npm run dev
```

انتظر حتى يظهر:
```
✔ Ready in 3s
○ Local:    http://localhost:4001
```

### 2. شغل جميع الاختبارات

في terminal تاني، اكتب:

```bash
npm test
```

هيشغل جميع الاختبارات ويطبع النتائج.

### 3. شغل اختبار واحد فقط

```bash
npx playwright test tests/e2e/01-auth.spec.ts
```

### 4. شغل مع فتح المتصفح (headed mode)

عشان تشوف المتصفح وهو بيشتغل:

```bash
npm run test:headed
```

### 5. وضع التصحيح (Debug Mode)

عشان تتابع كل خطوة بخطوة:

```bash
npm run test:debug
```

### 6. شغل الواجهة التفاعلية

أفضل طريقة للتعديل والتجربة:

```bash
npm run test:ui
```

### 7. عرض التقرير

بعد ما الاختبارات تخلص:

```bash
npm run test:report
```

---

## 📁 ملفات الاختبار

```
tests/e2e/
├── 01-auth.spec.ts           # اختبارات تسجيل الدخول والخروج
├── 02-members.spec.ts         # اختبارات إدارة الأعضاء
├── 03-nutrition.spec.ts       # اختبارات التغذية
├── 04-receipts.spec.ts        # اختبارات الإيصالات
└── 99-comprehensive.spec.ts   # اختبار شامل للنظام كامل
```

---

## 📊 التقارير

بعد تشغيل الاختبارات:

- **HTML Report**: `playwright-report/index.html`
- **JSON Results**: `test-results/results.json`
- **Screenshots**: `playwright-report/` (عند الفشل فقط)
- **Videos**: `playwright-report/` (عند الفشل فقط)

---

## ✅ السيناريوهات المختبرة

### Authentication (01-auth.spec.ts)
- ✓ تحميل صفحة Login
- ✓ تسجيل دخول ناجح
- ✓ رفض تسجيل دخول خاطئ
- ✓ تسجيل خروج

### Members (02-members.spec.ts)
- ✓ فتح صفحة الأعضاء
- ✓ فتح نموذج إضافة عضو
- ✓ إضافة عضو جديد
- ✓ البحث عن عضو
- ✓ عرض تفاصيل عضو

### Nutrition (03-nutrition.spec.ts)
- ✓ فتح صفحة التغذية
- ✓ فتح نموذج اشتراك جديد
- ✓ إنشاء اشتراك تغذية
- ✓ عرض سجل الجلسات
- ✓ تسجيل حضور جلسة

### Receipts (04-receipts.spec.ts)
- ✓ فتح صفحة الإيصالات
- ✓ البحث في الإيصالات
- ✓ فلترة حسب النوع
- ✓ عرض تفاصيل إيصال

### Comprehensive (99-comprehensive.spec.ts)
- ✓ سيناريو كامل: Login → إضافة عضو → اشتراك تغذية → عرض إيصال

---

## 🔧 إعدادات متقدمة

### تغيير المتصفح

في `playwright.config.ts`:

```typescript
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
]
```

### تغيير الـ URL

في `playwright.config.ts`:

```typescript
use: {
  baseURL: 'http://localhost:4001', // غيره للـ production URL
}
```

### تصوير جميع الاختبارات

في `playwright.config.ts`:

```typescript
use: {
  video: 'on', // بدل 'retain-on-failure'
  screenshot: 'on', // بدل 'only-on-failure'
}
```

---

## 🐛 إذا واجهت مشاكل

### Problem: `Error: page.goto: net::ERR_CONNECTION_REFUSED`

**الحل**: النظام مش شغال. افتح terminal وشغل `npm run dev` أولاً.

---

### Problem: `Test timeout exceeded`

**الحل**: زود الـ timeout في `playwright.config.ts`:

```typescript
timeout: 120 * 1000, // 2 minutes
```

---

### Problem: `Element not found`

**الحل**: النظام قد يكون بطيء. زود الانتظار:

```typescript
await page.waitForTimeout(3000) // 3 seconds
```

---

## 📝 كتابة اختبارات جديدة

### مثال بسيط:

```typescript
import { test, expect } from '@playwright/test'

test('my new test', async ({ page }) => {
  // 1. افتح الصفحة
  await page.goto('/my-page')

  // 2. املأ حقل
  await page.fill('input[name="field"]', 'value')

  // 3. اضغط زر
  await page.click('button[type="submit"]')

  // 4. تحقق من النتيجة
  await expect(page).toHaveURL('/success')
})
```

---

## 🎯 نصائح

1. **شغل الاختبارات بانتظام** - بعد كل تعديل كبير
2. **استخدم `test:ui`** - أسهل طريقة للتطوير
3. **شوف الـ videos** - لما اختبار يفشل، شوف الفيديو عشان تفهم ليه
4. **اكتب اختبارات للـ bugs** - لما تلاقي bug، اكتب اختبار يثبته

---

## 📚 مصادر إضافية

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)

---

## ✨ أمثلة سريعة

### Login
```bash
npx playwright test tests/e2e/01-auth.spec.ts
```

### إضافة عضو
```bash
npx playwright test tests/e2e/02-members.spec.ts -g "should create new member"
```

### اختبار شامل
```bash
npx playwright test tests/e2e/99-comprehensive.spec.ts
```

---

## 🎉 نجحت؟

إذا شفت:
```
✓ 15 passed (30s)
```

معناها النظام شغال 100% ومفيش مشاكل! 🚀

---

**تم الإعداد بواسطة Claude + Playwright** 🤖
