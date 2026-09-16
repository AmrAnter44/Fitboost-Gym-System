'use client';

//  🚪 تعليمات ربط الجهاز — اللي بيتكتب في صفحة HTTP Listening على الجهاز
//
//  ليه صفحة كاملة لحاجة زي دي؟ لأن ده أكتر مكان الناس بتغلط فيه: المسارات
//  الموجودة في السيستم بترجّع **أول IPv4 غير داخلي**، وده بيطلع غلط على
//  أجهزة فيها VirtualBox أو VPN أو كارتين شبكة — الموظف بيكتب عنوان
//  الـ VirtualBox في الجهاز والأحداث ماتوصلش، ومفيش أي رسالة خطأ توضّح ليه.
//  عشان كده بنعرض **كل** العناوين، ونرشّح اللي على نفس شبكة الجهاز.

import { useEffect, useState } from 'react';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const;

interface Props {
  eventSecret: string;
  gateHost?: string;
}

/** أول تلات خانات من الـ IPv4 — للمقارنة بشبكة الجهاز */
const subnet = (ip: string) => ip.split('.').slice(0, 3).join('.');

export default function GateListenerSetup({ eventSecret, gateHost }: Props) {
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">ربط الجهاز بالسيستم</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        عشان الحضور يتسجّل لوحده، لازم تقول للجهاز يبعت الأحداث على العنوان ده.
      </p>

      {ips.length > 1 && (
        <div className="mb-3">
          <span className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
            عنوان الكمبيوتر على الشبكة
          </span>
          <select
            value={picked}
            onChange={e => setPicked(e.target.value)}
            dir="ltr"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-mono"
          >
            {ips.map(ip => (
              <option key={ip} value={ip}>
                {ip}{gateHost && subnet(ip) === subnet(gateHost) ? '  ← نفس شبكة الجهاز' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {!sameSubnet && (
        <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 p-3 text-sm text-amber-900 dark:text-amber-200">
          العنوان ده على شبكة تانية غير الجهاز ({gateHost}). غالبًا الجهاز مش
          هيعرف يوصله — اختار عنوان بيبدأ بـ <span className="font-mono" dir="ltr">{subnet(gateHost || '')}</span>
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
        {copied ? 'اتنسخ ✓' : 'انسخ العنوان'}
      </button>

      <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-decimal ps-5">
        <li>افتح صفحة الجهاز في المتصفح: <span className="font-mono" dir="ltr">http://{gateHost || '<ip>'}</span></li>
        <li>روح <b>Configuration → Network → Advanced Settings → HTTP(S)</b></li>
        <li>في قسم <b>HTTP Listening</b> اكتب:
          <ul className="mt-1 space-y-1 ps-4 list-disc text-gray-600 dark:text-gray-400">
            <li><b>Event Alarm IP/Domain Name</b>: <span className="font-mono" dir="ltr">{picked || '—'}</span></li>
            <li><b>URL</b>: <span className="font-mono" dir="ltr">/api/gates/event/{eventSecret}</span></li>
            <li><b>Port</b>: <span className="font-mono" dir="ltr">{port}</span></li>
            <li><b>Protocol</b>: HTTP</li>
          </ul>
        </li>
        <li>اضغط <b>Save</b>، وبعدها حط وشك قدام الجهاز مرة واحدة للتجربة</li>
      </ol>

      <div className="mt-4 rounded-lg bg-sky-50 dark:bg-sky-900/20 ring-1 ring-sky-200 dark:ring-sky-900/50 p-3 text-sm text-sky-900 dark:text-sky-200">
        <p className="font-semibold mb-1">تسجيل الأوشاش بيتم على الجهاز نفسه</p>
        <p className="text-xs leading-relaxed">
          السيستم بيبعت للجهاز بيانات العضو وتاريخ انتهاء اشتراكه بس. عشان
          العضو يقدر يدخل، لازم الريسبشن يوقّفه قدام الجهاز ويسجّل وشه على
          <b> رقم عضويته</b> — نفس الرقم اللي في السيستم.
        </p>
      </div>

      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        العنوان ده فيه سر — أي حد يعرفه يقدر يبعت أحداث وهمية للسيستم. ماتنشرهوش.
      </p>
    </div>
  );
}
