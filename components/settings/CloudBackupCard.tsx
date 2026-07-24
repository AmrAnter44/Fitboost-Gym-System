'use client';

import { useState, useEffect } from 'react';

/**
 * ☁️ كارت النسخ الاحتياطي السحابي (Backblaze B2) — للأونر فقط.
 * self-contained: بيتحقق من الدور بنفسه وبيرجّع null لغير الأونر،
 * فينفع يتحط في أي صفحة إعدادات من غير شروط خارجية.
 */

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const;

interface CloudStatus {
  enabled: boolean;
  configured: boolean;
  bucketName: string;
  gymConfigured: boolean;
  gymName: string | null;
  branchName: string | null;
  lastCloudBackupAt: string | null;
  lastCloudBackupError: string | null;
  lastCloudBackupSize: number | null;
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

export default function CloudBackupCard() {
  const [isOwner, setIsOwner] = useState(false);
  const [cloud, setCloud] = useState<CloudStatus | null>(null);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [cloudToggling, setCloudToggling] = useState(false);
  const [cloudUploading, setCloudUploading] = useState(false);
  const [cloudMsg, setCloudMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchCloud = async () => {
    setCloudLoading(true);
    try {
      const res = await fetch('/api/settings/database/cloud-backup');
      if (res.ok) setCloud(await res.json());
    } catch (err) {
      console.error('Failed to load cloud backup status:', err);
    } finally {
      setCloudLoading(false);
    }
  };

  useEffect(() => {
    // الكارت للأونر بس — نتحقق من الدور الأول وبعدها نجيب الحالة
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user?.role === 'OWNER') {
          setIsOwner(true);
          fetchCloud();
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleCloud = async () => {
    if (!cloud) return;
    const next = !cloud.enabled;
    setCloudToggling(true);
    setCloudMsg(null);
    try {
      const res = await fetch('/api/settings/database/cloud-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', enabled: next }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCloud({ ...cloud, enabled: data.enabled });
        setCloudMsg({
          type: 'success',
          text: data.enabled ? 'تم تفعيل النسخ الاحتياطي السحابي' : 'تم إقفال النسخ الاحتياطي السحابي',
        });
      } else {
        setCloudMsg({ type: 'error', text: data.error || 'فشل تغيير الحالة' });
      }
    } catch {
      setCloudMsg({ type: 'error', text: 'حدث خطأ أثناء تغيير الحالة' });
    } finally {
      setCloudToggling(false);
    }
  };

  const handleCloudUploadNow = async () => {
    setCloudUploading(true);
    setCloudMsg(null);
    try {
      const res = await fetch('/api/settings/database/cloud-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upload-now' }),
      });
      const data = await res.json();
      setCloudMsg({ type: data.success ? 'success' : 'error', text: data.message || (data.success ? 'تم الرفع' : 'فشل الرفع') });
      await fetchCloud();
    } catch {
      setCloudMsg({ type: 'error', text: 'حدث خطأ أثناء الرفع للسحابة' });
    } finally {
      setCloudUploading(false);
    }
  };

  const fmtSize = (b?: number | null) => (b ? `${(b / (1024 * 1024)).toFixed(2)} MB` : '—');
  const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString('ar-EG') : 'لسه مفيش');

  if (!isOwner) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-6 py-5 bg-gradient-to-l from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300">
            <svg className="w-6 h-6" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 18a4 4 0 01-.88-7.9A5 5 0 1115.9 9H16a4 4 0 010 8H7z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v5m0 0l-2-2m2 2l2-2" />
            </svg>
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">النسخ الاحتياطي السحابي</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">نسخة يومية مضغوطة تُرفع لحسابك على السحابة (Backblaze B2)</p>
          </div>
        </div>
        {/* Status chip */}
        {!cloudLoading && cloud && (
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ring-1 whitespace-nowrap ${
              !cloud.configured
                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-900/50'
                : cloud.enabled
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 ring-green-200 dark:ring-green-900/50'
                : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 ring-gray-200 dark:ring-gray-600'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                !cloud.configured ? 'bg-amber-500' : cloud.enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}
            />
            {!cloud.configured ? 'محتاج إعداد' : cloud.enabled ? 'شغّال' : 'مقفول'}
          </span>
        )}
      </div>

      <div className="p-6">
        {/* رسالة */}
        {cloudMsg && (
          <div
            className={`mb-4 p-4 rounded-lg ring-1 flex items-start gap-2 ${
              cloudMsg.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 ring-green-200 dark:ring-green-900/50 text-green-800 dark:text-green-200'
                : 'bg-red-50 dark:bg-red-900/20 ring-red-200 dark:ring-red-900/50 text-red-800 dark:text-red-200'
            }`}
            style={{ whiteSpace: 'pre-line' }}
          >
            {cloudMsg.type === 'success' ? <CheckIcon className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <WarnIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />}
            <span className="text-sm">{cloudMsg.text}</span>
          </div>
        )}

        {cloudLoading ? (
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm py-2" aria-busy="true">
            <Spinner />
            جاري تحميل حالة النسخ السحابي...
          </div>
        ) : cloud ? (
          <>
            {/* صف التفعيل */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 bg-gray-50 dark:bg-gray-900/40">
              <div>
                <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">الرفع التلقائي اليومي</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  لما يكون شغّال، السيستم بيرفع نسخة كل يوم أوتوماتيك من غير أي تدخّل.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={cloud.enabled}
                aria-label="تفعيل أو إقفال النسخ الاحتياطي السحابي"
                onClick={handleToggleCloud}
                disabled={cloudToggling || (!cloud.enabled && !cloud.configured)}
                dir="ltr"
                className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed ${
                  cloud.enabled ? 'bg-green-600 focus-visible:ring-green-500' : 'bg-gray-300 dark:bg-gray-600 focus-visible:ring-gray-400'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                    cloud.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* تحذير الإعداد الناقص */}
            {!cloud.configured && (
              <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 p-4 rounded-lg text-sm">
                <p className="font-bold mb-1 text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <WarnIcon className="w-4 h-4" />
                  محتاج إعداد قبل التفعيل
                </p>
                <p className="text-amber-900 dark:text-amber-200">
                  لازم تظبّط متغيرات Backblaze في ملف الـ <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">.env</code> وتعيد تشغيل السيرفر:
                  <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded mx-1">B2_KEY_ID</code>،
                  <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded mx-1">B2_APPLICATION_KEY</code>،
                  <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded mx-1">B2_BUCKET_ID</code>.
                </p>
              </div>
            )}

            {/* شبكة الحالة */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">الوجهة (Bucket)</p>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5 truncate" title={cloud.bucketName}>{cloud.bucketName}</p>
              </div>
              <div className="p-3 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">الجيم / الفرع</p>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5 truncate">
                  {cloud.gymConfigured ? `${cloud.gymName || '—'} — ${cloud.branchName || '—'}` : 'غير مفعّل'}
                </p>
              </div>
              <div className="p-3 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">آخر رفعة ناجحة</p>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5">{fmtDate(cloud.lastCloudBackupAt)}</p>
              </div>
              <div className="p-3 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">حجم آخر نسخة</p>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5">{fmtSize(cloud.lastCloudBackupSize)}</p>
              </div>
            </div>

            {/* آخر خطأ */}
            {cloud.lastCloudBackupError && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 p-4 rounded-lg text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
                <XIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">آخر خطأ في الرفع: </span>
                  <span className="break-words">{cloud.lastCloudBackupError}</span>
                </div>
              </div>
            )}

            {/* زر الرفع الفوري */}
            <div className="mt-5">
              <button
                onClick={handleCloudUploadNow}
                disabled={cloudUploading || !cloud.configured || !cloud.gymConfigured}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                {cloudUploading ? (
                  <>
                    <Spinner />
                    جاري الرفع للسحابة...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" {...stroke}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 18a4 4 0 01-.88-7.9A5 5 0 1115.9 9H16a4 4 0 010 8H7z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-5m0 0l-2 2m2-2l2 2" />
                    </svg>
                    ارفع نسخة دلوقتي
                  </>
                )}
              </button>
            </div>

            {/* شرح */}
            <div className="mt-5 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 p-4 rounded-lg text-sm">
              <p className="font-bold mb-2 text-blue-900 dark:text-blue-200">إزاي بيشتغل؟</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li>كل يوم بيتاخد snapshot متسق من قاعدة البيانات، يتضغط (gzip ~٨٨٪ أصغر)، ويترفع لحسابك.</li>
                <li>كل جيم/فرع في مجلد لوحده، وآخر نسخة بتفضل محفوظة دايمًا حتى لو الجهاز فصل.</li>
                <li>الاحتفاظ بتاريخ أسبوع بيتظبط كـ Lifecycle rule على الـ bucket من موقع Backblaze.</li>
                <li>المفتاح المحطوط هنا "رفع فقط" — الاسترجاع بتعمله إنت من حسابك بس.</li>
              </ul>
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-400 py-2">تعذّر تحميل حالة النسخ السحابي.</div>
        )}
      </div>
    </div>
  );
}
