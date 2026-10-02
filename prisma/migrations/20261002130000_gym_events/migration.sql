-- 📣 إيفنتات الجيم (بتظهر في أبلكيشن الأعضاء + إشعار اختياري)
CREATE TABLE "GymEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notifiedAt" DATETIME,
    "notifiedCount" INTEGER,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "GymEvent_startsAt_idx" ON "GymEvent"("startsAt");
