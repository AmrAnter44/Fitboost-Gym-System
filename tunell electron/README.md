# Fit Boost Server Management 🚇

تطبيق **Electron Portable** — تفتحه من غير تثبيت، وهو اللي يشغّل الـ Cloudflare Tunnel
ويحافظ عليه شغّال **24/7** لوحده. بديل نضيف لكل خطوات الدليل اليدوي:

| الطريقة اليدوية القديمة | Fit Boost Server Management بيعملها لوحده |
| --- | --- |
| `cloudflared.exe` منفصل | مبنيّ جوّا التطبيق |
| ملف `config.yml` تكتبه بإيدك | التطبيق يولّده من `config.json` |
| ملف `.bat` فيه `:loop` لإعادة التشغيل | إعادة تشغيل تلقائية مع backoff |
| ملف `.vbs` مخفي | التطبيق يتصغّر للـ Tray |
| نسخ shortcut في Startup folder | زرار "تشغيل تلقائي مع Windows" |
| أوامر `powercfg` لمنع الـ Sleep | زرار "منع الجهاز من الـ Sleep" |

التطبيق بيتحكم في الـ **port والـ hostname محليًا** — الدومين مش محتاج غير سطر DNS واحد لكل فرع.

---

## الأسهل: إنشاء التونل من جوّا التطبيق 🚀

مش محتاج داشبورد ولا نسخ توكين. افتح `Fit Boost Server Management.exe` → في لوحة **"⚙️ إنشاء تونل جديد"**:

1. اضغط **"تسجيل دخول Cloudflare"** → المتصفح يفتح مرة واحدة، **اختار الدومين** هناك وأكّد.
2. اكتب الـ **subdomain** (مثلاً `branch1`) والـ **domain** (مثلاً `eaglegym.website`) والـ **port** (4001).
3. اضغط **"إنشاء وتشغيل"** → التطبيق يعمل `create` + DNS + الإعدادات + يشغّل **لوحده**.

بعد كده الـ Progress Bar يوصل 100% = **متصل ✓**. التطبيق بيحفظ الإعداد في `config.json`
فمش محتاج تعمل كده تاني — بيتصل تلقائي كل مرة.

> بعد أول تسجيل دخول، الـ `cert.pem` بيتحفظ — أي فرع بعد كده تكتب الـ subdomain وتضغط إنشاء
> على طول من غير تسجيل دخول تاني.

---

## يدويًا: Local config

نفس النتيجة بس بإيدك (لو عايز تتحكم أكتر). الـ port + hostname في `config.json`.

### تجهيز الفرع (مرة واحدة، على جهاز الأدمن)

محتاج `cloudflared` على جهازك عشان الأوامر دي (أو استخدم اللي في `resources/`):

```bash
# 1) تسجيل دخول مرة واحدة (بيحفظ cert.pem) — مش محتاج تكرره لكل فرع
cloudflared tunnel login

# 2) إنشاء tunnel للفرع — بيطبع Tunnel ID وبيعمل ملف <ID>.json
cloudflared tunnel create gym-branch-1

# 3) ربط الـ subdomain بالـ tunnel (ده سطر الـ DNS الوحيد في الدومين)
cloudflared tunnel route dns gym-branch-1 branch1.eaglegym.website
```

احفظ:
- **Tunnel ID** اللي طُبع (مثال: `5bfca8e6-4924-4edf-9faf-32ea855066c9`)
- ملف الـ credentials: `C:\Users\<you>\.cloudflared\<ID>.json`

### تشغيله على جهاز الفرع

1. انسخ فولدر التطبيق (اللي فيه `Fit Boost Server Management.exe`) على الجهاز.
2. انسخ ملف الـ credentials JSON **جنب** الـ exe (سمّيه مثلاً `gym-branch-1.json`).
3. افتح `config.json` اللي جنب الـ exe وحط:
   ```json
   {
     "tunnelId": "5bfca8e6-4924-4edf-9faf-32ea855066c9",
     "credentialsFile": "gym-branch-1.json",
     "hostname": "branch1.eaglegym.website",
     "localPort": 4001,
     "keepAwake": true
   }
   ```
   > `credentialsFile` ممكن يكون اسم الملف بس (لو جنب الـ exe) أو مسار كامل.
   > **مش محتاج تنسخ `cert.pem`** على جهاز الفرع — التشغيل محتاج ملف الـ credentials بس.
4. دبل كليك `Fit Boost Server Management.exe` → الـ Progress Bar يوصل 100% = **متصل ✓**.
5. فعّل **"تشغيل تلقائي مع Windows"** + **"منع الـ Sleep"** من جوّا التطبيق.

**فرع جديد؟** كرّر خطوات التجهيز (create + route dns)، انسخ الـ credentials الجديد، وغيّر الـ 3 قيم في `config.json`. نفس الـ exe.

---

## أوضاع تانية

**Token** (بديل أبسط بملف واحد، بس الـ port بيتظبط في الداشبورد): حط `"token": "eyJ..."` بدل
`tunnelId`/`credentialsFile`. الـ token بياخد الأولوية لو موجود.

**Demo** (تجربة بدون أي إعداد): حط `"demo": true` أو شغّل بـ `TUNNEL_DEMO=1` → quick tunnel
على `trycloudflare.com` برابط عشوائي مؤقت. للتجربة بس، مش للإنتاج.

**Environment variables** (بديل عن الملف): `TUNNEL_TOKEN` · `TUNNEL_PORT` · `TUNNEL_HOSTNAME`.

---

## البناء (Build) — إنت على Mac والهدف Windows

```bash
npm install                 # مرة واحدة
npm run dist:dir            # يبني نسخة Windows x64 بدون تثبيت (مش محتاج Wine)
```

الناتج: `release/win-unpacked/` — انسخ الفولدر كله على الويندوز وشغّل `Fit Boost Server Management.exe` جوّاه.

**exe واحد Portable؟** `npm run dist:portable` (محتاج Wine على الماك: `brew install --cask wine-stable`)
أو ابنيه على جهاز Windows مباشرة.

**تجربة على الماك:** `npm run fetch:cloudflared` ثم `npm start`.

---

## الملفات

```
tunell electron/
├── config.json            ← قيمك (tunnelId, credentialsFile, hostname, port)
├── scripts/fetch-cloudflared.js
├── resources/cloudflared.exe   ← بيتنزّل تلقائي وقت البناء
└── src/
    ├── main.js            ← الإدارة + توليد config.yml + النافذة + Tray + keep-awake
    ├── tunnel.js          ← تشغيل cloudflared (token/local/demo) + عدّ الاتصالات + إعادة التشغيل
    ├── preload.js
    ├── icon.js
    └── renderer/          ← واجهة الـ Progress Bar
```

الـ `config.yml` بيتولّد تلقائيًا في مجلد بيانات التطبيق وقت التشغيل — مش محتاج تكتبه.

---

## Troubleshooting

| المشكلة | الحل |
| --- | --- |
| "الإعدادات ناقصة" | حط `tunnelId` + `credentialsFile` + `hostname` في config.json |
| "ملف الـ credentials مش موجود" | تأكد إن ملف الـ JSON جنب الـ exe والاسم مطابق لـ `credentialsFile` |
| "مشكلة في credentials/الإعدادات" | الـ tunnelId غلط أو ملف الـ credentials مش بتاع نفس الـ tunnel |
| السيرفر المحلي أحمر | شغّل السيستم بتاعك على المنفذ 4001 الأول |
| متصل بس 502 | السيرفر مش شغّال على `localhost:4001` |
| قفلت النافذة والـ tunnel وقف؟ | لأ — القفل بيصغّرها للـ Tray والـ tunnel فاضل شغّال. للخروج النهائي استخدم "خروج نهائي" |

## 🔒 أمان
فعّل **Cloudflare Access (Zero Trust)** على الـ subdomain لطبقة تسجيل دخول قبل السيستم —
ده الحماية الحقيقية، مش إخفاء ملف الـ credentials (اللي بيتحزم في الـ app وسهل استخراجه).
