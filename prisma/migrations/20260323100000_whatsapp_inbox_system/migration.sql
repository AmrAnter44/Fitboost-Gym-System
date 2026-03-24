-- WhatsApp Multi-Number Inbox System
-- Created: 2026-03-23

-- WhatsApp Sessions (up to 4 numbers)
CREATE TABLE IF NOT EXISTS "WhatsAppSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionIndex" INTEGER NOT NULL UNIQUE,
  "label" TEXT NOT NULL,
  "phoneNumber" TEXT,
  "status" TEXT NOT NULL DEFAULT 'disconnected',
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "warmupComplete" INTEGER NOT NULL DEFAULT 0,
  "warmupStartedAt" DATETIME,
  "dailyMessageCount" INTEGER NOT NULL DEFAULT 0,
  "dailyCountResetAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp Conversations
CREATE TABLE IF NOT EXISTS "WhatsAppConversation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "remotePhone" TEXT NOT NULL UNIQUE,
  "remoteName" TEXT,
  "lastMessageAt" DATETIME,
  "lastMessageText" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "assignedToId" TEXT,
  "sessionId" TEXT,
  "unreadCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("assignedToId") REFERENCES "Staff"("id") ON DELETE SET NULL,
  FOREIGN KEY ("sessionId") REFERENCES "WhatsAppSession"("id") ON DELETE SET NULL
);

-- WhatsApp Messages
CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "sessionId" TEXT,
  "direction" TEXT NOT NULL,
  "messageType" TEXT NOT NULL DEFAULT 'text',
  "content" TEXT NOT NULL,
  "mediaUrl" TEXT,
  "whatsappMsgId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "sentById" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE CASCADE,
  FOREIGN KEY ("sessionId") REFERENCES "WhatsAppSession"("id") ON DELETE SET NULL
);

-- WhatsApp Queue
CREATE TABLE IF NOT EXISTS "WhatsAppQueueItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "messageType" TEXT NOT NULL DEFAULT 'text',
  "content" TEXT NOT NULL,
  "mediaBase64" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 5,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "scheduledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" DATETIME,
  "error" TEXT,
  "createdById" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("sessionId") REFERENCES "WhatsAppSession"("id") ON DELETE CASCADE
);

-- Indexes for WhatsAppSession
CREATE INDEX IF NOT EXISTS "idx_wa_session_index" ON "WhatsAppSession"("sessionIndex");
CREATE INDEX IF NOT EXISTS "idx_wa_session_status" ON "WhatsAppSession"("status");
CREATE INDEX IF NOT EXISTS "idx_wa_session_active" ON "WhatsAppSession"("isActive");

-- Indexes for WhatsAppConversation
CREATE INDEX IF NOT EXISTS "idx_wa_conv_status" ON "WhatsAppConversation"("status");
CREATE INDEX IF NOT EXISTS "idx_wa_conv_assigned" ON "WhatsAppConversation"("assignedToId");
CREATE INDEX IF NOT EXISTS "idx_wa_conv_lastmsg" ON "WhatsAppConversation"("lastMessageAt");
CREATE INDEX IF NOT EXISTS "idx_wa_conv_session" ON "WhatsAppConversation"("sessionId");

-- Indexes for WhatsAppMessage
CREATE INDEX IF NOT EXISTS "idx_wa_msg_conv" ON "WhatsAppMessage"("conversationId");
CREATE INDEX IF NOT EXISTS "idx_wa_msg_session" ON "WhatsAppMessage"("sessionId");
CREATE INDEX IF NOT EXISTS "idx_wa_msg_created" ON "WhatsAppMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "idx_wa_msg_direction" ON "WhatsAppMessage"("direction");

-- Indexes for WhatsAppQueueItem
CREATE INDEX IF NOT EXISTS "idx_wa_queue_session" ON "WhatsAppQueueItem"("sessionId");
CREATE INDEX IF NOT EXISTS "idx_wa_queue_status" ON "WhatsAppQueueItem"("status");
CREATE INDEX IF NOT EXISTS "idx_wa_queue_scheduled" ON "WhatsAppQueueItem"("scheduledAt");
CREATE INDEX IF NOT EXISTS "idx_wa_queue_priority" ON "WhatsAppQueueItem"("priority");

-- Seed 4 session slots
INSERT OR IGNORE INTO "WhatsAppSession" ("id", "sessionIndex", "label", "status", "createdAt", "updatedAt")
VALUES
  ('wa-session-0', 0, 'الرقم الرئيسي', 'disconnected', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO "WhatsAppSession" ("id", "sessionIndex", "label", "status", "createdAt", "updatedAt")
VALUES
  ('wa-session-1', 1, 'رقم 2', 'disconnected', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO "WhatsAppSession" ("id", "sessionIndex", "label", "status", "createdAt", "updatedAt")
VALUES
  ('wa-session-2', 2, 'رقم 3', 'disconnected', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO "WhatsAppSession" ("id", "sessionIndex", "label", "status", "createdAt", "updatedAt")
VALUES
  ('wa-session-3', 3, 'رقم 4', 'disconnected', datetime('now'), datetime('now'));

-- Add WhatsApp permissions
ALTER TABLE "Permission" ADD COLUMN "canViewWhatsAppInbox" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Permission" ADD COLUMN "canSendWhatsApp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Permission" ADD COLUMN "canManageWhatsApp" INTEGER NOT NULL DEFAULT 0;
