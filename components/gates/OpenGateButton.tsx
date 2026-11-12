'use client';

//  🚪 زرار «افتح البوابة» السريع — لصفحة التشيك إن.
//  نفس أمر صفحة إعدادات البوابات (/api/gates/[id]/door) المتاح لأي موظف
//  مسجّل دخول، وكل فتح بيتسجّل في الـ audit log. لو مفيش بوابات مفعّلة الزرار
//  مش بيظهر خالص.

import { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface AvailableGate {
  id: string;
  name: string;
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const;

export default function OpenGateButton() {
  const { tr } = useLanguage();
  const [gates, setGates] = useState<AvailableGate[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/gates/available')
      .then(r => r.json())
      .then(d => { if (alive && d?.success) setGates(d.gates ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(t);
  }, [msg]);

  if (gates.length === 0) return null;

  const open = async (g: AvailableGate) => {
    setBusy(g.id);
    try {
      const res = await fetch(`/api/gates/${g.id}/door`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open' }),
      });
      const data = await res.json().catch(() => ({}));
      const ok = res.ok && data.success !== false;
      setMsg(ok
        ? { ok: true, text: gates.length > 1 ? `${tr('اتفتحت', 'Opened')}: ${g.name}` : tr('البوابة اتفتحت', 'Gate opened') }
        : { ok: false, text: data.error || tr('فتح البوابة فشل', 'Failed to open the gate') });
    } catch {
      setMsg({ ok: false, text: tr('مفيش اتصال بالسيرفر', 'No connection to the server') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {gates.map(g => (
        <button
          key={g.id}
          type="button"
          onClick={() => open(g)}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-sm disabled:opacity-50 transition"
        >
          <svg className="w-5 h-5" {...stroke}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 017.83-1.17M5 11h14v10H5z" />
          </svg>
          {busy === g.id
            ? '…'
            : gates.length > 1
              ? `${tr('افتح', 'Open')} ${g.name}`
              : tr('افتح البوابة', 'Open gate')}
        </button>
      ))}
      {msg && (
        <span
          role="status"
          className={`text-sm font-semibold ${msg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
        >
          {msg.text}
        </span>
      )}
    </div>
  );
}
