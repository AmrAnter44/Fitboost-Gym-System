---
marp: true
theme: default
paginate: true
backgroundColor: "#0f172a"
color: "#f8fafc"
style: |
  section { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 50px 60px; }
  h1 { color: #ff9915; border-bottom: 3px solid #ff9915; padding-bottom: 10px; }
  h2 { color: #fbbf24; }
  h3 { color: #f97316; }
  strong { color: #fde68a; }
  code { background: #1e293b; color: #fbbf24; padding: 2px 6px; border-radius: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1e293b; color: #ff9915; padding: 8px; }
  td { border: 1px solid #334155; padding: 6px 10px; }
  ul li::marker { color: #ff9915; }
---

# FitBoost
## نظام إدارة الصالات الرياضية المتكامل

**الإصدار:** 6.8.1
**المطوّر:** Amr Anter
**التاريخ:** 2026

---

# نظرة عامة على النظام

**FitBoost** هو نظام إدارة شامل للجيمات يغطّي كل احتياجات إدارة الصالة الرياضية:

- 👥 إدارة الأعضاء والاشتراكات
- 💪 خدمات تدريب متعددة (PT / تغذية / علاج طبيعي / كلاسات / SPA)
- 💰 نظام محاسبي وإيصالات احترافي
- 📊 تقارير وتحليلات مالية وتشغيلية
- 📱 واتساب مدمج Multi-Number
- 🔒 صلاحيات وأمان وتدقيق كامل
- 🌐 شغّال أونلاين وأوفلاين

---

# المعمارية التقنية (Tech Stack)

| الطبقة | التقنية |
|--------|---------|
| **Framework** | Next.js 14 (App Router) |
| **Frontend** | React 18 + TypeScript + Tailwind CSS |
| **Backend** | Next.js API Routes (Node.js) |
| **Database** | SQLite + Prisma ORM |
| **Desktop** | Electron (Windows Installer) |
| **PWA** | next-pwa + Service Workers |
| **State** | React Query (TanStack) |
| **Auth** | JWT + bcryptjs |
| **Cloud Sync** | Supabase |
| **WhatsApp** | Baileys (Multi-Session) |

---

# طريقة التشغيل

النظام يشتغل بـ **3 طرق** مختلفة:

### 1️⃣ Desktop App (Electron)
- تثبيت Setup.exe على ويندوز
- اختصار سطح المكتب وقائمة Start

### 2️⃣ Web Server (Local Network)
- `npm run dev` على البورت 4001
- يفتح من أي جهاز على نفس الشبكة

### 3️⃣ Progressive Web App
- يتثبّت على الموبايل والتابلت
- أيقونات + Splash Screens للـ iOS و Android

---

# هيكل قاعدة البيانات

**أكثر من 40 جدول** منظمة في مجموعات:

- **الأعضاء:** Member, MemberCheckIn, Invitation, FreezeRequest
- **الخدمات:** PT, Nutrition, Physiotherapy, GroupClass, More, SpaBooking
- **الجلسات:** PTSession, NutritionSession, PhysioSession, GroupClassSession
- **المالية:** Receipt, Expense, Commission, ReceiptCounter
- **الموظفين:** Staff, Attendance, Rotation, StaffDeduction
- **العملاء المحتملين:** Visitor, FollowUp, FollowUpActivity
- **الأمان:** User, Permission, ActivityLog, AuditLog, ActiveSession
- **النظام:** SystemSettings, ServicePackage, Offer, BannedMember
- **الواتساب:** WhatsAppSession, Conversation, Message, QueueItem

---

# 👥 الموديول الأول: إدارة الأعضاء

### المميزات
- بيانات شخصية كاملة (صورة + ID Front/Back + رقم وطني)
- رقم عضوية فريد + Barcode/QR Code
- تتبّع تاريخ بداية ونهاية الاشتراك
- **تجميد الاشتراك (Freeze)** بأيام محددة
- **حظر العضو (Ban)** مع سبب
- **حظر بأرقام التليفون والرقم القومي**
- نظام **النقاط (Points)** مع تاريخ كامل
- تقييمات بدنية (Weight, Body Fat, Muscle Mass)
- ساعات دخول مسموح بها لكل عضو
- باقات مجانية: PT, Nutrition, Physio, Group, Pool, Padel, InBody

---

# 💪 الموديول الثاني: PT (التدريب الشخصي)

### النظام يدعم
- إنشاء حزم تدريب بعدد جلسات
- تعيين كوتش لكل عضو/عميل
- **سحب جلسة بـ QR Code** من تطبيق العميل
- توقيع رقمي على الجلسة (Signature Pad)
- **عمولة الكوتش** آلية مع كل جلسة
- جدول كوتشز برسوم متدرّجة (Tiers)
- تجديد الحزمة بفورم مخصص
- تاريخ كامل للجلسات (Attended / Skipped)
- جلسات مجانية مرتبطة بباقات الأعضاء

---

# 🥗 موديولات الخدمات الإضافية

### كل خدمة لها نظام مستقل بنفس البنية:

| الخدمة | الميزة الخاصة |
|--------|---------------|
| **Nutrition** 🥗 | مع نسبة Referral للكوتش |
| **Physiotherapy** 🏥 | جدولة جلسات + معالج مخصص |
| **Group Classes** 🎯 | جدول أسبوعي + حجز + حضور |
| **More** ➕ | باقات مرنة + عمولات |
| **SPA** 💆 | Massage / Sauna / Jacuzzi + Time Slots |
| **Day Use** 📊 | InBody واستخدام ليوم واحد |

كل خدمة فيها: **حزم + سحب جلسات + تجديد + تاريخ + عمولات + إيصالات**

---

# 🚶 موديول الزوار والمتابعات (Sales Pipeline)

### Funnel كامل لإدارة العملاء المحتملين:

- تسجيل زائر مع المصدر (Walk-in / Website / Referral)
- **مراحل Pipeline:** New → Contacted → Negotiation → Closed
- تعيين فولو-أب لموظف سيلز محدد
- مواعيد الاتصال القادمة + تذكيرات
- أولويات (High / Medium / Low)
- نشاطات تفصيلية (Call / WhatsApp / Visit / Note)
- **أرشفة** عند التحويل لعضو
- **استيراد Leads من ويبسايت الجيم** عبر Supabase
- تحليلات Conversion Rate

---

# 💰 الموديول المالي

### إيصالات احترافية
- ترقيم آلي + Counter منفصل
- 7 أنواع إيصالات (Member / PT / Nutrition / Physio / Class / DayUse / More)
- **طرق دفع متعددة** (Cash / Visa / InstaPay / Wallets)
- Multi-Payment Split
- إلغاء الإيصال بسبب + مَن ألغاه
- طباعة + إرسال واتساب فوري

### مصروفات وإغلاق يومي
- تصنيف المصروفات
- ربط بالموظف (مرتبات/عمولات)
- **شاشة الـ Closing** بأرقام اليوم
- متوسط مصروفات تلقائي

---

# 🎁 العروض والباقات (Offers)

### مرونة كاملة في تصميم الباقات

- **مدة الباقة:** بالأيام (مرنة)
- **سعر + حد أدنى للسعر** (Min Price لمنع التخفيض الزائد)
- جلسات مجانية من 8 خدمات مختلفة
- أيام تجميد مدمجة
- **حدود ساعات الدخول** (مثلاً صباحي فقط)
- نقاط Bonus عند الترقية
- أيقونة + مدة الترقية المسموحة

### Service Packages
باقات لكل خدمة منفصلة بأسعار مخصصة

---

# 👷 إدارة الموظفين والـ HR

### ملف موظف شامل
- كود + اسم + تليفون
- **مناصب متعددة** (مدرب / ريسبشن / بار)
- مرتب + ساعات عمل مطلوبة
- مواعيد شيفت (Start / End)
- إجازات شهرية

### النظام يحسب أوتوماتيك:
- **الحضور والانصراف** (Check In/Out)
- مدة الشيفت الفعلية
- خصومات (Deductions)
- **Rotations:** جدول دوريات أسبوعي
- **Commissions:** عمولات بنظام Tiers أو نسبة ثابتة

---

# 💵 نظام العمولات (Commission System)

### عمولات السيلز
- **تارجت شهري** لكل موظف
- 5 شرائح (Tiers) بنسب مختلفة
- نسبة ثابتة أو متدرّجة
- حساب آلي عند تسجيل عضو جديد

### عمولات الكوتشز
- عمولة عند كل جلسة PT
- عمولة عند تسجيل عضو في باقة
- عمولة Referral للتغذية والعلاج الطبيعي
- عمولات Service More قابلة للتخصيص

### Commission Settings قابل للتعديل من الأونر

---

# 🔐 نظام الأمان والصلاحيات

### Authentication
- تسجيل دخول بـ Email + Password (مشفر bcrypt)
- JWT Tokens للجلسات
- **Active Sessions Tracking** (متابعة الجلسات الحية)
- تسجيل خروج تلقائي عند التراخي

### Permissions (60+ صلاحية)
- صلاحيات على مستوى **كل عملية** (View / Create / Edit / Delete)
- لكل موديول (Members / PT / Nutrition / Receipts / إلخ)
- Coach Role منفصل لشاشات محدودة
- Sales Role: يشوف متابعاته فقط

---

# 🛡️ التدقيق والمراقبة (Audit & Monitoring)

### AuditLog
- تسجيل **كل عملية حساسة** (Create / Update / Delete / Login)
- مع: المستخدم + IP + User Agent + Status
- شاشة Admin لمراجعة كل اللوجات

### Error Tracking
- تسجيل أخطاء Frontend / Backend / Database
- تصنيف بـ Severity (Low / Medium / High / Critical)
- مزامنة الأخطاء مع Supabase
- Resolve / Track لكل خطأ

### Activity Logs
- نشاطات كل مستخدم

---

# 📱 الواتساب المدمج (Multi-Number Inbox)

### نظام متقدم لإدارة الواتساب
- **عدة أرقام في نفس الوقت** (Multi-Session)
- Inbox موحّد لكل المحادثات
- **تعيين محادثات لموظفين** محددين
- قوالب رسائل قابلة للتخصيص
- **Warmup mode** للأرقام الجديدة
- حد رسائل يومي لتفادي الحظر
- Queue للرسائل مع أولويات
- إرسال إيصالات وباركودز للأعضاء تلقائياً

### مبني على Baileys
خفيف وما يحتاجش Puppeteer

---

# 📊 التقارير والتحليلات

### Dashboard رئيسي
- إيرادات اليوم/الأسبوع/الشهر
- أعداد الأعضاء النشطين والمنتهية
- زيارات الموقع (Website Visits)
- Charts تفاعلية (Recharts)

### تقارير تفصيلية
- **Sales Dashboard** للمتابعات
- تحليلات حضور الأعضاء
- متوسط المصروفات
- إحصائيات الكوتشز (with-stats)
- Member Analytics
- Capacity الحالي للجيم

---

# 🎁 نظام النقاط (Points System)

### اكتساب النقاط
- نقاط لكل **Check-In** (قابل للتخصيص)
- نقاط على **الدعوات (Invitations)**
- نقاط **Referral** عند تحويل عضو جديد
- نقاط لكل **جنيه يُدفع**
- **نقاط عيد الميلاد** تلقائياً (Cron Job)

### Cron Jobs آلية
- فحص يومي لأعياد الميلاد
- إعادة فتح المتابعات المنتهية
- توزيع المتابعات غير المسندة
- Auto Check-out للأعضاء

---

# 🔄 الوضع الأوفلاين (Offline Mode)

### النظام مصمم ليشتغل بدون إنترنت

- **SQLite Local Database** قاعدة بيانات محلية كاملة
- **Sync Queue** للعمليات المعلّقة
- لما الإنترنت يرجع: يتبعت كل شيء لـ Supabase
- مزامنة الإيصالات والمصروفات
- مزامنة Leads من الموقع
- **Toggle** للتحكم بين Online/Offline mode

### نتيجة:
**انقطاع الإنترنت ما يوقفش العمل في الجيم نهائياً**

---

# 🔑 نظام الترخيص (Licensing)

### Multi-Branch / Multi-Gym Support
- اختيار الجيم + الفرع عند التشغيل
- التحقق من **رخصة شغّالة** عبر Supabase
- **Lock Screen** عند انتهاء الرخصة
- توقيع رقمي للرخص (Signature)
- Validation دوري

### قاعدة Supabase تحتوي:
- gymId / branchId / systemLicense
- Auto-toggle للـ Offline Mode

---

# 🎨 الواجهة (UX/UI)

### تجربة استخدام عالية
- **عربي + إنجليزي** (i18n كامل + RTL)
- **Dark Mode** لكل مستخدم منفصل
- ألوان قابلة للتخصيص (Primary Color)
- لوجو واسم الجيم مخصص
- **Floating Search** (سريع)
- اختصارات لوحة المفاتيح
- Toast Notifications
- Modals متعددة (Confirm / Success / Error)
- Loading Skeletons
- Virtual Lists للقوائم الكبيرة

---

# 🖨️ الإيصالات والطباعة

### إيصال احترافي قابل للتخصيص

- **لوجو الجيم** المرفوع من الأونر
- شروط وأحكام قابلة للتعديل
- رابط الموقع + روابط التطبيق
- **QR Code** للعضو
- Barcode للجلسات
- تصدير **PDF** (jsPDF + autoTable)
- تصدير **Excel** (ExcelJS)
- طباعة مباشرة + إرسال واتساب

---

# 📷 الباركود و QR

### استخدامات
- **بطاقة عضوية** بـ Barcode/QR
- **سحب جلسة** بمسح QR من تطبيق العميل
- **Check-In** سريع للعضو
- **Camera Scanner** مدمج (html5-qrcode + jsqr)
- توليد QR كصورة (bwip-js + qr-image)
- إرسال الباركود واتساب فوراً

---

# 🏗️ معمارية النظام (Architecture)

```
┌─────────────────────────────────────────┐
│  Electron Desktop App / Browser / PWA   │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│   Next.js 14 (App Router + API Routes)  │
│   ┌──────────────┬──────────────────┐   │
│   │  React UI    │  100+ API Routes │   │
│   └──────────────┴──────────────────┘   │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│      Prisma ORM (40+ Models)            │
└────────────┬────────────────────────────┘
             │
        ┌────┴────┐
        ▼         ▼
   ┌────────┐  ┌──────────┐
   │SQLite  │  │Supabase  │
   │(Local) │  │(Cloud)   │
   └────────┘  └──────────┘
```

---

# 🌐 الـ API (100+ Endpoint)

### مجموعات الـ APIs الرئيسية

| المجموعة | عدد Endpoints | الوظيفة |
|----------|----|---------|
| `/api/members/*` | 12+ | إدارة الأعضاء |
| `/api/pt/*` `/nutrition/*` `/physio/*` | 20+ | الخدمات |
| `/api/receipts/*` | 5+ | الإيصالات |
| `/api/followups/*` `/visitors/*` | 8+ | السيلز |
| `/api/admin/*` | 8+ | الإدارة |
| `/api/auth/*` | 3+ | المصادقة |
| `/api/public/*` | 15+ | تطبيق العضو |
| `/api/whatsapp/*` | 10+ | الواتساب |
| `/api/license/*` | 6+ | الترخيص |

---

# 📲 تطبيق العضو (Public APIs)

### Public Endpoints لتطبيق العضو الموبايل

- `GET /public/member/[id]/profile` — بياناته
- `GET /public/member/[id]/checkins` — سجل الدخول
- `GET /public/member/[id]/points` — نقاطه
- `GET /public/member/[id]/receipts` — إيصالاته
- `GET /public/member/[id]/services` — خدماته
- `GET /public/member/[id]/spa` — حجوزاته
- `POST /public/member/[id]/push-token` — Push Notifications
- `GET /public/gym/today-classes` — كلاسات اليوم
- `GET /public/gym/weekly-classes` — جدول الأسبوع
- `GET /public/gym/current-capacity` — السعة الحالية

---

# 🧪 الاختبار والجودة

### Playwright Testing
- `npm run test` — اختبار E2E
- `npm run test:ui` — واجهة تفاعلية
- `npm run test:debug` — وضع التصحيح
- `npm run test:report` — تقرير النتائج

### Database Scripts
- Auto-sync database schema
- Migration system (create/apply)
- Backup قبل أي تحديث
- DB Integrity Check
- Auto Prisma generation

---

# 📦 البناء والتوزيع

### Build Targets
- **Web:** `npm run build` → Next.js standalone
- **Desktop Windows:** `npm run build:electron:win`
- **Auto-Updater:** عبر electron-updater + GitHub Releases

### NSIS Installer
- One-Click Install
- Desktop + Start Menu Shortcuts
- اسم: `Gym-Management-Setup-${version}.exe`
- أيقونة مخصصة

### نشر تلقائي
GitHub Releases (AmrAnter44/Fitboost-Gym-System)

---

# ⚙️ الإعدادات (System Settings)

### كل شيء قابل للتخصيص من الأونر

- 🎨 لوجو الجيم + اسمه + اللون الأساسي
- 🔧 تفعيل/تعطيل أي خدمة (8 خدمات)
- 💰 نظام النقاط (نسب لكل نشاط)
- 🆓 أسعار الجلسات المجانية
- 💼 عمولات (PT / More / Referrals)
- 📜 شروط وأحكام الإيصال
- 🌐 روابط الموقع والتطبيقات
- 📅 نظام بواقي الاشتراك (تقسيط)
- 🎂 نقاط أعياد الميلاد

---

# 🎯 أبرز المميزات التنافسية

✅ **شغّال أوفلاين 100%** — مفيش انقطاع شغل
✅ **عربي + إنجليزي** مع RTL/LTR كامل
✅ **يتعمله Install على ويندوز** كتطبيق ديسكتوب
✅ **يفتح من الموبايل** كـ PWA
✅ **واتساب مدمج** بأكتر من رقم
✅ **+60 صلاحية** مرنة لكل موظف
✅ **+40 جدول** بقواعد بيانات احترافية
✅ **+100 API endpoint**
✅ **Audit Logs** على كل حركة
✅ **Multi-Gym + Multi-Branch** بترخيص ذكي
✅ **عمولات تلقائية** بشرائح متدرّجة

---

# 📈 الأرقام في سطور

| العنصر | القيمة |
|--------|--------|
| 📁 ملفات الكود | 200+ ملف TSX/TS |
| 🗄️ جداول قاعدة البيانات | 40+ جدول |
| 🌐 API Endpoints | 100+ مسار |
| 🔐 الصلاحيات | 60+ صلاحية مستقلة |
| 🎨 UI Components | 70+ مكون |
| 📦 npm Dependencies | 50+ مكتبة |
| 📱 منصات التشغيل | Web / Desktop / PWA |
| 🌍 اللغات المدعومة | عربي + إنجليزي |
| 💼 الخدمات المدعومة | 8 خدمات |

---

# 🚀 خارطة الطريق (Roadmap)

### قيد التطوير / مقترحات
- 🤖 **AI Assistant** للموظفين (HR Assistant موجود)
- 📊 تقارير AI-powered للأونر
- 📱 تطبيق Native Mobile للأعضاء
- 🔗 ربط بأجهزة InBody مباشرة
- 💳 ربط ببوابات دفع إلكترونية
- 📧 نظام إشعارات Email + SMS
- 🎥 بث مباشر للكلاسات
- 🏆 نظام Leaderboards للأعضاء

---

# 🎓 ملخص: ليه FitBoost؟

> **نظام جيم مصري متكامل، مبني بأحدث التقنيات، يشتغل أوفلاين، يدعم العربية بالكامل، وفيه كل اللي تحتاجه إدارة جيم احترافي.**

### حلول لكل دور:
- 👨‍💼 **الأونر:** تقارير وأرباح وتحكم كامل
- 👩‍💼 **الإدارة:** صلاحيات وتدقيق ومراقبة
- 💪 **الكوتش:** جلسات + عمولات + عملاء
- 🏪 **الريسبشن:** Check-in سريع + Sales
- 🧑‍🎓 **العضو:** تطبيق وباركود ونقاط

---

# شكراً 🙏

## أسئلة؟

**FitBoost v6.8.1**
👨‍💻 Developed by Amr Anter
🌐 github.com/AmrAnter44/Fitboost-Gym-System

