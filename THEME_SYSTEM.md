# نظام Theme المركزي - X Gym System

## نظرة عامة

نظام مركزي لإدارة جميع الألوان والـ styles في X Gym System. يسمح بتغيير theme النظام بالكامل من مكان واحد.

## البنية

```
lib/
└── theme/
    ├── colors.ts          ← الألوان الأساسية + helper functions
    ├── theme.config.ts    ← إعدادات Theme الشاملة
    └── index.ts           ← Entry point

app/
└── globals.css            ← CSS Variables

tailwind.config.ts         ← Tailwind Integration
```

## الاستخدام

### 1. في React/TypeScript Components

```tsx
import { PRIMARY_COLOR, THEME_COLORS } from '@/lib/theme'

// Inline styles
<div style={{ color: PRIMARY_COLOR }}>نص</div>
<div style={{ backgroundColor: THEME_COLORS.primary[600] }}>خلفية</div>

// SVG
<svg>
  <path fill={PRIMARY_COLOR} />
  <circle stroke={THEME_COLORS.primary[700]} />
</svg>

// Recharts
<Line stroke={PRIMARY_COLOR} />
<Bar fill={THEME_COLORS.primary[400]} />
```

### 2. في Tailwind Classes

```tsx
// استخدام primary-* بدلاً من blue-*
<div className="bg-primary-500 text-white">
  <button className="hover:bg-primary-600">زر</button>
</div>

// Gradients
<div className="bg-gradient-to-r from-primary-500 to-primary-700">
  Gradient Background
</div>

// جميع الدرجات متاحة: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950
```

### 3. في CSS المخصص

```css
.custom-class {
  color: var(--color-primary-500);
  border: 2px solid var(--color-primary-600);
}

/* مع transparency */
.custom-shadow {
  box-shadow: 0 4px 6px rgba(var(--color-primary-rgb), 0.3);
}
```

## تخصيص الألوان

### تعديل ملف colors.ts مباشرة

في `lib/theme/colors.ts`:

```typescript
export const THEME_COLORS = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    // ...
    500: '#your-new-color',  // غيّر هنا
    600: '#darker-shade',
    // ... باقي الدرجات
  }
}
```

**مثال:** لتغيير النظام للأخضر:

```typescript
export const THEME_COLORS = {
  primary: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#10b981',  // ✅ اللون الأساسي
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
    950: '#022c22',
  }
}
```

ثم:

```bash
npm run build
npm run dev
```

## الألوان المتاحة

### Primary Colors (الألوان الأساسية)

| الدرجة | Hex (افتراضي) | الاستخدام |
|--------|---------------|-----------|
| 50 | #eff6ff | خلفيات فاتحة جداً |
| 100 | #dbeafe | خلفيات فاتحة |
| 200 | #bfdbfe | Borders فاتحة |
| 300 | #93c5fd | Hover states |
| 400 | #60a5fa | Secondary buttons |
| **500** | **#3b82f6** | **اللون الأساسي** |
| 600 | #2563eb | Primary buttons |
| 700 | #1d4ed8 | Hover/Active states |
| 800 | #1e40af | Dark accents |
| 900 | #1e3a8a | Very dark |
| 950 | #172554 | Darkest |

### ألوان إضافية

```typescript
THEME_COLORS.secondary[500]  // #10b981 (أخضر)
THEME_COLORS.accent[500]     // #f59e0b (برتقالي)
THEME_COLORS.danger[500]     // #ef4444 (أحمر)
```

## Helper Functions

### getColor()

للحصول على لون بـ shade معين:

```typescript
import { getColor } from '@/lib/theme'

const color = getColor('primary', 600)  // #2563eb
```

### hexToRgb()

لتحويل hex إلى RGB:

```typescript
import { hexToRgb } from '@/lib/theme'

const rgb = hexToRgb('#3b82f6')  // "59, 130, 246"
```

## أمثلة عملية

### مثال 1: Button Component

```tsx
import { PRIMARY_COLOR, THEME_COLORS } from '@/lib/theme'

function CustomButton() {
  return (
    <button
      className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded"
    >
      انقر هنا
    </button>
  )
}
```

### مثال 2: Chart Component

```tsx
import { PRIMARY_COLOR, THEME_COLORS } from '@/lib/theme'
import { Line, Bar } from 'recharts'

function RevenueChart() {
  return (
    <LineChart data={data}>
      <Line
        stroke={PRIMARY_COLOR}
        fill={THEME_COLORS.primary[400]}
      />
    </LineChart>
  )
}
```

### مثال 3: Custom CSS

```tsx
function AnimatedLogo() {
  return (
    <div
      className="logo"
      style={{
        filter: `drop-shadow(0 0 8px rgba(var(--color-primary-rgb), 0.3))`
      }}
    >
      Logo
    </div>
  )
}
```

## إضافة ألوان جديدة

لإضافة لون جديد (مثل Warning):

1. في `lib/theme/colors.ts`:

```typescript
export const THEME_COLORS = {
  // ... existing colors

  warning: {
    50: '#fff7ed',
    100: '#ffedd5',
    // ... all shades
    500: '#f59e0b',  // اللون الأساسي
    // ... more shades
  }
}
```

2. في `tailwind.config.ts`:

```typescript
colors: {
  primary: THEME_COLORS.primary,
  warning: THEME_COLORS.warning,  // إضافة
}
```

3. استخدامه:

```tsx
<div className="bg-warning-500 text-warning-900">
  تحذير!
</div>
```

## الصيانة

### تحديث لون موجود

1. افتح `.env`
2. أضف/عدّل المتغير:
   ```env
   NEXT_PUBLIC_PRIMARY_500=#new-color
   ```
3. أعد تشغيل server

### نسخ احتياطي للألوان

احتفظ بنسخة من ألوانك في `.env.local` أو ملف منفصل.

### استكشاف الأخطاء

**المشكلة:** الألوان لا تتغير بعد تعديل `colors.ts`

**الحل:**
1. احفظ الملف (Ctrl+S)
2. أعد تشغيل dev server: `npm run dev`
3. امسح cache إذا لزم الأمر: `rm -rf .next`

**المشكلة:** أخطاء في TypeScript

**الحل:**
1. تحقق من paths في imports: `@/lib/theme` صحيح
2. تحقق من tsconfig.json أن paths معرّفة

## دعم Dark Mode (مستقبلي)

يمكن إضافة dark mode بسهولة:

```css
/* في globals.css */
@media (prefers-color-scheme: dark) {
  :root {
    --color-primary-500: #60a5fa;  /* lighter in dark mode */
    --color-primary-700: #3b82f6;
  }
}
```

## الخلاصة

### ✅ الفوائد

- **مركزية كاملة**: جميع الألوان في مكان واحد
- **Type Safety**: TypeScript + Autocomplete
- **Performance**: CSS Variables سريعة
- **Flexibility**: يعمل مع كل شيء (Tailwind, SVG, CSS)
- **سهل التخصيص**: تغيير من .env أو ملف واحد

### 📝 الملفات الرئيسية

- `lib/theme/colors.ts` - الألوان
- `lib/theme/theme.config.ts` - الإعدادات
- `app/globals.css` - CSS Variables
- `tailwind.config.ts` - Tailwind Integration
- `.env` - التخصيص

### 🎯 كيفية تغيير الألوان

1. افتح `lib/theme/colors.ts`
2. عدّل قيم `THEME_COLORS.primary`
3. احفظ الملف
4. أعد تشغيل: `npm run dev`

---

**تم إنشاء النظام بواسطة:** Claude Sonnet 4.5
**التاريخ:** 2026-01-29
