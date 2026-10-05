'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingScreen } from '../../../components/Spinner';
import { useLanguage } from '../../../contexts/LanguageContext';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const;

interface TunnelState {
  status: 'idle' | 'starting' | 'connecting' | 'connected' | 'error' | 'stopped';
  connections: number;
  serverUp: boolean;
  publicUrl: string;
  message: string;
  restarts: number;
  keepAwake: boolean;
  autoLaunch: boolean;
  hostname: string;
  localPort: number;
  mode: string;
  configured: boolean;
  loggedIn: boolean;
}

const STATUS_AR: Record<TunnelState['status'], string> = {
  idle: 'في الانتظار',
  starting: 'جاري البدء…',
  connecting: 'جاري الاتصال…',
  connected: 'متصل ✓',
  error: 'خطأ',
  stopped: 'متوقف',
};

const STATUS_EN: Record<TunnelState['status'], string> = {
  idle: 'Idle',
  starting: 'Starting…',
  connecting: 'Connecting…',
  connected: 'Connected ✓',
  error: 'Error',
  stopped: 'Stopped',
};

// نفس منطق التطبيق المنفصل لحساب نسبة التقدّم
function computePct(s: TunnelState, lastPct: number): number {
  if (s.status === 'connected') return s.connections >= 4 ? 100 : 30 + s.connections * 17.5;
  if (s.status === 'connecting') return Math.max(30, 30 + s.connections * 17.5);
  if (s.status === 'starting') return 15;
  if (s.status === 'error') return lastPct;
  return 0;
}

function barColor(status: TunnelState['status']): string {
  switch (status) {
    case 'connected': return 'bg-green-500';
    case 'connecting':
    case 'starting': return 'bg-amber-500';
    case 'error': return 'bg-red-500';
    default: return 'bg-gray-400 dark:bg-gray-600';
  }
}

function pillClasses(status: TunnelState['status']): string {
  switch (status) {
    case 'connected': return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 ring-green-200 dark:ring-green-900/50';
    case 'connecting':
    case 'starting': return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-900/50';
    case 'error': return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-900/50';
    default: return 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 ring-gray-200 dark:ring-gray-600';
  }
}

function getTunnel(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).electron?.tunnel || null;
}

export default function TunnelSettingsPage() {
  const router = useRouter();
  const { tr, locale } = useLanguage();
  const STATUS_LABEL = locale === 'ar' ? STATUS_AR : STATUS_EN;
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [available, setAvailable] = useState(false);

  const [tstate, setTstate] = useState<TunnelState | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [setupLog, setSetupLog] = useState<string[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);

  const [subdomain, setSubdomain] = useState('');
  const [domain, setDomain] = useState('');
  const [port, setPort] = useState('4001');
  const [loginBusy, setLoginBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);

  const lastPct = useRef(0);
  const logBoxRef = useRef<HTMLDivElement>(null);

  // تحقق من الأونر
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) { router.push('/login'); return; }
        const data = await res.json();
        if (data.user.role !== 'OWNER') { router.push('/'); return; }
        setUser(data.user);
      } catch {
        router.push('/login');
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [router]);

  // اشتراك في أحداث التونل (نسخة الديسكتوب بس)
  useEffect(() => {
    if (!user) return;
    const t = getTunnel();
    if (!t) { setAvailable(false); return; }
    setAvailable(true);

    t.getState().then((s: TunnelState) => setTstate(s)).catch(() => {});
    t.setupStatus().then((r: any) => setLoggedIn(!!r?.loggedIn)).catch(() => {});

    t.onStatus((s: TunnelState) => setTstate(s));
    t.onLog((line: string) => setLogs((prev) => [...prev.slice(-199), line]));
    t.onSetupProgress((line: string) => setSetupLog((prev) => [...prev.slice(-99), line]));

    return () => { try { t.offListeners(); } catch { /* ignore */ } };
  }, [user]);

  // scroll اللوجز للأسفل
  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [logs]);

  const handleLogin = async () => {
    const t = getTunnel();
    if (!t || loginBusy) return;
    setLoginBusy(true);
    setSetupLog([]);
    try {
      const r = await t.login();
      setLoggedIn(!!r?.ok);
      if (!r?.ok) setSetupLog((p) => [...p, r?.error || tr('اللوجن فشل.', 'Login failed.')]);
    } finally {
      setLoginBusy(false);
    }
  };

  const handleCreate = async () => {
    const t = getTunnel();
    if (!t || createBusy || !loggedIn || !domain.trim()) return;
    setCreateBusy(true);
    setSetupLog([]);
    try {
      const r = await t.createTunnel({ subdomain: subdomain.trim(), domain: domain.trim(), port: port.trim() });
      if (r?.ok) setSetupLog((p) => [...p, '✓ ' + tr('اتعمل', 'Created') + ': ' + r.hostname]);
      else setSetupLog((p) => [...p, '✗ ' + (r?.error || tr('فشل الإنشاء.', 'Creation failed.'))]);
    } finally {
      setCreateBusy(false);
    }
  };

  const running = tstate ? ['starting', 'connecting', 'connected'].includes(tstate.status) : false;
  const pct = tstate ? Math.round(computePct(tstate, lastPct.current)) : 0;
  if (tstate && tstate.status !== 'error') lastPct.current = pct;

  if (authLoading) return <LoadingScreen fullScreen />;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => router.push('/settings')}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 transition-colors duration-200"
          >
            <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            <span>{tr('العودة للإعدادات', 'Back to Settings')}</span>
          </button>
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M17.5 19a4.5 4.5 0 0 0 .3-9 6 6 0 0 0-11.5 1.5A3.75 3.75 0 0 0 6.5 19zM12 3v3m0 0-2-2m2 2 2-2" /></svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{tr('تانل — الاتصال بالإنترنت', 'Tunnel — Internet Access')}</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">{tr('يخلّي سيرفر الفرع متاح أونلاين 24/7 عبر Cloudflare Tunnel', 'Keeps the branch server online 24/7 via Cloudflare Tunnel')}</p>
            </div>
          </div>
        </div>

        {!available ? (
          <div className="bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-xl p-4 sm:p-6 text-amber-900 dark:text-amber-200">
            <p className="font-bold mb-1">{tr('متاح في تطبيق الديسكتوب بس', 'Available in the desktop app only')}</p>
            <p className="text-sm">{tr('إدارة التونل بتشتغل من داخل تطبيق FitBoost على الجهاز (Electron). افتح السيستم من التطبيق مش من المتصفح.', 'Tunnel management works from inside the FitBoost desktop app (Electron). Open the system from the app, not the browser.')}</p>
          </div>
        ) : (
          <>
            {/* حالة الاتصال */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{tr('حالة الاتصال', 'Connection Status')}</h2>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ring-1 ${pillClasses(tstate?.status || 'idle')}`}>
                  <span className={`w-2 h-2 rounded-full ${barColor(tstate?.status || 'idle')} ${tstate?.status === 'connecting' || tstate?.status === 'starting' ? 'animate-pulse' : ''}`} />
                  {STATUS_LABEL[tstate?.status || 'idle']}
                </span>
              </div>

              {/* progress */}
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-bold text-gray-700 dark:text-gray-300">{STATUS_LABEL[tstate?.status || 'idle']}</span>
                <span className="font-bold text-gray-900 dark:text-gray-100">{pct}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${barColor(tstate?.status || 'idle')}`} style={{ width: pct + '%' }} />
              </div>

              {/* connections */}
              <div className="flex items-center gap-3 mt-4">
                <span className="text-sm text-gray-500 dark:text-gray-400">{tr('اتصالات Cloudflare', 'Cloudflare connections')}</span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4].map((i) => (
                    <span key={i} className={`w-2.5 h-2.5 rounded-full ${(tstate?.connections || 0) >= i ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  ))}
                </div>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{tstate?.connections || 0}/4</span>
              </div>

              {tstate?.message && <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">{tstate.message}</p>}

              {/* public url */}
              {tstate?.publicUrl && (
                <button
                  onClick={() => (window as any).electron?.openExternal?.(tstate.publicUrl)}
                  className="mt-3 w-full flex items-center gap-2 p-3 rounded-lg ring-1 ring-sky-200 dark:ring-sky-900/50 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 text-sm font-bold hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors"
                >
                  <svg {...stroke} className="w-4 h-4"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></svg>
                  <span className="truncate">{tstate.publicUrl}</span>
                </button>
              )}

              {/* local server */}
              <div className="flex items-center gap-2 mt-3 text-sm">
                <span className={`w-2 h-2 rounded-full ${tstate?.serverUp ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-gray-600 dark:text-gray-400">
                  {tstate?.serverUp ? tr(`السيرفر المحلي شغّال (localhost:${tstate?.localPort})`, `Local server is running (localhost:${tstate?.localPort})`) : tr(`السيرفر المحلي مش شغّال على المنفذ ${tstate?.localPort || 4001}`, `Local server is not running on port ${tstate?.localPort || 4001}`)}
                </span>
              </div>

              {/* controls */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
                <button
                  onClick={() => getTunnel()?.start()}
                  disabled={running}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 5.5v13l11-6.5z" /></svg>
                  {tr('تشغيل', 'Start')}
                </button>
                <button
                  onClick={() => getTunnel()?.stop()}
                  disabled={!running}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <svg {...stroke} className="w-5 h-5"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                  {tr('إيقاف', 'Stop')}
                </button>
                <button
                  onClick={() => getTunnel()?.restart()}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold transition-colors col-span-2 sm:col-span-1"
                >
                  <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-2.64-6.36M21 3v4h-4" /></svg>
                  {tr('إعادة تشغيل', 'Restart')}
                </button>
              </div>

              {/* toggles */}
              <div className="mt-5 space-y-3">
                {[
                  { key: 'keepAwake' as const, label: tr('منع الجهاز من الـ Sleep', 'Prevent device sleep'), fn: (v: boolean) => getTunnel()?.setKeepAwake(v) },
                  { key: 'autoLaunch' as const, label: tr('تشغيل تلقائي مع بدء Windows', 'Auto-start with Windows'), fn: (v: boolean) => getTunnel()?.setAutoLaunch(v) },
                ].map((row) => {
                  const on = !!tstate?.[row.key];
                  return (
                    <div key={row.key} className="flex items-center justify-between gap-4 p-3 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 bg-gray-50 dark:bg-gray-900/40">
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{row.label}</span>
                      <button
                        role="switch"
                        aria-checked={on}
                        aria-label={row.label}
                        onClick={() => row.fn(!on)}
                        dir="ltr"
                        className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${on ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
                <span>{tr('إعادة التشغيل', 'Restarts')}: <b className="text-gray-700 dark:text-gray-300">{tstate?.restarts || 0}</b></span>
                {tstate?.hostname && <span>{tr('الدومين', 'Domain')}: <b className="text-gray-700 dark:text-gray-300">{tstate.hostname}</b></span>}
              </div>
            </div>

            {/* إنشاء تونل جديد */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <svg {...stroke} className="w-5 h-5 text-sky-600 dark:text-sky-400"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
                {tr('إنشاء تونل جديد', 'Create New Tunnel')}
              </h2>

              {/* login row */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 bg-gray-50 dark:bg-gray-900/40 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className={`w-2.5 h-2.5 rounded-full ${loggedIn ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-gray-700 dark:text-gray-300">{loggedIn ? tr('مسجّل دخول Cloudflare ✓', 'Signed in to Cloudflare ✓') : tr('مش مسجّل دخول Cloudflare', 'Not signed in to Cloudflare')}</span>
                </div>
                {!loggedIn && (
                  <button
                    onClick={handleLogin}
                    disabled={loginBusy}
                    className="px-3 py-1.5 text-sm font-bold rounded-lg ring-1 ring-sky-300 dark:ring-sky-700 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors disabled:opacity-60"
                  >
                    {loginBusy ? tr('بيفتح المتصفح…', 'Opening browser…') : tr('تسجيل دخول Cloudflare', 'Sign in to Cloudflare')}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Subdomain</span>
                  <input value={subdomain} onChange={(e) => setSubdomain(e.target.value)} placeholder="branch1" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </label>
                <label className="block">
                  <span className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Domain</span>
                  <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="eaglegym.website" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </label>
                <label className="block">
                  <span className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Port</span>
                  <input value={port} onChange={(e) => setPort(e.target.value)} type="number" placeholder="4001" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </label>
              </div>

              <button
                onClick={handleCreate}
                disabled={createBusy || !loggedIn || !domain.trim()}
                className="mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 2 4.5 13.2h5.5l-1 7.8L18 9.9H12z" /></svg>
                {createBusy ? tr('جاري الإنشاء…', 'Creating…') : tr('إنشاء وتشغيل', 'Create & Start')}
              </button>

              {setupLog.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-gray-900 text-gray-200 text-xs font-mono max-h-40 overflow-auto whitespace-pre-wrap" dir="ltr">
                  {setupLog.join('\n')}
                </div>
              )}
            </div>

            {/* لوجز cloudflared */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">{tr('سجل cloudflared', 'cloudflared log')}</h2>
              <div ref={logBoxRef} className="p-3 rounded-lg bg-gray-900 text-gray-300 text-xs font-mono h-56 overflow-auto whitespace-pre-wrap" dir="ltr">
                {logs.length ? logs.join('\n') : tr('مفيش سجل لسه…', 'No logs yet…')}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
