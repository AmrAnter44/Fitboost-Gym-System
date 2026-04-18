# GitHub Actions Workflows

هذا المجلد يحتوي على workflows التلقائية للمشروع.

## 🔄 Workflows المتاحة

### 1. Build & Test (`build.yml`)

يتم تشغيله عند:
- Push إلى `main` أو `develop`
- Pull Request إلى `main` أو `develop`

**الوظائف:**
- ✅ بناء النظام الرئيسي
- ✅ بناء بوابة العملاء
- ✅ فحص الأكواد (ESLint)
- ✅ فحص الأمان (npm audit)
- ✅ فحص TypeScript

### 2. Deploy to Production (`deploy.yml`)

يتم تشغيله عند:
- Push إلى `main`
- إنشاء tag جديد (`v*`)

**الوظائف:**
- 📦 بناء نسخة production
- 📦 إنشاء deployment package
- 📦 رفع الملفات كـ artifacts
- 📦 إنشاء GitHub Release (للـ tags)

## 🚀 كيفية الاستخدام

### البناء التلقائي:
```bash
# سيتم تشغيل build workflow تلقائياً
git add .
git commit -m "feat: add new feature"
git push origin main
```

### النشر (Deployment):
```bash
# إنشاء tag جديد
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# سيتم تشغيل deploy workflow وإنشاء release
```

## 📊 حالة الـ Workflows

يمكنك رؤية حالة الـ workflows من:
- علامة التبويب **Actions** في GitHub
- Badge في README الرئيسي

## ⚙️ التخصيص

### تعديل Node.js version:
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'  # غيّر الرقم هنا
```

### إضافة tests:
```yaml
- name: Run tests
  run: npm test
```

### إضافة deployment script:
```yaml
- name: Deploy to server
  run: |
    scp -r .next user@server:/path/to/app
    ssh user@server 'cd /path/to/app && pm2 restart app'
```

## 🔒 Secrets المطلوبة

لا توجد secrets مطلوبة حالياً. إذا أردت إضافة deployment حقيقي:

1. اذهب إلى **Settings → Secrets → Actions**
2. أضف secrets:
   - `SSH_PRIVATE_KEY`: مفتاح SSH للسيرفر
   - `SERVER_HOST`: عنوان السيرفر
   - `SERVER_USER`: اسم المستخدم

## 📝 ملاحظات

- Artifacts تُحفظ لمدة 7 أيام للـ builds
- Artifacts تُحفظ لمدة 30 يوم للـ deployments
- يمكن تحميل build artifacts من علامة تبويب Actions

## 🎯 Best Practices

1. **اختبر محلياً أولاً:**
   ```bash
   npm run build  # اختبر البناء
   npm run lint   # اختبر الأكواد
   ```

2. **استخدم branches:**
   ```bash
   git checkout -b feature/new-feature
   # افتح PR للمراجعة
   ```

3. **استخدم Semantic Versioning:**
   - v1.0.0 - Major release
   - v1.1.0 - Minor update
   - v1.1.1 - Patch/bugfix

## 🔧 Troubleshooting

### Build فشل؟
1. تحقق من Logs في Actions tab
2. اختبر محلياً: `npm ci && npm run build`
3. تأكد من `package-lock.json` موجود

### Deployment فشل؟
1. تحقق من branch name (يجب أن يكون `main`)
2. تحقق من tag format (يجب أن يبدأ بـ `v`)
3. تأكد من وجود permissions للـ GitHub Actions
