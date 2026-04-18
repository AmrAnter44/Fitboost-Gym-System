-- إضافة حقل pushToken إلى جدول Member
-- يجب تشغيل هذا على قاعدة البيانات في production

-- التحقق من وجود الحقل أولاً ثم إضافته
-- SQLite لا يدعم IF NOT EXISTS مع ALTER TABLE، لذا سيفشل إذا كان الحقل موجوداً (وهذا طبيعي)

ALTER TABLE Member ADD COLUMN pushToken TEXT;

-- بعد تشغيل هذا الـ SQL، أعد تشغيل التطبيق
