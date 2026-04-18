# 🏋️ FitBoost Gym Management System - نظرة شاملة

## 📌 نظرة عامة

**FitBoost** هو نظام شامل لإدارة صالات الرياضية مبني بتقنيات حديثة، يدعم اللغتين العربية والإنجليزية، ويعمل كتطبيق ويب وتطبيق سطح مكتب (Electron).

**الإصدار الحالي:** 5.6.2
**المطور:** Amr Anter
**الترخيص:** نظام License مدمج

---

## 🛠️ التقنيات المستخدمة

### Frontend
- **Next.js 14** - App Router (React 18.3.1)
- **TypeScript** - لضمان Type Safety
- **Tailwind CSS** - للتصميم الحديث والمرن
- **TanStack Query (React Query)** - لإدارة البيانات وال caching
- **next-intl** - للترجمة (عربي/إنجليزي)

### Backend
- **Next.js API Routes** - Server-side endpoints
- **Prisma ORM** - للتعامل مع قاعدة البيانات
- **SQLite** - قاعدة البيانات (better-sqlite3)
- **JWT** - للمصادقة (bcryptjs + jsonwebtoken)

### Integrations
- **WhatsApp (Baileys)** - إرسال رسائل WhatsApp تلقائياً
- **Supabase** - للتخزين السحابي (اختياري)
- **Barcode/QR Code** - للحضور والانصراف (bwip-js, qrcode)
- **Excel Export** - تصدير البيانات (exceljs)
- **PDF Generation** - طباعة الإيصالات (jspdf)

### Desktop App
- **Electron** - لتطبيق سطح المكتب
- **electron-builder** - لبناء التطبيق
- **electron-updater** - للتحديثات التلقائية

### PWA Support
- **next-pwa** - Progressive Web App
- **Service Workers** - للعمل Offline

---

## 📂 هيكل المشروع

```
Fitboost-System/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── auth/                 # المصادقة (Login/Logout)
│   │   ├── members/              # إدارة الأعضاء
│   │   ├── staff/                # إدارة الموظفين
│   │   ├── receipts/             # الإيصالات
│   │   ├── expenses/             # المصروفات
│   │   ├── visitors/             # الزوار
│   │   ├── followups/            # المتابعات
│   │   ├── pt/                   # PT (Personal Training)
│   │   ├── nutrition/            # التغذية
│   │   ├── physiotherapy/        # العلاج الطبيعي
│   │   ├── group-classes/        # الحصص الجماعية
│   │   ├── spa-bookings/         # حجوزات السبا
│   │   ├── more/                 # خدمات إضافية
│   │   ├── dayuse/               # استخدام يومي
│   │   ├── closing/              # الإقفال اليومي
│   │   ├── whatsapp/             # WhatsApp Integration
│   │   ├── barcode/              # توليد الباركود
│   │   ├── license/              # نظام الترخيص
│   │   └── settings/             # الإعدادات
│   ├── [feature]/page.tsx        # صفحات المزايا
│   ├── login/page.tsx            # صفحة تسجيل الدخول
│   └── layout.tsx                # Layout الرئيسي
├── components/                   # React Components
│   ├── Sidebar.tsx               # القائمة الجانبية
│   ├── Breadcrumb.tsx            # مسار التنقل
│   ├── Toast.tsx                 # الإشعارات
│   ├── SearchModal.tsx           # البحث السريع
│   ├── MemberForm.tsx            # نموذج إضافة عضو
│   ├── RenewalForm.tsx           # نموذج التجديد
│   ├── ReceiptToPrint.tsx        # الإيصال للطباعة
│   ├── BarcodeWhatsApp.tsx       # إرسال الباركود
│   └── [other components]
├── contexts/                     # React Contexts
│   ├── LanguageContext.tsx       # اللغة
│   ├── DarkModeContext.tsx       # الوضع الليلي
│   ├── ToastContext.tsx          # الإشعارات
│   ├── SearchContext.tsx         # البحث
│   ├── LicenseContext.tsx        # الترخيص
│   └── ServiceSettingsContext.tsx # إعدادات الخدمات
├── lib/                          # Utility Functions
│   ├── supabase.ts               # Supabase Client
│   ├── whatsapp.ts               # WhatsApp Backend (Baileys)
│   ├── whatsappHelper.ts         # WhatsApp Helpers
│   ├── license.ts                # License Validation
│   ├── rolePermissions.ts        # Roles & Permissions
│   └── [other utils]
├── prisma/                       # Database
│   ├── schema.prisma             # Database Schema
│   └── gym.db                    # SQLite Database
├── electron/                     # Electron App
│   ├── main.js                   # Main Process
│   ├── preload.js                # Preload Script
│   └── whatsapp-manager.js       # WhatsApp Manager
├── public/                       # Static Assets
│   ├── assets/icon.svg           # Logo
│   ├── manifest.json             # PWA Manifest
│   └── sw.js                     # Service Worker
├── messages/                     # Translations
│   ├── ar.json                   # العربية
│   └── en.json                   # English
├── scripts/                      # Build Scripts
│   ├── auto-sync-database.js     # Database Auto-sync
│   ├── production-sync-database.js
│   └── sync-theme-colors.js      # Theme Sync
└── package.json                  # Dependencies

```

---

## 🗄️ قاعدة البيانات (Database Schema)

### النماذج الرئيسية (Main Models)

#### 1. **Member** - الأعضاء
```prisma
- id, memberNumber, name, phone, email
- subscriptionPrice, remainingAmount
- startDate, expiryDate
- isActive, isFrozen, isBanned
- freePTSessions, freeNutritionSessions, freePhysioSessions
- inBodyScans, invitations, points
- coachId (FK → Staff)
```

#### 2. **Staff** - الموظفين
```prisma
- id, code, name, phone, email
- role (OWNER, ADMIN, MANAGER, RECEPTIONIST, TRAINER, COACH)
- salary, commission, workingHours
- monthlyVacationDays
- checkIns (FK → Attendance)
```

#### 3. **User** - المستخدمين (تسجيل الدخول)
```prisma
- id, email, password (hashed)
- name, role
- permissions (JSON - 30+ صلاحية)
```

#### 4. **Receipt** - الإيصالات
```prisma
- id, receiptNumber, type
- amount, paymentMethod
- memberId, staffId
- details (JSON)
- isCancelled
```

#### 5. **Expense** - المصروفات
```prisma
- id, category, amount, description
- paymentMethod, date
- approvedBy
```

#### 6. **Visitor** - الزوار
```prisma
- id, name, phone, source
- interestedIn
- visitDate, followUpDate
```

#### 7. **FollowUp** - المتابعات
```prisma
- id, visitorId, status
- notes, nextFollowUpDate
- assignedTo
```

#### 8. **PT** - Personal Training
```prisma
- ptNumber, clientName, phone
- sessionsPurchased, sessionsRemaining
- coachName, pricePerSession
- startDate, expiryDate
```

#### 9. **Nutrition** - التغذية
```prisma
- nutritionNumber, clientName, phone
- monthsPurchased, monthsRemaining
- coachName, pricePerMonth
- startDate, expiryDate
```

#### 10. **Physiotherapy** - العلاج الطبيعي
```prisma
- physioNumber, clientName, phone
- sessionsPurchased, sessionsRemaining
- coachName, pricePerSession
- startDate, expiryDate
```

#### 11. **GroupClass** - الحصص الجماعية
```prisma
- classNumber, clientName, phone
- sessionsPurchased, sessionsRemaining
- className, price
- startDate, expiryDate
```

#### 12. **SpaBooking** - حجوزات السبا
```prisma
- id, memberName, phone
- service, price, duration
- bookingDate, status
```

#### 13. **More** - خدمات إضافية
```prisma
- moreNumber, clientName, phone
- serviceName, price
- sessionsPurchased, sessionsRemaining
- startDate, expiryDate
```

#### 14. **DayUse** - الاستخدام اليومي
```prisma
- id, clientName, phone
- date, price
- paymentMethod
```

#### 15. **Attendance** - حضور الموظفين
```prisma
- id, staffId
- checkIn, checkOut
- duration (minutes)
```

#### 16. **License** - نظام الترخيص
```prisma
- id, licenseKey
- branchId, gymId
- expiryDate, isActive
```

#### 17. **WhatsAppTemplate** - قوالب WhatsApp
```prisma
- id, title, icon, message
- isCustom, isDefault
```

---

## 🔐 نظام الصلاحيات (Permissions System)

### الأدوار (Roles)
1. **OWNER** - المالك (جميع الصلاحيات)
2. **ADMIN** - المدير (معظم الصلاحيات)
3. **MANAGER** - مدير الفرع (صلاحيات محددة)
4. **RECEPTIONIST** - موظف الاستقبال (صلاحيات محدودة)
5. **TRAINER** - المدرب (صلاحيات PT فقط)
6. **COACH** - الكوتش (صلاحيات محددة)

### الصلاحيات (Permissions) - 30+ صلاحية
```typescript
- canViewMembers, canAddMember, canEditMember, canDeleteMember
- canViewStaff, canAddStaff, canEditStaff, canDeleteStaff
- canViewReceipts, canCreateReceipt, canCancelReceipt
- canViewExpenses, canAddExpense, canDeleteExpense
- canViewVisitors, canAddVisitor, canViewFollowUps
- canViewPT, canViewNutrition, canViewPhysiotherapy
- canViewGroupClass, canViewSpaBookings, canViewMore
- canAccessClosing, canAccessSettings
- canManageUsers, canManageLicense
... إلخ
```

---

## 🎨 المزايا الرئيسية

### 1. إدارة الأعضاء
- ✅ إضافة/تعديل/حذف الأعضاء
- ✅ البحث السريع (Ctrl+K)
- ✅ التجديد التلقائي
- ✅ تجميد الاشتراك
- ✅ نظام النقاط والمكافآت
- ✅ تتبع الجلسات المجانية (PT, Nutrition, Physio, etc.)
- ✅ الباركود/QR Code للحضور
- ✅ إرسال الباركود عبر WhatsApp

### 2. إدارة الموظفين
- ✅ إضافة/تعديل/حذف الموظفين
- ✅ تتبع الحضور والانصراف (Check-in/Check-out)
- ✅ حساب الرواتب والعمولات
- ✅ تتبع ساعات العمل
- ✅ أيام الإجازة الشهرية

### 3. الإيصالات والمالية
- ✅ إيصالات احترافية قابلة للطباعة
- ✅ تتبع المدفوعات والمتبقيات
- ✅ إلغاء الإيصالات (مع Audit Log)
- ✅ تصدير Excel/PDF
- ✅ طرق دفع متعددة (نقدي، فيزا، تحويل، إلخ)

### 4. المصروفات
- ✅ تسجيل جميع المصروفات
- ✅ تصنيفات متعددة (رواتب، إيجار، صيانة، إلخ)
- ✅ الموافقة على المصروفات
- ✅ تقارير شهرية

### 5. الإقفال اليومي
- ✅ حساب تلقائي للإيرادات
- ✅ مقارنة النقدي الفعلي بالمتوقع
- ✅ تصدير التقارير

### 6. الزوار والمتابعات
- ✅ تسجيل الزوار الجدد
- ✅ نظام متابعة ذكي
- ✅ قوالب رسائل WhatsApp قابلة للتخصيص
- ✅ جدولة المتابعات
- ✅ إرسال جماعي عبر WhatsApp

### 7. الخدمات
- ✅ PT (Personal Training)
- ✅ التغذية (Nutrition)
- ✅ العلاج الطبيعي (Physiotherapy)
- ✅ الحصص الجماعية (Group Classes)
- ✅ السبا (Spa Bookings)
- ✅ خدمات إضافية قابلة للتخصيص (More)
- ✅ الاستخدام اليومي (Day Use)

### 8. WhatsApp Integration
- ✅ إرسال الإيصالات تلقائياً
- ✅ إرسال الباركود للأعضاء
- ✅ قوالب رسائل قابلة للتخصيص
- ✅ إرسال جماعي للمتابعات
- ✅ دعم Electron (WhatsApp Web) والبراوزر

### 9. نظام الترخيص
- ✅ ترخيص لكل فرع (Branch-specific)
- ✅ تاريخ انتهاء
- ✅ قفل النظام عند انتهاء الترخيص
- ✅ تفعيل/إلغاء تفعيل الفروع

### 10. الإعدادات
- ✅ إعدادات الخدمات (تفعيل/إيقاف)
- ✅ تخصيص الألوان
- ✅ رابط الموقع الإلكتروني
- ✅ شروط وأحكام الإيصالات

---

## 🌍 اللغات والترجمة

### اللغات المدعومة
- 🇸🇦 العربية (افتراضي)
- 🇬🇧 الإنجليزية

### نظام الترجمة
- **next-intl** - للترجمة
- ملفات الترجمة: `messages/ar.json`, `messages/en.json`
- دعم RTL/LTR كامل
- تبديل فوري للغة (بدون reload)

---

## 🌙 الوضع الليلي (Dark Mode)

- ✅ دعم كامل للوضع الليلي
- ✅ تبديل فوري (بدون reload)
- ✅ حفظ التفضيل في localStorage
- ✅ ألوان متناسقة مع جميع المكونات

---

## 🔍 البحث السريع

- **اختصار:** `Ctrl+K` أو `/`
- **البحث في:**
  - الأعضاء (الاسم، الرقم، التليفون)
  - الموظفين (الاسم، الكود، التليفون)
  - الزوار (الاسم، التليفون)
  - الإيصالات (الرقم، المبلغ)

---

## 📱 Progressive Web App (PWA)

- ✅ قابل للتثبيت على الموبايل
- ✅ يعمل Offline (بيانات محفوظة)
- ✅ Splash Screens لجميع أحجام الشاشات
- ✅ Manifest للتخصيص
- ✅ Service Worker للتحديثات

---

## 🖥️ تطبيق سطح المكتب (Electron)

### المزايا
- ✅ يعمل بدون إنترنت
- ✅ WhatsApp Integration مدمج
- ✅ Barcode Scanner عبر الكاميرا
- ✅ Global Keyboard Shortcuts
- ✅ تحديثات تلقائية (electron-updater)

### البناء
```bash
npm run build:electron        # جميع المنصات
npm run build:electron:win     # Windows فقط
```

### المخرجات
- **Windows:** `dist/Gym Management Setup.exe`
- **Installer:** NSIS (قابل للتخصيص)

---

## 🚀 الأوامر الرئيسية

### Development
```bash
npm run dev                  # بدء التطوير
npm run dev:turbo            # التطوير مع Turbopack
npm run electron:dev         # تطوير Electron
```

### Database
```bash
npm run db:push              # تطبيق التغييرات
npm run db:studio            # فتح Prisma Studio
npm run db:backup            # نسخ احتياطي
npm run db:sync              # مزامنة البيانات
```

### Build & Deploy
```bash
npm run build                # بناء للإنتاج
npm run start                # تشغيل الإنتاج
npm run build:production     # بناء + Electron
```

---

## 📊 إحصائيات المشروع

- **عدد الملفات:** 200+ ملف
- **عدد المكونات:** 100+ component
- **عدد API Routes:** 80+ endpoint
- **عدد النماذج (Models):** 30+ model
- **عدد الصلاحيات:** 30+ permission
- **عدد السطور:** 50,000+ سطر

---

## 🔧 المتطلبات التقنية

### الحد الأدنى
- **Node.js:** 20.0.0+
- **npm:** 10.0.0+
- **RAM:** 4GB
- **مساحة القرص:** 500MB

### الموصى به
- **Node.js:** 20.0.0+
- **npm:** 10.0.0+
- **RAM:** 8GB
- **مساحة القرص:** 2GB
- **المعالج:** 4 Cores

---

## 📁 قواعد البيانات

### SQLite (الحالي)
- **مزايا:**
  - ✅ بدون إعداد
  - ✅ سرعة عالية
  - ✅ ملف واحد محمول
- **عيوب:**
  - ❌ لا يدعم Concurrent Writes
  - ❌ محدود لقاعدة بيانات واحدة

### PostgreSQL (مُقترح للمستقبل)
- **مزايا:**
  - ✅ دعم Concurrent Writes
  - ✅ أداء أفضل للبيانات الكبيرة
  - ✅ Multi-branch support
- **عيوب:**
  - ❌ يحتاج إعداد Server

---

## 🔐 الأمان (Security)

### المصادقة
- **JWT** - توكن آمن
- **bcryptjs** - تشفير كلمات المرور
- **HttpOnly Cookies** - حماية من XSS

### الصلاحيات
- **Role-based Access Control (RBAC)**
- **Permission-based Checks**
- **Audit Log** لجميع العمليات الحساسة

### حماية البيانات
- **Prisma ORM** - حماية من SQL Injection
- **Input Validation** - على جميع API Routes
- **CORS** - محدد للمصادر الموثوقة

---

## 📞 الدعم الفني

### الموارد
- **Documentation:** هذا الملف + FUTURE_IMPROVEMENTS.md
- **GitHub:** https://github.com/AmrAnter44/sys-Xgym

### Contact
- **المطور:** Amr Anter
- **Email:** (أضف البريد الإلكتروني)

---

## 📄 الترخيص

**FitBoost Gym Management System** هو نظام مملوك بالكامل.
جميع الحقوق محفوظة © 2024-2026

---

تم إنشاء هذا الملف في: 2026-03-15
آخر تحديث: 2026-03-15
