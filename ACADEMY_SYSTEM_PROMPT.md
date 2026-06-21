# 🎓 برومت بناء سيستم إدارة أكاديمية حلاقة (Barber Academy)

> سيستم إدارة متكامل لأكاديمية حلاقة، مبني بـ **Next.js (App Router) + Supabase** بدون أي ORM (Prisma).
> كل التعامل مع الداتا عن طريق **Supabase JS Client** مباشرة على جداول Postgres مع **RLS**.

---

## 1) القرارات النهائية (ملخص المتطلبات)

| البند | القرار |
|------|--------|
| النشاط | أكاديمية حلاقة / باربر (طلاب + كباتن + كورسات) |
| الفروع | **3 أماكن** — سيستم واحد مشترك + **فلترة بالمكان** (كل حاجة موسومة بفرعها) |
| مكان الطالب | **مكان تسجيل أساسي** (`location_id`) + ممكن يحضر حصص في فروع تانية |
| حساب الرسبشن | **مرتبط بفرعه** — لو فتح طالب مسجّل في فرع تاني **يبان له تنبيه** إن مكانه مختلف |
| جدول الأماكن | **مزيج**: بعض المجموعات ثابتة في فرع، وبعضها موزّعة — **كل يوم له مكان بترتيب** |
| الطالب والمجموعة | الطالب في **مجموعة/كورس واحد** في المرة |
| الكورسات | **مرنة حسب المجموعة** — كل مجموعة تحدد سعرها وعدد حصصها بنفسها |
| الحضور | كل حضور = **حصة واحدة** تتخصم من رصيد الطالب |
| نفاد الحصص | **يمنع الحضور + تنبيه تجديد** لما الرصيد يخلص |
| الدفع | **سعر كورس ثابت بالتقسيط** → الباقي = "بواقي على الطالب" |
| الإيصالات | **مرقّمة + قابلة للطباعة + إرسال واتساب** |
| المالية | **مصروفات + إقفال يومي** للخزنة |
| الكباتن | **موظفين** ليهم حضور/انصراف + خصومات + راتب **ثابت أو نسبة/عمولة** (مرن) |
| التقييم — الطلاب | درجات رقمية (عملي /100 + نظري /100) — يدخلها **الكابتن أو الأدمن** |
| التقييم — الكباتن | **يدوي من الأدمن + مؤشر محسوب آلي** من متوسط درجات وحضور طلابه |
| النجاح | **مفيش حد أدنى آلي** — الأدمن يقرر النجاح والشهادة |
| الشهادة | **يصدرها الأدمن يدوي** كـ PDF متكوّد + QR |
| كود الشهادة | **كود عشوائي مشفّر** (مثل `A7K9-2F4Q`) صعب التخمين/التزوير |
| التحقق | **صفحة تحقق عامة** بالكود/QR لإثبات صحة الشهادة |
| المتابعات | **مهتمين + Pipeline مراحل + واتساب** + **تحويل المهتم لطالب بضغطة** (نقل بياناته) |
| الواتساب | **رابط `wa.me`** (بسيط، بدون server) — قابل للترقية لإرسال آلي لاحقاً |
| اللغة | **عربي RTL فقط** |
| الدخول | **Supabase Auth** + أدوار + RLS |
| النشر | **Vercel** (ويب أونلاين) + **Dark Mode** + **PWA** + **داشبورد إحصائيات** |
| الباركود | كل طالب له **باركود/QR** + زر **إرسال واتساب** بسهولة |
| التقارير/Excel | مؤجّلة (مش أولوية في النسخة الأولى) |
| الهوية البصرية | **عند العميل لوجو وألوان** — نبني عليها (theme قابل للتخصيص) |
| حقول الطالب الإضافية | **تاريخ الميلاد + الرقم القومي + المؤهل الدراسي** |
| الدفع وقت التسجيل | **مقدّم جزئي + بواقي** (بدون حد أدنى) |
| الخصومات | **خصم وقت التسجيل** (مبلغ/نسبة) على سعر الكورس |
| التجديد | **حسب اختيار الموظف**: يضيف على الرصيد أو يبدأ كورس جديد |
| حساب الكابتن | **آه** — لوجين خاص، يشوف **مجموعاته وطلابه بس** + يدخل تقييماتهم/حضورهم |
| التنبيهات | **بواقي مستحقة + كورس قارب يخلص + متابعات اليوم** (داخل السيستم) |
| حالة "خلّص" | **يدوي** بعد ما الأدمن يخلص التقييم/الشهادة |
| جدول المجموعة | **أيام وساعات ثابتة** + عرض جدول أسبوعي |
| التجميد (Freeze) | **مش مطلوب** |
| إرسال الإيصال | **رسالة نص** على wa.me (تفاصيل الدفعة + البواقي) |
| ترحيل البيانات | **عند العميل بيانات قديمة (Excel/سيستم قديم)** → محتاجين **استيراد** |
| الأدوار | **أونر** (فوق الكل) + أدمن + رسبشن + كابتن |
| الإلغاء/الحذف | الرسبشن يقدر **يلغي إيصال بكتابة سبب** + يتسجّل في **Audit Log** |
| بيانات الإيصال | لوجو + اسم الفرع + اسم الموظف + التاريخ/الوقت + اسم الكورس/المجموعة + QR/رقم تواصل |
| تصميم الشهادة | **أصمّم قالب احترافي** (اسم الطالب، الكورس، الدرجات، الكود، QR) |
| الداشبورد | أرقام اليوم + رسوم شهرية + مقارنة فروع + أقرب متابعات/تنبيهات |
| جهاز الحضور | **سكانر USB + كاميرا + بحث يدوي** بالاسم/الرقم |
| مصادر المهتمين | سوشيال + ترشيح طالب + زيارة/إعلان (قابلة للتعديل) |
| الترشيحات | **تتبع مين رشّح ومين اترشّح** (referral) |

---

## 2) الـ Tech Stack

- **Frontend/Backend:** Next.js 15 (App Router, Server Components + Route Handlers)
- **DB/Auth/Storage:** Supabase (Postgres + Auth + Storage + RLS)
- **Data access:** `@supabase/supabase-js` (browser client) + `@supabase/ssr` (server) — **بدون Prisma**
- **Styling:** Tailwind CSS + Dark Mode (class strategy)
- **State/Data:** TanStack Query (React Query) للـ caching
- **Barcode/QR:** `bwip-js` لتوليد الباركود، `qrcode` للـ QR
- **PDF:** الشهادات والإيصالات بـ `@react-pdf/renderer` أو `jspdf`
- **WhatsApp:** زر يفتح `https://wa.me/<phone>?text=...` + إرفاق صورة الباركود (للنسخة البسيطة)، مع إمكانية ربط Baileys لاحقاً لإرسال آلي
- **i18n:** عربي (افتراضي RTL) — جاهز للإنجليزي لاحقاً
- **PWA:** manifest + service worker (قابل للتثبيت)
- **Deploy:** Vercel + متغيرات بيئة Supabase

---

## 3) مخطط قاعدة البيانات (Supabase / Postgres SQL)

> شغّل الـ SQL ده في Supabase SQL Editor. كل الجداول فيها `created_at` و RLS مفعّل.

```sql
-- ========== EXTENSIONS ==========
create extension if not exists "pgcrypto";

-- ========== ENUMS ==========
create type user_role        as enum ('owner','admin','receptionist','captain');
create type student_status    as enum ('active','finished','frozen','dropped');
create type payment_method    as enum ('cash','visa','transfer','instapay','wallet');
create type eval_target       as enum ('student','captain');
create type lead_status       as enum ('interested','contacted','subscribed','rejected','finished_followup');

-- ========== LOCATIONS (الفروع / الأماكن — 3) ==========
create table locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,        -- اسم الفرع
  address     text,
  phone       text,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

-- ========== APP USERS (linked to auth.users) ==========
create table app_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text,
  role        user_role not null default 'receptionist',
  location_id uuid references locations(id) on delete set null, -- فرع الرسبشن (null = كل الفروع للأدمن)
  staff_id    uuid,                 -- لو المستخدم كابتن/موظف مربوط بسجل staff
  is_active   boolean default true,
  created_at  timestamptz default now()
);

-- ========== STAFF (موظفين + كباتن) ==========
create table staff (
  id            uuid primary key default gen_random_uuid(),
  code          text unique,
  name          text not null,
  phone         text,
  job_title     text,                -- المسمى الوظيفي
  location_id   uuid references locations(id) on delete set null, -- فرع الموظف الأساسي
  is_captain    boolean default false,
  salary_type   text default 'fixed',  -- 'fixed' | 'commission' | 'fixed_plus_commission'
  salary        numeric default 0,     -- الراتب الثابت
  commission_per_student numeric default 0,  -- مبلغ/نسبة عن كل طالب في مجموعاته
  commission_is_percent  boolean default false, -- true=نسبة من اشتراك الطالب
  hire_date     date,
  photo_url     text,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

-- ========== GROUPS (المجموعات / الكورسات) ==========
create table groups (
  id            uuid primary key default gen_random_uuid(),
  code          text unique,
  name          text not null,
  captain_id    uuid references staff(id) on delete set null,
  location_id   uuid references locations(id) on delete set null, -- الفرع الثابت للمجموعة (null = موزّعة حسب الجدول)
  is_distributed boolean default false, -- true = مواعيدها موزّعة على أماكن مختلفة حسب اليوم
  start_date    date,
  end_date      date,
  max_students  int,
  -- جدول مرتّب: order للترتيب + اليوم + الساعة + المكان لكل يوم
  schedule      jsonb,               -- [{order:1, day:'sat', from:'16:00', to:'18:00', location_id:'...'}, ...]
  default_sessions int default 0,    -- عدد حصص الكورس الافتراضي
  course_price  numeric default 0,   -- سعر الكورس الافتراضي
  notes         text,
  created_at    timestamptz default now()
);

-- ========== STUDENTS (الطلاب / الأعضاء) ==========
create table students (
  id              uuid primary key default gen_random_uuid(),
  student_number  text unique,         -- كود تلقائي (انظر sequence تحت)
  name            text not null,
  phone           text not null,
  father_phone    text,
  mother_phone    text,
  birth_date      date,                -- تاريخ الميلاد
  national_id     text,                -- الرقم القومي
  education       text,                -- المؤهل الدراسي
  location_id     uuid references locations(id) on delete set null, -- مكان التسجيل الأساسي
  job             text,
  address         text,
  photo_url       text,
  id_card_front   text,                -- صورة البطاقة (وش)
  id_card_back    text,                -- صورة البطاقة (ضهر)
  group_id        uuid references groups(id) on delete set null,
  start_date      date,
  end_date        date,
  total_sessions     int default 0,    -- إجمالي حصص الكورس
  remaining_sessions int default 0,    -- المتبقي (يتخصم بالحضور)
  course_price    numeric default 0,   -- سعر الكورس قبل الخصم
  discount        numeric default 0,   -- الخصم وقت التسجيل (مبلغ)
  net_price       numeric default 0,   -- الصافي = course_price - discount
  paid_amount     numeric default 0,   -- المدفوع (مقدّم + دفعات)
  remaining_amount numeric default 0,  -- البواقي = net_price - paid_amount
  barcode         text unique,         -- قيمة الباركود/QR
  status          student_status default 'active',
  source          text,                -- مصدر الطالب: social | referral | walk-in | ad
  referred_by_student uuid references students(id) on delete set null, -- الطالب اللي رشّحه
  notes           text,
  created_at      timestamptz default now()
);
create index on students (group_id);
create index on students (phone);
create index on students (status);

-- ========== STUDENT CHECK-INS (الحضور) ==========
create table student_checkins (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid references students(id) on delete cascade,
  location_id   uuid references locations(id) on delete set null, -- الفرع اللي حضر فيه فعلاً (ممكن غير فرع تسجيله)
  check_in_time timestamptz default now(),
  sessions_deducted int default 1,     -- كل حضور = 1
  recorded_by   uuid references app_users(id) on delete set null,
  created_at    timestamptz default now()
);
create index on student_checkins (student_id);
create index on student_checkins (check_in_time);

-- ========== RECEIPTS (الإيصالات / الدفعات) ==========
create sequence if not exists receipt_seq start 1;
create table receipts (
  id             uuid primary key default gen_random_uuid(),
  receipt_number int not null default nextval('receipt_seq') unique,
  student_id     uuid references students(id) on delete set null,
  location_id    uuid references locations(id) on delete set null, -- الفرع اللي اتعمل فيه الإيصال
  amount         numeric not null,
  payment_method payment_method default 'cash',
  item_details   text,                 -- وصف الدفعة (قسط/تجديد...)
  staff_name     text,
  is_cancelled   boolean default false,
  cancelled_at   timestamptz,
  cancel_reason  text,
  created_at     timestamptz default now()
);
create index on receipts (created_at);
create index on receipts (student_id);

-- ========== EXPENSES (المصروفات) ==========
create table expenses (
  id            uuid primary key default gen_random_uuid(),
  category      text not null,         -- رواتب/إيجار/أدوات/صيانة...
  location_id   uuid references locations(id) on delete set null, -- فرع المصروف
  amount        numeric not null,
  description   text,
  payment_method payment_method default 'cash',
  expense_date  date default now(),
  created_by    uuid references app_users(id) on delete set null,
  created_at    timestamptz default now()
);

-- ========== DAILY CLOSING (الإقفال اليومي) ==========
create table daily_closings (
  id             uuid primary key default gen_random_uuid(),
  location_id    uuid references locations(id) on delete set null, -- إقفال لكل فرع
  closing_date   date not null,
  total_income   numeric default 0,
  total_expenses numeric default 0,
  cash_expected  numeric default 0,
  cash_counted   numeric default 0,
  difference     numeric default 0,
  notes          text,
  closed_by      uuid references app_users(id) on delete set null,
  created_at     timestamptz default now()
);

-- ========== STAFF ATTENDANCE (حضور الموظفين) ==========
create table staff_attendance (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid references staff(id) on delete cascade,
  check_in    timestamptz,
  check_out   timestamptz,
  work_date   date default now(),
  duration_minutes int,
  created_at  timestamptz default now()
);
create index on staff_attendance (staff_id, work_date);

-- ========== STAFF DEDUCTIONS (خصومات الموظفين) ==========
create table staff_deductions (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid references staff(id) on delete cascade,
  amount      numeric not null,
  reason      text,
  deduct_date date default now(),
  created_by  uuid references app_users(id) on delete set null,
  created_at  timestamptz default now()
);

-- ========== EVALUATIONS (التقييمات: طلاب + كباتن) ==========
create table evaluations (
  id            uuid primary key default gen_random_uuid(),
  target_type   eval_target not null,        -- student | captain
  student_id    uuid references students(id) on delete cascade,
  staff_id      uuid references staff(id) on delete cascade,
  practical_score numeric,                   -- /100
  theoretical_score numeric,                 -- /100
  total_score   numeric,                     -- عملي + نظري (أو متوسط)
  evaluator_id  uuid references app_users(id) on delete set null,
  eval_date     date default now(),
  notes         text,
  created_at    timestamptz default now()
);
create index on evaluations (student_id);
create index on evaluations (staff_id);

-- ========== CERTIFICATES (الشهادات) ==========
create table certificates (
  id              uuid primary key default gen_random_uuid(),
  cert_code       text unique not null,       -- كود عشوائي مشفّر مثل A7K9-2F4Q (يتولّد في الكود، صعب التخمين)
  student_id      uuid references students(id) on delete set null,
  group_id        uuid references groups(id) on delete set null,
  student_name    text not null,              -- snapshot للاسم وقت الإصدار
  course_name     text,
  practical_score numeric,
  theoretical_score numeric,
  issue_date      date default now(),
  qr_url          text,                       -- رابط صفحة التحقق
  pdf_url         text,                       -- ملف الشهادة في Storage
  issued_by       uuid references app_users(id) on delete set null,
  is_valid        boolean default true,       -- يمكن إبطالها
  created_at      timestamptz default now()
);
create index on certificates (cert_code);

-- ========== VISITORS / LEADS (المهتمين) ==========
create table leads (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text not null,
  source        text default 'walk-in',        -- social | referral | walk-in | ad
  referred_by_student uuid references students(id) on delete set null, -- لو ترشيح من طالب
  location_id   uuid references locations(id) on delete set null, -- الفرع المهتم بيه
  interested_in text,                          -- الكورس المهتم بيه
  status        lead_status default 'interested',
  notes         text,
  assigned_to   uuid references app_users(id) on delete set null,
  next_followup date,
  contact_count int default 0,
  is_archived   boolean default false,
  created_at    timestamptz default now()
);
create index on leads (status);
create index on leads (phone);

-- ========== FOLLOW-UP ACTIVITIES (سجل المتابعات) ==========
create table followups (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references leads(id) on delete cascade,
  activity    text not null,                   -- call | whatsapp | visit | note
  result      text,                            -- no-answer | interested | agreed | rejected
  notes       text,
  next_date   date,
  created_by  uuid references app_users(id) on delete set null,
  created_at  timestamptz default now()
);
create index on followups (lead_id);

-- ========== WHATSAPP TEMPLATES ==========
create table whatsapp_templates (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  message    text not null,                    -- يدعم {name}, {amount}, {code}...
  is_default boolean default false,
  created_at timestamptz default now()
);

-- ========== AUDIT LOG (سجل العمليات الحسّاسة) ==========
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references app_users(id) on delete set null,
  action      text not null,                   -- cancel_receipt | delete_student | edit_price ...
  entity      text,                            -- receipt | student ...
  entity_id   text,
  reason      text,                            -- السبب المكتوب (إلزامي للإلغاء/الحذف)
  meta        jsonb,                           -- snapshot قبل التغيير
  location_id uuid references locations(id) on delete set null,
  created_at  timestamptz default now()
);
create index on audit_log (created_at);
create index on audit_log (action);

-- ========== SETTINGS (إعدادات عامة) ==========
-- يشمل: لوجو الأكاديمية، الألوان، أرقام التواصل/السوشيال، إعدادات الإيصال والشهادة
create table settings (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz default now()
);

-- ========== STUDENT NUMBER SEQUENCE ==========
create sequence if not exists student_seq start 1;
-- يُولّد في الكود: 'STD-' || lpad(nextval, 5, '0')
```

### ملاحظات على الحساب الآلي (في الكود أو عبر triggers/RPC):
- `net_price = course_price - discount` و `remaining_amount = net_price - paid_amount` (يتحدّث مع كل إيصال).
- **التجديد:** الموظف يختار يضيف الحصص الجديدة على `remaining_sessions` أو يصفّرها ويبدأ عدد + تواريخ جديدة (UI خيار وقت التجديد).
- **التنبيهات (داخل السيستم):** view/query يجمع: طلاب عليهم `remaining_amount > 0` + طلاب `remaining_sessions` قريب من الصفر (≤ حد قابل للضبط) + متابعات `leads.next_followup = today`. تتعرض في جرس إشعارات + كروت في الداشبورد.
- **ترحيل البيانات:** سكربت استيراد (CSV/Excel → Supabase) للطلاب والبواقي الموجودين قبل الإطلاق.
- عند الحضور (`student_checkins`): `remaining_sessions = remaining_sessions - sessions_deducted` (RPC ذرّي لتجنب race).
- عند وصول `remaining_sessions = 0` → الطالب يدخل قائمة "خلصوا" للمتابعة.
- "المجموعة مدخلة كام" = `SUM(receipts.amount WHERE student.group_id = group AND NOT cancelled)` (view أو RPC).
- عدد طلاب المجموعة = `COUNT(students WHERE group_id = group)`.
- **منع الحضور عند نفاد الحصص:** الـ RPC بتاع الحضور يرفض الخصم لو `remaining_sessions <= 0` ويرجّع رسالة "محتاج تجديد".
- **المؤشر المحسوب لتقييم الكابتن:** view/RPC يحسب متوسط `total_score` + نسبة حضور طلاب مجموعاته — يُعرض جنب الدرجة اليدوية في صفحة تقييم الكباتن.
- **كود الشهادة المشفّر:** يتولّد في الكود (مثلاً 8 خانات base32 عشوائية بصيغة `XXXX-XXXX`) ويتأكّد إنه `unique`.
- **تحويل المهتم لطالب:** زر في صفحة المهتم ينقل `name/phone` لفورم `/students/new` ويحدّث `lead.status='subscribed'` ويأرشفه.

### ملاحظات المالتي-برانش (3 أماكن):
- كل الجداول الأساسية فيها `location_id` (طلاب/إيصالات/مصروفات/حضور/موظفين/مجموعات/إقفال).
- **الرسبشن مربوط بفرعه** (`app_users.location_id`): الافتراضي إنه يشوف/يضيف في فرعه، والإيصال والحضور يتختموا بفرعه تلقائياً.
- **تنبيه الفرع المختلف:** لما الرسبشن يفتح ملف طالب `student.location_id != app_users.location_id` يظهر **بانر تنبيه**: "هذا الطالب مسجّل في فرع: [اسم الفرع]". (الرسبشن يقدر يخدمه عادي لكن يبقى واخد باله).
- **الحضور عابر الفروع:** الطالب يقدر يحضر في أي فرع — `student_checkins.location_id` يسجّل الفرع الفعلي للحضور (ممكن يختلف عن فرع تسجيله).
- **جدول المجموعة المرتّب:** `groups.schedule` array مرتّب بـ `order`، كل عنصر فيه `day/from/to/location_id`؛ لو `is_distributed=false` كل الأيام في `groups.location_id`.
- **الإقفال اليومي per-location:** `daily_closings` مفتاحه (`location_id` + `closing_date`)، وكل فرع له إقفاله؛ الأدمن يشوف إجمالي مجمّع.
- **الداشبورد:** فلتر بالفرع (الأدمن يشوف الكل أو فرع محدد، الرسبشن فرعه فقط).
- **RLS:** الأدمن/الأونر = كل الفروع. الرسبشن = صفّه افتراضي على `location_id` بتاعه (قراءة الكل مسموح للتنبيه، الكتابة الأساسية في فرعه). الكابتن = مجموعاته فقط.

---

## 4) سياسات RLS (مبدئية)

- المستخدم لازم يكون مسجّل دخول (authenticated) لأي قراءة/كتابة.
- **owner:** كل شيء + كل الفروع + التقارير المالية الشاملة (أعلى صلاحية).
- **admin:** كل شيء تقريباً (إدارة المستخدمين/الإعدادات حسب ما يحدد الأونر).
- **receptionist:** قراءة/إضافة طلاب، إيصالات، حضور، مهتمين/متابعات — **افتراضي على فرعه** (`location_id`)، يقدر **يلغي إيصال بسبب إلزامي** (يتسجّل في `audit_log`)، بدون إعدادات أو حذف نهائي. يقدر يقرأ طلاب الفروع التانية (لإظهار تنبيه الفرع المختلف).
- **captain:** يقرأ **مجموعاته وطلابه فقط** + يدخل تقييمات طلابه + يشوف حضوره. (لوجين خاص).
- صفحة **التحقق من الشهادة عامة** (anon) — قراءة فقط لجدول `certificates` بالـ `cert_code` (عبر RPC آمن يرجّع بيانات محدودة).

---

## 5) الصفحات والمميزات (App Router)

```
/login                      تسجيل دخول (Supabase Auth)
/                           داشبورد: طلاب نشطين، إيرادات اليوم/الشهر، بواقي، نسب نجاح، أقرب متابعات
/students                   قائمة الطلاب + بحث + فلترة بالمجموعة/الحالة
/students/new               إضافة طالب (كل الحقول + رفع صورة + صورتي بطاقة)
/students/[id]              ملف الطالب: بيانات، باركود + زر واتساب، حضوره، دفعاته، بواقيه، تقييمه، شهادته
/groups                     المجموعات: عدد الطلاب + إجمالي المُحصّل + المتبقي + الفرع
/groups/new                 إنشاء مجموعة (كابتن، جدول مرتّب بأيام/ساعات/مكان لكل يوم، سعر، عدد حصص، حد أقصى)
/groups/[id]               تفاصيل المجموعة + جدولها المرتّب بالأماكن + طلابها وحالة كل واحد
/locations                  الفروع (3 أماكن): إضافة/تعديل + إحصائيات كل فرع
/schedule                   عرض جدول أسبوعي بكل المجموعات والأماكن (مرتّب)
/checkin                    شاشة حضور: مسح باركود الطالب → خصم حصة + تأكيد
/receipts                   الإيصالات + طباعة + إرسال واتساب + إلغاء
/expenses                   المصروفات
/closing                    الإقفال اليومي (إيرادات vs مصروفات vs الكاش الفعلي)
/staff                      الموظفين/الكباتن
/staff/attendance           حضور/انصراف الموظفين
/staff/deductions           الخصومات
/evaluations                التقييمات (طلاب + كباتن) — عملي/نظري من 100
/certificates               إصدار شهادة (يدوي) + قائمة الشهادات + توليد PDF/QR
/verify/[code]              صفحة عامة للتحقق من صحة الشهادة (anon)
/leads                      المهتمين + Pipeline مراحل + جدولة متابعة + واتساب
/followups                  سجل المتابعات والأنشطة
/settings                   الإعدادات، قوالب واتساب، الأدوار، إعدادات الأكاديمية
```

### تفاصيل مهمة لكل وحدة:
- **الطالب:** كود تلقائي `STD-00001`، باركود فريد يتولّد عند الإنشاء، زر **"إرسال الباركود واتساب"** يبعت صورة الباركود + رسالة من قالب (`{name}`). يتختم بـ `location_id` بتاع الرسبشن، و**بانر تنبيه** لو الرسبشن من فرع مختلف عن فرع تسجيل الطالب.
- **الحضور:** يدعم **سكانر USB (زي كيبورد) + كاميرا QR + بحث يدوي بالاسم/الرقم** → RPC يخصم حصة + يسجّل `check_in` بفرع الجهاز/الرسبشن + يمنع الخصم لو `remaining_sessions = 0` (تنبيه للتجديد). الطالب يقدر يحضر في أي فرع.
- **الإيصال:** رقم تسلسلي، يتختم بفرعه، طباعة A5، عليه **لوجو + اسم الفرع + اسم الموظف + التاريخ/الوقت + اسم الكورس/المجموعة + المبلغ والبواقي + QR/رقم تواصل** (من `settings`)، وزر واتساب (رسالة نص). الإلغاء بسبب إلزامي + يتسجّل في `audit_log`.
- **التقييم:** فورم عملي/نظري لكل طالب أو كابتن، يحسب `total_score` ويعرض ترتيب/متوسط.
- **الشهادة:** الأدمن يختار طالب ناجح → يدخل الدرجات → يتولّد `cert_code` مشفّر + QR يفتح `/verify/[code]` + PDF بـ **قالب احترافي** (اسم الطالب، الكورس، الدرجات، الكود، QR، لوجو الأكاديمية) يترفع على Storage.
- **المهتمين:** مصدر (سوشيال/ترشيح/زيارة/إعلان) + لو ترشيح يتسجّل الطالب اللي رشّح، مراحل (مهتم → اتصل → اشترك/رفض)، تحويل المهتم لطالب بضغطة، إرسال واتساب جماعي/فردي.
- **الداشبورد:** أرقام اليوم (إيراد/حضور/تسجيل) + بواقي مستحقة + رسوم شهرية + مقارنة بين الفروع + أقرب متابعات وتنبيهات. فلتر بالفرع.
- **اللي خلصوا:** الطلاب اللي `remaining_sessions=0` أو `status=finished` يظهروا في قائمة متابعة للتجديد/تقييم ما بعد التخرج.

---

## 6) Storage (Supabase Buckets)

- `student-photos` (صور الطلاب)
- `id-cards` (صور البطاقات — private/RLS)
- `certificates` (ملفات PDF للشهادات)
- `barcodes` (صور الباركود المولّدة)

---

## 7) متغيرات البيئة (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # للعمليات الإدارية في route handlers فقط
```

---

## 8) خطة التنفيذ المقترحة (مراحل)

1. **Setup:** Next.js + Tailwind + Supabase clients (browser/server) + Auth + Layout عربي RTL + Dark Mode.
2. **DB:** تشغيل الـ SQL + RLS + Buckets + seed لمستخدم admin.
3. **الطلاب + المجموعات + الباركود + إرسال واتساب.**
4. **الحضور (سكان + خصم حصة).**
5. **الإيصالات + البواقي + الطباعة + واتساب.**
6. **الموظفين/الكباتن + حضورهم + خصوماتهم.**
7. **المصروفات + الإقفال اليومي.**
8. **التقييمات (طلاب + كباتن).**
9. **الشهادات + PDF + QR + صفحة التحقق العامة.**
10. **المهتمين + المتابعات + واتساب.**
11. **الداشبورد + الإحصائيات.**
12. **PWA + النشر على Vercel.**
```
```
