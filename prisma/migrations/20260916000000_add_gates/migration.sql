-- 🚪 بوابات التعرّف على الوش (Hikvision)

CREATE TABLE IF NOT EXISTS "Gate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 80,
    "useHttps" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT NOT NULL DEFAULT 'admin',
    "passwordEnc" TEXT NOT NULL,
    "doorNo" INTEGER NOT NULL DEFAULT 1,
    "planTemplateNo" TEXT NOT NULL DEFAULT '1',
    "capacity" INTEGER NOT NULL DEFAULT 1500,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS "Gate_isEnabled_idx" ON "Gate"("isEnabled");

CREATE TABLE IF NOT EXISTS "GateMemberSync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gateId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "employeeNo" TEXT NOT NULL,
    "isAllowed" BOOLEAN NOT NULL,
    "validUntil" DATETIME,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "GateMemberSync_gateId_memberId_key" ON "GateMemberSync"("gateId", "memberId");
CREATE INDEX IF NOT EXISTS "GateMemberSync_gateId_idx" ON "GateMemberSync"("gateId");
CREATE INDEX IF NOT EXISTS "GateMemberSync_memberId_idx" ON "GateMemberSync"("memberId");

CREATE TABLE IF NOT EXISTS "GateEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gateId" TEXT,
    "memberId" TEXT,
    "employeeNo" TEXT,
    "eventTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allowed" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "rawPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "GateEvent_eventTime_idx" ON "GateEvent"("eventTime");
CREATE INDEX IF NOT EXISTS "GateEvent_memberId_idx" ON "GateEvent"("memberId");
CREATE INDEX IF NOT EXISTS "GateEvent_gateId_idx" ON "GateEvent"("gateId");
CREATE INDEX IF NOT EXISTS "GateEvent_allowed_idx" ON "GateEvent"("allowed");

-- تفعيل الميزة (افتراضي مقفول — الجيمات اللي مالهاش بوابة ماتحسش بحاجة)
ALTER TABLE "SystemSettings" ADD COLUMN "gatesEnabled" BOOLEAN NOT NULL DEFAULT false;
