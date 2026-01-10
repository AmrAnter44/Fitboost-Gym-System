# نظام Toast للإشعارات
# Toast Notification System

## 📝 نظرة عامة | Overview

تم إنشاء نظام toast احترافي لعرض رسائل النجاح والفشل والتحذيرات بدلاً من `setMessage` و alerts العادية.

Professional toast system created to display success, error, and warning messages instead of regular `setMessage` and alerts.

---

## 🎯 الملفات المُنشأة | Created Files

### 1. [contexts/ToastContext.tsx](contexts/ToastContext.tsx)
- Context لإدارة Toast notifications
- Hook `useToast()` للاستخدام في أي مكون

### 2. [components/Toast.tsx](components/Toast.tsx)
- مكون Toast المحسّن
- دعم RTL/LTR ✓
- Progress bar ✓
- Animations احترافية ✓

### 3. [components/ToastContainer.tsx](components/ToastContainer.tsx)
- Container لعرض جميع Toasts
- Stacking تلقائي ✓

### 4. [components/ClientLayout.tsx](components/ClientLayout.tsx) - Updated
- إضافة ToastProvider ✓
- إضافة ToastContainer ✓

### 5. [app/globals.css](app/globals.css) - Updated
- Toast animations ✓

---

## 🚀 كيفية الاستخدام | How to Use

### طريقة الاستخدام الأساسية | Basic Usage

```tsx
'use client'

import { useToast } from '../contexts/ToastContext'

export default function MyComponent() {
  const toast = useToast()

  const handleSuccess = () => {
    toast.success('تم إضافة العضو بنجاح!')
  }

  const handleError = () => {
    toast.error('فشل في إضافة العضو')
  }

  const handleWarning = () => {
    toast.warning('يرجى ملء جميع الحقول')
  }

  const handleInfo = () => {
    toast.info('معلومة مهمة')
  }

  return (
    <div>
      <button onClick={handleSuccess}>نجاح</button>
      <button onClick={handleError}>خطأ</button>
      <button onClick={handleWarning}>تحذير</button>
      <button onClick={handleInfo}>معلومات</button>
    </div>
  )
}
```

---

## 🔄 تحويل الكود القديم | Converting Old Code

### ❌ القديم (Old)
```tsx
const [message, setMessage] = useState('')

const handleSubmit = async () => {
  try {
    // API call
    setMessage('✅ تم بنجاح!')
    setTimeout(() => setMessage(''), 3000)
  } catch (error) {
    setMessage('❌ فشل!')
  }
}

return (
  <div>
    {message && (
      <div className="bg-green-100 p-4">
        {message}
      </div>
    )}
  </div>
)
```

### ✅ الجديد (New)
```tsx
import { useToast } from '../contexts/ToastContext'

const handleSubmit = async () => {
  const toast = useToast()

  try {
    // API call
    toast.success('تم بنجاح!')
  } catch (error) {
    toast.error('فشل!')
  }
}

// لا حاجة للـ JSX - Toast يظهر تلقائياً!
```

---

## 📋 أمثلة متقدمة | Advanced Examples

### 1. رسالة طويلة | Long Message
```tsx
toast.success('تم إضافة العضو بنجاح!\nرقم العضوية: 1001\nالاشتراك: شهر')
```

### 2. تحديد المدة | Custom Duration
```tsx
toast.success('رسالة قصيرة', 2000) // 2 seconds
toast.error('رسالة طويلة', 6000)   // 6 seconds
```

### 3. رسائل متعددة | Multiple Toasts
```tsx
toast.success('تم إضافة العضو')
toast.info('جاري إنشاء الباركود...')
setTimeout(() => {
  toast.success('تم إنشاء الباركود!')
}, 2000)
```

### 4. في API Calls
```tsx
const handleAddMember = async (data) => {
  try {
    const response = await fetch('/api/members', {
      method: 'POST',
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error('فشل في إضافة العضو')
    }

    const result = await response.json()
    toast.success(`تم إضافة العضو: ${result.name}`)
    onSuccess()
  } catch (error) {
    toast.error(error.message || 'حدث خطأ')
  }
}
```

---

## 🎨 أنواع Toast | Toast Types

### 1. Success (نجاح)
```tsx
toast.success('تمت العملية بنجاح!')
```
- لون: أخضر
- أيقونة: ✅
- استخدام: عند نجاح العمليات

### 2. Error (خطأ)
```tsx
toast.error('فشلت العملية!')
```
- لون: أحمر
- أيقونة: ❌
- استخدام: عند فشل العمليات

### 3. Warning (تحذير)
```tsx
toast.warning('يرجى التحقق من البيانات')
```
- لون: برتقالي
- أيقونة: ⚠️
- استخدام: للتحذيرات

### 4. Info (معلومات)
```tsx
toast.info('معلومة مفيدة')
```
- لون: أزرق
- أيقونة: ℹ️
- استخدام: للمعلومات العامة

---

## 📊 الميزات | Features

### ✅ Stacking
- يتم تكديس Toast notifications تلقائياً
- كل toast في مكانه الخاص
- لا تتداخل مع بعضها

### ✅ Auto Dismiss
- تختفي تلقائياً بعد 4 ثواني (افتراضي)
- يمكن تحديد مدة مخصصة
- يمكن الإغلاق يدوياً بالنقر على ×

### ✅ Progress Bar
- شريط تقدم يظهر الوقت المتبقي
- يتقلص تدريجياً
- يختفي عندما ينتهي الوقت

### ✅ RTL/LTR Support
- دعم كامل للعربية والإنجليزية
- يظهر من اليمين في العربية
- يظهر من اليسار في الإنجليزية

### ✅ Animations
- دخول سلس (slide in)
- خروج سلس (slide out)
- progress bar animation

---

## 🔧 الصفحات المطلوب تحديثها | Pages to Update

### High Priority (أولوية عالية)
1. ✅ [app/members/page.tsx](app/members/page.tsx) - إضافة/تعديل/حذف أعضاء
2. ✅ [components/MemberForm.tsx](components/MemberForm.tsx) - نموذج الأعضاء
3. ✅ [app/pt/page.tsx](app/pt/page.tsx) - إدارة PT
4. ✅ [components/RenewalForm.tsx](components/RenewalForm.tsx) - تجديد الاشتراك
5. ✅ [app/receipts/page.tsx](app/receipts/page.tsx) - الإيصالات
6. ✅ [app/expenses/page.tsx](app/expenses/page.tsx) - المصروفات
7. ✅ [app/staff/page.tsx](app/staff/page.tsx) - الموظفين

### Medium Priority (أولوية متوسطة)
8. [app/dayuse/page.tsx](app/dayuse/page.tsx)
9. [app/invitations/page.tsx](app/invitations/page.tsx)
10. [app/visitors/page.tsx](app/visitors/page.tsx)
11. [app/followups/page.tsx](app/followups/page.tsx)
12. [app/offers/page.tsx](app/offers/page.tsx)

---

## 🔍 البحث عن الاستخدام القديم | Find Old Usage

### Commands للبحث
```bash
# البحث عن setMessage
grep -r "setMessage" app/
grep -r "setMessage" components/

# البحث عن message state
grep -r "useState.*message" app/

# البحث عن alert
grep -r "alert\(" app/
```

### Patterns للاستبدال
```tsx
// ❌ Old Pattern 1
const [message, setMessage] = useState('')
setMessage('✅ Success!')

// ✅ New Pattern 1
const toast = useToast()
toast.success('Success!')

// ❌ Old Pattern 2
{message && <div className="bg-green-100">{message}</div>}

// ✅ New Pattern 2
// Nothing needed - Toast shows automatically!

// ❌ Old Pattern 3
alert('تم بنجاح!')

// ✅ New Pattern 3
toast.success('تم بنجاح!')
```

---

## 💡 Best Practices | أفضل الممارسات

### ✅ Do (افعل)
```tsx
// 1. استخدم toast للعمليات المهمة
toast.success('تم حفظ البيانات')

// 2. رسائل واضحة ومختصرة
toast.error('فشل في الاتصال بالخادم')

// 3. استخدم النوع المناسب
toast.warning('الاشتراك سينتهي قريباً')

// 4. رسائل متعددة السطور للتفاصيل
toast.success(`تم إضافة العضو
رقم العضوية: ${memberNumber}
الاشتراك: ${package}`)
```

### ❌ Don't (لا تفعل)
```tsx
// 1. لا تستخدم emojis في الرسالة (موجودة تلقائياً)
toast.success('✅ تم بنجاح!') // Wrong
toast.success('تم بنجاح!')     // Correct

// 2. لا تجعل الرسائل طويلة جداً
toast.success('رسالة طويلة جداً...') // Bad

// 3. لا تستخدم setTimeout لإخفاء Toast
setTimeout(() => toast.hide(), 3000) // Wrong - يختفي تلقائياً
```

---

## 🎯 مثال كامل | Complete Example

```tsx
'use client'

import { useState } from 'react'
import { useToast } from '../contexts/ToastContext'

export default function MemberForm({ onSuccess }) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    price: 0
  })

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
    if (!formData.name) {
      toast.warning('يرجى إدخال اسم العضو')
      return
    }

    if (!formData.phone) {
      toast.warning('يرجى إدخال رقم الهاتف')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('فشل في إضافة العضو')
      }

      const result = await response.json()

      toast.success(`تم إضافة العضو بنجاح!
الاسم: ${result.name}
رقم العضوية: ${result.memberNumber}`)

      onSuccess()

    } catch (error) {
      toast.error(error.message || 'حدث خطأ غير متوقع')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'جاري الحفظ...' : 'حفظ'}
      </button>
    </form>
  )
}
```

---

## 📈 الفوائد | Benefits

### قبل Toast System
- ❌ رسائل عادية في div
- ❌ تحتاج state management
- ❌ تحتاج cleanup (setTimeout)
- ❌ لا تدعم stacking
- ❌ مظهر بسيط

### بعد Toast System
- ✅ Toast notifications احترافية
- ✅ لا تحتاج state management
- ✅ cleanup تلقائي
- ✅ stacking تلقائي
- ✅ مظهر احترافي مع animations

---

## 🔄 Migration Plan | خطة التحويل

### Phase 1: Setup (تم ✅)
- [x] إنشاء ToastContext
- [x] إنشاء Toast component
- [x] إنشاء ToastContainer
- [x] تحديث ClientLayout
- [x] إضافة animations

### Phase 2: Main Pages (تالي)
- [ ] تحديث members page
- [ ] تحديث MemberForm
- [ ] تحديث pt page
- [ ] تحديث RenewalForm
- [ ] تحديث receipts page

### Phase 3: Secondary Pages
- [ ] تحديث باقي الصفحات
- [ ] اختبار شامل
- [ ] حذف الكود القديم

---

تم الإنشاء: 2026-01-06
Created: 2026-01-06

بواسطة: Claude Sonnet 4.5
By: Claude Sonnet 4.5
