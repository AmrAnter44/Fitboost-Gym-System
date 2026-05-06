'use client';

import { useState, useEffect } from 'react';

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

export default function DatabaseSettings() {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [validating, setValidating] = useState(false);
  const [updatingPrisma, setUpdatingPrisma] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // 🗜️ تنظيف الـ DB
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
    if (!confirm(
      `⚠️ هذه العملية ستقوم بالتالي:\n\n` +
      `1️⃣ حفظ نسخة احتياطية من قاعدة البيانات\n` +
      `2️⃣ نقل ${cleanupInfo.candidates} صورة من قاعدة البيانات لملفات\n` +
      `3️⃣ ضغط قاعدة البيانات (VACUUM)\n\n` +
      `الوقت المتوقع: ١-٢ دقيقة. تأكد إن مفيش حد بيستخدم النظام في نفس الوقت.\n\n` +
      `هل تريد المتابعة؟`
    )) {
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
            `✅ تم التنظيف بنجاح!\n\n` +
            `📦 تم نقل ${data.migrated} صورة` +
            (data.failed > 0 ? ` (فشل ${data.failed})` : '') + `\n` +
            `💾 حجم قاعدة البيانات: ${data.before.mb} MB → ${data.after.mb} MB\n` +
            `🎉 وفّرت: ${data.saved.mb} MB (${data.saved.percent}%)` +
            (data.backup ? `\n\n💾 النسخة الاحتياطية: ${data.backup.filename}` : '') +
            (data.vacuumError ? `\n\n⚠️ تحذير: VACUUM فشل (${data.vacuumError}) — البيانات اتنقلت بس الحجم ما اتقللش. اعمل "ضغط قاعدة البيانات" يدوياً.` : ''),
        });
        // refetch لتحديث الـ info card
        await fetchCleanupInfo();
      } else {
        setMessage({
          type: 'error',
          text: `❌ فشل التنظيف: ${(data as any).error || 'خطأ غير معروف'}`,
        });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: `❌ حدث خطأ أثناء التنظيف: ${(err as Error).message}`,
      });
    } finally {
      setCleanupRunning(false);
    }
  };

  // تحديث Prisma (db push + generate)
  const handleUpdatePrisma = async () => {
    if (!confirm('⚠️ هل تريد تطبيق التغييرات على قاعدة البيانات وتحديث Prisma Client؟\n\nسيتم تطبيق آخر التحديثات من schema.prisma')) {
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
          text: '✅ تم تحديث Prisma بنجاح!\n\n📦 تم تطبيق التغييرات على قاعدة البيانات\n⚙️ تم توليد Prisma Client\n\n💡 يُنصح بإعادة تشغيل السيرفر للحصول على أفضل أداء.'
        });
      } else {
        setMessage({
          type: 'error',
          text: data.message || 'فشل تحديث Prisma'
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'حدث خطأ أثناء تحديث Prisma'
      });
    } finally {
      setUpdatingPrisma(false);
    }
  };

  // فحص سلامة الداتابيز
  const handleValidateDatabase = async () => {
    setValidating(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings/database/validate');
      const data = await response.json();

      setDbInfo(data);

      if (data.valid) {
        setMessage({ type: 'success', text: 'الداتابيز سليمة وجاهزة للاستخدام ✅' });
      } else {
        setMessage({ type: 'error', text: data.error || 'توجد مشاكل في الداتابيز' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'فشل فحص الداتابيز' });
    } finally {
      setValidating(false);
    }
  };

  // إنشاء نسخة احتياطية
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
          text: `تم إنشاء النسخة الاحتياطية: ${data.details.filename} (${data.details.size})`
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'فشل إنشاء النسخة الاحتياطية' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'حدث خطأ أثناء إنشاء النسخة الاحتياطية' });
    } finally {
      setCreatingBackup(false);
    }
  };

  // اختيار ملف
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setMessage(null);
    }
  };

  // تحديث وتنزيل الداتابيز
  const handleUpgradeDatabase = async (downloadOnly: boolean) => {
    if (!selectedFile) {
      setMessage({ type: 'error', text: 'يرجى اختيار ملف داتابيز أولاً' });
      return;
    }

    // تأكيد من المستخدم إذا كان سيستبدل الداتابيز الحالية
    if (!downloadOnly) {
      if (!confirm('⚠️ تحذير: هذا سيستبدل الداتابيز الحالية بالملف المحدث. هل أنت متأكد؟\n\nسيتم إنشاء نسخة احتياطية تلقائياً.')) {
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
        // تنزيل الملف المحدث
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
          text: '✅ تم تحديث الداتابيز وتنزيلها بنجاح!\n\nيمكنك الآن استخدام الملف المحدث في أي مكان.'
        });
        setSelectedFile(null);
      } else {
        // استبدال الداتابيز الحالية
        const data = await response.json();

        if (data.success) {
          const newTablesText = data.details.newTablesAdded.length > 0
            ? `\n🆕 جداول جديدة: ${data.details.newTablesAdded.join(', ')}`
            : '';

          setMessage({
            type: 'success',
            text: `✅ ${data.message}\n\n📊 عدد الجداول: ${data.details.tablesCount}${newTablesText}\n💾 نسخة احتياطية: ${data.details.backupCreated}\n\n⏳ سيتم إعادة تحميل الصفحة خلال 3 ثواني...`
          });
          setSelectedFile(null);

          // إعادة تحميل الصفحة بعد 3 ثواني
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        } else {
          setMessage({ type: 'error', text: data.error || 'فشل تحديث الداتابيز' });
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'حدث خطأ أثناء تحديث الداتابيز' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">⚙️ إدارة قاعدة البيانات</h2>

        {/* رسالة التنبيه */}
        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
            style={{ whiteSpace: 'pre-line' }}
          >
            {message.text}
          </div>
        )}

        {/* معلومات الداتابيز */}
        {dbInfo && dbInfo.valid && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-bold mb-2">📊 معلومات الداتابيز:</h3>
            <div className="space-y-1 text-sm">
              <p>📦 الحجم: {dbInfo.details?.file.size}</p>
              <p>🗂️ عدد الجداول: {dbInfo.details?.tables.count}</p>
              <p className="flex items-center gap-2">
                {dbInfo.details?.integrity.valid ? '✅' : '❌'} السلامة: {dbInfo.details?.integrity.message}
              </p>
              <p className="flex items-center gap-2">
                {dbInfo.details?.connection.valid ? '✅' : '❌'} الاتصال: {dbInfo.details?.connection.message}
              </p>
            </div>
          </div>
        )}

        {/* الأزرار الرئيسية */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* فحص السلامة */}
          <button
            onClick={handleValidateDatabase}
            disabled={validating}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {validating ? (
              <>
                <span className="animate-spin">⏳</span>
                جاري الفحص...
              </>
            ) : (
              <>
                🔍 فحص سلامة الداتابيز
              </>
            )}
          </button>

          {/* نسخة احتياطية */}
          <button
            onClick={handleCreateBackup}
            disabled={creatingBackup}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creatingBackup ? (
              <>
                <span className="animate-spin">⏳</span>
                جاري النسخ...
              </>
            ) : (
              <>
                💾 إنشاء نسخة احتياطية
              </>
            )}
          </button>

          {/* تحديث Prisma */}
          <button
            onClick={handleUpdatePrisma}
            disabled={updatingPrisma}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updatingPrisma ? (
              <>
                <span className="animate-spin">⏳</span>
                جاري التحديث...
              </>
            ) : (
              <>
                🔄 تحديث Prisma
              </>
            )}
          </button>
        </div>

        {/* 🗜️ تنظيف قاعدة البيانات (نقل الصور القديمة) */}
        <div className="border-t pt-6 mb-6">
          <h3 className="text-lg font-bold mb-4">🗜️ تنظيف قاعدة البيانات</h3>

          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-sm mb-4">
            <p className="font-bold mb-2">💡 ايه ده؟</p>
            <p className="text-yellow-900">
              النظام بيخزن صور الأعضاء القديمة كنصوص base64 جوه قاعدة البيانات نفسها — ده بيخلي ملف <code className="bg-yellow-200 px-1 rounded">gym.db</code> يكبر بشكل كبير. التنظيف ده بينقل الصور دي لملفات منفصلة في فولدر <code className="bg-yellow-200 px-1 rounded">uploads/</code> ويرجّع حجم قاعدة البيانات لطبيعته. مفيش بيانات هتضيع.
            </p>
          </div>

          {/* Status card */}
          {cleanupLoading && (
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg text-sm mb-4 flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              جاري فحص حالة قاعدة البيانات...
            </div>
          )}

          {!cleanupLoading && cleanupInfo && cleanupInfo.candidates === 0 && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-sm mb-4">
              ✅ قاعدة البيانات نضيفة، مفيش صور قديمة تحتاج نقل.
              <br />
              📦 الحجم الحالي: <strong>{cleanupInfo.currentDbSizeMb} MB</strong>
            </div>
          )}

          {!cleanupLoading && cleanupInfo && cleanupInfo.candidates > 0 && (
            <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg text-sm mb-4">
              <p className="font-bold mb-2">⚠️ وُجدت بيانات قديمة:</p>
              <ul className="list-disc list-inside space-y-1 text-orange-900">
                <li>عدد الصور القديمة: <strong>{cleanupInfo.candidates}</strong></li>
                <li>الحجم في قاعدة البيانات: <strong>{cleanupInfo.estimatedBase64Mb} MB</strong></li>
                <li>الحجم الكلي لـ <code className="bg-orange-100 px-1 rounded">gym.db</code>: <strong>{cleanupInfo.currentDbSizeMb} MB</strong></li>
                <li>الحجم المتوقع بعد التنظيف: <strong>~{Math.max(0.5, +(cleanupInfo.currentDbSizeMb - cleanupInfo.estimatedBase64Mb).toFixed(1))} MB</strong></li>
              </ul>
            </div>
          )}

          {/* Cleanup result */}
          {cleanupResult && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-sm mb-4">
              <p className="font-bold mb-2">📊 نتيجة آخر عملية تنظيف:</p>
              <ul className="list-disc list-inside space-y-1 text-green-900">
                <li>تم نقل: <strong>{cleanupResult.migrated}</strong> صورة</li>
                {cleanupResult.failed > 0 && (
                  <li>فشل: <strong>{cleanupResult.failed}</strong> صورة</li>
                )}
                <li>قبل: <strong>{cleanupResult.before.mb} MB</strong> → بعد: <strong>{cleanupResult.after.mb} MB</strong></li>
                <li>وفّرت: <strong>{cleanupResult.saved.mb} MB</strong> ({cleanupResult.saved.percent}%)</li>
                {cleanupResult.backup && (
                  <li>النسخة الاحتياطية: <code className="bg-green-100 px-1 rounded text-xs">{cleanupResult.backup.filename}</code></li>
                )}
              </ul>
              {cleanupResult.failures.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-orange-700 font-medium">عرض الأعضاء اللي فشل نقلهم ({cleanupResult.failures.length})</summary>
                  <ul className="mt-2 ml-4 space-y-1 text-xs text-gray-700">
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

          {/* Action button */}
          <button
            onClick={handleRunCleanup}
            disabled={cleanupRunning || cleanupLoading || !cleanupInfo || cleanupInfo.candidates === 0}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
          >
            {cleanupRunning ? (
              <>
                <span className="animate-spin">⏳</span>
                جاري التنظيف... (ممكن ياخد دقيقة أو اتنين)
              </>
            ) : (
              <>🗜️ ابدأ التنظيف</>
            )}
          </button>
        </div>

        {/* تحديث داتابيز قديمة */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-bold mb-4">🔄 تحديث داتابيز قديمة</h3>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm">
              <p className="font-bold mb-2">💡 كيف يعمل:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>ارفع أي ملف داتابيز قديم من أي نسخة سابقة</li>
                <li>سيتم إضافة جميع الجداول والأعمدة الجديدة تلقائياً</li>
                <li>لن يتم حذف أي بيانات موجودة</li>
                <li>يمكنك تنزيل الملف المحدث أو استبدال الداتابيز الحالية به</li>
              </ul>
            </div>

            {/* اختيار الملف */}
            <div>
              <label className="block text-sm font-medium mb-2">
                اختر ملف الداتابيز (.db):
              </label>
              <input
                type="file"
                accept=".db"
                onChange={handleFileSelect}
                disabled={importing}
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
              />
              {selectedFile && (
                <p className="mt-2 text-sm text-gray-600">
                  ✅ تم اختيار: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              )}
            </div>

            {/* أزرار التحديث */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* تحديث وتنزيل */}
              <button
                onClick={() => handleUpgradeDatabase(true)}
                disabled={!selectedFile || importing}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
              >
                {importing ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    جاري التحديث...
                  </>
                ) : (
                  <>
                    📥 تحديث وتنزيل
                  </>
                )}
              </button>

              {/* تحديث واستبدال */}
              <button
                onClick={() => handleUpgradeDatabase(false)}
                disabled={!selectedFile || importing}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
              >
                {importing ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    جاري التحديث والاستبدال...
                  </>
                ) : (
                  <>
                    🚀 تحديث واستبدال الداتابيز
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* معلومات إضافية */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm">
          <p className="font-bold mb-2">💡 ملاحظات:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li>الملف يجب أن يكون من نوع SQLite (.db)</li>
            <li>سيتم فحص سلامة الملف قبل الاستيراد</li>
            <li>إذا فشل الاستيراد، سيتم استرجاع النسخة الاحتياطية تلقائياً</li>
            <li>النسخ الاحتياطية محفوظة في: <code className="bg-gray-200 px-1 rounded">prisma/gym.db.backup.*</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
