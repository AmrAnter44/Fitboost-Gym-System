// check-and-migrate.js
// Script to automatically update database schema on app startup
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// 📝 لوج خاص بإصلاح memberNumber في ملف منفصل (مش بس console)
function getRepairLogPath() {
  try {
    const { app } = require('electron');
    const dir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'membernumber-repair.log');
  } catch {
    return path.join(process.cwd(), 'membernumber-repair.log');
  }
}

function repairLog(level, msg) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
  try {
    fs.appendFileSync(getRepairLogPath(), line);
  } catch {}
  if (level === 'ERROR') console.error(`❌ ${msg}`);
  else if (level === 'WARN') console.warn(`⚠️ ${msg}`);
  else console.log(`${msg}`);
}

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
 * يقرأ نوع العمود المُعلن في الجدول (مثل INTEGER, TEXT, REAL).
 */
function getColumnType(db, tableName, columnName) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const col = cols.find(c => c.name === columnName);
    return col ? (col.type || '').toUpperCase().trim() : null;
  } catch {
    return null;
  }
}

/**
 * 📦 backup للـ DB قبل الـ rebuild — مرة واحدة بس قبل أول جدول.
 */
let _preMigrationBackupCreated = false;
function createPreMigrationBackup(dbPath) {
  if (_preMigrationBackupCreated) return;
  _preMigrationBackupCreated = true;

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const backupPath = `${dbPath}.pre-membernumber-fix.${timestamp}`;
    fs.copyFileSync(dbPath, backupPath);
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    if (fs.existsSync(walPath)) fs.copyFileSync(walPath, backupPath + '-wal');
    if (fs.existsSync(shmPath)) fs.copyFileSync(shmPath, backupPath + '-shm');
    const sizeMB = (fs.statSync(backupPath).size / 1024 / 1024).toFixed(2);
    repairLog('INFO', `💾 Backup created: ${path.basename(backupPath)} (${sizeMB} MB)`);
  } catch (err) {
    repairLog('WARN', `Backup failed (continuing anyway): ${err.message}`);
  }
}

/**
 * 🔧 يحوّل نوع memberNumber من INTEGER إلى TEXT لجدول معيّن.
 *
 * المشكلة: أول migration كان `"memberNumber" INTEGER`. الـ schema الحالي
 * بقى `String?` لكن مفيش migration حوّل النوع. الـ Prisma client بيرفض
 * يقرا قيمة integer من حقل المتوقع يكون string ويرمي P2032.
 *
 * الحل: نعمل rebuild كامل للجدول — create new → copy data with CAST →
 * drop old → rename new. ده الطريقة الآمنة في SQLite (writable_schema
 * بيتحجب في defensive mode لـ better-sqlite3).
 *
 * Returns: { skipped: bool, success: bool, error?: string }
 */
function ensureMemberNumberIsText(db, tableName, dbPath) {
  if (!tableExists(db, tableName)) return { skipped: true };

  const type = getColumnType(db, tableName, 'memberNumber');
  if (!type) return { skipped: true };

  const numericTypes = new Set([
    'INTEGER', 'INT', 'BIGINT', 'TINYINT', 'SMALLINT',
    'MEDIUMINT', 'INT2', 'INT8', 'UNSIGNED BIG INT',
    'NUMERIC', 'REAL', 'DOUBLE', 'FLOAT', 'DECIMAL'
  ]);

  if (!numericTypes.has(type)) {
    return { skipped: true };
  }

  repairLog('INFO', `🔧 [${tableName}] memberNumber type = ${type}. Rebuilding table as TEXT...`);

  // 📦 backup قبل أي تعديل (مرة واحدة فقط للـ DB كلها)
  if (dbPath) createPreMigrationBackup(dbPath);

  try {
    // 1) قراءة الـ CREATE TABLE الأصلي
    const origRow = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?"
    ).get(tableName);
    if (!origRow || !origRow.sql) {
      repairLog('WARN', `[${tableName}] لم يتم العثور على CREATE TABLE في sqlite_master`);
      return { skipped: true };
    }

    // 2) قراءة كل الأعمدة الفعلية
    const cols = db.prepare(`PRAGMA table_info("${tableName}")`).all();
    if (cols.length === 0) {
      repairLog('WARN', `[${tableName}] الجدول فاضي من الأعمدة`);
      return { skipped: true };
    }

    // 3) قراءة كل الـ indexes غير الـ auto المرتبطة بالجدول
    const indexes = db.prepare(
      "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL"
    ).all(tableName);

    // 4) بناء CREATE TABLE الجديد: نفس الـ SQL بس باسم مؤقت + memberNumber TEXT
    const tempName = `${tableName}__migrating_text`;
    const escapedTable = tableName.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');

    let newSql = origRow.sql.replace(
      new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?["\`]?${escapedTable}["\`]?`, 'i'),
      `CREATE TABLE "${tempName}"`
    );

    newSql = newSql.replace(
      /(["`]?memberNumber["`]?)\s+(INTEGER|INT|BIGINT|TINYINT|SMALLINT|MEDIUMINT|INT2|INT8|UNSIGNED BIG INT|NUMERIC|REAL|DOUBLE|FLOAT|DECIMAL)\b/i,
      '$1 TEXT'
    );

    if (!newSql.includes(`"${tempName}"`) || !/memberNumber["`]?\s+TEXT/i.test(newSql)) {
      repairLog('WARN', `[${tableName}] فشل بناء CREATE TABLE الجديد`);
      repairLog('WARN', `Original SQL: ${origRow.sql.slice(0, 300)}`);
      return { skipped: true };
    }

    // 5) أعمدة المصدر مع CAST على memberNumber
    const colsCsv = cols.map(c => `"${c.name}"`).join(', ');
    const selectCsv = cols.map(c =>
      c.name === 'memberNumber'
        ? 'CAST("memberNumber" AS TEXT)'
        : `"${c.name}"`
    ).join(', ');

    const rowCountBefore = db.prepare(`SELECT COUNT(*) as n FROM "${tableName}"`).get().n;
    repairLog('INFO', `[${tableName}] rebuilding ${rowCountBefore} rows...`);

    // 6) FK off → rebuild → FK on
    // pragma بتاع foreign_keys مينفعش جوّه transaction، فلازم نظبّطها برّه
    db.pragma('foreign_keys = OFF');

    try {
      db.exec(`DROP TABLE IF EXISTS "${tempName}"`);
      db.exec('BEGIN');

      db.exec(newSql);
      db.exec(`INSERT INTO "${tempName}" (${colsCsv}) SELECT ${selectCsv} FROM "${tableName}"`);

      const rowCountNew = db.prepare(`SELECT COUNT(*) as n FROM "${tempName}"`).get().n;
      if (rowCountNew !== rowCountBefore) {
        throw new Error(`Row count mismatch: original=${rowCountBefore}, new=${rowCountNew}`);
      }

      db.exec(`DROP TABLE "${tableName}"`);
      db.exec(`ALTER TABLE "${tempName}" RENAME TO "${tableName}"`);

      // إعادة إنشاء الـ indexes (الـ DROP TABLE بيمسحها)
      for (const idx of indexes) {
        try {
          db.exec(idx.sql);
        } catch (idxErr) {
          repairLog('WARN', `[${tableName}] فشل إعادة إنشاء index ${idx.name}: ${idxErr.message}`);
        }
      }

      db.exec('COMMIT');

      // ✅ التحقق بعد الـ commit:
      const newType = getColumnType(db, tableName, 'memberNumber');
      const rowCountAfter = db.prepare(`SELECT COUNT(*) as n FROM "${tableName}"`).get().n;

      if (newType !== 'TEXT' || rowCountAfter !== rowCountBefore) {
        throw new Error(`Verification failed: type=${newType}, rows=${rowCountAfter} (expected TEXT, ${rowCountBefore})`);
      }

      repairLog('INFO', `✅ [${tableName}] rebuilt successfully — ${rowCountAfter} rows, memberNumber=TEXT`);
      return { success: true, rows: rowCountAfter };
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch {}
      try { db.exec(`DROP TABLE IF EXISTS "${tempName}"`); } catch {}
      throw err;
    } finally {
      try { db.pragma('foreign_keys = ON'); } catch {}
    }
  } catch (err) {
    repairLog('ERROR', `[${tableName}] فشل تحويل memberNumber: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * 🚨 الدالة الرئيسية للإصلاح اليدوي / التلقائي.
 * تشتغل عبر كل الجداول المتأثرة وترجّع تقرير كامل.
 * بتُستخدم من main.js أوتوماتيكياً، ومن endpoint الـ admin يدوياً.
 */
function runMemberNumberRepair(dbPathOrDb) {
  // Accept إما dbPath أو db instance قائم بالفعل
  let db, dbPath, ownsDb = false;
  if (typeof dbPathOrDb === 'string') {
    dbPath = dbPathOrDb;
    db = new Database(dbPath);
    ownsDb = true;
  } else {
    db = dbPathOrDb;
    dbPath = db.name;
  }

  repairLog('INFO', '═══ memberNumber repair started ═══');
  const report = { tables: {}, integrityCheck: null };

  try {
    const targetTables = ['Member', 'Invitation', 'Nutrition', 'Physiotherapy', 'GroupClass'];
    for (const t of targetTables) {
      report.tables[t] = ensureMemberNumberIsText(db, t, dbPath);
    }

    // ✅ integrity check بعد الكل
    try {
      const result = db.prepare('PRAGMA integrity_check').all();
      const integrityOk = result.length === 1 && result[0].integrity_check === 'ok';
      report.integrityCheck = integrityOk ? 'ok' : JSON.stringify(result);
      if (integrityOk) repairLog('INFO', '✅ PRAGMA integrity_check passed');
      else repairLog('WARN', `integrity_check returned: ${report.integrityCheck}`);
    } catch (intErr) {
      report.integrityCheck = 'failed-to-run';
      repairLog('WARN', `integrity_check failed to run: ${intErr.message}`);
    }
  } finally {
    if (ownsDb) {
      try { db.close(); } catch {}
    }
  }

  repairLog('INFO', '═══ memberNumber repair finished ═══');
  return report;
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

    // 🚨 إصلاح حرج: تحويل memberNumber من INTEGER → TEXT في كل الجداول
    // الـ DBs القديمة فيها العمود ده كـ INTEGER بسبب أول init migration،
    // والـ Prisma client الحالي بيتوقعه String → بيرمي P2032 وبيوقع API الأعضاء/الدعوات.
    // لازم يتم القبل أي شيء تاني عشان باقي queries تشتغل.
    // ⚡ بنستدعي runMemberNumberRepair عشان نستفيد من backup + integrity check + logging.
    runMemberNumberRepair(db);

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

    // ✅ User.profileImage — صورة بروفايل الموظف (self-service)
    if (!columnExists(db, 'User', 'profileImage')) {
      db.prepare('ALTER TABLE User ADD COLUMN profileImage TEXT').run();
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

    // 🕐 Member.allowedCheckInStart/End — ساعات الدخول المسموح بها
    if (!columnExists(db, 'Member', 'allowedCheckInStart')) {
      db.prepare('ALTER TABLE Member ADD COLUMN allowedCheckInStart TEXT').run();
    }
    if (!columnExists(db, 'Member', 'allowedCheckInEnd')) {
      db.prepare('ALTER TABLE Member ADD COLUMN allowedCheckInEnd TEXT').run();
    }

    // 🕐 Offer.allowedCheckInStart/End — ساعات الدخول المسموح بها (template للعرض)
    if (tableExists(db, 'Offer') && !columnExists(db, 'Offer', 'allowedCheckInStart')) {
      db.prepare('ALTER TABLE Offer ADD COLUMN allowedCheckInStart TEXT').run();
    }
    if (tableExists(db, 'Offer') && !columnExists(db, 'Offer', 'allowedCheckInEnd')) {
      db.prepare('ALTER TABLE Offer ADD COLUMN allowedCheckInEnd TEXT').run();
    }

    // ✅ DayUseInBody.salesStaffId — ربط عملية الـ Day Use بموظف سيلز
    if (!columnExists(db, 'DayUseInBody', 'salesStaffId')) {
      db.prepare('ALTER TABLE DayUseInBody ADD COLUMN salesStaffId TEXT').run();
    }

    // ✅ DayUseInBody.memberId — ربط يوم الاستخدام بعضو موجود
    if (tableExists(db, 'DayUseInBody') && !columnExists(db, 'DayUseInBody', 'memberId')) {
      db.prepare('ALTER TABLE DayUseInBody ADD COLUMN memberId TEXT').run();
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

    // ✅ PT permissions في جدول Permission (canViewAllPT للفتنس مانجر)
    const ptPermissions = [
      'canViewAllPT',
      'canAccessPTCommission'
    ];
    for (const permission of ptPermissions) {
      if (!columnExists(db, 'Permission', permission)) {
        db.prepare(`ALTER TABLE Permission ADD COLUMN ${permission} INTEGER NOT NULL DEFAULT 0`).run();
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
      { col: 'remainingCheckIns',       def: 'INTEGER' },  //  nullable = دخول غير محدود
      { col: 'transferredFromMemberId', def: 'TEXT' },     //  📤 نقل العضوية: العضو اللي نقل للعضو ده
      { col: 'transferredFromAt',       def: 'DATETIME' },
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
      { col: 'primaryTextColor',           def: 'TEXT' },
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
      { col: 'salesDailyCallTarget',       def: 'INTEGER NOT NULL DEFAULT 30' },
      { col: 'updatedBy',                  def: 'TEXT' },
      // ☁️ أعمدة النسخ الاحتياطي السحابي (إصدار 6.10.0) — غيابها كان بيفشّل أي قراءة للإعدادات (إضافة عضو/PT)
      { col: 'cloudBackupEnabled',         def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'lastCloudBackupAt',          def: 'DATETIME' },
      { col: 'lastCloudBackupError',       def: 'TEXT' },
      { col: 'lastCloudBackupSize',        def: 'INTEGER' },
      // 💼 إعدادات الرواتب — أيام العمل الشهرية الافتراضية 30 يوم
      { col: 'payrollWorkingDaysPerMonth', def: 'INTEGER NOT NULL DEFAULT 30' },
      { col: 'payrollLateGraceMinutes',    def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'payrollMonthEndDay',         def: 'INTEGER NOT NULL DEFAULT 1' },
      { col: 'payrollSuggestedLatePerMinute', def: 'REAL DEFAULT 0' },
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
      { col: 'refundMethod',    def: 'TEXT' },
    ];
    for (const { col, def } of receiptCols) {
      if (!columnExists(db, 'Receipt', col)) {
        db.prepare(`ALTER TABLE Receipt ADD COLUMN ${col} ${def}`).run();
      } else {
      }
    }

    // ✅ ClassSchedule — أعمدة مواعيد الكلاسات (gender كان بيكسر عرض/إضافة المواعيد)
    if (tableExists(db, 'ClassSchedule')) {
      const classScheduleCols = [
        { col: 'gender',   def: "TEXT NOT NULL DEFAULT 'mixed'" },
        { col: 'duration', def: 'INTEGER NOT NULL DEFAULT 60' },
      ];
      for (const { col, def } of classScheduleCols) {
        if (!columnExists(db, 'ClassSchedule', col)) {
          db.prepare(`ALTER TABLE ClassSchedule ADD COLUMN ${col} ${def}`).run();
        }
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
      { col: 'minPrice',                def: 'REAL' },  // 💰 الحد الأدنى لسعر الاشتراك بعد الخصم
      { col: 'maxCheckIns',             def: 'INTEGER NOT NULL DEFAULT 0' },  //  عدد حصص الدخول (0 = غير محدود)
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
          isBack INTEGER NOT NULL DEFAULT 0,
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
      //  عمود الباك فريز للقواعد الموجودة
      if (!columnExists(db, 'FreezeRequest', 'isBack')) {
        db.prepare("ALTER TABLE FreezeRequest ADD COLUMN isBack INTEGER NOT NULL DEFAULT 0").run();
      }
    }

    // LostAndFound — المتعلقات المفقودة
    if (!tableExists(db, 'LostAndFound')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS LostAndFound (
          id TEXT PRIMARY KEY,
          itemName TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'A',
          location TEXT,
          foundByType TEXT NOT NULL DEFAULT 'staff',
          foundByName TEXT,
          status TEXT NOT NULL DEFAULT 'stored',
          claimedBy TEXT,
          notes TEXT,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS LostAndFound_category_idx ON LostAndFound(category);
        CREATE INDEX IF NOT EXISTS LostAndFound_status_idx ON LostAndFound(status);
        CREATE INDEX IF NOT EXISTS LostAndFound_createdAt_idx ON LostAndFound(createdAt);
      `);
    } else {
    }

    // Task + TaskAssignment — المهام (To-Do)
    if (!tableExists(db, 'Task')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS Task (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          dueDate DATETIME,
          priority TEXT NOT NULL DEFAULT 'normal',
          createdBy TEXT NOT NULL,
          createdByName TEXT NOT NULL,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS Task_createdBy_idx ON Task(createdBy);
        CREATE INDEX IF NOT EXISTS Task_dueDate_idx ON Task(dueDate);
        CREATE INDEX IF NOT EXISTS Task_createdAt_idx ON Task(createdAt);
      `);
    }
    if (!tableExists(db, 'TaskAssignment')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS TaskAssignment (
          id TEXT PRIMARY KEY,
          taskId TEXT NOT NULL,
          userId TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          completedAt DATETIME,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS TaskAssignment_userId_status_idx ON TaskAssignment(userId, status);
        CREATE INDEX IF NOT EXISTS TaskAssignment_taskId_idx ON TaskAssignment(taskId);
      `);
    }

    // MaintenanceRecord — صيانة الأجهزة
    if (!tableExists(db, 'MaintenanceRecord')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS MaintenanceRecord (
          id TEXT PRIMARY KEY,
          deviceName TEXT NOT NULL,
          issue TEXT NOT NULL,
          cost REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'fixed',
          fixedAt DATETIME,
          notes TEXT,
          createdBy TEXT,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS MaintenanceRecord_deviceName_idx ON MaintenanceRecord(deviceName);
        CREATE INDEX IF NOT EXISTS MaintenanceRecord_status_idx ON MaintenanceRecord(status);
        CREATE INDEX IF NOT EXISTS MaintenanceRecord_createdAt_idx ON MaintenanceRecord(createdAt);
      `);
    }

    // Complaint — قسم الشكاوى
    if (!tableExists(db, 'Complaint')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS Complaint (
          id TEXT PRIMARY KEY,
          memberId TEXT NOT NULL,
          memberName TEXT NOT NULL,
          memberNumber TEXT,
          memberPhone TEXT,
          subject TEXT,
          body TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'open',
          priority TEXT NOT NULL DEFAULT 'normal',
          resolution TEXT,
          source TEXT NOT NULL DEFAULT 'staff',
          createdBy TEXT,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS Complaint_memberId_idx ON Complaint(memberId);
        CREATE INDEX IF NOT EXISTS Complaint_status_idx ON Complaint(status);
        CREATE INDEX IF NOT EXISTS Complaint_createdAt_idx ON Complaint(createdAt);
      `);
    }

    // ✅ Complaint — عمود source (staff | app) عشان نفرّق الشكاوى الجاية من تطبيق الأعضاء
    if (tableExists(db, 'Complaint') && !columnExists(db, 'Complaint', 'source')) {
      db.prepare(`ALTER TABLE Complaint ADD COLUMN source TEXT NOT NULL DEFAULT 'staff'`).run();
    }

    // InternalMessage + InternalMessageRecipient — الإيميل الداخلي
    if (!tableExists(db, 'InternalMessage')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS InternalMessage (
          id TEXT PRIMARY KEY,
          senderId TEXT NOT NULL,
          senderName TEXT NOT NULL,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          targetDepts TEXT NOT NULL,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS InternalMessage_senderId_idx ON InternalMessage(senderId);
        CREATE INDEX IF NOT EXISTS InternalMessage_createdAt_idx ON InternalMessage(createdAt);
      `);
    }
    if (!tableExists(db, 'InternalMessageRecipient')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS InternalMessageRecipient (
          id TEXT PRIMARY KEY,
          messageId TEXT NOT NULL,
          userId TEXT NOT NULL,
          isRead INTEGER NOT NULL DEFAULT 0,
          readAt DATETIME,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS InternalMessageRecipient_userId_isRead_idx ON InternalMessageRecipient(userId, isRead);
        CREATE INDEX IF NOT EXISTS InternalMessageRecipient_messageId_idx ON InternalMessageRecipient(messageId);
      `);
    }
    if (!tableExists(db, 'InternalMessageReply')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS InternalMessageReply (
          id TEXT PRIMARY KEY,
          messageId TEXT NOT NULL,
          userId TEXT NOT NULL,
          userName TEXT NOT NULL,
          body TEXT NOT NULL,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS InternalMessageReply_messageId_idx ON InternalMessageReply(messageId);
      `);
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
          isResolved INTEGER NOT NULL DEFAULT 0
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

    // ✅ SupabaseLicense — رخصة الجيم من Supabase
    if (!tableExists(db, 'SupabaseLicense')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS SupabaseLicense (
          id TEXT PRIMARY KEY,
          gymId TEXT NOT NULL,
          gymName TEXT NOT NULL,
          branchId TEXT NOT NULL,
          branchName TEXT NOT NULL,
          systemLicense TEXT NOT NULL,
          licenseMessage TEXT,
          offlineModeEnabled INTEGER NOT NULL DEFAULT 0,
          lastChecked DATETIME NOT NULL DEFAULT (datetime('now')),
          createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS SupabaseLicense_branchId_idx ON SupabaseLicense(branchId);
      `);
    } else {
      // ✅ SupabaseLicense.offlineModeEnabled — flag وضع الأوفلاين
      if (!columnExists(db, 'SupabaseLicense', 'offlineModeEnabled')) {
        db.prepare('ALTER TABLE SupabaseLicense ADD COLUMN offlineModeEnabled INTEGER NOT NULL DEFAULT 0').run();
      }
    }

    // ✅ WebsiteLeadImport — تتبع الـ leads المستوردة من ويبسايت الجيم
    if (!tableExists(db, 'WebsiteLeadImport')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS WebsiteLeadImport (
          id         TEXT PRIMARY KEY,
          remoteId   TEXT NOT NULL UNIQUE,
          visitorId  TEXT,
          importedAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS WebsiteLeadImport_remoteId_idx ON WebsiteLeadImport(remoteId);
      `);
    }

    // ✅ SyncQueueItem — قائمة الانتظار لمزامنة الإيصالات والمصاريف مع Supabase
    if (!tableExists(db, 'SyncQueueItem')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS SyncQueueItem (
          id TEXT PRIMARY KEY,
          resource TEXT NOT NULL,
          operation TEXT NOT NULL,
          resourceId TEXT NOT NULL,
          payload TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          lastError TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
          sentAt DATETIME
        );
        CREATE INDEX IF NOT EXISTS SyncQueueItem_status_idx ON SyncQueueItem(status);
        CREATE INDEX IF NOT EXISTS SyncQueueItem_resource_idx ON SyncQueueItem(resource);
        CREATE INDEX IF NOT EXISTS SyncQueueItem_createdAt_idx ON SyncQueueItem(createdAt);
      `);
    } else {
    }

    // ✅ Nutrition — التغذية
    if (!tableExists(db, 'Nutrition')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS Nutrition (
          nutritionNumber   INTEGER PRIMARY KEY AUTOINCREMENT,
          clientName        TEXT NOT NULL,
          phone             TEXT NOT NULL,
          memberNumber      TEXT,
          sessionsPurchased INTEGER NOT NULL,
          sessionsRemaining INTEGER NOT NULL,
          nutritionistName  TEXT NOT NULL,
          pricePerSession   REAL NOT NULL,
          startDate         DATETIME,
          expiryDate        DATETIME,
          createdAt         DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt         DATETIME NOT NULL DEFAULT (datetime('now')),
          coachUserId       TEXT,
          qrCode            TEXT UNIQUE,
          qrCodeImage       TEXT,
          remainingAmount   INTEGER
        );
        CREATE INDEX IF NOT EXISTS Nutrition_coachUserId_idx ON Nutrition(coachUserId);
        CREATE INDEX IF NOT EXISTS Nutrition_qrCode_idx ON Nutrition(qrCode);
        CREATE INDEX IF NOT EXISTS Nutrition_memberNumber_idx ON Nutrition(memberNumber);
      `);
    }

    // ✅ NutritionSession — جلسات التغذية
    if (!tableExists(db, 'NutritionSession')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS NutritionSession (
          id                   TEXT PRIMARY KEY,
          nutritionNumber      INTEGER,
          clientName           TEXT NOT NULL,
          nutritionistName     TEXT NOT NULL,
          sessionDate          DATETIME NOT NULL,
          notes                TEXT,
          createdAt            DATETIME NOT NULL DEFAULT (datetime('now')),
          attended             INTEGER NOT NULL DEFAULT 0,
          attendedAt           DATETIME,
          attendedBy           TEXT,
          isFreeSession        INTEGER NOT NULL DEFAULT 0,
          memberId             TEXT,
          collectedInExpenseId TEXT
        );
        CREATE INDEX IF NOT EXISTS NutritionSession_nutritionNumber_idx ON NutritionSession(nutritionNumber);
        CREATE INDEX IF NOT EXISTS NutritionSession_sessionDate_idx ON NutritionSession(sessionDate);
        CREATE INDEX IF NOT EXISTS NutritionSession_attended_idx ON NutritionSession(attended);
        CREATE INDEX IF NOT EXISTS NutritionSession_memberId_idx ON NutritionSession(memberId);
        CREATE INDEX IF NOT EXISTS NutritionSession_isFreeSession_idx ON NutritionSession(isFreeSession);
        CREATE INDEX IF NOT EXISTS NutritionSession_collectedInExpenseId_idx ON NutritionSession(collectedInExpenseId);
      `);
    }

    // ✅ Physiotherapy — العلاج الطبيعي
    if (!tableExists(db, 'Physiotherapy')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS Physiotherapy (
          physioNumber      INTEGER PRIMARY KEY AUTOINCREMENT,
          clientName        TEXT NOT NULL,
          phone             TEXT NOT NULL,
          memberNumber      TEXT,
          sessionsPurchased INTEGER NOT NULL,
          sessionsRemaining INTEGER NOT NULL,
          therapistName     TEXT NOT NULL,
          pricePerSession   REAL NOT NULL,
          startDate         DATETIME,
          expiryDate        DATETIME,
          createdAt         DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt         DATETIME NOT NULL DEFAULT (datetime('now')),
          therapistUserId   TEXT,
          qrCode            TEXT UNIQUE,
          qrCodeImage       TEXT,
          remainingAmount   INTEGER
        );
        CREATE INDEX IF NOT EXISTS Physiotherapy_therapistUserId_idx ON Physiotherapy(therapistUserId);
        CREATE INDEX IF NOT EXISTS Physiotherapy_qrCode_idx ON Physiotherapy(qrCode);
        CREATE INDEX IF NOT EXISTS Physiotherapy_memberNumber_idx ON Physiotherapy(memberNumber);
      `);
    }

    // ✅ PhysiotherapySession — جلسات العلاج الطبيعي
    if (!tableExists(db, 'PhysiotherapySession')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS PhysiotherapySession (
          id                   TEXT PRIMARY KEY,
          physioNumber         INTEGER,
          clientName           TEXT NOT NULL,
          therapistName        TEXT NOT NULL,
          sessionDate          DATETIME NOT NULL,
          notes                TEXT,
          createdAt            DATETIME NOT NULL DEFAULT (datetime('now')),
          attended             INTEGER NOT NULL DEFAULT 0,
          attendedAt           DATETIME,
          attendedBy           TEXT,
          isFreeSession        INTEGER NOT NULL DEFAULT 0,
          memberId             TEXT,
          collectedInExpenseId TEXT
        );
        CREATE INDEX IF NOT EXISTS PhysiotherapySession_physioNumber_idx ON PhysiotherapySession(physioNumber);
        CREATE INDEX IF NOT EXISTS PhysiotherapySession_sessionDate_idx ON PhysiotherapySession(sessionDate);
        CREATE INDEX IF NOT EXISTS PhysiotherapySession_attended_idx ON PhysiotherapySession(attended);
        CREATE INDEX IF NOT EXISTS PhysiotherapySession_memberId_idx ON PhysiotherapySession(memberId);
        CREATE INDEX IF NOT EXISTS PhysiotherapySession_isFreeSession_idx ON PhysiotherapySession(isFreeSession);
        CREATE INDEX IF NOT EXISTS PhysiotherapySession_collectedInExpenseId_idx ON PhysiotherapySession(collectedInExpenseId);
      `);
    }

    // ✅ GroupClass — جروب كلاسيس
    if (!tableExists(db, 'GroupClass')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS GroupClass (
          classNumber       INTEGER PRIMARY KEY AUTOINCREMENT,
          clientName        TEXT NOT NULL,
          phone             TEXT NOT NULL,
          memberNumber      TEXT,
          sessionsPurchased INTEGER NOT NULL,
          sessionsRemaining INTEGER NOT NULL,
          instructorName    TEXT NOT NULL,
          pricePerSession   REAL NOT NULL,
          startDate         DATETIME,
          expiryDate        DATETIME,
          createdAt         DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt         DATETIME NOT NULL DEFAULT (datetime('now')),
          instructorUserId  TEXT,
          qrCode            TEXT UNIQUE,
          qrCodeImage       TEXT,
          remainingAmount   INTEGER
        );
        CREATE INDEX IF NOT EXISTS GroupClass_instructorUserId_idx ON GroupClass(instructorUserId);
        CREATE INDEX IF NOT EXISTS GroupClass_qrCode_idx ON GroupClass(qrCode);
        CREATE INDEX IF NOT EXISTS GroupClass_memberNumber_idx ON GroupClass(memberNumber);
      `);
    }

    // ✅ GroupClassSession — جلسات الكلاس الجماعي
    if (!tableExists(db, 'GroupClassSession')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS GroupClassSession (
          id                   TEXT PRIMARY KEY,
          classNumber          INTEGER NOT NULL,
          clientName           TEXT NOT NULL,
          instructorName       TEXT NOT NULL,
          sessionDate          DATETIME NOT NULL,
          notes                TEXT,
          createdAt            DATETIME NOT NULL DEFAULT (datetime('now')),
          attended             INTEGER NOT NULL DEFAULT 0,
          attendedAt           DATETIME,
          attendedBy           TEXT,
          isFreeSession        INTEGER NOT NULL DEFAULT 0,
          memberId             TEXT,
          collectedInExpenseId TEXT
        );
        CREATE INDEX IF NOT EXISTS GroupClassSession_classNumber_idx ON GroupClassSession(classNumber);
        CREATE INDEX IF NOT EXISTS GroupClassSession_sessionDate_idx ON GroupClassSession(sessionDate);
        CREATE INDEX IF NOT EXISTS GroupClassSession_attended_idx ON GroupClassSession(attended);
        CREATE INDEX IF NOT EXISTS GroupClassSession_memberId_idx ON GroupClassSession(memberId);
        CREATE INDEX IF NOT EXISTS GroupClassSession_isFreeSession_idx ON GroupClassSession(isFreeSession);
        CREATE INDEX IF NOT EXISTS GroupClassSession_collectedInExpenseId_idx ON GroupClassSession(collectedInExpenseId);
      `);
    }

    // ✅ CommissionSettings — إعدادات العمولة
    if (!tableExists(db, 'CommissionSettings')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS CommissionSettings (
          id          TEXT PRIMARY KEY,
          tier1Limit  REAL NOT NULL DEFAULT 5000,
          tier2Limit  REAL NOT NULL DEFAULT 11000,
          tier3Limit  REAL NOT NULL DEFAULT 15000,
          tier4Limit  REAL NOT NULL DEFAULT 20000,
          tier1Rate   REAL NOT NULL DEFAULT 25,
          tier2Rate   REAL NOT NULL DEFAULT 30,
          tier3Rate   REAL NOT NULL DEFAULT 35,
          tier4Rate   REAL NOT NULL DEFAULT 40,
          tier5Rate   REAL NOT NULL DEFAULT 45,
          createdAt   DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt   DATETIME NOT NULL DEFAULT (datetime('now'))
        );
      `);
    }

    // ✅ ServicePackage — باكدجات الخدمات
    if (!tableExists(db, 'ServicePackage')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ServicePackage (
          id             TEXT PRIMARY KEY,
          name           TEXT NOT NULL,
          serviceType    TEXT NOT NULL,
          sessions       INTEGER NOT NULL,
          price          REAL NOT NULL,
          durationDays   INTEGER NOT NULL DEFAULT 30,
          moreCommission REAL DEFAULT 0,
          isActive       INTEGER NOT NULL DEFAULT 1,
          createdAt      DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt      DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS ServicePackage_serviceType_idx ON ServicePackage(serviceType);
        CREATE INDEX IF NOT EXISTS ServicePackage_isActive_idx ON ServicePackage(isActive);
      `);
    }

    // ✅ WhatsAppTemplate — قوالب رسائل الواتساب
    if (!tableExists(db, 'WhatsAppTemplate')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS WhatsAppTemplate (
          id        TEXT PRIMARY KEY,
          title     TEXT NOT NULL,
          icon      TEXT NOT NULL DEFAULT '💬',
          message   TEXT NOT NULL,
          isCustom  INTEGER NOT NULL DEFAULT 1,
          isDefault INTEGER NOT NULL DEFAULT 0,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
      `);
    }

    // ✅ WhatsAppSession — جلسات الواتساب
    if (!tableExists(db, 'WhatsAppSession')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS WhatsAppSession (
          id                TEXT PRIMARY KEY,
          sessionIndex      INTEGER NOT NULL UNIQUE,
          label             TEXT NOT NULL,
          phoneNumber       TEXT,
          status            TEXT NOT NULL DEFAULT 'disconnected',
          isActive          INTEGER NOT NULL DEFAULT 1,
          warmupComplete    INTEGER NOT NULL DEFAULT 0,
          warmupStartedAt   DATETIME,
          dailyMessageCount INTEGER NOT NULL DEFAULT 0,
          dailyCountResetAt DATETIME,
          createdAt         DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt         DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS WhatsAppSession_sessionIndex_idx ON WhatsAppSession(sessionIndex);
        CREATE INDEX IF NOT EXISTS WhatsAppSession_status_idx ON WhatsAppSession(status);
        CREATE INDEX IF NOT EXISTS WhatsAppSession_isActive_idx ON WhatsAppSession(isActive);
      `);
    }

    // ✅ WhatsAppConversation — محادثات الواتساب
    if (!tableExists(db, 'WhatsAppConversation')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS WhatsAppConversation (
          id              TEXT PRIMARY KEY,
          remotePhone     TEXT NOT NULL UNIQUE,
          remoteName      TEXT,
          lastMessageAt   DATETIME,
          lastMessageText TEXT,
          status          TEXT NOT NULL DEFAULT 'open',
          assignedToId    TEXT,
          sessionId       TEXT,
          unreadCount     INTEGER NOT NULL DEFAULT 0,
          createdAt       DATETIME NOT NULL DEFAULT (datetime('now')),
          updatedAt       DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS WhatsAppConversation_status_idx ON WhatsAppConversation(status);
        CREATE INDEX IF NOT EXISTS WhatsAppConversation_assignedToId_idx ON WhatsAppConversation(assignedToId);
        CREATE INDEX IF NOT EXISTS WhatsAppConversation_lastMessageAt_idx ON WhatsAppConversation(lastMessageAt);
        CREATE INDEX IF NOT EXISTS WhatsAppConversation_sessionId_idx ON WhatsAppConversation(sessionId);
      `);
    }

    // ✅ WhatsAppMessage — رسائل الواتساب
    if (!tableExists(db, 'WhatsAppMessage')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS WhatsAppMessage (
          id             TEXT PRIMARY KEY,
          conversationId TEXT NOT NULL,
          sessionId      TEXT,
          direction      TEXT NOT NULL,
          messageType    TEXT NOT NULL DEFAULT 'text',
          content        TEXT NOT NULL,
          mediaUrl       TEXT,
          whatsappMsgId  TEXT,
          status         TEXT NOT NULL DEFAULT 'pending',
          sentById       TEXT,
          createdAt      DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS WhatsAppMessage_conversationId_idx ON WhatsAppMessage(conversationId);
        CREATE INDEX IF NOT EXISTS WhatsAppMessage_sessionId_idx ON WhatsAppMessage(sessionId);
        CREATE INDEX IF NOT EXISTS WhatsAppMessage_createdAt_idx ON WhatsAppMessage(createdAt);
        CREATE INDEX IF NOT EXISTS WhatsAppMessage_direction_idx ON WhatsAppMessage(direction);
        CREATE INDEX IF NOT EXISTS WhatsAppMessage_status_idx ON WhatsAppMessage(status);
      `);
    }

    // ✅ WhatsAppQueueItem — قائمة انتظار رسائل الواتساب
    if (!tableExists(db, 'WhatsAppQueueItem')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS WhatsAppQueueItem (
          id          TEXT PRIMARY KEY,
          sessionId   TEXT NOT NULL,
          phone       TEXT NOT NULL,
          messageType TEXT NOT NULL DEFAULT 'text',
          content     TEXT NOT NULL,
          mediaBase64 TEXT,
          priority    INTEGER NOT NULL DEFAULT 5,
          status      TEXT NOT NULL DEFAULT 'queued',
          attempts    INTEGER NOT NULL DEFAULT 0,
          maxAttempts INTEGER NOT NULL DEFAULT 3,
          scheduledAt DATETIME NOT NULL DEFAULT (datetime('now')),
          sentAt      DATETIME,
          error       TEXT,
          createdById TEXT,
          createdAt   DATETIME NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS WhatsAppQueueItem_sessionId_idx ON WhatsAppQueueItem(sessionId);
        CREATE INDEX IF NOT EXISTS WhatsAppQueueItem_status_idx ON WhatsAppQueueItem(status);
        CREATE INDEX IF NOT EXISTS WhatsAppQueueItem_scheduledAt_idx ON WhatsAppQueueItem(scheduledAt);
        CREATE INDEX IF NOT EXISTS WhatsAppQueueItem_priority_idx ON WhatsAppQueueItem(priority);
      `);
    }

    // ✅ Member — أعمدة ممكن تكون ناقصة من DBs قديمة
    const memberExtraCols = [
      { col: 'email',         def: 'TEXT' },
      { col: 'nationalId',    def: 'TEXT' },
      { col: 'birthDate',     def: 'DATETIME' },
      { col: 'profileImage',  def: 'TEXT' },
      { col: 'coachId',       def: 'TEXT' },
      { col: 'isFrozen',      def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'startDate',     def: 'DATETIME' },
    ];
    for (const { col, def } of memberExtraCols) {
      if (!columnExists(db, 'Member', col)) {
        db.prepare(`ALTER TABLE Member ADD COLUMN ${col} ${def}`).run();
      }
    }

    // ✅ PT — أعمدة كوتش/باركود/ريمايننج/تجميد
    const ptCols = [
      { col: 'coachUserId',   def: 'TEXT' },
      { col: 'qrCode',        def: 'TEXT' },
      { col: 'qrCodeImage',   def: 'TEXT' },
      { col: 'startDate',     def: 'DATETIME' },
      { col: 'expiryDate',    def: 'DATETIME' },
      { col: 'isFrozen',      def: 'INTEGER NOT NULL DEFAULT 0' },
      { col: 'freezeUntil',   def: 'DATETIME' },
    ];
    for (const { col, def } of ptCols) {
      if (!columnExists(db, 'PT', col)) {
        db.prepare(`ALTER TABLE PT ADD COLUMN ${col} ${def}`).run();
      }
    }

    // ✅ PTSession — أعمدة الحضور/التوقيع/الجلسات المجانية
    if (tableExists(db, 'PTSession')) {
      const ptSessionCols = [
        { col: 'attended',             def: 'INTEGER NOT NULL DEFAULT 0' },
        { col: 'attendedAt',           def: 'DATETIME' },
        { col: 'attendedBy',           def: 'TEXT' },
        { col: 'signature',            def: 'TEXT' },
        { col: 'isFreeSession',        def: 'INTEGER NOT NULL DEFAULT 0' },
        { col: 'memberId',             def: 'TEXT' },
        { col: 'collectedInExpenseId', def: 'TEXT' },
      ];
      for (const { col, def } of ptSessionCols) {
        if (!columnExists(db, 'PTSession', col)) {
          db.prepare(`ALTER TABLE PTSession ADD COLUMN ${col} ${def}`).run();
        }
      }
    }

    // ✅ Receipt — أعمدة الـ staff والإلغاء
    if (!columnExists(db, 'Receipt', 'staffName')) {
      db.prepare('ALTER TABLE Receipt ADD COLUMN staffName TEXT').run();
    }
    if (!columnExists(db, 'Receipt', 'isCancelled')) {
      db.prepare('ALTER TABLE Receipt ADD COLUMN isCancelled INTEGER NOT NULL DEFAULT 0').run();
    }

    // ✅ Expense — عمود الـ isPaid
    if (tableExists(db, 'Expense') && !columnExists(db, 'Expense', 'isPaid')) {
      db.prepare('ALTER TABLE Expense ADD COLUMN isPaid INTEGER NOT NULL DEFAULT 0').run();
    }

    // ✅ Expense — طريقة الدفع (البنك) + التصنيف
    if (tableExists(db, 'Expense') && !columnExists(db, 'Expense', 'paymentMethod')) {
      db.prepare("ALTER TABLE Expense ADD COLUMN paymentMethod TEXT NOT NULL DEFAULT 'cash'").run();
    }
    if (tableExists(db, 'Expense') && !columnExists(db, 'Expense', 'category')) {
      db.prepare('ALTER TABLE Expense ADD COLUMN category TEXT').run();
    }

    // ✅ Expense — أعمدة السلف بالأقساط (paidAmount / installmentLimit)
    if (tableExists(db, 'Expense') && !columnExists(db, 'Expense', 'paidAmount')) {
      db.prepare('ALTER TABLE Expense ADD COLUMN paidAmount REAL NOT NULL DEFAULT 0').run();
    }
    if (tableExists(db, 'Expense') && !columnExists(db, 'Expense', 'installmentLimit')) {
      db.prepare('ALTER TABLE Expense ADD COLUMN installmentLimit REAL').run();
    }

    // ✅ ExpenseCategory — تصنيفات المصاريف (يديرها المستخدم)
    if (!tableExists(db, 'ExpenseCategory')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ExpenseCategory (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          createdAt DATETIME NOT NULL DEFAULT (datetime('now'))
        );
      `);
    }

    // ✅ Offer — عمود freezeDays
    if (tableExists(db, 'Offer') && !columnExists(db, 'Offer', 'freezeDays')) {
      db.prepare('ALTER TABLE Offer ADD COLUMN freezeDays INTEGER NOT NULL DEFAULT 0').run();
    }

    // ✅ SystemSettings — أعمدة تفعيل/تعطيل الخدمات + النقاط
    const settingsBoolCols = [
      { col: 'nutritionEnabled',     def: 'INTEGER NOT NULL DEFAULT 1' },
      { col: 'physiotherapyEnabled', def: 'INTEGER NOT NULL DEFAULT 1' },
      { col: 'groupClassEnabled',    def: 'INTEGER NOT NULL DEFAULT 1' },
      { col: 'moreEnabled',          def: 'INTEGER NOT NULL DEFAULT 1' },
      { col: 'spaEnabled',           def: 'INTEGER NOT NULL DEFAULT 1' },
      { col: 'inBodyEnabled',        def: 'INTEGER NOT NULL DEFAULT 1' },
      { col: 'poolEnabled',          def: 'INTEGER NOT NULL DEFAULT 1' },
      { col: 'padelEnabled',         def: 'INTEGER NOT NULL DEFAULT 1' },
      { col: 'assessmentEnabled',    def: 'INTEGER NOT NULL DEFAULT 1' },
      { col: 'lostFoundEnabled',     def: 'INTEGER NOT NULL DEFAULT 1' },
      { col: 'pointsEnabled',        def: 'INTEGER NOT NULL DEFAULT 1' },
      { col: 'pointsPerCheckIn',     def: 'INTEGER NOT NULL DEFAULT 1' },
      { col: 'pointsPerInvitation',  def: 'INTEGER NOT NULL DEFAULT 2' },
    ];
    for (const { col, def } of settingsBoolCols) {
      if (!columnExists(db, 'SystemSettings', col)) {
        db.prepare(`ALTER TABLE SystemSettings ADD COLUMN ${col} ${def}`).run();
      }
    }

    // ✅ ErrorLog — أعمدة الـ Supabase sync (إن لم تكن موجودة)
    if (tableExists(db, 'ErrorLog')) {
      const errorLogSyncCols = [
        { col: 'syncedToSupabase', def: 'INTEGER NOT NULL DEFAULT 0' },
        { col: 'supabaseId',       def: 'TEXT' },
        { col: 'syncAttempts',     def: 'INTEGER NOT NULL DEFAULT 0' },
        { col: 'lastSyncAttempt',  def: 'DATETIME' },
      ];
      for (const { col, def } of errorLogSyncCols) {
        if (!columnExists(db, 'ErrorLog', col)) {
          db.prepare(`ALTER TABLE ErrorLog ADD COLUMN ${col} ${def}`).run();
        }
      }
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

    // فهرس ترتيب قائمة الأعضاء (createdAt DESC) — بدونه كل تحميل للقائمة يعمل فرز كامل
    db.exec('CREATE INDEX IF NOT EXISTS Member_createdAt_idx ON Member(createdAt)');

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

module.exports = { migrateDatabase, runMemberNumberRepair };
