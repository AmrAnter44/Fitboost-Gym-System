# 🔒 حل مشكلة: attempt to write a readonly database

## المشكلة:
عند محاولة تطبيق migrations أو تحديث قاعدة البيانات، يظهر الخطأ:
```
attempt to write a readonly database
```

---

## 🔍 الأسباب:

### 1. **قاعدة البيانات مفتوحة في برنامج آخر**
- Prisma Studio
- DB Browser for SQLite
- أي database viewer

### 2. **صلاحيات الملف غلط**
- الملف readonly
- المجلد readonly
- المستخدم الحالي مش عنده صلاحيات الكتابة

### 3. **في Mac: Full Disk Access**
- التطبيق محتاج Full Disk Access للوصول للملفات في Library

---

## ✅ الحلول السريعة:

### الحل 1: أغلق جميع البرامج التي تستخدم قاعدة البيانات

```bash
# تحقق من البرامج المفتوحة:
# - Prisma Studio
# - DB Browser for SQLite
# - DBeaver
# - أي IDE أو editor

# أغلقها كلها وأعد المحاولة
```

---

### الحل 2: إصلاح الصلاحيات تلقائياً

```bash
# في مجلد المشروع
node scripts/fix-database-permissions.js
```

هذا الـ script سيصلح صلاحيات:
- ✅ ملف قاعدة البيانات
- ✅ المجلد اللي فيه
- ✅ ملفات الـ journal/wal

---

### الحل 3: إصلاح يدوي

#### على Mac/Linux:

```bash
# 1. تحديد مسار قاعدة البيانات
# Development:
chmod 666 prisma/gym.db
chmod 777 prisma/

# Production (Mac):
chmod 666 ~/Library/Preferences/gym-management/gym.db
chmod 777 ~/Library/Preferences/gym-management/

# Production (Linux):
chmod 666 ~/.local/share/gym-management/gym.db
chmod 777 ~/.local/share/gym-management/
```

#### على Windows:

```cmd
# إزالة readonly flag
attrib -R C:\Users\YourUsername\AppData\Roaming\gym-management\gym.db

# أو من Properties:
# Right-click على gym.db → Properties → أزالة علامة "Read-only"
```

---

### الحل 4: Full Disk Access (Mac فقط)

إذا كان التطبيق في Production (Electron):

1. افتح **System Settings** (الإعدادات)
2. اذهب إلى **Privacy & Security**
3. اضغط على **Full Disk Access**
4. اضغط زر **+** لإضافة التطبيق
5. ابحث عن تطبيق Gym System
6. فعّله ✅
7. أعد تشغيل التطبيق

---

## 🔧 خطوات Troubleshooting كاملة:

### 1. تحقق من البرامج المفتوحة

```bash
# Mac/Linux - شوف مين فاتح قاعدة البيانات
lsof ~/Library/Preferences/gym-management/gym.db

# إذا ظهر أي برنامج، أغلقه
```

### 2. تحقق من الصلاحيات

```bash
# Mac/Linux
ls -la ~/Library/Preferences/gym-management/gym.db

# يجب أن يكون:
# -rw-rw-rw-  (666) أو
# -rw-r--r--  (644) على الأقل
```

### 3. صلّح الصلاحيات

```bash
# استخدم الـ script التلقائي
node scripts/fix-database-permissions.js
```

### 4. أعد المحاولة

- أعد تشغيل التطبيق
- جرب تطبيق الـ migrations مرة أخرى

---

## 📝 ملاحظات مهمة:

### في Development:

- **المسار:** `prisma/gym.db`
- **الحل:** عادةً يكفي إغلاق Prisma Studio

### في Production (Electron):

- **Mac:** `~/Library/Preferences/gym-management/gym.db`
- **Windows:** `%APPDATA%\gym-management\gym.db`
- **Linux:** `~/.local/share/gym-management/gym.db`
- **الحل:** قد تحتاج Full Disk Access (Mac) أو صلاحيات الـ Admin (Windows)

---

## 🚨 إذا استمرت المشكلة:

### تحقق من مساحة القرص:

```bash
# Mac
df -h ~/Library/Preferences/gym-management/

# إذا القرص ممتلئ، احذف ملفات غير مهمة
```

### نسخ احتياطي وإعادة إنشاء:

```bash
# 1. احفظ نسخة احتياطية
cp ~/Library/Preferences/gym-management/gym.db ~/gym-backup.db

# 2. اصلح الصلاحيات
chmod 666 ~/gym-backup.db

# 3. انسخها مكان الأصلية
cp ~/gym-backup.db ~/Library/Preferences/gym-management/gym.db

# 4. اصلح الصلاحيات
chmod 666 ~/Library/Preferences/gym-management/gym.db
chmod 777 ~/Library/Preferences/gym-management/
```

---

## 🔐 منع المشكلة في المستقبل:

### 1. لا تفتح قاعدة البيانات في برامج متعددة

```
❌ سيء:
- Prisma Studio مفتوح
- التطبيق شغال
- DB Browser for SQLite مفتوح

✅ جيد:
- التطبيق فقط شغال
- أو Prisma Studio فقط مفتوح
```

### 2. احفظ backup منتظم

```bash
# أضف script للـ backup اليومي
npm run db:backup
```

### 3. راقب الصلاحيات

```bash
# تحقق من الصلاحيات بعد كل تحديث
ls -la ~/Library/Preferences/gym-management/
```

---

## 🎯 الخلاصة:

### أسرع حل:

1. **أغلق Prisma Studio** وجميع البرامج اللي تستخدم قاعدة البيانات
2. **شغّل:** `node scripts/fix-database-permissions.js`
3. **أعد تشغيل** التطبيق
4. **جرب مرة تانية**

### إذا لسه فيه مشكلة (Mac):

1. **System Settings** → **Privacy & Security** → **Full Disk Access**
2. **أضف التطبيق** للقائمة
3. **أعد تشغيل** التطبيق

---

تاريخ الإنشاء: 2026-03-15
آخر تحديث: 2026-03-15
