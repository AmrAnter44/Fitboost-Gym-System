// check-and-migrate.js
// Script to automatically update database schema on app startup
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

/**
 * تحقق من وجود جدول في قاعدة البيانات
 */
function tableExists(db, tableName) {
  try {
    const result = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
    ).get(tableName);
    return !!result;
  } catch (error) {
    console.error(`Error checking table ${tableName}:`, error);
    return false;
  }
}

function columnExists(db, tableName, columnName) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return columns.some(col => col.name === columnName);
  } catch (error) {
    console.error(`Error checking column ${columnName}:`, error);
    return false;
  }
}

/**
 * تحديث قاعدة البيانات
 */
function migrateDatabase(dbPath) {

  if (!fs.existsSync(dbPath)) {
    return;
  }

  try {
    const db = new Database(dbPath);

    // ✅ فحص وجود remainingAmount في جدول PT
    if (!columnExists(db, 'PT', 'remainingAmount')) {
      db.prepare('ALTER TABLE PT ADD COLUMN remainingAmount REAL NOT NULL DEFAULT 0').run();
    } else {
    }

    // ✅ فحص وجود SPA Booking permissions في جدول Permission
    const spaPermissions = [
      'canViewSpaBookings',
      'canCreateSpaBooking',
      'canEditSpaBooking',
      'canCancelSpaBooking',
      'canViewSpaReports'
    ];

    for (const permission of spaPermissions) {
      if (!columnExists(db, 'Permission', permission)) {
        db.prepare(`ALTER TABLE Permission ADD COLUMN ${permission} INTEGER NOT NULL DEFAULT 0`).run();
      } else {
      }
    }

    // ✅ فحص وجود More & Deduction permissions في جدول Permission
    const morePermissions = [
      'canViewMore',
      'canRegisterMoreAttendance',
      'canDeleteMore',
      'canAccessMoreCommission',
      'canViewDeductions',
      'canCreateDeduction',
      'canEditDeduction',
      'canDeleteDeduction',
      'canManageBannedMembers'
    ];

    for (const permission of morePermissions) {
      if (!columnExists(db, 'Permission', permission)) {
        db.prepare(`ALTER TABLE Permission ADD COLUMN ${permission} INTEGER NOT NULL DEFAULT 0`).run();
      } else {
      }
    }

    // ✅ User.isSales — حساب سيلز
    if (!columnExists(db, 'User', 'isSales')) {
      db.prepare('ALTER TABLE User ADD COLUMN isSales INTEGER NOT NULL DEFAULT 0').run();
    } else {
    }

    // ✅ User.staffId — ربط المستخدم بموظف
    if (!columnExists(db, 'User', 'staffId')) {
      db.prepare('ALTER TABLE User ADD COLUMN staffId TEXT').run();
    } else {
    }

    // ✅ Staff.salesTarget — تارجت السيلز الشهري
    if (!columnExists(db, 'Staff', 'salesTarget')) {
      db.prepare('ALTER TABLE Staff ADD COLUMN salesTarget REAL DEFAULT 0').run();
    } else {
    }

    // ✅ Member.salesStaffId — ربط العضو بموظف سيلز
    if (!columnExists(db, 'Member', 'salesStaffId')) {
      db.prepare('ALTER TABLE Member ADD COLUMN salesStaffId TEXT').run();
    } else {
    }

    // ✅ DayUseInBody.salesStaffId — ربط عملية الـ Day Use بموظف سيلز
    if (!columnExists(db, 'DayUseInBody', 'salesStaffId')) {
      db.prepare('ALTER TABLE DayUseInBody ADD COLUMN salesStaffId TEXT').run();
    } else {
    }

    // ✅ Staff commission fields (sales commission system)
    const commissionCols = [
      { col: 'salesCommissionType', def: 'TEXT' },
      { col: 'salesCommissionRate', def: 'REAL' },
      { col: 'salesCommissionTiers', def: 'TEXT' },
    ];
    for (const { col, def } of commissionCols) {
      if (!columnExists(db, 'Staff', col)) {
        db.prepare(`ALTER TABLE Staff ADD COLUMN ${col} ${def}`).run();
      } else {
      }
    }

    // ✅ SystemSettings.remainingEnabled
    if (!columnExists(db, 'SystemSettings', 'remainingEnabled')) {
      db.prepare('ALTER TABLE SystemSettings ADD COLUMN remainingEnabled INTEGER NOT NULL DEFAULT 1').run();
    } else {
    }

    // ✅ Member.remainingDueDate — موعد سداد الباقي
    if (!columnExists(db, 'Member', 'remainingDueDate')) {
      db.prepare('ALTER TABLE Member ADD COLUMN remainingDueDate DATETIME').run();
    } else {
    }

    // ✅ SystemSettings.androidAppUrl — رابط تطبيق الأندرويد
    if (!columnExists(db, 'SystemSettings', 'androidAppUrl')) {
      db.prepare('ALTER TABLE SystemSettings ADD COLUMN androidAppUrl TEXT').run();
    } else {
    }

    // ✅ WhatsApp permissions في جدول Permission
    const whatsappPermissions = [
      'canViewWhatsAppInbox',
      'canSendWhatsApp',
      'canManageWhatsApp'
    ];
    for (const permission of whatsappPermissions) {
      if (!columnExists(db, 'Permission', permission)) {
        db.prepare(`ALTER TABLE Permission ADD COLUMN ${permission} INTEGER NOT NULL DEFAULT 0`).run();
      } else {
      }
    }

    // ✅ FollowUp enhanced fields — حقول المتابعات المطورة
    const followUpCols = [
      { col: 'salesName',       def: 'TEXT' },
      { col: 'assignedTo',      def: 'TEXT' },
      { col: 'priority',        def: 'TEXT' },
      { col: 'stage',           def: "TEXT NOT NULL DEFAULT 'new'" },
      { col: 'lastContactedAt', def: 'DATETIME' },
      { col: 'contactCount',    def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'archived',        def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'archivedAt',      def: 'DATETIME' },
      { col: 'archivedReason',  def: 'TEXT' },
    ];
    for (const { col, def } of followUpCols) {
      if (!columnExists(db, 'FollowUp', col)) {
        db.prepare(`ALTER TABLE FollowUp ADD COLUMN ${col} ${def}`).run();
      } else {
      }
    }

    // ✅ Staff HR fields — حقول الحضور والدوامات
    const staffHrCols = [
      { col: 'workingHours',        def: 'REAL' },
      { col: 'monthlyVacationDays', def: 'INTEGER' },
      { col: 'shiftStartTime',      def: 'TEXT' },
      { col: 'shiftEndTime',        def: 'TEXT' },
    ];
    for (const { col, def } of staffHrCols) {
      if (!columnExists(db, 'Staff', col)) {
        db.prepare(`ALTER TABLE Staff ADD COLUMN ${col} ${def}`).run();
      } else {
      }
    }

    // ✅ Member new fields — حقول الأعضاء الجديدة
    const memberCols = [
      { col: 'isBanned',                def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'pushToken',               def: 'TEXT' },
      { col: 'remainingFreezeDays',     def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'backupPhone',             def: 'TEXT' },
      { col: 'idCardFront',             def: 'TEXT' },
      { col: 'idCardBack',              def: 'TEXT' },
      { col: 'source',                  def: 'TEXT' },
      { col: 'freePTSessions',          def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'freeNutritionSessions',   def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'freePhysioSessions',      def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'freeGroupClassSessions',  def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'freePoolSessions',        def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'freePadelSessions',       def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'freeAssessmentSessions',  def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'freeMoreSessions',        def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'inBodyScans',             def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'invitations',             def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'points',                  def: 'INTEGER NOT NULL DEFAULT 0' },
    ];
    for (const { col, def } of memberCols) {
      if (!columnExists(db, 'Member', col)) {
        db.prepare(`ALTER TABLE Member ADD COLUMN ${col} ${def}`).run();
      } else {
      }
    }

    // ✅ User new fields — حقول المستخدمين الجديدة
    const userCols = [
      { col: 'darkMode', def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'locale',   def: "TEXT NOT NULL DEFAULT 'ar'" },
    ];
    for (const { col, def } of userCols) {
      if (!columnExists(db, 'User', col)) {
        db.prepare(`ALTER TABLE User ADD COLUMN ${col} ${def}`).run();
      } else {
      }
    }

    // ✅ SystemSettings new fields — إعدادات النظام الجديدة
    const settingsCols = [
      { col: 'gymName',                    def: 'TEXT' },
      { col: 'gymLogo',                    def: 'TEXT' },
      { col: 'primaryColor',               def: 'TEXT' },
      { col: 'iosAppUrl',                  def: 'TEXT' },
      { col: 'showAppLinksOnReceipts',     def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'websiteUrl',                 def: 'TEXT' },
      { col: 'showWebsiteOnReceipts',      def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'receiptTerms',               def: 'TEXT' },
      { col: 'trackFreeSessionsCost',      def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'freePTSessionPrice',         def: 'REAL DEFAULT 0' },
      { col: 'freeNutritionSessionPrice',  def: 'REAL DEFAULT 0' },
      { col: 'freePhysioSessionPrice',     def: 'REAL DEFAULT 0' },
      { col: 'freeGroupClassSessionPrice', def: 'REAL DEFAULT 0' },
      { col: 'ptCommissionEnabled',        def: 'INTEGER NOT NULL DEFAULT 1' },
      { col: 'ptCommissionAmount',         def: 'REAL DEFAULT 50' },
      { col: 'moreCommissionEnabled',      def: 'INTEGER NOT NULL DEFAULT 1' },
      { col: 'moreCommissionAmount',       def: 'REAL DEFAULT 50' },
      { col: 'nutritionReferralEnabled',   def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'nutritionReferralPercentage',def: 'REAL DEFAULT 0' },
      { col: 'physioReferralEnabled',      def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'physioReferralPercentage',   def: 'REAL DEFAULT 0' },
      { col: 'lastBirthdayPointsCheck',    def: "TEXT DEFAULT '1970-01-01'" },
      { col: 'pointsPerReferral',          def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'pointsPerEGPSpent',          def: 'REAL DEFAULT 0.1' },
      { col: 'pointsPerBirthday',          def: 'INTEGER NOT NULL DEFAULT 10' },
      { col: 'pointsValueInEGP',           def: 'REAL DEFAULT 0.1' },
      { col: 'updatedBy',                  def: 'TEXT' },
    ];
    for (const { col, def } of settingsCols) {
      if (!columnExists(db, 'SystemSettings', col)) {
        db.prepare(`ALTER TABLE SystemSettings ADD COLUMN ${col} ${def}`).run();
      } else {
      }
    }

    // ✅ Receipt new service columns — أعمدة الإيصالات للخدمات الجديدة
    const receiptCols = [
      { col: 'nutritionNumber', def: 'INTEGER' },
      { col: 'physioNumber',    def: 'INTEGER' },
      { col: 'classNumber',     def: 'INTEGER' },
      { col: 'moreNumber',      def: 'INTEGER' },
      { col: 'cancelledAt',     def: 'DATETIME' },
      { col: 'cancelledBy',     def: 'TEXT' },
      { col: 'cancelReason',    def: 'TEXT' },
    ];
    for (const { col, def } of receiptCols) {
      if (!columnExists(db, 'Receipt', col)) {
        db.prepare(`ALTER TABLE Receipt ADD COLUMN ${col} ${def}`).run();
      } else {
      }
    }

    // ✅ Offer new fields — حقول الباقات الجديدة
    const offerCols = [
      { col: 'freePoolSessions',        def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'freePadelSessions',       def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'freeAssessmentSessions',  def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'freeMoreSessions',        def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'nutritionPrice',          def: 'REAL DEFAULT 0' },
      { col: 'physioPrice',             def: 'REAL DEFAULT 0' },
      { col: 'groupClassPrice',         def: 'REAL DEFAULT 0' },
      { col: 'morePrice',               def: 'REAL DEFAULT 0' },
      { col: 'ptCommission',            def: 'REAL DEFAULT 0' },
      { col: 'icon',                    def: "TEXT NOT NULL DEFAULT '📅'" },
      { col: 'upgradeEligibilityDays',  def: 'INTEGER DEFAULT 7' },
      { col: 'upgradePoints',           def: 'INTEGER NOT NULL DEFAULT 0' },
    ];
    for (const { col, def } of offerCols) {
      if (!columnExists(db, 'Offer', col)) {
        db.prepare(`ALTER TABLE Offer ADD COLUMN ${col} ${def}`).run();
      } else {
      }
    }

    // ✅ إنشاء الجداول الجديدة إذا لم تكن موجودة
    // FreezeRequest — مطلوب في members API
    if (!tableExists(db, 'FreezeRequest')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS FreezeRequest (
          id TEXT PRIMARY KEY,
          memberId TEXT NOT NULL,
          startDate DATETIME NOT NULL,
          endDate DATETIME NOT NULL,
          days INTEGER NOT NULL,
          reason TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          approvedBy TEXT,
          approvedAt DATETIME,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS FreezeRequest_memberId_idx ON FreezeRequest(memberId);
        CREATE INDEX IF NOT EXISTS FreezeRequest_status_idx ON FreezeRequest(status);
        CREATE INDEX IF NOT EXISTS FreezeRequest_startDate_idx ON FreezeRequest(startDate);
      `);
    } else {
    }

    // PointsHistory — نظام النقاط
    if (!tableExists(db, 'PointsHistory')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS PointsHistory (
          id TEXT PRIMARY KEY,
          memberId TEXT NOT NULL,
          points INTEGER NOT NULL,
          action TEXT NOT NULL,
          description TEXT,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS PointsHistory_memberId_idx ON PointsHistory(memberId);
        CREATE INDEX IF NOT EXISTS PointsHistory_createdAt_idx ON PointsHistory(createdAt);
        CREATE INDEX IF NOT EXISTS PointsHistory_action_idx ON PointsHistory(action);
      `);
    } else {
    }

    // AssessmentHistory — تاريخ التقييمات
    if (!tableExists(db, 'AssessmentHistory')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS AssessmentHistory (
          id TEXT PRIMARY KEY,
          memberId TEXT NOT NULL,
          type TEXT NOT NULL,
          value REAL,
          notes TEXT,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS AssessmentHistory_memberId_idx ON AssessmentHistory(memberId);
        CREATE INDEX IF NOT EXISTS AssessmentHistory_createdAt_idx ON AssessmentHistory(createdAt);
        CREATE INDEX IF NOT EXISTS AssessmentHistory_type_idx ON AssessmentHistory(type);
      `);
    } else {
    }

    // SpaBooking — حجوزات السبا
    if (!tableExists(db, 'SpaBooking')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS SpaBooking (
          id TEXT PRIMARY KEY,
          memberId TEXT NOT NULL,
          memberName TEXT NOT NULL,
          memberPhone TEXT,
          serviceType TEXT NOT NULL,
          bookingDate DATETIME NOT NULL,
          bookingTime TEXT NOT NULL,
          duration INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          notes TEXT,
          createdBy TEXT NOT NULL,
          createdByUserId TEXT,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS SpaBooking_memberId_idx ON SpaBooking(memberId);
        CREATE INDEX IF NOT EXISTS SpaBooking_bookingDate_idx ON SpaBooking(bookingDate);
        CREATE INDEX IF NOT EXISTS SpaBooking_status_idx ON SpaBooking(status);
        CREATE INDEX IF NOT EXISTS SpaBooking_serviceType_idx ON SpaBooking(serviceType);
      `);
    } else {
    }

    // BannedMember — قائمة المحظورين
    if (!tableExists(db, 'BannedMember')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS BannedMember (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          nationalId TEXT,
          reason TEXT,
          notes TEXT,
          bannedBy TEXT,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS BannedMember_phone_idx ON BannedMember(phone);
        CREATE INDEX IF NOT EXISTS BannedMember_nationalId_idx ON BannedMember(nationalId);
      `);
    } else {
    }

    // StaffDeduction — خصومات الموظفين
    if (!tableExists(db, 'StaffDeduction')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS StaffDeduction (
          id TEXT PRIMARY KEY,
          staffId TEXT NOT NULL,
          amount REAL NOT NULL,
          reason TEXT NOT NULL,
          notes TEXT,
          isApplied INTEGER NOT NULL DEFAULT 0,
          appliedAt DATETIME,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
      `);
    } else {
    }

    // FollowUpActivity — أنشطة المتابعات
    if (!tableExists(db, 'FollowUpActivity')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS FollowUpActivity (
          id TEXT PRIMARY KEY,
          followUpId TEXT NOT NULL,
          activityType TEXT NOT NULL,
          notes TEXT,
          createdBy TEXT NOT NULL,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS FollowUpActivity_followUpId_idx ON FollowUpActivity(followUpId);
        CREATE INDEX IF NOT EXISTS FollowUpActivity_createdAt_idx ON FollowUpActivity(createdAt);
      `);
    } else {
    }

    // More — خدمة مزيد
    if (!tableExists(db, 'More')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS More (
          moreNumber INTEGER PRIMARY KEY AUTOINCREMENT,
          clientName TEXT NOT NULL,
          phone TEXT NOT NULL,
          memberId TEXT,
          sessionsPurchased INTEGER NOT NULL,
          sessionsRemaining INTEGER NOT NULL,
          coachName TEXT NOT NULL,
          coachUserId TEXT,
          pricePerSession REAL NOT NULL,
          totalAmount REAL NOT NULL,
          startDate DATETIME NOT NULL DEFAULT (datetime('now')),
          expiryDate DATETIME NOT NULL,
          remainingAmount REAL NOT NULL DEFAULT 0,
          notes TEXT,
          isActive INTEGER NOT NULL DEFAULT 1,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS More_moreNumber_idx ON More(moreNumber);
        CREATE INDEX IF NOT EXISTS More_phone_idx ON More(phone);
        CREATE INDEX IF NOT EXISTS More_memberId_idx ON More(memberId);
        CREATE INDEX IF NOT EXISTS More_coachUserId_idx ON More(coachUserId);
        CREATE INDEX IF NOT EXISTS More_isActive_idx ON More(isActive);
      `);
    } else {
    }

    // MoreSession — جلسات مزيد
    if (!tableExists(db, 'MoreSession')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS MoreSession (
          id TEXT PRIMARY KEY,
          moreNumber INTEGER NOT NULL,
          clientName TEXT NOT NULL,
          coachName TEXT NOT NULL,
          sessionDate DATETIME NOT NULL DEFAULT (datetime('now')),
          attended INTEGER NOT NULL DEFAULT 1,
          attendedAt DATETIME NOT NULL DEFAULT (datetime('now')),
          attendedBy TEXT NOT NULL,
          notes TEXT,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
          isFreeSession INTEGER NOT NULL DEFAULT 0,
          memberId TEXT,
          collectedInExpenseId TEXT
        );
        CREATE INDEX IF NOT EXISTS MoreSession_moreNumber_idx ON MoreSession(moreNumber);
        CREATE INDEX IF NOT EXISTS MoreSession_sessionDate_idx ON MoreSession(sessionDate);
        CREATE INDEX IF NOT EXISTS MoreSession_attended_idx ON MoreSession(attended);
        CREATE INDEX IF NOT EXISTS MoreSession_memberId_idx ON MoreSession(memberId);
        CREATE INDEX IF NOT EXISTS MoreSession_isFreeSession_idx ON MoreSession(isFreeSession);
      `);
    } else {
    }

    // MemberCheckIn — سجل دخول الأعضاء
    if (!tableExists(db, 'MemberCheckIn')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS MemberCheckIn (
          id TEXT PRIMARY KEY,
          memberId TEXT NOT NULL,
          checkInTime DATETIME NOT NULL DEFAULT (datetime('now')),
          checkInMethod TEXT NOT NULL DEFAULT 'scan'
        );
        CREATE INDEX IF NOT EXISTS MemberCheckIn_memberId_idx ON MemberCheckIn(memberId);
        CREATE INDEX IF NOT EXISTS MemberCheckIn_checkInTime_idx ON MemberCheckIn(checkInTime);
      `);
    } else {
    }

    // ClassBooking — حجوزات كلاسات اليوم
    if (!tableExists(db, 'ClassBooking')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ClassBooking (
          id TEXT PRIMARY KEY,
          memberId TEXT NOT NULL,
          classScheduleId TEXT NOT NULL,
          bookingDate DATETIME NOT NULL DEFAULT (datetime('now')),
          createdAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS ClassBooking_memberId_idx ON ClassBooking(memberId);
        CREATE INDEX IF NOT EXISTS ClassBooking_bookingDate_idx ON ClassBooking(bookingDate);
        CREATE INDEX IF NOT EXISTS ClassBooking_classScheduleId_idx ON ClassBooking(classScheduleId);
        CREATE UNIQUE INDEX IF NOT EXISTS ClassBooking_unique_idx ON ClassBooking(memberId, classScheduleId, bookingDate);
      `);
    } else {
    }

    // AuditLog — سجل المراجعة
    if (!tableExists(db, 'AuditLog')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS AuditLog (
          id TEXT PRIMARY KEY,
          userId TEXT,
          userEmail TEXT,
          userName TEXT,
          userRole TEXT,
          action TEXT NOT NULL,
          resource TEXT NOT NULL,
          resourceId TEXT,
          details TEXT,
          ipAddress TEXT,
          userAgent TEXT,
          status TEXT NOT NULL DEFAULT 'success',
          errorMessage TEXT,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS AuditLog_userId_idx ON AuditLog(userId);
        CREATE INDEX IF NOT EXISTS AuditLog_action_idx ON AuditLog(action);
        CREATE INDEX IF NOT EXISTS AuditLog_resource_idx ON AuditLog(resource);
        CREATE INDEX IF NOT EXISTS AuditLog_status_idx ON AuditLog(status);
        CREATE INDEX IF NOT EXISTS AuditLog_createdAt_idx ON AuditLog(createdAt);
      `);
    } else {
    }

    // ActiveSession — الجلسات النشطة
    if (!tableExists(db, 'ActiveSession')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ActiveSession (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          userEmail TEXT NOT NULL,
          userName TEXT NOT NULL,
          userRole TEXT NOT NULL,
          loginAt DATETIME NOT NULL DEFAULT (datetime('now')),
          lastActivityAt DATETIME NOT NULL DEFAULT (datetime('now')),
          ipAddress TEXT,
          userAgent TEXT,
          isActive INTEGER NOT NULL DEFAULT 1
        );
        CREATE INDEX IF NOT EXISTS ActiveSession_userId_idx ON ActiveSession(userId);
        CREATE INDEX IF NOT EXISTS ActiveSession_isActive_idx ON ActiveSession(isActive);
        CREATE INDEX IF NOT EXISTS ActiveSession_loginAt_idx ON ActiveSession(loginAt);
        CREATE INDEX IF NOT EXISTS ActiveSession_lastActivityAt_idx ON ActiveSession(lastActivityAt);
      `);
    } else {
    }

    // ErrorLog — سجل الأخطاء
    if (!tableExists(db, 'ErrorLog')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ErrorLog (
          id TEXT PRIMARY KEY,
          errorType TEXT NOT NULL,
          errorCategory TEXT,
          severity TEXT NOT NULL DEFAULT 'MEDIUM',
          message TEXT NOT NULL,
          sanitizedMessage TEXT,
          errorCode TEXT,
          stackTrace TEXT,
          endpoint TEXT,
          httpMethod TEXT,
          statusCode INTEGER,
          userId TEXT,
          userEmail TEXT,
          userName TEXT,
          userRole TEXT,
          staffId TEXT,
          requestBody TEXT,
          requestHeaders TEXT,
          ipAddress TEXT,
          userAgent TEXT,
          additionalContext TEXT,
          browserInfo TEXT,
          environment TEXT NOT NULL DEFAULT 'production',
          appVersion TEXT,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
          resolvedAt DATETIME,
          isResolved INTEGER NOT NULL DEFAULT 0,
          syncedToSupabase INTEGER NOT NULL DEFAULT 0,
          supabaseId TEXT,
          syncAttempts INTEGER NOT NULL DEFAULT 0,
          lastSyncAttempt DATETIME
        );
        CREATE INDEX IF NOT EXISTS ErrorLog_errorType_idx ON ErrorLog(errorType);
        CREATE INDEX IF NOT EXISTS ErrorLog_severity_idx ON ErrorLog(severity);
        CREATE INDEX IF NOT EXISTS ErrorLog_createdAt_idx ON ErrorLog(createdAt);
        CREATE INDEX IF NOT EXISTS ErrorLog_endpoint_idx ON ErrorLog(endpoint);
        CREATE INDEX IF NOT EXISTS ErrorLog_userId_idx ON ErrorLog(userId);
        CREATE INDEX IF NOT EXISTS ErrorLog_isResolved_idx ON ErrorLog(isResolved);
      `);
    } else {
    }

    // LicenseValidation
    if (!tableExists(db, 'LicenseValidation')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS LicenseValidation (
          id TEXT PRIMARY KEY DEFAULT 'singleton',
          isValid INTEGER NOT NULL DEFAULT 1,
          lastCheckedAt DATETIME NOT NULL DEFAULT (datetime('now')),
          errorMessage TEXT,
          signature TEXT
        );
      `);
    } else {
    }

    // ClassSchedule — إن لم تكن موجودة
    if (!tableExists(db, 'ClassSchedule')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ClassSchedule (
          id TEXT PRIMARY KEY,
          dayOfWeek INTEGER NOT NULL,
          startTime TEXT NOT NULL,
          className TEXT NOT NULL,
          coachName TEXT NOT NULL,
          duration INTEGER NOT NULL DEFAULT 60,
          isActive INTEGER NOT NULL DEFAULT 1,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS ClassSchedule_dayOfWeek_idx ON ClassSchedule(dayOfWeek);
        CREATE INDEX IF NOT EXISTS ClassSchedule_isActive_idx ON ClassSchedule(isActive);
      `);
    } else {
    }

    db.close();
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }
}

/**
 * Main function
 */
function main() {
  try {
    // تحديد مسار قاعدة البيانات
    const possiblePaths = [
      // في Production (exe)
      path.join(process.resourcesPath, 'app', 'prisma', 'gym.db'),
      // في Development
      path.join(process.cwd(), 'prisma', 'gym.db'),
      // مسار بديل
      path.join(__dirname, '..', 'prisma', 'gym.db')
    ];

    let dbPath = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        dbPath = testPath;
        break;
      }
    }

    if (dbPath) {
      migrateDatabase(dbPath);
    } else {
    }
  } catch (error) {
    console.error('❌ Migration script error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { migrateDatabase };
