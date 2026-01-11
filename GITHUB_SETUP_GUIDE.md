# دليل رفع المشروع على GitHub وربطه بالتحديث التلقائي

## 📋 الخطوات الكاملة

---

## 1️⃣ إنشاء Repository على GitHub

### أ. على موقع GitHub:
1. اذهب إلى https://github.com
2. اضغط على علامة **+** في الأعلى → **New repository**
3. املأ البيانات:
   - **Repository name**: `gym-management`
   - **Description**: `نظام إدارة الصالة الرياضية - X Gym`
   - **Visibility**:
     - ✅ **Public** - إذا تريد يكون مفتوح المصدر (مجاني 100%)
     - ✅ **Private** - إذا تريد يكون خاص (مجاني أيضاً)
   - ⚠️ **لا تختر** أي شيء من:
     - Add a README file
     - Add .gitignore
     - Choose a license
4. اضغط **Create repository**

---

## 2️⃣ تحديث package.json (تم بالفعل ✅)

في [package.json](package.json:94-98), غيّر:

```json
"publish": {
  "provider": "github",
  "owner": "YOUR-GITHUB-USERNAME",  // 👈 غيّر هنا
  "repo": "gym-management",
  "private": false  // غيّر لـ true إذا الـ repo خاص
}
```

**مثال:**
إذا username بتاعك `amr123`:
```json
"publish": {
  "provider": "github",
  "owner": "amr123",
  "repo": "gym-management",
  "private": false
}
```

---

## 3️⃣ إعداد Git محلياً

افتح terminal في مجلد المشروع وشغّل:

```bash
# 1. تهيئة Git (إذا لم يكن مهيأ)
git init

# 2. إضافة كل الملفات
git add .

# 3. أول commit
git commit -m "Initial commit - X Gym Management System v1.0.0"

# 4. تسمية البرانش الرئيسي
git branch -M main

# 5. ربط الـ repository
git remote add origin https://github.com/YOUR-USERNAME/gym-management.git

# 6. رفع الكود
git push -u origin main
```

**مثال كامل:**
```bash
git init
git add .
git commit -m "Initial commit - X Gym Management System v1.0.0"
git branch -M main
git remote add origin https://github.com/amr123/gym-management.git
git push -u origin main
```

---

## 4️⃣ إنشاء GitHub Personal Access Token

### لماذا نحتاجه؟
عشان electron-builder يقدر يرفع الـ releases على GitHub.

### الخطوات:
1. اذهب إلى: https://github.com/settings/tokens
2. اضغط **Generate new token** → **Generate new token (classic)**
3. املأ البيانات:
   - **Note**: `Gym Management Auto Update`
   - **Expiration**: `No expiration` (أو حسب رغبتك)
   - **Scopes** - اختر:
     - ✅ `repo` (كل الصلاحيات تحته)
     - ✅ `write:packages`
4. اضغط **Generate token**
5. **انسخ الـ Token فوراً!** (لن تراه مرة ثانية)

مثال Token:
```
ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 5️⃣ حفظ الـ Token في Environment Variables

### على Windows:

#### الطريقة 1: عبر System Properties
1. ابحث عن "Environment Variables" في Windows
2. اضغط "Edit the system environment variables"
3. اضغط "Environment Variables"
4. تحت "User variables" اضغط "New"
5. املأ:
   - **Variable name**: `GH_TOKEN`
   - **Variable value**: الصق الـ Token
6. اضغط OK

#### الطريقة 2: عبر CMD (أسرع)
```cmd
setx GH_TOKEN "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**⚠️ مهم:** أعد تشغيل VS Code أو Terminal بعد إضافة المتغير!

---

## 6️⃣ بناء ونشر أول نسخة

```bash
# 1. تأكد من version في package.json
# "version": "1.0.0"

# 2. بناء Next.js
npm run build

# 3. بناء Electron ونشر على GitHub
npm run electron:build:win
```

**ماذا سيحدث؟**
1. ✅ يبني التطبيق
2. ✅ يُنشئ ملفات في `dist/`:
   - `X-Gym-Management-Setup-1.0.0.exe`
   - `latest.yml`
3. ✅ **تلقائياً** يرفعهم على GitHub Releases!

---

## 7️⃣ التحقق من النشر

1. اذهب إلى repository على GitHub
2. اضغط **Releases** (على اليمين)
3. يجب أن ترى:
   - **Release**: `v1.0.0`
   - **Assets**:
     - `X-Gym-Management-Setup-1.0.0.exe`
     - `latest.yml`

---

## 8️⃣ نشر تحديث جديد

### السيناريو: عملت تعديل وتريد نشر نسخة جديدة

```bash
# 1. عدّل الكود (مثلاً أصلحت bug)
# ...تعديلاتك...

# 2. زود version في package.json
# من "1.0.0" إلى "1.0.1"

# 3. Commit التعديلات
git add .
git commit -m "Fix: حل مشكلة الباركود في Electron"
git push

# 4. بناء ونشر
npm run build
npm run electron:build:win
```

**النتيجة:**
- ✅ ينشر release جديد `v1.0.1` على GitHub
- ✅ كل الأجهزة المثبتة (1.0.0) تفحص وتجد تحديث
- ✅ يحملوا 1.0.1 تلقائياً
- ✅ يثبتوا بعد إعادة التشغيل

---

## 9️⃣ كيف يعمل التحديث التلقائي مع GitHub؟

### الفحص:
```javascript
// في electron/main.js
autoUpdater.checkForUpdates()
```

**ماذا يحدث؟**
1. التطبيق يرسل طلب إلى:
   ```
   https://api.github.com/repos/YOUR-USERNAME/gym-management/releases/latest
   ```

2. GitHub يرجع JSON:
   ```json
   {
     "tag_name": "v1.0.1",
     "assets": [
       {
         "name": "X-Gym-Management-Setup-1.0.1.exe",
         "browser_download_url": "https://github.com/.../releases/download/..."
       },
       {
         "name": "latest.yml",
         "browser_download_url": "https://github.com/.../releases/download/..."
       }
     ]
   }
   ```

3. التطبيق يقارن:
   ```
   Current: 1.0.0
   Latest:  1.0.1

   → Update Available! 🎉
   ```

4. يحمل من:
   ```
   https://github.com/YOUR-USERNAME/gym-management/releases/download/v1.0.1/X-Gym-Management-Setup-1.0.1.exe
   ```

---

## 🔟 Workflow الكامل

### المرة الأولى (Setup):
```mermaid
1. إنشاء Repo على GitHub
   ↓
2. تعديل package.json (owner, repo)
   ↓
3. إنشاء GH_TOKEN
   ↓
4. حفظ Token في Environment Variables
   ↓
5. git init & git push
   ↓
6. npm run build
   ↓
7. npm run electron:build:win
   ↓
8. ✅ Release v1.0.0 على GitHub
```

### عند كل تحديث:
```mermaid
1. تعديل الكود
   ↓
2. زيادة version (1.0.0 → 1.0.1)
   ↓
3. git commit & push
   ↓
4. npm run build
   ↓
5. npm run electron:build:win
   ↓
6. ✅ Release v1.0.1 على GitHub
   ↓
7. الأجهزة المثبتة تتحدث تلقائياً 🎉
```

---

## ⚠️ مشاكل شائعة وحلولها

### المشكلة 1: "Error: GitHub token not found"
**الحل:**
```bash
# تأكد من وجود المتغير
echo %GH_TOKEN%  # على Windows

# إذا لم يظهر شيء، أضفه:
setx GH_TOKEN "your-token-here"

# أعد تشغيل Terminal
```

### المشكلة 2: "403 Forbidden" عند الرفع
**الحل:**
- تأكد أن الـ Token له صلاحية `repo`
- تأكد أن `owner` و `repo` صحيحين في package.json
- جرب إنشاء Token جديد

### المشكلة 3: "Release already exists"
**الحل:**
- غيّر version في package.json
- أو احذف الـ release القديم من GitHub

### المشكلة 4: الأجهزة لا تجد التحديث
**الحل:**
1. تأكد أن Release published (ليس draft)
2. تأكد أن ملفات .exe و .yml موجودة في Assets
3. تأكد أن `private: false` في package.json إذا الـ repo public

---

## 📊 مقارنة: GitHub vs السيرفر الخاص

| الميزة | GitHub Releases | سيرفرك الخاص |
|--------|----------------|--------------|
| **التكلفة** | ✅ مجاني 100% | ❌ يحتاج استضافة |
| **السرعة** | ✅ سريع جداً (CDN) | ⚠️ يعتمد على سيرفرك |
| **الأمان** | ✅ HTTPS تلقائي | ⚠️ تحتاج SSL |
| **السهولة** | ✅ بأمر واحد | ❌ رفع يدوي |
| **التاريخ** | ✅ كل الإصدارات محفوظة | ⚠️ تحتاج تنظيم |
| **الخصوصية** | ⚠️ Public/Private | ✅ تحكم كامل |

**توصيتي:** استخدم GitHub Releases - أسهل وأسرع ومجاني! 🎯

---

## 📝 ملاحظات مهمة

1. ✅ **لا ترفع `node_modules/` أو `dist/`** - موجودين في .gitignore
2. ✅ **لا ترفع قاعدة البيانات** - `prisma/gym.db` موجودة في .gitignore
3. ✅ **لا ترفع `.env`** - موجود في .gitignore
4. ✅ **الـ GH_TOKEN سري** - لا تشاركه أو ترفعه على Git
5. ✅ **Code Signing** - للمستقبل، يحسن الأمان ويمنع تحذيرات Windows

---

## 🚀 الخطوات التالية

بعد ما تخلص Setup:
1. ✅ وزع النسخة 1.0.0 على الفروع
2. ✅ اختبر التحديث بنشر 1.0.1
3. ✅ راقب console logs للتأكد
4. ✅ فكر في إضافة Release Notes

---

## 📞 مساعدة إضافية

**الملفات المهمة:**
- `package.json` - إعدادات النشر
- `electron/main.js` - Auto updater setup
- `.gitignore` - الملفات المستثناة
- `GITHUB_SETUP_GUIDE.md` - هذا الملف!

**Resources:**
- [electron-builder docs](https://www.electron.build/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [Auto Update docs](https://www.electron.build/auto-update)

---

## ✅ Checklist نهائي

قبل ما تبدأ التوزيع:

- [ ] Repository مُنشأ على GitHub
- [ ] `package.json` محدّث (owner, repo)
- [ ] GH_TOKEN موجود في Environment Variables
- [ ] الكود مرفوع على GitHub (`git push`)
- [ ] أول release منشور (v1.0.0)
- [ ] التطبيق مثبت على جهاز اختبار
- [ ] جربت التحديث من 1.0.0 إلى 1.0.1
- [ ] التحديث شغال تمام ✅

**الآن جاهز للتوزيع على جميع الفروع! 🎉**
