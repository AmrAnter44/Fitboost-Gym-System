# ⚡ مرجع تقني سريع - FitBoost System
## Quick Technical Reference

هذا الملف للرجوع السريع للمعلومات التقنية الأساسية.

---

## 🎨 الألوان الأساسية (Theme Colors)

```css
/* Primary Colors */
--color-primary-50: #fff7ed
--color-primary-100: #ffedd5
--color-primary-200: #fed7aa
--color-primary-300: #fdba74
--color-primary-400: #fb923c
--color-primary-500: #ff9915  /* Main Brand Color */
--color-primary-600: #ea580c
--color-primary-700: #c2410c
--color-primary-800: #9a3412
--color-primary-900: #7c2d12

/* Gray Colors (Dark Mode) */
--color-gray-50: #f9fafb
--color-gray-800: #1f2937
--color-gray-900: #111827
```

---

## 📁 Structure المهمة

```
app/
├── api/                    # API Routes
│   ├── auth/              # Login/Logout
│   ├── members/           # الأعضاء
│   ├── staff/             # الموظفين
│   ├── receipts/          # الإيصالات
│   ├── whatsapp/          # WhatsApp Integration
│   └── [feature]/         # باقي المزايا

components/
├── ClientLayout.tsx       # Layout الرئيسي (Sidebar + Breadcrumb)
├── Sidebar.tsx            # القائمة الجانبية
├── Breadcrumb.tsx         # مسار التنقل
├── Toast.tsx              # الإشعارات
├── MemberForm.tsx         # نموذج الأعضاء
├── RenewalForm.tsx        # نموذج التجديد
└── Receipt*.tsx           # الإيصالات

lib/
├── whatsapp.ts            # WhatsApp Backend (Baileys)
├── whatsappHelper.ts      # WhatsApp Helpers
├── license.ts             # License Validation
└── rolePermissions.ts     # Permissions

contexts/
├── LanguageContext.tsx    # اللغة (ar/en)
├── DarkModeContext.tsx    # Dark Mode
├── ToastContext.tsx       # Toasts
└── LicenseContext.tsx     # License
```

---

## 🗄️ Database Models (الأهم)

### Member
```typescript
{
  id: string
  memberNumber: number
  name: string
  phone: string
  subscriptionPrice: number
  startDate: DateTime
  expiryDate: DateTime
  isActive: boolean
  isFrozen: boolean
  freePTSessions: number
  freeNutritionSessions: number
  // ... more fields
}
```

### Staff
```typescript
{
  id: string
  code: string
  name: string
  phone: string
  role: "OWNER" | "ADMIN" | "MANAGER" | "RECEPTIONIST" | "TRAINER" | "COACH"
  salary: number
  commission: number
  workingHours: number
  // ... more fields
}
```

### User (Authentication)
```typescript
{
  id: string
  email: string
  password: string // hashed
  name: string
  role: string
  permissions: JSON // 30+ permissions
}
```

### Receipt
```typescript
{
  id: string
  receiptNumber: number
  type: "gym" | "pt" | "nutrition" | ...
  amount: number
  paymentMethod: string
  memberId: string
  isCancelled: boolean
  details: JSON
}
```

---

## 🔐 Permissions (الصلاحيات)

```typescript
type Permissions = {
  // Members
  canViewMembers: boolean
  canAddMember: boolean
  canEditMember: boolean
  canDeleteMember: boolean
  canRenewMembership: boolean
  canFreezeMembership: boolean

  // Staff
  canViewStaff: boolean
  canAddStaff: boolean
  canEditStaff: boolean
  canDeleteStaff: boolean

  // Receipts
  canViewReceipts: boolean
  canCreateReceipt: boolean
  canCancelReceipt: boolean

  // Expenses
  canViewExpenses: boolean
  canAddExpense: boolean
  canDeleteExpense: boolean

  // Features
  canViewPT: boolean
  canViewNutrition: boolean
  canViewPhysiotherapy: boolean
  canViewGroupClass: boolean
  canViewSpaBookings: boolean
  canViewMore: boolean
  canViewDayUse: boolean

  // Visitors
  canViewVisitors: boolean
  canAddVisitor: boolean
  canViewFollowUps: boolean

  // Admin
  canAccessClosing: boolean
  canAccessSettings: boolean
  canManageUsers: boolean
  canManageLicense: boolean
  canEditLicense: boolean
  canViewAllReceipts: boolean
}
```

---

## 🌍 الترجمة (Translations)

### الملفات
- `messages/ar.json` - العربية
- `messages/en.json` - English

### الاستخدام
```typescript
import { useLanguage } from '@/contexts/LanguageContext'

const { t, locale, direction } = useLanguage()

// Usage
<h1>{t('nav.members')}</h1>
<div dir={direction}>...</div>
```

### المفاتيح الأساسية
```json
{
  "nav": {
    "dashboard": "لوحة التحكم",
    "members": "الأعضاء",
    "staff": "الموظفين",
    "receipts": "الإيصالات",
    "expenses": "المصروفات"
  },
  "common": {
    "appTitle": "نظام الجيم",
    "add": "إضافة",
    "edit": "تعديل",
    "delete": "حذف",
    "save": "حفظ",
    "cancel": "إلغاء"
  }
}
```

---

## 📡 API Routes (أهم الـ Endpoints)

### Authentication
```typescript
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Members
```typescript
GET    /api/members              // Get all members
GET    /api/members/[id]         // Get single member
POST   /api/members              // Create member
PUT    /api/members/[id]         // Update member
DELETE /api/members/[id]         // Delete member
POST   /api/members/[id]/renew   // Renew membership
POST   /api/members/[id]/freeze  // Freeze membership
```

### Staff
```typescript
GET    /api/staff                // Get all staff
POST   /api/staff                // Create staff
PUT    /api/staff/[id]           // Update staff
DELETE /api/staff/[id]           // Delete staff
GET    /api/staff/attendance     // Get attendance
POST   /api/staff/checkin        // Check-in
POST   /api/staff/checkout       // Check-out
```

### Receipts
```typescript
GET    /api/receipts             // Get all receipts
POST   /api/receipts             // Create receipt
PUT    /api/receipts/[id]        // Update receipt
POST   /api/receipts/[id]/cancel // Cancel receipt
```

### WhatsApp
```typescript
POST   /api/whatsapp/initialize  // Initialize WhatsApp
GET    /api/whatsapp/status      // Get status
POST   /api/whatsapp/send        // Send text message
POST   /api/whatsapp/send-image  // Send image
POST   /api/whatsapp/reset       // Reset session
GET    /api/whatsapp/templates   // Get templates
POST   /api/whatsapp/templates   // Create template
PUT    /api/whatsapp/templates   // Update template
DELETE /api/whatsapp/templates   // Delete template
```

---

## 🔧 Environment Variables

```bash
# Database
DATABASE_URL="file:./prisma/gym.db"

# JWT
JWT_SECRET="your-secret-key"

# Supabase (اختياري)
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# License (اختياري)
LICENSE_KEY="your-license-key"
BRANCH_ID="main-branch"
```

---

## 🛠️ أوامر مهمة

### Development
```bash
npm run dev                     # تشغيل التطوير
npm run dev:turbo               # تشغيل مع Turbopack
npm run electron:dev            # تشغيل Electron
```

### Database
```bash
npm run db:push                 # تطبيق التغييرات
npm run db:studio               # فتح Prisma Studio
npm run db:backup               # نسخ احتياطي
npx prisma generate             # توليد Prisma Client
```

### Build
```bash
npm run build                   # بناء Next.js
npm run build:electron          # بناء Electron
npm run build:electron:win      # بناء Windows فقط
```

---

## 🎨 Tailwind Classes (أهم الـ Classes)

### Colors
```css
bg-primary-600                  /* خلفية باللون الأساسي */
text-primary-600                /* نص باللون الأساسي */
dark:bg-gray-800                /* خلفية في Dark Mode */
dark:text-gray-100              /* نص في Dark Mode */
```

### Layout
```css
flex items-center justify-between
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3
sticky top-0 z-40
```

### Responsive
```css
hidden lg:flex                  /* مخفي في الموبايل، ظاهر في Desktop */
lg:hidden                       /* ظاهر في الموبايل، مخفي في Desktop */
sm:px-4                         /* padding في الموبايل */
```

---

## 📱 WhatsApp Integration

### Backend (lib/whatsapp.ts)
```typescript
import { whatsappBackend } from '@/lib/whatsapp'

// Initialize
await whatsappBackend.initialize()

// Get Status
const { isReady, qrCode } = whatsappBackend.getStatus()

// Send Message
await whatsappBackend.sendMessage(phone, message)

// Send Image
await whatsappBackend.sendImage(phone, imageBase64, caption)

// Reset
await whatsappBackend.resetSession()
```

### Frontend Helper (lib/whatsappHelper.ts)
```typescript
import { sendWhatsAppMessage } from '@/lib/whatsappHelper'

// Simple Send (opens wa.me link)
await sendWhatsAppMessage(phone, message)
```

### Electron Integration
```typescript
// في Electron
if (window.electron?.whatsapp) {
  await window.electron.whatsapp.sendMessage(phone, message)
  await window.electron.whatsapp.sendImage(phone, imageBase64, caption)
}
```

---

## 🔍 البحث السريع (Search)

### الاستخدام
```typescript
import { useSearch } from '@/contexts/SearchContext'

const { openSearch } = useSearch()

// فتح البحث
openSearch()

// اختصار لوحة المفاتيح: Ctrl+K أو /
```

### البحث في
- الأعضاء (name, memberNumber, phone)
- الموظفين (name, code, phone)
- الزوار (name, phone)
- الإيصالات (receiptNumber, amount)

---

## 🌙 Dark Mode

### الاستخدام
```typescript
import { useDarkMode } from '@/contexts/DarkModeContext'

const { darkMode, toggleDarkMode } = useDarkMode()

// Toggle
toggleDarkMode()

// Check
if (darkMode) { /* ... */ }
```

### Classes
```css
dark:bg-gray-800
dark:text-gray-100
dark:border-gray-700
```

---

## 🎯 Toast Notifications

### الاستخدام
```typescript
import { useToast } from '@/contexts/ToastContext'

const { showToast } = useToast()

// Show
showToast('تم الحفظ بنجاح', 'success')
showToast('حدث خطأ', 'error')
showToast('تحذير', 'warning')
showToast('معلومة', 'info')
```

---

## 📊 أهم الـ Components

### MemberForm
```typescript
import MemberForm from '@/components/MemberForm'

<MemberForm
  member={member}          // اختياري للتعديل
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>
```

### RenewalForm
```typescript
import RenewalForm from '@/components/RenewalForm'

<RenewalForm
  member={member}
  onSuccess={handleSuccess}
  onCancel={handleCancel}
/>
```

### ReceiptToPrint
```typescript
import ReceiptToPrint from '@/components/ReceiptToPrint'

<ReceiptToPrint receipt={receipt} />
```

---

## 🔐 License System

### التحقق
```typescript
import { useLicense } from '@/contexts/LicenseContext'

const { isLicensed, licenseData, checkLicense } = useLicense()

// Check
if (!isLicensed) {
  // عرض شاشة القفل
}
```

### API
```typescript
POST /api/license/activate      // تفعيل الترخيص
POST /api/license/deactivate    // إلغاء التفعيل
GET  /api/license/validate      // التحقق من الترخيص
```

---

## 🐛 Common Issues & Fixes

### 1. EPERM Error (WhatsApp)
```bash
# الحل: نقل .baileys_auth من Program Files إلى User Directory
# تم حله في lib/whatsapp.ts (line 43-52)
```

### 2. Toast لا يظهر
```typescript
// تأكد من استخدام showToast من ToastContext
import { useToast } from '@/contexts/ToastContext'
const { showToast } = useToast()
```

### 3. Dark Mode لا يعمل
```typescript
// تأكد من إضافة dark: prefix
className="bg-white dark:bg-gray-800"
```

### 4. الترجمة لا تعمل
```typescript
// تأكد من استخدام t() function
const { t } = useLanguage()
<h1>{t('nav.members')}</h1>
```

---

## 📝 Coding Standards

### Naming Conventions
```typescript
// Components: PascalCase
MemberForm.tsx
ReceiptToPrint.tsx

// Hooks: camelCase with 'use' prefix
usePermissions.ts
useDarkMode.ts

// API Routes: kebab-case
/api/members
/api/whatsapp/send-image

// Variables: camelCase
const memberName = "John"
const isActive = true
```

### File Structure
```typescript
// Component File Structure
'use client'

import { ... }                  // 1. Imports
import type { ... }             // 2. Types

interface Props { ... }         // 3. Interfaces/Types

export default function Component({ ... }: Props) {
  const { ... } = useHook()     // 4. Hooks
  const [state, setState] = ... // 5. State

  useEffect(() => { ... }, [])  // 6. Effects

  const handleClick = () => {}  // 7. Handlers

  return (...)                  // 8. JSX
}
```

---

## 🚀 Performance Tips

### 1. استخدام React Query
```typescript
import { useQuery } from '@tanstack/react-query'

const { data, isLoading } = useQuery({
  queryKey: ['members'],
  queryFn: fetchMembers
})
```

### 2. Lazy Loading
```typescript
import dynamic from 'next/dynamic'

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>
})
```

### 3. Image Optimization
```typescript
import Image from 'next/image'

<Image
  src="/logo.png"
  alt="Logo"
  width={100}
  height={100}
  priority
/>
```

---

تم إنشاء هذا الملف في: 2026-03-15
آخر تحديث: 2026-03-15
