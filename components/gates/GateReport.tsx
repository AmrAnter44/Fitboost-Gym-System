'use client';

//  🚪 تقرير البوابات
//
//  الترتيب مقصود: **المرفوضين الأول**. الجيم عنده تقرير حضور بالفعل، فاللي
//  البوابة بتضيفه فعلاً هو معرفة مين حاول يدخل واترفض وليه — ده اللي
//  بيوريك مشاكل التسجيل والاشتراكات المنتهية اللي الناس لسه بتيجي عليها.

import { useCallback, useEffect, useState } from 'react';

interface GateEventRow {
  id: string;
  at: string;
  allowed: boolean;
  reason: string | null;
  reasonText: string | null;
  employeeNo: string | null;
  gateName: string | null;
  member: { id: string; name: string; memberNumber: string | null; phone: string | null } | null;
}

interface Stats {
  total: number;
  allowed: number;
  denied: number;
  deniedByReason: { reason: string; label: string; count: number }[];
  daily: { day: string; total: number; allowed: number }[];
}

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

export default function GateReport() {
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(today());
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<GateEventRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'denied'>('denied');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gates/report?startDate=${from}&endDate=${to}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setEvents(data.events);
        setTruncated(!!data.truncated);
      }
    } catch { /* الواجهة بتفضل فاضية */ }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const shown = filter === 'denied' ? events.filter(e => !e.allowed) : events;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">تقرير الدخول</h2>

      <div className="flex gap-2 flex-wrap items-end mb-4">
        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">من</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">إلى</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls} />
        </label>
        <button onClick={load} disabled={loading}
          className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50">
          {loading ? '…' : 'عرض'}
        </button>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Stat label="كل المحاولات" value={stats.total} />
            <Stat label="دخلوا" value={stats.allowed} tone="ok" />
            <Stat label="اترفضوا" value={stats.denied} tone="warn" />
          </div>

          {/* أهم جزء: ليه اترفضوا */}
          {stats.deniedByReason.length > 0 && (
            <div className="mb-4 rounded-xl ring-1 ring-amber-200 dark:ring-amber-900/50 bg-amber-50/60 dark:bg-amber-900/10 p-4">
              <h3 className="font-bold text-sm text-amber-900 dark:text-amber-200 mb-2">أسباب الرفض</h3>
              <div className="space-y-1">
                {stats.deniedByReason.map(r => (
                  <div key={r.reason} className="flex items-center justify-between text-sm">
                    <span className="text-amber-900 dark:text-amber-200">{r.label}</span>
                    <span className="font-bold text-amber-900 dark:text-amber-200">{r.count}</span>
                  </div>
                ))}
              </div>
              {stats.deniedByReason.some(r => r.reason === 'unparsed' || r.reason === 'unknownMember') && (
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-2 leading-relaxed">
                  في أحداث مش متعرّف عليها — غالبًا مستخدم متسجّل على الجهاز
                  برقم مش موجود في السيستم، أو حدث مش بتاع دخول أصلاً.
                </p>
              )}
            </div>
          )}

          {stats.daily.length > 0 && (
            <div className="mb-4">
              <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">يوم بيوم</h3>
              <div className="space-y-1">
                {stats.daily.map(d => {
                  const max = Math.max(...stats.daily.map(x => x.total), 1);
                  return (
                    <div key={d.day} className="flex items-center gap-2 text-xs">
                      <span className="w-24 text-gray-500 dark:text-gray-400 font-mono" dir="ltr">{d.day}</span>
                      <div className="flex-1 h-5 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden flex">
                        <div className="bg-emerald-500 h-full" style={{ width: `${(d.allowed / max) * 100}%` }} />
                        <div className="bg-amber-500 h-full" style={{ width: `${((d.total - d.allowed) / max) * 100}%` }} />
                      </div>
                      <span className="w-16 text-end text-gray-600 dark:text-gray-400">
                        {d.allowed}/{d.total}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex gap-2 mb-2">
        <button onClick={() => setFilter('denied')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${filter === 'denied'
            ? 'bg-primary-600 text-white'
            : 'ring-1 ring-gray-300 dark:ring-gray-600 text-gray-700 dark:text-gray-300'}`}>
          المرفوضين
        </button>
        <button onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${filter === 'all'
            ? 'bg-primary-600 text-white'
            : 'ring-1 ring-gray-300 dark:ring-gray-600 text-gray-700 dark:text-gray-300'}`}>
          الكل
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
          {loading ? 'بيحمّل…' : 'مفيش أحداث في المدى ده'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="text-start py-2 font-semibold">الوقت</th>
                <th className="text-start py-2 font-semibold">العضو</th>
                <th className="text-start py-2 font-semibold">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(e => (
                <tr key={e.id} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {new Date(e.at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="py-2">
                    {e.member ? (
                      <a href={`/members/${e.member.id}`} className="text-primary-700 dark:text-primary-400 hover:underline font-semibold">
                        {e.member.name}
                        <span className="text-gray-400 font-normal"> #{e.member.memberNumber}</span>
                      </a>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">
                        {e.employeeNo ? `رقم غير معروف: ${e.employeeNo}` : '—'}
                      </span>
                    )}
                  </td>
                  <td className="py-2">
                    {e.allowed ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">دخل</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">{e.reasonText || e.reason || 'مرفوض'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {truncated && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              بتشوف أحدث ٣٠٠ حدث بس — ضيّق المدى لو عايز تشوف الباقي.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const inputCls =
  'px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 ' +
  'text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' }) {
  const color = tone === 'ok'
    ? 'text-emerald-700 dark:text-emerald-400'
    : tone === 'warn'
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-gray-900 dark:text-gray-100';
  return (
    <div className="rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}
