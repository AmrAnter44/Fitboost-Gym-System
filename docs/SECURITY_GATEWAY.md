# ربط الأجهزة بـ Control (Gym Gateway) — من 6.12.0

## ليه
قبل 6.12.0 كان `.env` بيتشحن جوه النسخة (`.next/standalone/.env`) لكل الجيمات، وفيه
`SUPABASE_SERVICE_ROLE_KEY` (صلاحية كاملة على مشروع Fitboost) و `GH_TOKEN` و مفاتيح B2،
ومفاتيح B2 كمان كانت بتتحفر جوه الكود من `next.config.js`.

## دلوقتي
- مفيش أي مفتاح Supabase ولا B2 على الجهاز. `lib/supabase.ts` اتشال.
- كل التواصل مع السحابة من `lib/gateway.ts` → Control (`FITBOOST_GATEWAY_URL`) بتوكن خاص بالفرع
  (`SupabaseLicense.gatewayToken`).
- `scripts/sanitize-standalone-env.js` (من `postbuild.js`): بيسيب في `.next/standalone/.env`
  الإعدادات العامة بس، وبيوقف الـ build لو لقى أي سر من `.env` جوه ملفات النسخة.
- `app/api/license/test|gyms|branches|select` اتشالوا. التفعيل بقى بكود: `POST /api/license/activate`.

## الربط
- **أي جهاز عليه 6.12.0+** بيعرّف نفسه لـ Control أول ما يفتح (`lib/gateway.ts → ensureLinked`)
  ويظهر في Control ← أجهزة الجيمات ← "أجهزة مستنية ربط" باسم الجهاز والـ IP والنسخة ورقمه
  (نفس الرقم اللي ظاهر في الإعدادات ← الترخيص). الأجهزة القديمة بتبعت الجيم/الفرع اللي فاكرينه.
- **تربطه من Control** (تختار الجيم والفرع) → الجهاز بياخد التوكن لوحده خلال دقيقتين.
- **أو بكود تفعيل** من Control يتكتب في الإعدادات ← الترخيص.
- هوية التسطيب: ملف `.gateway-install` (رقم + سر) في مجلد الأسرار — مش في الداتابيز.
- **إلغاء جهاز** من Control: الجهاز بيمسح التوكن ويرجع يظهر "مستني".
- لحد ما يتربط بيشتغل بالرخصة المحفوظة (سماح ١٤ يوم من آخر تحقق ناجح).

## الـ build
`.env` على جهاز الـ build محتاج `FITBOOST_GATEWAY_URL` (بيتحفر جوه النسخة — مش سر).
مفاتيح Supabase / B2 مش مطلوبة للسيستم خالص. `GH_TOKEN` للنشر بس (مش بيتشحن).

## التحديثات (من 6.12.0)
- الكود في `Fitboost-Gym-System` (هيبقى **Private**). ملفات الإصدارات في `fitboost-releases` (**Public**).
- الأجهزة بتتحدّث من `fitboost-releases` من غير توكن (أول publisher في `package.json` + `electron/main.js`).
- **6.12.0 بس** بتترفع على الاتنين (عشان الأجهزة القديمة اللي بتدوّر في `Fitboost-Gym-System` تلاقيها).
  بعد ما كل الأجهزة تبقى 6.12.0+: شيل الـ publisher التاني من `package.json` وخلّي `Fitboost-Gym-System` Private.
- النشر: `read -s GH_TOKEN && export GH_TOKEN && npm run publish:electron:win` (التوكن مش في أي ملف).

## حساب FitBoost Admin (من 6.12.0)
- مفيش باسورد ولا هاش على أجهزة الجيمات. `OWNER_*` مبقتش بتتشحن (والـ build بيقف لو اتسرّبت).
- الدخول: إيميل + باسورد حساب **Control** (super admin) → السيستم يسأل Control (`/api/gym/v1/admin-login`)
  → لو صح يطلب **كود التحقق بخطوتين** (نفس الكود بتاع Control في Ente Auth) → جلسة ١٢ ساعة.
- محتاج نت + الجهاز يكون مربوط. من غير نت: الأونر بتاع الجيم يدخل بحسابه العادي.
- تأكيد الباسورد للعمليات الحساسة بيتحقق منه Control برضه.
- كل محاولة (ناجحة أو فاشلة) بتتسجل في Control ← أجهزة الجيمات. ٨ محاولات غلط في ربع ساعة → قفل مؤقت.
- تغيير الباسورد: من Control/Supabase — مش محتاج تحديث للجيمات.
- الحساب الاحتياطي من `.env` (OWNER_EMAIL/OWNER_PASSWORD_HASH_B64) شغال في التطوير على جهازك بس.
