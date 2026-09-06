# رفع FitBoost لجيم حقيقي على VPS (مع الواتساب)

دليل تشغيل نسخة جيم حقيقي على سيرفر Linux — سواء سيرفر لوحده أو جنب
الديمو على نفس الجهاز.

الفرق عن [README-BETA.md](README-BETA.md): داتا حقيقية بدل التجريبية،
مفيش تصفير يومي (بدله نسخة احتياطية)، وخدمة الواتساب شغالة.

---

## الشكل العام

كل جيم = **عمليتين PM2** في مجلد لوحده:

| العملية | إيه هي | البورت |
|---|---|---|
| `fitboost-<slug>` | تطبيق Next | `PORT` (افتراضي 4011) |
| `fitboost-<slug>-whatsapp` | خدمة Baileys | `WHATSAPP_PORT` (افتراضي 4012) |

الاتنين سامعين على `127.0.0.1` بس. Caddy هو الوحيد المعرّض للإنترنت
وبيوصّل لبورت التطبيق. **خدمة الواتساب مالهاش أي منفذ من بره** — التطبيق
هو اللي بيكلّمها من جوه السيرفر، وده مقصود: الخدمة نفسها مافيهاش
authentication.

الواتساب هنا شغال بـ **Baileys** (WebSocket) — مش Puppeteer ولا Chromium،
فمش محتاج متصفح ولا رام كتير على السيرفر.

> ⚠️ ملف `WHATSAPP_PRODUCTION_SETUP.md` في جذر المشروع بيتكلم عن
> `whatsapp-web.js` و Puppeteer — ده **قديم ومش بيوصف النظام الحالي**.

---

## البورتات

البورتات كانت مثبّتة في الكود، وبقت بتتقرا من `.env`:

- `lib/servicePorts.ts` — الجانب اللي بيقرا من Next
- `electron/service-ports.js` — الجانب اللي بيقرا من الـ sidecar

الافتراضيات **4001/4002 زي ما كانت بالظبط**، فنسخة الديسكتوب في الجيمات
شغالة زي ما هي من غير أي متغير بيئة.

على سيرفر فيه أكتر من نسخة، لازم كل نسخة تاخد:

```
APP_NAME=fitboost-helmyapoint
PORT=4011
WHATSAPP_PORT=4012
WHATSAPP_AUTH_DIR=/opt/fitboost-helmyapoint/.whatsapp-auth
DATABASE_URL="file:/opt/fitboost-helmyapoint/prisma/helmyapoint.db?..."
```

### اسم ملف الداتابيز

الاسم بقى حر — سمّي ملف كل جيم باسمه (`helmyapoint.db`) عشان ماتلخبطش
بين داتابيزات جيمات مختلفة. `setup-gym.sh` بياخده من `DB_FILE`
(الافتراضي `<slug>.db`).

التطبيق بيشتق الاسم والمجلد من `DATABASE_URL` عن طريق `lib/dbPath.ts`
(`resolveDbPath` / `resolveDbDir` / `resolveDbName`). كان في ١٤ مكان
بيفترضوا `process.cwd()/prisma/gym.db` بالنص — النسخ الاحتياطي والتنظيف
والاستيراد والترقية وإصلاح الصلاحيات — كلهم بقوا بيشتقوا من هناك، فتغيير
الاسم مابيكسرش أي زر في **الإعدادات → قاعدة البيانات**.

> ده كان بيصلّح كمان عيب موجود أصلاً: نفس الأماكن دي كانت بتفشل في نسخة
> Electron المعبّأة، لأن الـ DB هناك في `userData` مش في `prisma/`.

> ⚠️ **`WHATSAPP_AUTH_DIR` لازم يكون مختلف لكل جيم.** لو نسختين شاركوا
> نفس المجلد هيدوسوا على جلسة بعض والرقمين هيتفصلوا من واتساب.

لو البورت مشغول، الخدمة بتقف وبتقول السبب. (قبل كده كانت بتسمع على
`PORT+1` بصمت — وده كان بيخلّي الواتساب مقفول من غير أي رسالة، لأن
التطبيق بينادي على البورت الأصلي دايماً.)

---

## التنصيب

وجّه A record للدومين على IP السيرفر الأول، وبعدين كـ root:

```bash
# سيرفر لوحده
bash deploy/setup-gym.sh gym.example.com "اسم الجيم"

# جنب الديمو — حدد بورتات فاضية
PORT=4011 WHATSAPP_PORT=4012 OWNER_EMAIL=owner@gym.com \
  bash deploy/setup-gym.sh gym.example.com "اسم الجيم"
```

السكربت بيوقف من أول خطوة لو أي بورت مشغول، فمش هيبني ساعة وبعدين يفشل.

**بيعمل إيه:** حزم النظام + swap → Node 20 + PM2 + Caddy → يجيب الكود →
`.env` بأسرار عشوائية → `npm ci` → داتابيز فاضية + حساب أونر → build →
Caddy + العمليتين → كرون نسخة احتياطية + جدار ناري.

في الآخر بيطبع باسورد الأونر ويحطه في
`<APP_DIR>/logs/owner-credentials.txt` (صلاحيات 600). **غيّره من الإعدادات
بعد أول دخول وامسح الملف.**

### Caddy على سيرفر مشترك

السكربت **مابيدوسش** على `/etc/caddy/Caddyfile`. بيكتب بلوك النسخة في
`/etc/caddy/sites/<domain>.caddy` وبيضيف `import sites/*.caddy` للـ
Caddyfile لو مش موجود (بعد ما ياخد منه نسخة احتياطية)، وبيعمل
`caddy validate` قبل الـ reload — فلو في غلط، الديمو مابيقعش.

---

## ربط رقم الواتساب

1. ادخل `https://<domain>` بحساب الأونر
2. **الإعدادات → واتساب**
3. اضغط "اربط رقم" — الـ QR بيظهر في الصفحة
4. من موبايل الجيم: واتساب → **الأجهزة المرتبطة** → ربط جهاز → امسح الكود

النظام بيشيل لحد **٤ أرقام** (`MAX_SESSIONS`).

الـ QR بيوصل للمتصفح عن طريق SSE على `/api/whatsapp/events`. عشان كده
`Caddyfile.gym` فيه:

```
@sse path /api/whatsapp/events
reverse_proxy @sse 127.0.0.1:<PORT> {
    flush_interval -1
}
```

من غير `flush_interval -1` الـ proxy بيخزّن الرد في بافر والـ QR
مايظهرش خالص — الصفحة بتفضل مستنية على الفاضي.

---

## النسخ الاحتياطي

كرون يومي ٣ الفجر → `/var/backups/<APP_NAME>`:

- الداتابيز بـ `sqlite3 .backup` (آمن والتطبيق شغال؛ `cp` مش آمن مع WAL)،
  وبيتعمل عليها `PRAGMA quick_check` قبل ما تتحفظ — لو طلعت تالفة بتتمسح
- **جلسة الواتساب** — من غيرها أي استرجاع هيحتاج مسح QR من الأول
- ملفات الرفع أسبوعياً (الأحد)

يدوياً:

```bash
APP_DIR=/opt/fitboost-elnour BACKUP_DIR=/var/backups/fitboost-elnour \
  WA_DIR=/opt/fitboost-elnour/.whatsapp-auth deploy/backup-gym.sh
```

### استرجاع

```bash
pm2 stop fitboost-elnour fitboost-elnour-whatsapp
gunzip -c /var/backups/fitboost-elnour/gym-2026-09-01_0300.db.gz \
  > /opt/fitboost-elnour/prisma/gym.db
tar -xzf /var/backups/fitboost-elnour/whatsapp-2026-09-01_0300.tar.gz \
  -C /opt/fitboost-elnour/
pm2 restart fitboost-elnour fitboost-elnour-whatsapp
```

---

## التحديث

```bash
APP_DIR=/opt/fitboost-elnour bash deploy/update-gym.sh
APP_DIR=/opt/fitboost-elnour bash deploy/update-gym.sh --if-changed
```

بياخد نسخة احتياطية الأول، بعدين `git reset --hard` → `npm ci` →
`prisma db push` → build → إعادة تشغيل العمليتين.

`.env` و `prisma/*.db` و `uploads/` و `.whatsapp-auth/` مش متتبعين في
git، فمابيتلمسوش.

---

## لما الواتساب يقع

بالترتيب:

```bash
pm2 logs fitboost-elnour-whatsapp --lines 50
curl -s http://127.0.0.1:4012/status/all      # لازم يرجّع JSON
grep -E '^(WHATSAPP_PORT|INTERNAL_API_TOKEN|APP_NAME)=' /opt/fitboost-elnour/.env
```

| العرض | السبب الغالب |
|---|---|
| `/status` بيرجّع `sidecarOnline: false` | العملية واقعة، أو `WHATSAPP_PORT` مختلف بين العمليتين |
| الرسايل بتتبعت بس مابتتسجّلش | `INTERNAL_API_TOKEN` ناقص أو مختلف → `/api/whatsapp/internal/*` بترجّع 503 |
| الـ QR مابيظهرش | `flush_interval -1` ناقص من بلوك الـ SSE في Caddy |
| الرقم اتفصل فجأة | الجلسة اتمسحت، أو نسخة تانية شاركت نفس `WHATSAPP_AUTH_DIR` |
| البورت مشغول | الخدمة بتقف وبتقول كده في اللوج — غيّر `WHATSAPP_PORT` للنسختين |

الاتنين لازم يشوفوا نفس `WHATSAPP_PORT` ونفس `INTERNAL_API_TOKEN` —
`ecosystem.gym.config.js` بيقراهم من `.env` ويمرّرهم للعمليتين، فأي
تغيير في `.env` محتاج:

```bash
pm2 restart fitboost-elnour fitboost-elnour-whatsapp --update-env
```

---

## اللي لازم تاخد باله

**الواتساب:** Baileys عميل غير رسمي. واتساب ممكن يوقف الرقم، خصوصاً مع
إرسال كتير أو أرقام مش محفوظة عند المستقبِل. استخدم رقم الجيم مش رقم
شخصي، وخلي الإرسال في حدود المعقول.

**الترخيص:** مفيش سجل `SupabaseLicense` = `validateLicense()` بترجّع
صالح، فالنظام شغال من غير ما تظبط Supabase.

**الديسكتوب:** الرفع ده بديل، مش إضافة. لو البرنامج المحلي في الجيم فضل
شغال، هيكتب في داتابيز تانية والاتنين هيفترقوا — مفيش مزامنة بينهم.

**`UPLOADS_PATH`:** بيتقرا **وقت البناء** (rewrites في `next.config`)، فأي
تغيير فيه محتاج `npm run build` تاني، مش إعادة تشغيل.

---

## ملفات الكِت

| الملف | الدور |
|---|---|
| `setup-gym.sh` | التنصيب من الأول |
| `update-gym.sh` | تحديث لآخر كود |
| `backup-gym.sh` | نسخة احتياطية (داتابيز + جلسة واتساب + رفع) |
| `ecosystem.gym.config.js` | عمليتين PM2، القيم من `.env` |
| `Caddyfile.gym` | بلوك الموقع + استثناء SSE |
| `env.gym.example` | قالب `.env` |
| `../scripts/bootstrap-gym.js` | داتابيز فاضية + حساب أونر |
