'use client';

import { useState, useEffect } from 'react';
import CloudBackupCard from './CloudBackupCard';
import { useLanguage } from '../../contexts/LanguageContext';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const;

interface DatabaseInfo {
  valid: boolean;
  details?: {
    file: {
      size: string;
      lastModified: string;
    };
    integrity: {
      valid: boolean;
      message: string;
    };
    schema: {
      valid: boolean;
      message: string;
    };
    connection: {
      valid: boolean;
      message: string;
    };
    tables: {
      count: number;
    };
  };
  error?: string;
}

interface CleanupPreflight {
  candidates: number;
  currentDbSizeMb: number;
  estimatedBase64Mb: number;
}

interface CleanupResult {
  success: boolean;
  migrated: number;
  failed: number;
  failures: Array<{ id: string; name: string; reason: string }>;
  before: { mb: number };
  after: { mb: number };
  saved: { mb: number; percent: number };
  filesWritten: number;
  filesSize: { mb: number };
  backup?: { filename: string };
  vacuumError?: string | null;
  message?: string;
}

const Spinner = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} {...stroke}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0013.13 4.95M19.5 12a7.5 7.5 0 00-13.13-4.95" />
  </svg>
);

const CheckIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} {...stroke}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} {...stroke}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const WarnIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} {...stroke}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.01M5.07 19h13.86A2 2 0 0020.66 16L13.73 4a2 2 0 00-3.46 0L3.34 16A2 2 0 005.07 19z" />
  </svg>
);

export default function DatabaseSettings() {
  const { tr } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [validating, setValidating] = useState(false);
  const [updatingPrisma, setUpdatingPrisma] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [cleanupInfo, setCleanupInfo] = useState<CleanupPreflight | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);

  const fetchCleanupInfo = async () => {
    setCleanupLoading(true);
    try {
      const res = await fetch('/api/settings/database/migrate-base64-images');
      const data = await res.json();
      if (data.success) {
        setCleanupInfo({
          candidates: data.candidates,
          currentDbSizeMb: data.currentDbSizeMb,
          estimatedBase64Mb: data.estimatedBase64Mb,
        });
      }
    } catch (err) {
      console.error('Failed to load cleanup info:', err);
    } finally {
      setCleanupLoading(false);
    }
  };

  useEffect(() => {
    fetchCleanupInfo();
  }, []);

  const handleRunCleanup = async () => {
    if (!cleanupInfo || cleanupInfo.candidates === 0) return;
    if (!confirm(tr(
      `هذه العملية ستقوم بالتالي:\n\n` +
      `1) حفظ نسخة احتياطية من قاعدة البيانات\n` +
      `2) نقل ${cleanupInfo.candidates} صورة من قاعدة البيانات لملفات\n` +
      `3) ضغط قاعدة البيانات (VACUUM)\n\n` +
      `الوقت المتوقع: ١-٢ دقيقة. تأكد إن مفيش حد بيستخدم النظام في نفس الوقت.\n\n` +
      `هل تريد المتابعة؟`,
      `This will:\n\n` +
      `1) Save a database backup\n` +
      `2) Move ${cleanupInfo.candidates} images from the database to files\n` +
      `3) Compact the database (VACUUM)\n\n` +
      `Expected time: 1-2 minutes. Make sure nobody is using the system meanwhile.\n\n` +
      `Do you want to continue?`
    ))) {
      return;
    }

    setCleanupRunning(true);
    setCleanupResult(null);
    setMessage(null);

    try {
      const res = await fetch('/api/settings/database/migrate-base64-images', {
        method: 'POST',
      });
      const data: CleanupResult = await res.json();

      if (data.success) {
        setCleanupResult(data);
        setMessage({
          type: 'success',
          text:
            tr(`تم التنظيف بنجاح!\n\n`, `Cleanup completed successfully!\n\n`) +
            tr(`تم نقل ${data.migrated} صورة`, `Moved ${data.migrated} images`) +
            (data.failed > 0 ? tr(` (فشل ${data.failed})`, ` (${data.failed} failed)`) : '') + `\n` +
            tr(`حجم قاعدة البيانات: `, `Database size: `) + `${data.before.mb} MB → ${data.after.mb} MB\n` +
            tr(`وفّرت: `, `Saved: `) + `${data.saved.mb} MB (${data.saved.percent}%)` +
            (data.backup ? tr(`\n\nالنسخة الاحتياطية: `, `\n\nBackup: `) + data.backup.filename : '') +
            (data.vacuumError ? tr(`\n\nتحذير: VACUUM فشل (${data.vacuumError}) — البيانات اتنقلت بس الحجم ما اتقللش. اعمل "ضغط قاعدة البيانات" يدوياً.`, `\n\nWarning: VACUUM failed (${data.vacuumError}) — data was moved but the size was not reduced. Compact the database manually.`) : ''),
        });
        await fetchCleanupInfo();
      } else {
        setMessage({
          type: 'error',
          text: `${tr('فشل التنظيف', 'Cleanup failed')}: ${(data as any).error || tr('خطأ غير معروف', 'Unknown error')}`,
        });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: `${tr('حدث خطأ أثناء التنظيف', 'An error occurred during cleanup')}: ${(err as Error).message}`,
      });
    } finally {
      setCleanupRunning(false);
    }
  };

  const handleUpdatePrisma = async () => {
    if (!confirm(tr('هل تريد تطبيق التغييرات على قاعدة البيانات وتحديث Prisma Client؟\n\nسيتم تطبيق آخر التحديثات من schema.prisma', 'Apply changes to the database and update Prisma Client?\n\nThe latest updates from schema.prisma will be applied.'))) {
      return;
    }

    setUpdatingPrisma(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/prisma-update', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: tr('تم تحديث Prisma بنجاح!\n\nتم تطبيق التغييرات على قاعدة البيانات\nتم توليد Prisma Client\n\nيُنصح بإعادة تشغيل السيرفر للحصول على أفضل أداء.', 'Prisma updated successfully!\n\nChanges applied to the database\nPrisma Client generated\n\nRestarting the server is recommended for best performance.'),
        });
      } else {
        setMessage({
          type: 'error',
          text: data.message || tr('فشل تحديث Prisma', 'Prisma update failed'),
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: tr('حدث خطأ أثناء تحديث Prisma', 'An error occurred while updating Prisma'),
      });
    } finally {
      setUpdatingPrisma(false);
    }
  };

  const handleValidateDatabase = async () => {
    setValidating(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings/database/validate');
      const data = await response.json();

      setDbInfo(data);

      if (data.valid) {
        setMessage({ type: 'success', text: tr('الداتابيز سليمة وجاهزة للاستخدام', 'Database is healthy and ready to use') });
      } else {
        setMessage({ type: 'error', text: data.error || tr('توجد مشاكل في الداتابيز', 'The database has problems') });
      }
    } catch (error) {
      setMessage({ type: 'error', text: tr('فشل فحص الداتابيز', 'Database check failed') });
    } finally {
      setValidating(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings/database/backup', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: `${tr('تم إنشاء النسخة الاحتياطية', 'Backup created')}: ${data.details.filename} (${data.details.size})`,
        });
      } else {
        setMessage({ type: 'error', text: data.error || tr('فشل إنشاء النسخة الاحتياطية', 'Failed to create backup') });
      }
    } catch (error) {
      setMessage({ type: 'error', text: tr('حدث خطأ أثناء إنشاء النسخة الاحتياطية', 'An error occurred while creating the backup') });
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setMessage(null);
    }
  };

  const handleUpgradeDatabase = async (downloadOnly: boolean) => {
    if (!selectedFile) {
      setMessage({ type: 'error', text: tr('يرجى اختيار ملف داتابيز أولاً', 'Please select a database file first') });
      return;
    }

    if (!downloadOnly) {
      if (!confirm(tr('تحذير: هذا سيستبدل الداتابيز الحالية بالملف المحدث. هل أنت متأكد؟\n\nسيتم إنشاء نسخة احتياطية تلقائياً.', 'Warning: this will replace the current database with the upgraded file. Are you sure?\n\nA backup will be created automatically.'))) {
        return;
      }
    }

    setImporting(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('database', selectedFile);
      formData.append('action', downloadOnly ? 'upgrade-only' : 'upgrade-and-replace');

      const response = await fetch('/api/settings/database/upgrade', {
        method: 'POST',
        body: formData,
      });

      if (downloadOnly) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gym-upgraded-${Date.now()}.db`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        setMessage({
          type: 'success',
          text: tr('تم تحديث الداتابيز وتنزيلها بنجاح!\n\nيمكنك الآن استخدام الملف المحدث في أي مكان.', 'Database upgraded and downloaded successfully!\n\nYou can now use the upgraded file anywhere.'),
        });
        setSelectedFile(null);
      } else {
        const data = await response.json();

        if (data.success) {
          const newTablesText = data.details.newTablesAdded.length > 0
            ? `\n${tr('جداول جديدة', 'New tables')}: ${data.details.newTablesAdded.join(', ')}`
            : '';

          setMessage({
            type: 'success',
            text: `${data.message}\n\n${tr('عدد الجداول', 'Tables')}: ${data.details.tablesCount}${newTablesText}\n${tr('نسخة احتياطية', 'Backup')}: ${data.details.backupCreated}\n\n${tr('سيتم إعادة تحميل الصفحة خلال 3 ثواني...', 'The page will reload in 3 seconds...')}`,
          });
          setSelectedFile(null);

          setTimeout(() => {
            window.location.reload();
          }, 3000);
        } else {
          setMessage({ type: 'error', text: data.error || tr('فشل تحديث الداتابيز', 'Database upgrade failed') });
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: tr('حدث خطأ أثناء تحديث الداتابيز', 'An error occurred while upgrading the database') });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ☁️ النسخ الاحتياطي السحابي — للأونر فقط (كارت مستقل self-contained) */}
      <CloudBackupCard />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" {...stroke}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7c0-2 4-3 8-3s8 1 8 3v10c0 2-4 3-8 3s-8-1-8-3V7zm0 5c0 2 4 3 8 3s8-1 8-3" />
          </svg>
          {tr('إدارة قاعدة البيانات', 'Database Management')}
        </h2>

        {/* Message */}
        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ring-1 flex items-start gap-2 ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 ring-green-200 dark:ring-green-900/50 text-green-800 dark:text-green-200'
                : 'bg-red-50 dark:bg-red-900/20 ring-red-200 dark:ring-red-900/50 text-red-800 dark:text-red-200'
            }`}
            style={{ whiteSpace: 'pre-line' }}
          >
            {message.type === 'success' ? <CheckIcon className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <WarnIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />}
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        {/* DB Info */}
        {dbInfo && dbInfo.valid && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 rounded-lg">
            <h3 className="font-bold mb-2 text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <svg className="w-5 h-5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {tr('معلومات الداتابيز', 'Database Info')}
            </h3>
            <div className="space-y-1 text-sm text-blue-900 dark:text-blue-200">
              <p>{tr('الحجم', 'Size')}: {dbInfo.details?.file.size}</p>
              <p>{tr('عدد الجداول', 'Tables')}: {dbInfo.details?.tables.count}</p>
              <p className="flex items-center gap-2">
                {dbInfo.details?.integrity.valid ? <CheckIcon className="w-4 h-4 text-green-600 dark:text-green-400" /> : <XIcon className="w-4 h-4 text-red-600 dark:text-red-400" />}
                {tr('السلامة', 'Integrity')}: {dbInfo.details?.integrity.message}
              </p>
              <p className="flex items-center gap-2">
                {dbInfo.details?.connection.valid ? <CheckIcon className="w-4 h-4 text-green-600 dark:text-green-400" /> : <XIcon className="w-4 h-4 text-red-600 dark:text-red-400" />}
                {tr('الاتصال', 'Connection')}: {dbInfo.details?.connection.message}
              </p>
            </div>
          </div>
        )}

        {/* Main actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <button
            onClick={handleValidateDatabase}
            disabled={validating}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            {validating ? (
              <>
                <Spinner />
                {tr('جاري الفحص...', 'Checking...')}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {tr('فحص سلامة الداتابيز', 'Check Database Integrity')}
              </>
            )}
          </button>

          <button
            onClick={handleCreateBackup}
            disabled={creatingBackup}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            {creatingBackup ? (
              <>
                <Spinner />
                {tr('جاري النسخ...', 'Backing up...')}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zm2 4h10v4H7V8zm0 6h6" />
                </svg>
                {tr('إنشاء نسخة احتياطية', 'Create Backup')}
              </>
            )}
          </button>

          <button
            onClick={handleUpdatePrisma}
            disabled={updatingPrisma}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            {updatingPrisma ? (
              <>
                <Spinner />
                {tr('جاري التحديث...', 'Updating...')}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {tr('تحديث Prisma', 'Update Prisma')}
              </>
            )}
          </button>
        </div>

        {/* Cleanup section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mb-6">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
            </svg>
            {tr('تنظيف قاعدة البيانات', 'Database Cleanup')}
          </h3>

          <div className="bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 p-4 rounded-lg text-sm mb-4">
            <p className="font-bold mb-2 text-amber-900 dark:text-amber-200">{tr('ايه ده؟', 'What is this?')}</p>
            <p className="text-amber-900 dark:text-amber-200">
              {tr('النظام بيخزن صور الأعضاء القديمة كنصوص base64 جوه قاعدة البيانات نفسها — ده بيخلي ملف', 'The system stores old member photos as base64 text inside the database itself — this makes the')} <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">gym.db</code> {tr('يكبر بشكل كبير. التنظيف ده بينقل الصور دي لملفات منفصلة في فولدر', 'file grow a lot. This cleanup moves those images to separate files in the')} <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">uploads/</code> {tr('ويرجّع حجم قاعدة البيانات لطبيعته. مفيش بيانات هتضيع.', 'folder and restores the database to its normal size. No data will be lost.')}
            </p>
          </div>

          {cleanupLoading && (
            <div className="bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 p-4 rounded-lg text-sm mb-4 flex items-center gap-2 text-gray-700 dark:text-gray-300" aria-busy="true" aria-live="polite">
              <Spinner />
              {tr('جاري فحص حالة قاعدة البيانات...', 'Checking database status...')}
            </div>
          )}

          {!cleanupLoading && cleanupInfo && cleanupInfo.candidates === 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 p-4 rounded-lg text-sm mb-4 text-green-900 dark:text-green-200 flex items-start gap-2">
              <CheckIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                {tr('قاعدة البيانات نضيفة، مفيش صور قديمة تحتاج نقل.', 'The database is clean; no old images need moving.')}
                <br />
                {tr('الحجم الحالي', 'Current size')}: <strong>{cleanupInfo.currentDbSizeMb} MB</strong>
              </div>
            </div>
          )}

          {!cleanupLoading && cleanupInfo && cleanupInfo.candidates > 0 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-200 dark:ring-orange-900/50 p-4 rounded-lg text-sm mb-4">
              <p className="font-bold mb-2 text-orange-900 dark:text-orange-200 flex items-center gap-2">
                <WarnIcon className="w-4 h-4" />
                {tr('وُجدت بيانات قديمة', 'Old data found')}
              </p>
              <ul className="list-disc list-inside space-y-1 text-orange-900 dark:text-orange-200">
                <li>{tr('عدد الصور القديمة', 'Old images')}: <strong>{cleanupInfo.candidates}</strong></li>
                <li>{tr('الحجم في قاعدة البيانات', 'Size in database')}: <strong>{cleanupInfo.estimatedBase64Mb} MB</strong></li>
                <li>{tr('الحجم الكلي لـ', 'Total size of')} <code className="bg-orange-100 dark:bg-orange-900/40 px-1 rounded">gym.db</code>: <strong>{cleanupInfo.currentDbSizeMb} MB</strong></li>
                <li>{tr('الحجم المتوقع بعد التنظيف', 'Expected size after cleanup')}: <strong>~{Math.max(0.5, +(cleanupInfo.currentDbSizeMb - cleanupInfo.estimatedBase64Mb).toFixed(1))} MB</strong></li>
              </ul>
            </div>
          )}

          {cleanupResult && (
            <div className="bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 p-4 rounded-lg text-sm mb-4">
              <p className="font-bold mb-2 text-green-900 dark:text-green-200">{tr('نتيجة آخر عملية تنظيف', 'Last cleanup result')}</p>
              <ul className="list-disc list-inside space-y-1 text-green-900 dark:text-green-200">
                <li>{tr('تم نقل', 'Moved')}: <strong>{cleanupResult.migrated}</strong> {tr('صورة', 'images')}</li>
                {cleanupResult.failed > 0 && (
                  <li>{tr('فشل', 'Failed')}: <strong>{cleanupResult.failed}</strong> {tr('صورة', 'images')}</li>
                )}
                <li>{tr('قبل', 'Before')}: <strong>{cleanupResult.before.mb} MB</strong> → {tr('بعد', 'After')}: <strong>{cleanupResult.after.mb} MB</strong></li>
                <li>{tr('وفّرت', 'Saved')}: <strong>{cleanupResult.saved.mb} MB</strong> ({cleanupResult.saved.percent}%)</li>
                {cleanupResult.backup && (
                  <li>{tr('النسخة الاحتياطية', 'Backup')}: <code className="bg-green-100 dark:bg-green-900/40 px-1 rounded text-xs">{cleanupResult.backup.filename}</code></li>
                )}
              </ul>
              {cleanupResult.failures.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-orange-700 dark:text-orange-300 font-bold">{tr('عرض الأعضاء اللي فشل نقلهم', 'Show members that failed to move')} ({cleanupResult.failures.length})</summary>
                  <ul className="mt-2 ms-4 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                    {cleanupResult.failures.map(f => (
                      <li key={f.id}>
                        <strong>{f.name}</strong> ({f.id.slice(0, 8)}…): {f.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <button
            onClick={handleRunCleanup}
            disabled={cleanupRunning || cleanupLoading || !cleanupInfo || cleanupInfo.candidates === 0}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            {cleanupRunning ? (
              <>
                <Spinner />
                {tr('جاري التنظيف... (ممكن ياخد دقيقة أو اتنين)', 'Cleaning... (may take a minute or two)')}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                </svg>
                {tr('ابدأ التنظيف', 'Start Cleanup')}
              </>
            )}
          </button>
        </div>

        {/* Upgrade old DB */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {tr('تحديث داتابيز قديمة', 'Upgrade an Old Database')}
          </h3>

          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 p-4 rounded-lg text-sm">
              <p className="font-bold mb-2 text-blue-900 dark:text-blue-200">{tr('كيف يعمل', 'How it works')}</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li>{tr('ارفع أي ملف داتابيز قديم من أي نسخة سابقة', 'Upload any old database file from any previous version')}</li>
                <li>{tr('سيتم إضافة جميع الجداول والأعمدة الجديدة تلقائياً', 'All new tables and columns will be added automatically')}</li>
                <li>{tr('لن يتم حذف أي بيانات موجودة', 'No existing data will be deleted')}</li>
                <li>{tr('يمكنك تنزيل الملف المحدث أو استبدال الداتابيز الحالية به', 'You can download the upgraded file or replace the current database with it')}</li>
              </ul>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {tr('اختر ملف الداتابيز (.db):', 'Choose database file (.db):')}
              </label>
              <input
                type="file"
                accept=".db"
                onChange={handleFileSelect}
                disabled={importing}
                className="block w-full text-sm text-primary-contrast dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 file:me-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-bold file:bg-primary-500 file:text-primary-contrast hover:file:bg-primary-600"
              />
              {selectedFile && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  <CheckIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                  {tr('تم اختيار', 'Selected')}: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => handleUpgradeDatabase(true)}
                disabled={!selectedFile || importing}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                {importing ? (
                  <>
                    <Spinner />
                    {tr('جاري التحديث...', 'Updating...')}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" {...stroke}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    {tr('تحديث وتنزيل', 'Upgrade & Download')}
                  </>
                )}
              </button>

              <button
                onClick={() => handleUpgradeDatabase(false)}
                disabled={!selectedFile || importing}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                {importing ? (
                  <>
                    <Spinner />
                    {tr('جاري التحديث والاستبدال...', 'Upgrading & replacing...')}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" {...stroke}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    {tr('تحديث واستبدال الداتابيز', 'Upgrade & Replace Database')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg text-sm">
          <p className="font-bold mb-2 text-gray-700 dark:text-gray-300">{tr('ملاحظات', 'Notes')}</p>
          <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
            <li>{tr('الملف يجب أن يكون من نوع SQLite (.db)', 'The file must be a SQLite file (.db)')}</li>
            <li>{tr('سيتم فحص سلامة الملف قبل الاستيراد', 'The file integrity will be checked before import')}</li>
            <li>{tr('إذا فشل الاستيراد، سيتم استرجاع النسخة الاحتياطية تلقائياً', 'If the import fails, the backup will be restored automatically')}</li>
            <li>{tr('النسخ الاحتياطية محفوظة في', 'Backups are saved in')}: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">prisma/gym.db.backup.*</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
