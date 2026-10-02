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
import { useLanguage } from '../../../contexts/LanguageContext';

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
  const { tr, locale, direction } = useLanguage();
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
      else setMsg({ type: 'err', text: data.error || tr('مقدرتش أحمّل البوابات', 'Could not load gates') });
    } catch {
      setMsg({ type: 'err', text: tr('مشكلة في الاتصال بالسيرفر', 'Server connection problem') });
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
      setMsg({ type: 'err', text: data.error || tr('مقدرتش أحفظ التفعيل', 'Could not save the setting') });
    }
  };

  const call = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.success !== false, data };
  };

  const save = async () => {
    if (!form.name.trim() || !form.host.trim()) {
      setMsg({ type: 'err', text: tr('اسم البوابة والـ IP مطلوبين', 'Gate name and IP are required') }); return;
    }
    if (!editingId && !form.password) {
      setMsg({ type: 'err', text: tr('كلمة سر الجهاز مطلوبة', 'Device password is required') }); return;
    }
    setBusy('save');
    const { ok, data } = await call(editingId ? `/api/gates/${editingId}` : '/api/gates', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify(form),
    });
    setBusy(null);
    if (!ok) { setMsg({ type: 'err', text: data.error || tr('فشل الحفظ', 'Save failed'), detail: data.detail }); return; }
    setMsg({ type: 'ok', text: editingId ? tr('اتحفظت', 'Saved') : tr('البوابة اتضافت', 'Gate added') });
    setShowForm(false); setEditingId(null); setForm({ ...emptyForm });
    load();
  };

  const test = async (g: Gate) => {
    setBusy(`test-${g.id}`);
    const { ok, data } = await call(`/api/gates/${g.id}/test`, { method: 'POST' });
    setBusy(null);
    setMsg(ok
      ? { type: 'ok', text: `${tr('الجهاز رد', 'Device responded')} ✓ ${data.model ? `— ${data.model}` : ''}${data.firmware ? ` (${data.firmware})` : ''}` }
      : { type: 'err', text: data.error || tr('الاختبار فشل', 'Test failed'), detail: data.detail });
    load();
  };

  const door = async (g: Gate, action: 'open' | 'close') => {
    setBusy(`door-${g.id}`);
    const { ok, data } = await call(`/api/gates/${g.id}/door`, { method: 'POST', body: JSON.stringify({ action }) });
    setBusy(null);
    setMsg(ok
      ? { type: 'ok', text: action === 'open' ? tr('الباب اتفتح', 'Door opened') : tr('الباب اتقفل', 'Door closed') }
      : { type: 'err', text: data.error || tr('الأمر فشل', 'Command failed'), detail: data.detail });
  };

  const syncAll = async (dryRun: boolean) => {
    setBusy('sync');
    const { ok, data } = await call('/api/gates/sync', { method: 'POST', body: JSON.stringify({ dryRun }) });
    setBusy(null);
    if (!ok) { setMsg({ type: 'err', text: data.error || tr('المزامنة فشلت', 'Sync failed'), detail: data.detail }); return; }
    const lines = (data.reports || []).map((r: any) =>
      `${r.gateName}: ${dryRun ? tr('هيتضاف', 'to add') : tr('اتضاف', 'added')} ${r.added}${tr('، ', ', ')}${dryRun ? tr('هيتعدّل', 'to update') : tr('اتعدّل', 'updated')} ${r.modified}` +
      (r.deleted ? `${tr('، اتشال', ', removed')} ${r.deleted}` : '') + (r.failed ? ` ⚠️ ${tr('فشل', 'failed')} ${r.failed}` : '')
    );
    setMsg({ type: 'ok', text: (dryRun ? tr('معاينة — مالمستش أي جهاز · ', 'Preview — no device was changed · ') : '') + lines.join(' · ') });
    load();
  };

  const remove = async (g: Gate) => {
    if (!confirm(tr(`تشيل "${g.name}" من السيستم؟\n\nالمستخدمين المسجّلين على الجهاز نفسه مش هيتمسحوا.`, `Remove "${g.name}" from the system?\n\nUsers enrolled on the device itself will not be deleted.`))) return;
    setBusy(`del-${g.id}`);
    const { ok, data } = await call(`/api/gates/${g.id}`, { method: 'DELETE' });
    setBusy(null);
    setMsg(ok ? { type: 'ok', text: data.note || tr('اتشالت', 'Removed') } : { type: 'err', text: data.error || tr('فشل الحذف', 'Delete failed') });
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6" dir={direction}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => router.push('/settings')}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 transition-colors duration-200"
          >
            <svg {...stroke} className="w-4 h-4 rtl:rotate-180"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            <span>{tr('العودة للإعدادات', 'Back to settings')}</span>
          </button>
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M6 21V7l6-4 6 4v14M10 21v-5h4v5" /></svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{tr('البوابات', 'Gates')}</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {tr('أجهزة التعرّف على الوش — العضو يدخل بوشه والحضور يتسجّل لوحده', 'Face recognition devices — members enter with their face and attendance is logged automatically')}
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
              <button onClick={() => setMsg(null)} aria-label={tr('إغلاق', 'Close')} className="text-sm opacity-60 hover:opacity-100 w-10 h-10 -m-2 flex items-center justify-center flex-shrink-0">✕</button>
            </div>
          </div>
        )}

        {/* ── تفعيل الميزة ── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{tr('تفعيل البوابات', 'Enable gates')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {tr('لما تكون مفعّلة: بوب-أب في صفحة التشيك لما البوابة ترفض حد، وزرار مسح الوش في صفحة العضو.', 'When enabled: a popup on the check-in page when a gate denies someone, and a face-scan button on the member page.')}
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{tr('الأجهزة', 'Devices')}</h2>
            {!showForm && (
              <button
                onClick={() => { setEditingId(null); setForm({ ...emptyForm }); setShowForm(true); }}
                className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
              >
                + {tr('بوابة جديدة', 'New gate')}
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">{tr('بيحمّل…', 'Loading…')}</p>
          ) : gates.length === 0 && !showForm ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400 mb-1">{tr('لسه مفيش بوابات', 'No gates yet')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">{tr('ضيف جهاز عشان تبدأ', 'Add a device to get started')}</p>
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
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{tr('متوقفة', 'Disabled')}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 font-mono" dir="ltr">
                          {g.useHttps ? 'https' : 'http'}://{g.host}:{g.port} · door {g.doorNo}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {g.onDevice} / {g.capacity} {tr('مستخدم', 'users')} ({pct}%)
                          {pct >= 90 && <span className="text-amber-600 dark:text-amber-400 font-semibold"> — {tr('السعة قربت تخلص', 'Capacity almost full')}</span>}
                        </p>
                        {g.lastError && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{tr('آخر خطأ:', 'Last error:')} {g.lastError}</p>
                        )}
                        {g.lastSeenAt && !g.lastError && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                            {tr('آخر رد:', 'Last response:')} {new Date(g.lastSeenAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => test(g)} disabled={busy === `test-${g.id}`}
                          className="px-3 py-1.5 rounded-lg text-sm font-semibold ring-1 ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
                          {busy === `test-${g.id}` ? '…' : tr('اختبار', 'Test')}
                        </button>
                        <button onClick={() => door(g, 'open')} disabled={busy === `door-${g.id}`}
                          className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
                          {busy === `door-${g.id}` ? '…' : tr('افتح', 'Open')}
                        </button>
                        <button onClick={() => startEdit(g)}
                          className="px-3 py-1.5 rounded-lg text-sm font-semibold ring-1 ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                          {tr('تعديل', 'Edit')}
                        </button>
                        <button onClick={() => remove(g)} disabled={busy === `del-${g.id}`}
                          className="px-3 py-1.5 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
                          {tr('حذف', 'Delete')}
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
                    {tr('معاينة المزامنة', 'Preview sync')}
                  </button>
                  <button onClick={() => syncAll(false)} disabled={busy === 'sync'}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50">
                    {busy === 'sync' ? tr('بيزامن…', 'Syncing…') : tr('زامن كل الأعضاء', 'Sync all members')}
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 self-center">
                    {tr('المزامنة بتحصل لوحدها كل ربع ساعة — الزرار ده للتعجيل', 'Sync runs automatically every 15 minutes — this button runs it now')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* نموذج الإضافة/التعديل */}
          {showForm && (
            <div className="mt-4 rounded-xl ring-1 ring-primary-200 dark:ring-primary-900/50 bg-primary-50/50 dark:bg-primary-900/10 p-4 space-y-3">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">
                {editingId ? tr('تعديل البوابة', 'Edit gate') : tr('بوابة جديدة', 'New gate')}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={tr('اسم البوابة', 'Gate name')}>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder={tr('البوابة الرئيسية', 'Main gate')} className={inputCls} />
                </Field>
                <Field label={tr('IP الجهاز', 'Device IP')}>
                  <input value={form.host} onChange={e => setForm({ ...form, host: e.target.value })}
                    placeholder="192.168.1.64" dir="ltr" className={inputCls} />
                </Field>
                <Field label={tr('اسم المستخدم', 'Username')}>
                  <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                    dir="ltr" className={inputCls} />
                </Field>
                <Field label={editingId ? tr('كلمة السر (سيبها فاضية لو مش هتغيّرها)', 'Password (leave empty to keep it)') : tr('كلمة السر', 'Password')}>
                  <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    dir="ltr" className={inputCls} autoComplete="new-password" />
                </Field>
                <Field label={tr('البورت', 'Port')}>
                  <input type="number" value={form.port} onChange={e => setForm({ ...form, port: Number(e.target.value) })}
                    dir="ltr" className={inputCls} />
                </Field>
                <Field label={tr('رقم الباب', 'Door number')}>
                  <input type="number" value={form.doorNo} onChange={e => setForm({ ...form, doorNo: Number(e.target.value) })}
                    dir="ltr" className={inputCls} />
                </Field>
                <Field label={tr('رقم جدول الصلاحية', 'Access schedule number')}>
                  <input value={form.planTemplateNo} onChange={e => setForm({ ...form, planTemplateNo: e.target.value })}
                    dir="ltr" className={inputCls} />
                </Field>
                <Field label={tr('سعة الأوشاش', 'Face capacity')}>
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
                  {tr('مفعّلة', 'Enabled')}
                </label>
              </div>

              <div className="flex gap-2">
                <button onClick={save} disabled={busy === 'save'}
                  className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50">
                  {busy === 'save' ? tr('بيحفظ…', 'Saving…') : tr('حفظ', 'Save')}
                </button>
                <button onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...emptyForm }); }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold ring-1 ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                  {tr('إلغاء', 'Cancel')}
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
