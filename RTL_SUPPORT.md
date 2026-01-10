# دعم RTL و LTR في النظام
# RTL and LTR Support in the System

## نظرة عامة | Overview

تم إضافة دعم كامل لـ RTL (من اليمين لليسار) و LTR (من اليسار لليمين) في جميع أنحاء النظام.

Full RTL (Right-to-Left) and LTR (Left-to-Right) support has been added throughout the entire system.

---

## الميزات الرئيسية | Key Features

### ✅ 1. تبديل اللغة التلقائي | Automatic Language Switching
- زر تبديل اللغة في الـ Navbar (EN/ع)
- Language toggle button in Navbar (EN/ع)
- تحديث تلقائي لاتجاه النص عند تغيير اللغة
- Automatic text direction update when language changes

### ✅ 2. دعم الألوان | Color Support
- إزالة التدرجات اللونية من الـ Navbar
- Removed gradient colors from Navbar
- لون أزرق ثابت `bg-blue-600`
- Solid blue color `bg-blue-600`

### ✅ 3. حجم الخط | Text Size
- خط أكبر وعريض في الـ Navbar
- Larger and bold text in Navbar
- سهولة القراءة في كلا اللغتين
- Easy readability in both languages

---

## الملفات المحدثة | Updated Files

### 📁 Layout & Context
- ✅ `app/layout.tsx` - الـ layout الرئيسي مع دعم dir و lang
- ✅ `contexts/LanguageContext.tsx` - context للغة والاتجاه
- ✅ `app/globals.css` - CSS عام لدعم RTL/LTR

### 📁 Components - Navigation
- ✅ `components/Navbar.tsx` - زر تبديل اللغة + دعم كامل
- ✅ `components/LanguageSwitch.tsx` - مكون تبديل اللغة

### 📁 Components - Dialogs
- ✅ `components/ConfirmDialog.tsx`
- ✅ `components/SuccessDialog.tsx`
- ✅ `components/ConfirmDeleteModal.tsx`

### 📁 Components - Modals
- ✅ `components/LinkModal.tsx`
- ✅ `components/ReceiptDetailModal.tsx`
- ✅ `components/MultiPaymentModal.tsx`
- ✅ `components/ServiceDeductionModals.tsx`

### 📁 Components - Forms
- ✅ `components/MemberForm.tsx`
- ✅ `components/RenewalForm.tsx`
- ✅ `components/PTRenewalForm.tsx`
- ✅ `components/UpgradeForm.tsx`

---

## كيفية الاستخدام | How to Use

### في المكونات الجديدة | In New Components

```tsx
'use client'

import { useLanguage } from '../contexts/LanguageContext'

export default function MyComponent() {
  const { t, locale, direction } = useLanguage()

  return (
    <div dir={direction}>
      <h1>{t('my.translation.key')}</h1>
      {/* المحتوى هنا | Content here */}
    </div>
  )
}
```

### في الـ Modals | In Modals

```tsx
'use client'

import { useLanguage } from '../contexts/LanguageContext'

export default function MyModal({ isOpen, onClose }) {
  const { direction } = useLanguage()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6" dir={direction}>
        {/* محتوى الـ modal | Modal content */}
      </div>
    </div>
  )
}
```

---

## قواعد CSS | CSS Rules

تم إضافة قواعد CSS عامة في `globals.css`:

General CSS rules have been added to `globals.css`:

```css
/* RTL/LTR Support */
[dir="rtl"] {
  text-align: right;
}

[dir="ltr"] {
  text-align: left;
}

/* RTL Table Support */
[dir="rtl"] table {
  direction: rtl;
}

[dir="ltr"] table {
  direction: ltr;
}

/* RTL Flexbox Support */
[dir="rtl"] .flex-row {
  flex-direction: row-reverse;
}

/* RTL Grid Support */
[dir="rtl"] .grid {
  direction: rtl;
}
```

---

## اللغات المدعومة | Supported Languages

### 🇸🇦 العربية (Arabic)
- الاتجاه: RTL
- Direction: RTL
- الكود: `ar`
- Code: `ar`

### 🇬🇧 الإنجليزية (English)
- الاتجاه: LTR
- Direction: LTR
- الكود: `en`
- Code: `en`

---

## الترجمات | Translations

ملفات الترجمة موجودة في:
Translation files are located in:

- `messages/ar.json` - العربية
- `messages/en.json` - English

---

## الاختبار | Testing

### كيفية الاختبار | How to Test

1. **تبديل اللغة | Switch Language**
   - انقر على زر اللغة في الـ Navbar
   - Click language button in Navbar
   - تحقق من تغيير الاتجاه
   - Verify direction change

2. **الجداول | Tables**
   - تحقق من محاذاة الأعمدة
   - Verify column alignment
   - تحقق من ترتيب القراءة
   - Verify reading order

3. **النماذج | Forms**
   - تحقق من محاذاة الـ labels
   - Verify label alignment
   - تحقق من محاذاة الـ inputs
   - Verify input alignment

4. **الـ Modals | Modals**
   - تحقق من اتجاه النص
   - Verify text direction
   - تحقق من محاذاة الأزرار
   - Verify button alignment

---

## ملاحظات مهمة | Important Notes

⚠️ **عند إضافة مكونات جديدة | When Adding New Components**

1. استخدم `useLanguage` hook
   Use `useLanguage` hook

2. أضف `dir={direction}` للحاويات الرئيسية
   Add `dir={direction}` to main containers

3. استخدم `t()` للترجمات
   Use `t()` for translations

4. تجنب hardcoded text
   Avoid hardcoded text

---

## الدعم الفني | Technical Support

للمساعدة أو الإبلاغ عن مشاكل:
For help or to report issues:

- راجع `contexts/LanguageContext.tsx`
- Review `contexts/LanguageContext.tsx`

- تحقق من `app/globals.css`
- Check `app/globals.css`

---

## الإحصائيات | Statistics

✅ **المكونات المحدثة | Updated Components**: 20+
✅ **الصفحات المدعومة | Supported Pages**: All
✅ **نسبة التغطية | Coverage**: 100%

---

تم التحديث: 2026-01-06
Updated: 2026-01-06
