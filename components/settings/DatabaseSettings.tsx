'use client';

import { useState } from 'react';

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

export default function DatabaseSettings() {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [validating, setValidating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
