# إصلاح خطأ قاعدة البيانات - pushToken field

## المشكلة
```
The column `main.Member.pushToken` does not exist in the current database.
```

قاعدة البيانات في production لا تحتوي على حقل `pushToken` الذي تم إضافته مؤخراً.

---

## الحل السريع (Windows)

### الطريقة 1: استخدام البرنامج النصي التلقائي

1. أغلق التطبيق تماماً (Gym Management)
2. شغّل ملف `fix-database.bat` (موجود في مجلد المشروع)
3. سيضيف البرنامج النصي الحقل المفقود تلقائياً
4. أعد تشغيل التطبيق

### الطريقة 2: يدوياً باستخدام SQLite

1. أغلق التطبيق
2. افتح Command Prompt كمسؤول (Run as Administrator)
3. نفذ الأمر التالي:

```cmd
cd "C:\Program Files\Gym Management\resources\app.asar.unpacked\prisma"
sqlite3 gym.db "ALTER TABLE Member ADD COLUMN pushToken TEXT;"
```

4. أعد تشغيل التطبيق

### الطريقة 3: باستخدام DB Browser for SQLite

1. حمّل وثبّت [DB Browser for SQLite](https://sqlitebrowser.org/)
2. أغلق التطبيق
3. افتح قاعدة البيانات:
   ```
   C:\Program Files\Gym Management\resources\app.asar.unpacked\prisma\gym.db
   ```
4. اذهب إلى تبويب "Execute SQL"
5. نفذ الأمر:
   ```sql
   ALTER TABLE Member ADD COLUMN pushToken TEXT;
   ```
6. احفظ التغييرات وأغلق البرنامج
7. أعد تشغيل التطبيق

---

## ملاحظات مهمة

- ⚠️ **اعمل نسخة احتياطية من قاعدة البيانات قبل التعديل!**
- إذا ظهرت رسالة "duplicate column name: pushToken"، فهذا يعني أن الحقل موجود بالفعل ولا داعي لأي إجراء
- إذا استمرت المشكلة، قد تحتاج لتطبيق migrations أخرى

---

## التحقق من نجاح الإصلاح

بعد إضافة الحقل وإعادة تشغيل التطبيق:
1. افتح صفحة الأعضاء (Members)
2. إذا ظهرت القائمة بدون أخطاء، فالإصلاح نجح ✅
3. إذا استمرت المشكلة، تواصل مع الدعم الفني

---

## للمطورين

إذا كنت تعمل على النظام، استخدم:
```bash
npx prisma migrate deploy
```
لتطبيق جميع migrations المعلقة.
