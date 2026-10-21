'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * 🖥️ زرار «دعم عن بُعد» في هيدر صفحة الدعم الفني — لكل الموظفين اللي عاملين لوجين.
 * بيفتح نافذة صغيرة: الحالة + رقم الجهاز + زرار التفعيل (RustDesk على سيرفر FitBoost).
 * بيظهر بس على جهاز السيستم الأساسي (ويندوز). الباسورد عند فيت بوست بس — مش بيظهر هنا أبداً.
 */

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const;

interface RemoteStatus {
  supported: boolean;
  installed: boolean;
  configured: boolean;
  id: string | null;
  configuredAt: string | null;
  lastError: string | null;
}

const fmtId = (id: string) => id.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export default function RemoteSupportButton() {
  const { tr } = useLanguage();
  const [st, setSt] = useState<RemoteStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/settings/remote-support');
      if (res.ok) setSt(await res.json());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy]);

  const setup = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/settings/remote-support', { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      setMsg({ type: d?.success ? 'success' : 'error', text: d?.message || d?.error || tr('حصل خطأ', 'An error occurred') });
      await load();
    } catch {
      setMsg({ type: 'error', text: tr('حصل خطأ في الاتصال', 'Connection error') });
    } finally {
      setBusy(false);
    }
  };

  const copyId = async () => {
    if (!st?.id) return;
    try {
      await navigator.clipboard.writeText(st.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  if (!st || !st.supported) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => { setMsg(null); setOpen(true); }}
        aria-label={tr('الدعم الفني عن بُعد', 'Remote support')}
        title={tr('الدعم الفني عن بُعد — فريق فيت بوست يدخل على الجهاز', 'Remote support — let the FitBoost team access this device')}
        className="flex-shrink-0 relative inline-flex items-center gap-1.5 h-11 px-3 rounded-full text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <svg className="w-5 h-5" {...stroke} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="hidden sm:inline">{tr('دعم عن بُعد', 'Remote')}</span>
        <span
          className={`absolute top-2 end-2 w-2 h-2 rounded-full ${st.configured ? 'bg-emerald-500' : 'bg-amber-500'}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={() => { if (!busy) setOpen(false); }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remote-support-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4 bg-gradient-to-l from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 border-b border-gray-200 dark:border-gray-700">
              <div className="min-w-0">
                <h2 id="remote-support-title" className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {tr('الدعم الفني عن بُعد', 'Remote Technical Support')}
                </h2>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {tr('فريق فيت بوست يدخل على الجهاز ده ويحل المشكلة', 'The FitBoost team can access this device to fix issues')}
                </p>
              </div>
              {st.configured ? (
                <span className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {tr('مفعّل', 'Enabled')}
                </span>
              ) : (
                <span className="flex-shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {tr('مش مفعّل', 'Not enabled')}
                </span>
              )}
            </div>

            <div className="p-5 space-y-4">
              {st.configured && st.id && (
                <button
                  type="button"
                  onClick={copyId}
                  className="w-full flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-900/40 px-4 py-3 min-h-[44px] hover:bg-gray-100 dark:hover:bg-gray-900/60"
                  title={tr('نسخ رقم الجهاز', 'Copy device ID')}
                >
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {copied ? tr('اتنسخ ✓', 'Copied ✓') : tr('رقم الجهاز', 'Device ID')}
                  </span>
                  <span className="font-mono text-lg font-bold tracking-wider text-gray-900 dark:text-gray-100" dir="ltr">{fmtId(st.id)}</span>
                </button>
              )}

              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {st.configured
                  ? tr('الدعم شغال. ابعت رقم الجهاز لفريق الدعم لو طلبوه. الباسورد عند فيت بوست بس — محدش هنا محتاج يعرفه.', 'Support is active. Send the device ID to the support team if they ask. Only FitBoost has the password.')
                  : tr('هينزّل برنامج الدعم (RustDesk) ويظبطه على سيرفر فيت بوست. ويندوز هيسألك «هل تسمح…» — دوس Yes.', 'This will download the support app (RustDesk) and configure it on the FitBoost server. Windows will ask “Do you want to allow…” — click Yes.')}
              </p>

              {msg && (
                <div
                  className={`rounded-lg px-4 py-3 text-sm ${
                    msg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  }`}
                >
                  {msg.text}
                </div>
              )}
              {!msg && st.lastError && !st.configured && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                  {tr('آخر محاولة', 'Last attempt')}: {st.lastError}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="min-h-[44px] rounded-lg px-5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60"
                >
                  {tr('إغلاق', 'Close')}
                </button>
                <button
                  type="button"
                  onClick={setup}
                  disabled={busy}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {busy
                    ? tr('جاري التفعيل… (لو ويندوز سأل دوس Yes)', 'Enabling… (if Windows asks, click Yes)')
                    : st.configured
                      ? tr('إعادة الظبط', 'Reconfigure')
                      : tr('تفعيل الدعم عن بُعد', 'Enable Remote Support')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
