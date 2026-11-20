'use client';

//  🚪 تعليمات ربط الجهاز — اللي بيتكتب في صفحة HTTP Listening على الجهاز
//
//  ليه صفحة كاملة لحاجة زي دي؟ لأن ده أكتر مكان الناس بتغلط فيه: المسارات
//  الموجودة في السيستم بترجّع **أول IPv4 غير داخلي**، وده بيطلع غلط على
//  أجهزة فيها VirtualBox أو VPN أو كارتين شبكة — الموظف بيكتب عنوان
//  الـ VirtualBox في الجهاز والأحداث ماتوصلش، ومفيش أي رسالة خطأ توضّح ليه.
//  عشان كده بنعرض **كل** العناوين، ونرشّح اللي على نفس شبكة الجهاز.

import { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const;

interface Props {
  eventSecret: string;
  gateHost?: string;
  gateId?: string;
}

interface LastScan {
  at: string;
  allowed: boolean;
  reason: string | null;
  employeeNo: string | null;
  member: { name: string; memberNumber: string | null } | null;
}

/** أول تلات خانات من الـ IPv4 — للمقارنة بشبكة الجهاز */
const subnet = (ip: string) => ip.split('.').slice(0, 3).join('.');

export default function GateListenerSetup({ eventSecret, gateHost, gateId }: Props) {
  const { tr, locale } = useLanguage();
  //  🔗 الربط التلقائي (ISAPI httpHosts) + آخر سكان وصل للسيستم
  const [linked, setLinked] = useState<boolean | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<LastScan | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkResult, setLinkResult] = useState<{ ok: boolean; text: string } | null>(null);

  const loadStatus = async () => {
    if (!gateId) return;
    try {
      const res = await fetch(`/api/gates/${gateId}/listener`, { cache: 'no-store' });
      const d = await res.json();
      if (!d.success) return;
      setLinked(d.device ? !!d.device.linked : null);
      setDeviceError(d.deviceError || null);
      setLastScan(d.lastScan || null);
    } catch { /* نسيب الحالة زي ما هي */ }
  };

  useEffect(() => {
    loadStatus();
    const t = setInterval(loadStatus, 15_000); //  آخر سكان بيتحدث لوحده
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateId]);

  const autoLink = async () => {
    if (!gateId || !picked) return;
    setLinking(true);
    setLinkResult(null);
    try {
      const res = await fetch(`/api/gates/${gateId}/listener`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipAddress: picked, port: Number(port) || 4001 }),
      });
      const d = await res.json();
      if (!d.success) {
        setLinkResult({ ok: false, text: d.error || tr('فشل الربط', 'Link failed') });
        return;
      }
      const testText = d.test?.ok
        ? tr('والجهاز جرّب يوصل للسيستم ونجح ✓', 'and the device reached the system ✓')
        : d.test?.unsupported
          ? tr('(الجهاز مابيدعمش زرار الاختبار — جرّب بوش قدام الجهاز)', '(device has no test — try a face scan)')
          : tr('بس الجهاز مقدرش يوصل للسيستم: ', 'but the device could not reach the system: ') + (d.test?.error || '');
      const replacedText = d.replaced
        ? tr(` — اتبدّل عنوان قديم كان عليه (${d.replaced})`, ` — replaced an old address (${d.replaced})`)
        : '';
      setLinkResult({
        ok: !!d.test?.ok || !!d.test?.unsupported,
        text: tr('الجهاز اتظبط يبعت السكانات للسيستم ', 'Device set to send scans to the system ') + testText + replacedText,
      });
      loadStatus();
    } catch {
      setLinkResult({ ok: false, text: tr('مقدرتش أوصل للسيستم', 'Could not reach the server') });
    } finally {
      setLinking(false);
    }
  };
  const [ips, setIps] = useState<string[]>([]);
  const [port, setPort] = useState('4001');
  const [picked, setPicked] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/network/interfaces');
        const data = await res.json();
        if (data.success && data.addresses?.length) {
          setIps(data.addresses);
          setPort(String(data.port || '4001'));
          //  نرشّح اللي على نفس شبكة الجهاز — ده اللي الجهاز هيقدر يوصله
          const match = gateHost
            ? data.addresses.find((a: string) => subnet(a) === subnet(gateHost))
            : null;
          setPicked(match || data.addresses[0]);
        }
      } catch { /* بنسيب الحقول فاضية والمستخدم يكتب بإيده */ }
    })();
  }, [gateHost]);

  const url = picked ? `http://${picked}:${port}/api/gates/event/${eventSecret}` : '';
  const sameSubnet = picked && gateHost ? subnet(picked) === subnet(gateHost) : true;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* المتصفح رفض — المستخدم يقدر يحدد ويكوبي بإيده */ }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{tr('ربط الجهاز بالسيستم', 'Connect the device to the system')}</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {tr('عشان الحضور يتسجّل لوحده، لازم تقول للجهاز يبعت الأحداث على العنوان ده.', 'For attendance to be logged automatically, configure the device to send events to this address.')}
      </p>

      {ips.length > 1 && (
        <div className="mb-3">
          <span className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
            {tr('عنوان الكمبيوتر على الشبكة', 'Computer address on the network')}
          </span>
          <select
            value={picked}
            onChange={e => setPicked(e.target.value)}
            dir="ltr"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-mono"
          >
            {ips.map(ip => (
              <option key={ip} value={ip}>
                {ip}{gateHost && subnet(ip) === subnet(gateHost) ? tr('  ← نفس شبكة الجهاز', '  ← same network as device') : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {!sameSubnet && (
        <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 p-3 text-sm text-amber-900 dark:text-amber-200">
          {tr('العنوان ده على شبكة تانية غير الجهاز', 'This address is on a different network than the device')} ({gateHost}). {tr('غالبًا الجهاز مش هيعرف يوصله — اختار عنوان بيبدأ بـ', 'The device probably cannot reach it — pick an address starting with')} <span className="font-mono" dir="ltr">{subnet(gateHost || '')}</span>
        </div>
      )}

      <div className="rounded-lg bg-gray-900 text-gray-100 p-3 font-mono text-xs break-all mb-3" dir="ltr">
        {url || '—'}
      </div>

      <button
        onClick={copy}
        disabled={!url}
        className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50"
      >
        <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2M8 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M8 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 0h2a2 2 0 0 1 2 2v3" /></svg>
        {copied ? tr('اتنسخ ✓', 'Copied ✓') : tr('انسخ العنوان', 'Copy address')}
      </button>

      {/*  🔗 الربط التلقائي — بيكتب الإعدادات دي في الجهاز بدل ما تكتبها بإيدك */}
      {gateId && (
        <div className="mb-4 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className={`w-2.5 h-2.5 rounded-full ${linked ? 'bg-emerald-500' : linked === false ? 'bg-amber-500' : 'bg-gray-400'}`} aria-hidden="true" />
              <span className="text-gray-900 dark:text-gray-100">
                {linked
                  ? tr('الجهاز مربوط بالسيستم', 'Device is linked')
                  : linked === false
                    ? tr('الجهاز مش مربوط لسه', 'Device not linked yet')
                    : tr('حالة الربط مش معروفة', 'Link status unknown')}
              </span>
            </div>
            <button
              onClick={autoLink}
              disabled={linking || !picked}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              {linking ? tr('جارٍ الربط...', 'Linking...') : linked ? tr('أعد الربط', 'Re-link') : tr('اربط الجهاز تلقائي', 'Link automatically')}
            </button>
          </div>
          {deviceError && linked === null && (
            <p className="text-xs text-amber-700 dark:text-amber-400">{tr('مقدرتش أقرا إعدادات الجهاز: ', 'Could not read device settings: ')}{deviceError}</p>
          )}
          {linkResult && (
            <p className={`text-sm ${linkResult.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{linkResult.text}</p>
          )}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 px-3 py-2.5 text-sm">
            <span className="text-gray-500 dark:text-gray-400">{tr('آخر سكان وصل للسيستم: ', 'Last scan received: ')}</span>
            {lastScan ? (
              <span className="text-gray-900 dark:text-gray-100 font-semibold">
                {lastScan.member?.name || (lastScan.employeeNo ? `#${lastScan.employeeNo}` : tr('حدث من الجهاز', 'device event'))}
                {' · '}
                {new Date(lastScan.at).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                {' · '}
                <span className={lastScan.allowed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                  {lastScan.allowed ? tr('دخل واتسجل حضور', 'entered, attendance logged') : tr('مرفوض', 'denied')}
                </span>
              </span>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">{tr('لسه مفيش — بعد الربط حط وشك قدام الجهاز', 'none yet — after linking, scan a face')}</span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{tr('أو اظبطها بإيدك من صفحة الجهاز بالخطوات اللي تحت.', 'Or set it manually from the device page using the steps below.')}</p>
        </div>
      )}

      <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-decimal ps-5">
        <li>{tr('افتح صفحة الجهاز في المتصفح:', 'Open the device page in a browser:')} <span className="font-mono" dir="ltr">http://{gateHost || '<ip>'}</span></li>
        <li>{tr('روح', 'Go to')} <b>Configuration → Network → Advanced Settings → HTTP(S)</b></li>
        <li>{tr('في قسم', 'In the')} <b>HTTP Listening</b> {tr('اكتب:', 'section, enter:')}
          <ul className="mt-1 space-y-1 ps-4 list-disc text-gray-600 dark:text-gray-400">
            <li><b>Event Alarm IP/Domain Name</b>: <span className="font-mono" dir="ltr">{picked || '—'}</span></li>
            <li><b>URL</b>: <span className="font-mono" dir="ltr">/api/gates/event/{eventSecret}</span></li>
            <li><b>Port</b>: <span className="font-mono" dir="ltr">{port}</span></li>
            <li><b>Protocol</b>: HTTP</li>
          </ul>
        </li>
        <li>{tr('اضغط', 'Click')} <b>Save</b>{tr('، وبعدها حط وشك قدام الجهاز مرة واحدة للتجربة', ', then show your face to the device once to test')}</li>
      </ol>

      <div className="mt-4 rounded-lg bg-sky-50 dark:bg-sky-900/20 ring-1 ring-sky-200 dark:ring-sky-900/50 p-3 text-sm text-sky-900 dark:text-sky-200">
        <p className="font-semibold mb-1">{tr('تسجيل الأوشاش بيتم على الجهاز نفسه', 'Faces are enrolled on the device itself')}</p>
        <p className="text-xs leading-relaxed">
          {tr('السيستم بيبعت للجهاز بيانات العضو وتاريخ انتهاء اشتراكه بس. عشان العضو يقدر يدخل، لازم الريسبشن يوقّفه قدام الجهاز ويسجّل وشه على', 'The system only sends the member data and subscription end date to the device. For a member to enter, reception must stand them in front of the device and enroll their face under their')}
          <b> {tr('رقم عضويته', 'membership number')}</b> — {tr('نفس الرقم اللي في السيستم.', 'the same number as in the system.')}
        </p>
      </div>

      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {tr('العنوان ده فيه سر — أي حد يعرفه يقدر يبعت أحداث وهمية للسيستم. ماتنشرهوش.', 'This address contains a secret — anyone who knows it can send fake events to the system. Do not share it.')}
      </p>
    </div>
  );
}
