-- 📍 الحضور الذكي (FB Team): مقفول افتراضياً — الطريقة القديمة مش بتتأثر
ALTER TABLE "SystemSettings" ADD COLUMN "smartAttendanceEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SystemSettings" ADD COLUMN "smartAttendanceRadiusM" INTEGER NOT NULL DEFAULT 150;
ALTER TABLE "SystemSettings" ADD COLUMN "branchLat" REAL;
ALTER TABLE "SystemSettings" ADD COLUMN "branchLng" REAL;

-- 📱 توكنات إشعارات أبلكيشن FB Team
CREATE TABLE "StaffPushToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "StaffPushToken_token_key" ON "StaffPushToken"("token");
CREATE INDEX "StaffPushToken_userId_idx" ON "StaffPushToken"("userId");
