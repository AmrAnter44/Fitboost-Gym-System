# دليل استخدام GitHub Actions

## 📋 الـ Workflows المتاحة

### 1️⃣ Build and Deploy (التلقائي)
**الملف:** `.github/workflows/build-and-deploy.yml`

**متى يشتغل:**
- عند عمل Push على branch `main` أو `master`
- عند فتح Pull Request
- يدوياً من GitHub Actions tab

**ماذا يفعل:**
1. ✅ يعمل build للتطبيق
2. ✅ يحفظ الـ build artifacts
3. ✅ ينشئ Release جديد على GitHub
4. ✅ يرفع ملف ZIP جاهز للتحميل

**كيفية الاستخدام:**
```bash
# فقط اعمل commit و push
git add .
git commit -m "Update version to 1.0.38"
git push origin main

# GitHub Actions هيشتغل تلقائياً!
```

---

### 2️⃣ Run Tests
**الملف:** `.github/workflows/test.yml`

**متى يشتغل:**
- عند عمل Push على أي branch
- عند فتح Pull Request

**ماذا يفعل:**
1. ✅ يفحص الـ TypeScript
2. ✅ يشغل ESLint
3. ✅ يتأكد إن الـ Build شغال

---

### 3️⃣ Deploy to Production
**الملف:** `.github/workflows/deploy-production.yml`

**متى يشتغل:**
- عند نشر Release جديد
- يدوياً من GitHub Actions tab

**ماذا يفعل:**
1. ✅ يعمل build production
2. ✅ ينشئ deployment info
3. ✅ جاهز لإضافة خطوات deployment إضافية

---

## 🚀 الاستخدام السريع

### خطوة 1: Push الكود على GitHub

```bash
# إضافة الملفات الجديدة
git add .

# Commit مع رسالة واضحة
git commit -m "feat: Add PWA support and production setup"

# Push على main branch
git push origin main
```

### خطوة 2: متابعة البيلد

1. افتح repository على GitHub
2. اذهب لتاب **Actions**
3. شاهد الـ workflow وهو بيشتغل في الوقت الفعلي ⚡

### خطوة 3: تحميل النسخة الجاهزة

1. اذهب لتاب **Releases**
2. حمّل ملف `gym-system-v1.0.x.zip`
3. فك الضغط وشغّل `start-production.bat`

---

## 📦 محتويات الـ Release

عند كل build ناجح، GitHub Actions ينشئ ملف ZIP يحتوي على:

```
gym-system-v1.0.x.zip
├── .next/                      # البيلد الجاهز
├── public/                     # الملفات العامة
├── prisma/                     # قاعدة البيانات
├── package.json
├── package-lock.json
├── .env                        # ملف إعدادات (من .env.example)
├── INSTALL.md                  # دليل التثبيت السريع
├── PRODUCTION_SETUP.md         # دليل الإنتاج الكامل
├── GODADDY_SETUP.md           # دليل إعداد الدومين
├── start-production.bat        # سكريبت التشغيل
├── backup-database.bat         # سكريبت النسخ الاحتياطي
└── ecosystem.config.js         # إعدادات PM2
```

---

## ⚙️ الإعدادات المطلوبة

### في repository settings:

1. **اذهب لـ Settings → Actions → General**
2. تأكد أن **Workflow permissions** مضبوطة على:
   - ✅ Read and write permissions

3. **اذهب لـ Settings → Environments** (اختياري)
   - أنشئ environment اسمه `production`
   - أضف protection rules إذا أردت

---

## 🎯 تشغيل Workflow يدوياً

### من GitHub UI:
1. اذهب لتاب **Actions**
2. اختر الـ workflow اللي عايز تشغله
3. اضغط **Run workflow**
4. اختر الـ branch
5. اضغط **Run workflow** الأخضر

### من Command Line:
```bash
# تثبيت GitHub CLI
# ثم:
gh workflow run "Build and Deploy Gym System"
```

---

## 📊 مراقبة الـ Workflows

### شاهد حالة الـ Build:
```bash
gh run list

gh run watch
```

### شاهد الـ Logs:
```bash
gh run view --log
```

---

## 🔧 تخصيص الـ Workflows

### تغيير رقم الإصدار تلقائياً:

في `package.json`:
```json
{
  "version": "1.0.38"  ← غيّر الرقم هنا
}
```

GitHub Actions هياخد الرقم ده تلقائياً!

### إضافة خطوات deployment إضافية:

في `.github/workflows/deploy-production.yml`، أضف بعد الخطوة الأخيرة:

```yaml
- name: Deploy to server via SSH
  uses: appleboy/ssh-action@v1.0.0
  with:
    host: ${{ secrets.SERVER_HOST }}
    username: ${{ secrets.SERVER_USER }}
    key: ${{ secrets.SSH_KEY }}
    script: |
      cd /path/to/app
      git pull
      npm install
      npm run build
      pm2 restart gym-system
```

---

## 🛡️ Secrets Management

### إضافة Secrets (لمعلومات حساسة):

1. Settings → Secrets and variables → Actions
2. اضغط **New repository secret**
3. أضف:
   - `SERVER_HOST`: عنوان السيرفر
   - `SERVER_USER`: اسم المستخدم
   - `SSH_KEY`: مفتاح SSH

---

## ✅ أفضل الممارسات

1. **Semantic Versioning:**
   ```
   1.0.0 → Initial release
   1.0.1 → Bug fixes
   1.1.0 → New features
   2.0.0 → Breaking changes
   ```

2. **Commit Messages:**
   ```bash
   feat: Add new feature
   fix: Fix bug
   docs: Update documentation
   style: Format code
   refactor: Refactor code
   test: Add tests
   chore: Update dependencies
   ```

3. **Branch Strategy:**
   ```
   main/master → Production-ready code
   develop → Development branch
   feature/* → New features
   hotfix/* → Urgent fixes
   ```

---

## 🔄 سير العمل الموصى به

```bash
# 1. إنشاء feature branch
git checkout -b feature/spa-bookings

# 2. عمل التغييرات
# ... code ...

# 3. Commit
git add .
git commit -m "feat: Add SPA booking system"

# 4. Push للـ branch
git push origin feature/spa-bookings

# 5. فتح Pull Request على GitHub
# GitHub Actions هيشغل Tests تلقائياً

# 6. بعد الموافقة، Merge للـ main
# GitHub Actions هيعمل Build و Release تلقائياً!
```

---

## 📈 مراقبة الأداء

### Build Time:
- عادي: 3-5 دقائق
- مع Cache: 1-2 دقيقة

### تحسين السرعة:
```yaml
# في الـ workflow، أضف:
- uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

---

## 🆘 حل المشاكل

### Build فشل:
1. شاهد الـ logs في Actions tab
2. تأكد من صحة `package.json`
3. تأكد من عدم وجود أخطاء TypeScript

### Release لم ينشأ:
1. تأكد من الـ permissions (Read & Write)
2. تأكد من وجود tag في الكود
3. تحقق من صحة `GITHUB_TOKEN`

---

## 🎉 الخلاصة

GitHub Actions يوفر لك:
- ✅ Build تلقائي عند كل Push
- ✅ Releases جاهزة للتحميل
- ✅ Tests تلقائية
- ✅ Deployment آمن
- ✅ توفير الوقت والجهد

**الآن كل اللي عليك:**
```bash
git push
```

**وخلي GitHub Actions يشتغل! 🚀**
