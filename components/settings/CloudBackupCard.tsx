'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

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
  photos?: {
    totalTracked: number;
    lastRunAt: string | null;
    lastError: string | null;
    localCount: number;
  };
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
  const { tr, locale } = useLanguage();
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
          text: data.enabled ? tr('تم تفعيل النسخ الاحتياطي السحابي', 'Cloud backup enabled') : tr('تم إقفال النسخ الاحتياطي السحابي', 'Cloud backup disabled'),
        });
      } else {
        setCloudMsg({ type: 'error', text: data.error || tr('فشل تغيير الحالة', 'Failed to change status') });
      }
    } catch {
      setCloudMsg({ type: 'error', text: tr('حدث خطأ أثناء تغيير الحالة', 'An error occurred while changing status') });
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
      setCloudMsg({ type: data.success ? 'success' : 'error', text: data.message || (data.success ? tr('تم الرفع', 'Uploaded') : tr('فشل الرفع', 'Upload failed')) });
      await fetchCloud();
    } catch {
      setCloudMsg({ type: 'error', text: tr('حدث خطأ أثناء الرفع للسحابة', 'An error occurred while uploading to the cloud') });
    } finally {
      setCloudUploading(false);
    }
  };

  const fmtSize = (b?: number | null) => (b ? `${(b / (1024 * 1024)).toFixed(2)} MB` : '—');
  const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') : tr('لسه مفيش', 'None yet'));

  if (!isOwner) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-5 bg-gradient-to-l from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300">
            <svg className="w-6 h-6" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 18a4 4 0 01-.88-7.9A5 5 0 1115.9 9H16a4 4 0 010 8H7z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v5m0 0l-2-2m2 2l2-2" />
            </svg>
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{tr('النسخ الاحتياطي السحابي', 'Cloud Backup')}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{tr('نسخة يومية مضغوطة تُرفع لحسابك على السحابة (Backblaze B2)', 'A compressed daily backup uploaded to your cloud account (Backblaze B2)')}</p>
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
            {!cloud.configured ? tr('محتاج إعداد', 'Needs setup') : cloud.enabled ? tr('شغّال', 'Active') : tr('مقفول', 'Off')}
          </span>
        )}
      </div>

      <div className="p-4 sm:p-6">
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
            {tr('جاري تحميل حالة النسخ السحابي...', 'Loading cloud backup status...')}
          </div>
        ) : cloud ? (
          <>
            {/* صف التفعيل */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 bg-gray-50 dark:bg-gray-900/40">
              <div>
                <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">{tr('الرفع التلقائي اليومي', 'Automatic daily upload')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {tr('لما يكون شغّال، السيستم بيرفع نسخة كل يوم أوتوماتيك من غير أي تدخّل.', 'When enabled, the system uploads a backup every day automatically.')}
                </p>
              </div>
              <button
                role="switch"
                aria-checked={cloud.enabled}
                aria-label={tr('تفعيل أو إقفال النسخ الاحتياطي السحابي', 'Enable or disable cloud backup')}
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
                  {tr('محتاج إعداد قبل التفعيل', 'Setup required before enabling')}
                </p>
                <p className="text-amber-900 dark:text-amber-200">
                  {tr('الباك أب السحابي بيشتغل عن طريق فيت بوست — لازم الجهاز يكون مربوط (الإعدادات ← الترخيص).', 'Cloud backup works through FitBoost — the device must be linked (Settings → License).')}
                </p>
              </div>
            )}

            {/* شبكة الحالة */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">{tr('الوجهة (Bucket)', 'Destination (Bucket)')}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5 truncate" title={cloud.bucketName}>{cloud.bucketName}</p>
              </div>
              <div className="p-3 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">{tr('الجيم / الفرع', 'Gym / Branch')}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5 truncate">
                  {cloud.gymConfigured ? `${cloud.gymName || '—'} — ${cloud.branchName || '—'}` : tr('غير مفعّل', 'Not enabled')}
                </p>
              </div>
              <div className="p-3 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">{tr('آخر رفعة ناجحة', 'Last successful upload')}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5">{fmtDate(cloud.lastCloudBackupAt)}</p>
              </div>
              <div className="p-3 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">{tr('حجم آخر نسخة', 'Last backup size')}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5">{fmtSize(cloud.lastCloudBackupSize)}</p>
              </div>
              <div className="p-3 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 sm:col-span-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">{tr('📷 صور الأعضاء (تزايدي — الجديد بس بيترفع)', '📷 Member photos (incremental — only new ones are uploaded)')}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                  {cloud.photos
                    ? tr(`${cloud.photos.totalTracked} مرفوعة من ${cloud.photos.localCount} على الجهاز`, `${cloud.photos.totalTracked} uploaded of ${cloud.photos.localCount} on device`)
                    : '—'}
                  {cloud.photos?.lastError && (
                    <span className="text-red-600 dark:text-red-400 font-normal text-xs ms-2">— {tr('آخر خطأ', 'Last error')}: {cloud.photos.lastError}</span>
                  )}
                </p>
              </div>
            </div>

            {/* آخر خطأ */}
            {cloud.lastCloudBackupError && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 p-4 rounded-lg text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
                <XIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">{tr('آخر خطأ في الرفع', 'Last upload error')}: </span>
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
                    {tr('جاري الرفع للسحابة...', 'Uploading to cloud...')}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" {...stroke}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 18a4 4 0 01-.88-7.9A5 5 0 1115.9 9H16a4 4 0 010 8H7z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-5m0 0l-2 2m2-2l2 2" />
                    </svg>
                    {tr('ارفع نسخة دلوقتي', 'Upload a backup now')}
                  </>
                )}
              </button>
            </div>

            {/* شرح */}
            <div className="mt-5 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 p-4 rounded-lg text-sm">
              <p className="font-bold mb-2 text-blue-900 dark:text-blue-200">{tr('إزاي بيشتغل؟', 'How does it work?')}</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li>{tr('كل يوم بيتاخد snapshot متسق من قاعدة البيانات، يتضغط (gzip ~٨٨٪ أصغر)، ويترفع لحسابك.', 'Every day a consistent database snapshot is taken, compressed (gzip, ~88% smaller), and uploaded to your account.')}</li>
                <li>{tr('كل جيم/فرع في مجلد لوحده، وآخر نسخة بتفضل محفوظة دايمًا حتى لو الجهاز فصل.', 'Each gym/branch has its own folder, and the latest backup is always kept even if the device goes offline.')}</li>
                <li>{tr('الاحتفاظ بتاريخ أسبوع بيتظبط كـ Lifecycle rule على الـ bucket من موقع Backblaze.', 'One-week history retention is set as a Lifecycle rule on the bucket in Backblaze.')}</li>
                <li>{tr('المفتاح المحطوط هنا "رفع فقط" — الاسترجاع بتعمله إنت من حسابك بس.', 'The key used here is upload-only — restoring is done only by you from your account.')}</li>
              </ul>
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-400 py-2">{tr('تعذّر تحميل حالة النسخ السحابي.', 'Could not load cloud backup status.')}</div>
        )}
      </div>
    </div>
  );
}
