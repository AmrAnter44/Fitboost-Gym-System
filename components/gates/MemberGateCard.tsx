'use client';

//  🚪 حالة العضو على البوابات + زرار مسح الوش — بيظهر في صفحة العضو
//
//  الزرار ده موجود لأن الوش بيتسجّل على الجهاز نفسه: لو العضو اتسجّل غلط،
//  أو رقم العضوية اتنقل لحد تاني، لازم يبقى في طريقة تمسحه من الجهاز من
//  غير ما حد يروح يقف قدامه.

import { useCallback, useEffect, useState } from 'react';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const;

interface GateStatus {
  gateId: string;
  gateName: string;
  isAllowed: boolean;
  validUntil: string | null;
  syncedAt: string;
  lastError: string | null;
}

export default function MemberGateCard({
  memberId,
  enabled,
  canEdit,
}: {
  memberId: string;
  /** من SystemSettings.gatesEnabled — الكارت مايظهرش لو الميزة مقفولة */
  enabled: boolean;
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<GateStatus[] | null>(null);
  const [busy, setBusy] = useState<'del' | 'sync' | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/gates/member/${memberId}`);
      const data = await res.json();
      if (data.success) setRows(data.onGates);
    } catch { setRows([]); }
  }, [memberId]);

  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled || rows === null) return null;

  const act = async (kind: 'del' | 'sync') => {
    if (kind === 'del' && !confirm('تمسح وش العضو من الجهاز؟\n\nلو رجع يجدّد هيحتاج يسجّل وشه تاني.')) return;
    setBusy(kind);
    setMsg(null);
    try {
      const res = await fetch(`/api/gates/member/${memberId}`, { method: kind === 'del' ? 'DELETE' : 'POST' });
      const data = await res.json();
      setMsg(data.success
        ? { type: 'ok', text: data.warning || data.note || 'تم' }
        : { type: 'err', text: data.error || 'العملية فشلت' });
      load();
    } catch {
      setMsg({ type: 'err', text: 'مشكلة في الاتصال' });
    } finally { setBusy(null); }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5" dir="rtl">
      <div className="flex items-center gap-2 mb-3">
        <svg {...stroke} className="w-5 h-5 text-emerald-600 dark:text-emerald-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M6 21V7l6-4 6 4v14M10 21v-5h4v5" />
        </svg>
        <h3 className="font-bold text-gray-900 dark:text-gray-100">البوابات</h3>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          العضو ده لسه مش متبعت لأي بوابة.
          <span className="block text-xs mt-1">
            بيتبعت تلقائيًا لما يبقى اشتراكه ساري — وبعدين يسجّل وشه على الجهاز.
          </span>
        </p>
      ) : (
        <div className="space-y-2 mb-3">
          {rows.map(r => (
            <div key={r.gateId} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-700 dark:text-gray-300">{r.gateName}</span>
              <div className="flex items-center gap-2">
                {r.lastError ? (
                  <span className="text-xs text-red-600 dark:text-red-400" title={r.lastError}>فشلت المزامنة</span>
                ) : r.isAllowed ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-semibold">
                    مسموح
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    متوقف
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {msg && (
        <p className={`text-xs mb-3 ${msg.type === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {msg.text}
        </p>
      )}

      {canEdit && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => act('sync')}
            disabled={busy !== null}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold ring-1 ring-gray-300 dark:ring-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {busy === 'sync' ? '…' : 'إعادة مزامنة'}
          </button>
          {rows.length > 0 && (
            <button
              onClick={() => act('del')}
              disabled={busy !== null}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              {busy === 'del' ? '…' : 'امسح الوش من الجهاز'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
