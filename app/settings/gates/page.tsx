'use client';

//  🚪 صفحة البوابات — الأجهزة + تعليمات الربط + التقرير
//
//  الصلاحية: الإعدادات للأونر بس (زي صفحة التانل). فتح الباب متاح لأي
//  مستخدم من مكان تاني — الصفحة دي للإعداد.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingScreen } from '../../../components/Spinner';
import GateReport from '../../../components/gates/GateReport';
import GateListenerSetup from '../../../components/gates/GateListenerSetup';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const;

export interface Gate {
  id: string;
  name: string;
  host: string;
  port: number;
  useHttps: boolean;
  username: string;
  doorNo: number;
  planTemplateNo: string;
  capacity: number;
  isEnabled: boolean;
  lastSeenAt: string | null;
  lastError: string | null;
  onDevice: number;
}

const emptyForm = {
  name: '', host: '', port: 80, useHttps: false, username: 'admin', password: '',
  doorNo: 1, planTemplateNo: '1', capacity: 1500, isEnabled: true,
};

export default function GatesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [gates, setGates] = useState<Gate[]>([]);
  const [eventSecret, setEventSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string; detail?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [gatesEnabled, setGatesEnabled] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  //  الأونر بس — نفس حارس صفحة التانل
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) { router.push('/login'); return; }
        const data = await res.json();
        if (data.user.role !== 'OWNER') { router.push('/'); return; }
        setUser(data.user);
      } catch { router.push('/login'); }
      finally { setAuthLoading(false); }
    })();
  }, [router]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/gates');
      const data = await res.json();
      if (data.success) { setGates(data.gates); setEventSecret(data.eventSecret); }
      else setMsg({ type: 'err', text: data.error || 'مقدرتش أحمّل البوابات' });
    } catch {
      setMsg({ type: 'err', text: 'مشكلة في الاتصال بالسيرفر' });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  //  حالة التفعيل بتيجي من نفس مسار إعدادات الخدمات زي باقي المميزات
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch('/api/settings/services');
        const d = await res.json();
        setGatesEnabled(!!d.gatesEnabled);
      } catch { /* بتفضل مقفولة */ }
    })();
  }, [user]);

  const toggleFeature = async (on: boolean) => {
    setGatesEnabled(on);
    const { ok, data } = await call('/api/settings/services', {
      method: 'PUT',
      body: JSON.stringify({ gatesEnabled: on }),
    });
    if (!ok) {
      setGatesEnabled(!on);
      setMsg({ type: 'err', text: data.error || 'مقدرتش أحفظ التفعيل' });
    }
  };

  const call = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.success !== false, data };
  };

  const save = async () => {
    if (!form.name.trim() || !form.host.trim()) {
      setMsg({ type: 'err', text: 'اسم البوابة والـ IP مطلوبين' }); return;
    }
    if (!editingId && !form.password) {
      setMsg({ type: 'err', text: 'كلمة سر الجهاز مطلوبة' }); return;
    }
    setBusy('save');
    const { ok, data } = await call(editingId ? `/api/gates/${editingId}` : '/api/gates', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify(form),
    });
    setBusy(null);
    if (!ok) { setMsg({ type: 'err', text: data.error || 'فشل الحفظ', detail: data.detail }); return; }
    setMsg({ type: 'ok', text: editingId ? 'اتحفظت' : 'البوابة اتضافت' });
    setShowForm(false); setEditingId(null); setForm({ ...emptyForm });
    load();
  };

  const test = async (g: Gate) => {
    setBusy(`test-${g.id}`);
    const { ok, data } = await call(`/api/gates/${g.id}/test`, { method: 'POST' });
    setBusy(null);
    setMsg(ok
      ? { type: 'ok', text: `الجهاز رد ✓ ${data.model ? `— ${data.model}` : ''}${data.firmware ? ` (${data.firmware})` : ''}` }
      : { type: 'err', text: data.error || 'الاختبار فشل', detail: data.detail });
    load();
  };

  const door = async (g: Gate, action: 'open' | 'close') => {
    setBusy(`door-${g.id}`);
    const { ok, data } = await call(`/api/gates/${g.id}/door`, { method: 'POST', body: JSON.stringify({ action }) });
    setBusy(null);
    setMsg(ok
      ? { type: 'ok', text: action === 'open' ? 'الباب اتفتح' : 'الباب اتقفل' }
      : { type: 'err', text: data.error || 'الأمر فشل', detail: data.detail });
  };

  const syncAll = async (dryRun: boolean) => {
    setBusy('sync');
    const { ok, data } = await call('/api/gates/sync', { method: 'POST', body: JSON.stringify({ dryRun }) });
    setBusy(null);
    if (!ok) { setMsg({ type: 'err', text: data.error || 'المزامنة فشلت', detail: data.detail }); return; }
    const lines = (data.reports || []).map((r: any) =>
      `${r.gateName}: ${dryRun ? 'هيتضاف' : 'اتضاف'} ${r.added}، ${dryRun ? 'هيتعدّل' : 'اتعدّل'} ${r.modified}` +
      (r.deleted ? `، اتشال ${r.deleted}` : '') + (r.failed ? ` ⚠️ فشل ${r.failed}` : '')
    );
    setMsg({ type: 'ok', text: (dryRun ? 'معاينة — مالمستش أي جهاز · ' : '') + lines.join(' · ') });
    load();
  };

  const remove = async (g: Gate) => {
    if (!confirm(`تشيل "${g.name}" من السيستم؟\n\nالمستخدمين المسجّلين على الجهاز نفسه مش هيتمسحوا.`)) return;
    setBusy(`del-${g.id}`);
    const { ok, data } = await call(`/api/gates/${g.id}`, { method: 'DELETE' });
    setBusy(null);
    setMsg(ok ? { type: 'ok', text: data.note || 'اتشالت' } : { type: 'err', text: data.error || 'فشل الحذف' });
    load();
  };

  const startEdit = (g: Gate) => {
    setEditingId(g.id);
    //  الباسورد مابيرجعش من السيرفر — فاضي معناه "سيبه زي ما هو"
    setForm({ ...emptyForm, ...g, password: '' });
    setShowForm(true);
  };

  if (authLoading) return <LoadingScreen fullScreen />;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => router.push('/settings')}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 transition-colors duration-200"
          >
            <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            <span>العودة للإعدادات</span>
          </button>
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M6 21V7l6-4 6 4v14M10 21v-5h4v5" /></svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">البوابات</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                أجهزة التعرّف على الوش — العضو يدخل بوشه والحضور يتسجّل لوحده
              </p>
            </div>
          </div>
        </div>

        {msg && (
          <div
            role="status"
            className={`rounded-xl p-4 ring-1 ${msg.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-emerald-200 dark:ring-emerald-900/50 text-emerald-900 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-900/20 ring-red-200 dark:ring-red-900/50 text-red-900 dark:text-red-200'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{msg.text}</p>
                {msg.detail && <p className="text-xs opacity-70 mt-1 font-mono" dir="ltr">{msg.detail}</p>}
              </div>
              <button onClick={() => setMsg(null)} className="text-sm opacity-60 hover:opacity-100">✕</button>
            </div>
          </div>
        )}

        {/* ── تفعيل الميزة ── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">تفعيل البوابات</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                لما تكون مفعّلة: بوب-أب في صفحة التشيك لما البوابة ترفض حد،
                وزرار مسح الوش في صفحة العضو.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={gatesEnabled}
              onClick={() => toggleFeature(!gatesEnabled)}
              dir="ltr"
              className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                gatesEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${
                gatesEnabled ? 'left-6' : 'left-1'
              }`} />
            </button>
          </div>
        </div>

        {/* ── الأجهزة ── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">الأجهزة</h2>
            {!showForm && (
              <button
                onClick={() => { setEditingId(null); setForm({ ...emptyForm }); setShowForm(true); }}
                className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
              >
                + بوابة جديدة
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">بيحمّل…</p>
          ) : gates.length === 0 && !showForm ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400 mb-1">لسه مفيش بوابات</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">ضيف جهاز عشان تبدأ</p>
            </div>
          ) : (
            <div className="space-y-3">
              {gates.map(g => {
                const pct = Math.round((g.onDevice / Math.max(g.capacity, 1)) * 100);
                return (
                  <div key={g.id} className="rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-gray-100">{g.name}</span>
                          {!g.isEnabled && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">متوقفة</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 font-mono" dir="ltr">
                          {g.useHttps ? 'https' : 'http'}://{g.host}:{g.port} · door {g.doorNo}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {g.onDevice} / {g.capacity} مستخدم ({pct}%)
                          {pct >= 90 && <span className="text-amber-600 dark:text-amber-400 font-semibold"> — السعة قربت تخلص</span>}
                        </p>
                        {g.lastError && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">آخر خطأ: {g.lastError}</p>
                        )}
                        {g.lastSeenAt && !g.lastError && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                            آخر رد: {new Date(g.lastSeenAt).toLocaleString('ar-EG')}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => test(g)} disabled={busy === `test-${g.id}`}
                          className="px-3 py-1.5 rounded-lg text-sm font-semibold ring-1 ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
                          {busy === `test-${g.id}` ? '…' : 'اختبار'}
                        </button>
                        <button onClick={() => door(g, 'open')} disabled={busy === `door-${g.id}`}
                          className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
                          {busy === `door-${g.id}` ? '…' : 'افتح'}
                        </button>
                        <button onClick={() => startEdit(g)}
                          className="px-3 py-1.5 rounded-lg text-sm font-semibold ring-1 ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                          تعديل
                        </button>
                        <button onClick={() => remove(g)} disabled={busy === `del-${g.id}`}
                          className="px-3 py-1.5 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
                          حذف
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {gates.length > 0 && (
                <div className="flex gap-2 pt-2 flex-wrap">
                  <button onClick={() => syncAll(true)} disabled={busy === 'sync'}
                    className="px-4 py-2 rounded-lg text-sm font-semibold ring-1 ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
                    معاينة المزامنة
                  </button>
                  <button onClick={() => syncAll(false)} disabled={busy === 'sync'}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50">
                    {busy === 'sync' ? 'بيزامن…' : 'زامن كل الأعضاء'}
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 self-center">
                    المزامنة بتحصل لوحدها كل ربع ساعة — الزرار ده للتعجيل
                  </p>
                </div>
              )}
            </div>
          )}

          {/* نموذج الإضافة/التعديل */}
          {showForm && (
            <div className="mt-4 rounded-xl ring-1 ring-primary-200 dark:ring-primary-900/50 bg-primary-50/50 dark:bg-primary-900/10 p-4 space-y-3">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">
                {editingId ? 'تعديل البوابة' : 'بوابة جديدة'}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="اسم البوابة">
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="البوابة الرئيسية" className={inputCls} />
                </Field>
                <Field label="IP الجهاز">
                  <input value={form.host} onChange={e => setForm({ ...form, host: e.target.value })}
                    placeholder="192.168.1.64" dir="ltr" className={inputCls} />
                </Field>
                <Field label="اسم المستخدم">
                  <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                    dir="ltr" className={inputCls} />
                </Field>
                <Field label={editingId ? 'كلمة السر (سيبها فاضية لو مش هتغيّرها)' : 'كلمة السر'}>
                  <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    dir="ltr" className={inputCls} autoComplete="new-password" />
                </Field>
                <Field label="البورت">
                  <input type="number" value={form.port} onChange={e => setForm({ ...form, port: Number(e.target.value) })}
                    dir="ltr" className={inputCls} />
                </Field>
                <Field label="رقم الباب">
                  <input type="number" value={form.doorNo} onChange={e => setForm({ ...form, doorNo: Number(e.target.value) })}
                    dir="ltr" className={inputCls} />
                </Field>
                <Field label="رقم جدول الصلاحية">
                  <input value={form.planTemplateNo} onChange={e => setForm({ ...form, planTemplateNo: e.target.value })}
                    dir="ltr" className={inputCls} />
                </Field>
                <Field label="سعة الأوشاش">
                  <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })}
                    dir="ltr" className={inputCls} />
                </Field>
              </div>

              <div className="flex gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={form.useHttps} onChange={e => setForm({ ...form, useHttps: e.target.checked })} />
                  HTTPS
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={form.isEnabled} onChange={e => setForm({ ...form, isEnabled: e.target.checked })} />
                  مفعّلة
                </label>
              </div>

              <div className="flex gap-2">
                <button onClick={save} disabled={busy === 'save'}
                  className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50">
                  {busy === 'save' ? 'بيحفظ…' : 'حفظ'}
                </button>
                <button onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...emptyForm }); }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold ring-1 ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── تعليمات ربط الجهاز ── */}
        {gates.length > 0 && <GateListenerSetup eventSecret={eventSecret} gateHost={gates[0]?.host} />}

        {/* ── التقرير ── */}
        <GateReport />
      </div>
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 ' +
  'text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{label}</span>
      {children}
    </label>
  );
}
