# 🌙 دليل Dark Mode السريع

## 🎯 للمستخدمين

### تفعيل Dark Mode
1. افتح **الإعدادات** من القائمة (⚙️)
2. ابحث عن **"إعدادات المظهر"**
3. اضغط على زر التبديل 🌙/☀️
4. سيتم حفظ التفضيل تلقائياً

### مميزات Dark Mode
- 🌙 **مريح للعين** في الإضاءة المنخفضة
- 🔋 **يوفر البطارية** على شاشات OLED
- 💾 **يحفظ التفضيل** تلقائياً
- 🌐 **يعمل عبر التبويبات** جميعها

---

## 💻 للمطورين

### استخدام Dark Mode في Component

```tsx
import { useDarkMode } from '@/contexts/DarkModeContext'

function MyComponent() {
  const { isDarkMode, toggleDarkMode, setDarkMode } = useDarkMode()

  return (
    <div className="bg-white dark:bg-gray-800">
      <button onClick={toggleDarkMode}>
        {isDarkMode ? '☀️ Light' : '🌙 Dark'}
      </button>
    </div>
  )
}
```

### القواعد الأساسية

#### 1. الخلفيات
```tsx
// ✅ صحيح
className="bg-white dark:bg-gray-800"

// ❌ خطأ
className="bg-white"
```

#### 2. النصوص
```tsx
// ✅ صحيح
className="text-gray-700 dark:text-gray-200"

// ❌ خطأ
className="text-gray-700"
```

#### 3. الحدود
```tsx
// ✅ صحيح
className="border-gray-300 dark:border-gray-600"

// ❌ خطأ
className="border-gray-300"
```

#### 4. المدخلات
```tsx
// ✅ صحيح
className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white"

// ❌ خطأ
className="border"
```

### Tailwind Classes الشائعة

| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Background | `bg-white` | `dark:bg-gray-800` |
| Card | `bg-gray-50` | `dark:bg-gray-700` |
| Text | `text-gray-700` | `dark:text-gray-200` |
| Border | `border-gray-300` | `dark:border-gray-600` |
| Input | `bg-white` | `dark:bg-gray-700 dark:text-white` |
| Hover | `hover:bg-gray-50` | `dark:hover:bg-gray-700` |

### Gradients

```tsx
// Light + Dark gradients
className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30"

// Borders with gradients
className="border-blue-200 dark:border-blue-700"
```

### التعامل مع الألوان

```tsx
// Primary Colors (تُعكس في Dark Mode)
className="text-primary-600 dark:text-primary-400"

// Success Colors
className="text-green-600 dark:text-green-400"

// Error Colors
className="text-red-600 dark:text-red-400"

// Warning Colors
className="text-yellow-600 dark:text-yellow-400"
```

---

## 🎨 أمثلة عملية

### Button
```tsx
<button className="
  bg-primary-600 dark:bg-primary-700
  hover:bg-primary-700 dark:hover:bg-primary-800
  text-white
  px-6 py-2 rounded-lg
">
  Click Me
</button>
```

### Card
```tsx
<div className="
  bg-white dark:bg-gray-800
  border-2 border-gray-200 dark:border-gray-700
  p-6 rounded-xl shadow-lg
">
  <h2 className="text-xl font-bold dark:text-white">
    Card Title
  </h2>
  <p className="text-gray-600 dark:text-gray-300">
    Card description
  </p>
</div>
```

### Input Field
```tsx
<input
  type="text"
  className="
    w-full px-4 py-3
    border-2 border-gray-300 dark:border-gray-600
    dark:bg-gray-700 dark:text-white
    rounded-lg
    focus:border-primary-500
  "
  placeholder="Enter text"
/>
```

### Table
```tsx
<table className="w-full">
  <thead className="bg-gray-100 dark:bg-gray-700">
    <tr>
      <th className="px-4 py-3 dark:text-gray-200">Header</th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
      <td className="px-4 py-3 dark:text-gray-200">Data</td>
    </tr>
  </tbody>
</table>
```

---

## 🔧 تخصيص CSS Variables

### في globals.css

```css
.dark {
  /* Primary Colors - تُعكس للـ Dark Mode */
  --color-primary-500: #60a5fa;
  --color-primary-600: #93c5fd;

  /* Background & Foreground */
  --foreground-rgb: 255, 255, 255;
  --background-start-rgb: 17, 24, 39;
  --background-end-rgb: 17, 24, 39;
}

.dark body {
  background: rgb(17, 24, 39);
  color: rgb(243, 244, 246);
}
```

---

## ⚡ نصائح الأداء

### 1. استخدم Tailwind Classes
```tsx
// ✅ أسرع
className="dark:bg-gray-800"

// ❌ أبطأ
style={{ backgroundColor: isDarkMode ? '#1f2937' : '#ffffff' }}
```

### 2. تجنب Re-renders غير الضرورية
```tsx
// ✅ استخدم useMemo
const cardClass = useMemo(() =>
  `bg-white dark:bg-gray-800 p-6`,
  []
)

// ❌ تجنب
const cardClass = `bg-white dark:bg-gray-800 p-6`
```

### 3. CSS Variables للألوان المتكررة
```css
/* في globals.css */
:root {
  --card-bg: #ffffff;
}

.dark {
  --card-bg: #1f2937;
}
```

---

## 🐛 حل المشاكل

### المشكلة: Flash عند التحميل
```tsx
// الحل في DarkModeContext
if (!mounted) {
  return <>{children}</>
}
```

### المشكلة: الألوان لا تتغير
```tsx
// تأكد من:
1. DarkModeProvider موجود في ClientLayout
2. Classes مكتوبة بشكل صحيح
3. Tailwind يتعرف على dark: variant
```

### المشكلة: بعض العناصر لا تتأثر
```tsx
// تأكد من إضافة dark: لكل class
// ❌ خطأ
className="bg-white text-gray-700"

// ✅ صحيح
className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
```

---

## 📋 Checklist للـ Components الجديدة

عند إنشاء component جديد:

- [ ] إضافة `dark:bg-*` للخلفيات
- [ ] إضافة `dark:text-*` للنصوص
- [ ] إضافة `dark:border-*` للحدود
- [ ] إضافة `dark:hover:*` للحالات التفاعلية
- [ ] اختبار في Light Mode
- [ ] اختبار في Dark Mode
- [ ] التأكد من Contrast جيد

---

## 🎯 Best Practices

### 1. الاتساق
استخدم نفس الألوان في كل مكان:
- Cards: `bg-white dark:bg-gray-800`
- Borders: `border-gray-200 dark:border-gray-600`
- Text: `text-gray-700 dark:text-gray-200`

### 2. Contrast
تأكد من تباين جيد:
```tsx
// ✅ تباين جيد
bg-white dark:bg-gray-800
text-gray-900 dark:text-gray-100

// ❌ تباين ضعيف
bg-white dark:bg-gray-700
text-gray-400 dark:text-gray-500
```

### 3. التدرجات
استخدم opacity للتدرجات:
```tsx
// ✅ يعمل في الوضعين
from-blue-50 dark:from-blue-900/30

// ❌ قد لا يظهر جيداً
from-blue-50 dark:from-blue-900
```

---

## 📚 موارد إضافية

- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [Next.js Themes](https://nextjs.org/docs/pages/building-your-application/styling/css-in-js)
- [DarkModeContext.tsx](/contexts/DarkModeContext.tsx)
- [globals.css](/app/globals.css)

---

**Happy Coding! 🚀**
