-- Migration: Create WhatsAppTemplate table
-- Created: 2026-03-15

CREATE TABLE IF NOT EXISTS "WhatsAppTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "icon" TEXT NOT NULL DEFAULT '💬',
  "message" TEXT NOT NULL,
  "isCustom" INTEGER NOT NULL DEFAULT 1,
  "isDefault" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default templates if not exists
INSERT OR IGNORE INTO WhatsAppTemplate (id, title, icon, message, isCustom, isDefault, createdAt, updatedAt)
VALUES
('default-1', 'تواصل أول', '👋', 'مرحباً {name}! 🏋️

شكراً لزيارتك لـ Gym System

نحن سعداء باهتمامك بالانضمام إلينا!

📞 للاستفسارات: {phone}
📍 العنوان: {address}

💪 ننتظرك!', 0, 1, datetime('now'), datetime('now')),

('default-2', 'متابعة ثانية', '📞', 'أهلاً {name}! 😊

مر بعض الوقت منذ زيارتك الأخيرة

هل لديك أي استفسارات؟

🎁 لدينا عروض جديدة قد تناسبك!

💪 نحن في انتظارك', 0, 1, datetime('now'), datetime('now')),

('default-3', 'عرض خاص', '🎁', '{name} عزيزي! 🎉

🔥 عرض خاص لفترة محدودة!

✨ خصم {discount}% على جميع الاشتراكات

⏰ العرض ساري حتى: {endDate}

📞 للحجز: {phone}

💪 لا تفوت الفرصة!', 0, 1, datetime('now'), datetime('now')),

('default-4', 'تذكير بالموعد', '⏰', 'مرحباً {name}! 🏋️

📅 تذكير بموعد حصتك:
🕐 الوقت: {time}
📍 المكان: {location}

💪 نراك قريباً!', 0, 1, datetime('now'), datetime('now'));
