'use client';

import { useEffect, useState } from 'react';

/**
 * 🖥️ كارت "الدعم الفني عن بُعد" (RustDesk على سيرفر FitBoost) — للأونر بس، وويندوز بس.
 * زرار واحد: بينزّل RustDesk ويظبطه ويبعت رقم الجهاز لفيت بوست.
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

export default function RemoteSupportCard() {
  const [isOwner, setIsOwner] = useState(false);
  const [st, setSt] = useState<RemoteStatus | null>(null);
  const [busy, setBusy] = useState(false);
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
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user?.role === 'OWNER') {
          setIsOwner(true);
          load();
        }
      })
      .catch(() => {});
  }, []);

  const setup = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/settings/remote-support', { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      setMsg({ type: d?.success ? 'success' : 'error', text: d?.message || d?.error || 'حصل خطأ' });
      await load();
    } catch {
      setMsg({ type: 'error', text: 'حصل خطأ في الاتصال' });
    } finally {
      setBusy(false);
    }
  };

  if (!isOwner || !st || !st.supported) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 py-5 bg-gradient-to-l from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300">
            <svg className="w-6 h-6" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">الدعم الفني عن بُعد</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400">فريق فيت بوست يقدر يدخل على الجهاز ده لما تحتاج مساعدة</p>
          </div>
        </div>
        {st.configured ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> مفعّل
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300">مش مفعّل</span>
        )}
      </div>

      <div className="p-6 space-y-4">
        {st.configured && st.id && (
          <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-900/40 px-4 py-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">رقم الجهاز</span>
            <span className="font-mono text-lg font-bold tracking-wider text-gray-900 dark:text-gray-100" dir="ltr">{fmtId(st.id)}</span>
          </div>
        )}

        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {st.configured
            ? 'الدعم شغال. الباسورد عند فيت بوست بس — محدش هنا محتاج يعرفه.'
            : 'هينزّل برنامج الدعم (RustDesk) ويظبطه على سيرفر فيت بوست. ويندوز هيسألك «هل تسمح…» — دوس Yes.'}
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
            آخر محاولة: {st.lastError}
          </div>
        )}

        <button
          type="button"
          onClick={setup}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {busy ? 'جاري التفعيل… (لو ويندوز سأل دوس Yes)' : st.configured ? 'إعادة الظبط' : 'تفعيل الدعم عن بُعد'}
        </button>
      </div>
    </div>
  );
}
