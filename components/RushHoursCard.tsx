'use client'

// ⏰ أوقات الزحمة — حضور الأعضاء موزّع على ساعات اليوم + أكتر ساعة زحمة
//  سلسلة واحدة (عدد الدخول في الساعة) → لون واحد؛ ساعة الذروة نفس اللون كامل والباقي أفتح
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { PRIMARY_COLOR } from '@/lib/theme/colors'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

export default function RushHoursCard({ hourly, days, ar }: { hourly: { hour: number; count: number }[]; days: number; ar: boolean }) {
  const total = hourly.reduce((s, h) => s + h.count, 0)
  //  مفيش حضور في الفترة → الكارت يفضل ظاهر برسالة (بدل ما يختفي ومحدش يعرف إنه موجود)
  if (!total) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span>{ar ? 'أوقات الزحمة (الراش تايم)' : 'Rush hours'}</span>
          </h2>
        </div>
        <p className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          {ar ? 'مفيش حضور في الفترة دي — غيّر التاريخ من فوق عشان تشوف أوقات الزحمة' : 'No check-ins in this period — change the dates above to see rush hours'}
        </p>
      </div>
    )
  }

  const hourName = (h: number) => {
    const d = new Date(); d.setHours(h, 0, 0, 0)
    return d.toLocaleTimeString(ar ? 'ar-EG' : 'en-US', { hour: 'numeric' })
  }
  const range = (h: number) => `${hourName(h)} – ${hourName((h + 1) % 24)}`
  const perDay = (c: number) => (days > 0 ? Math.round((c / days) * 10) / 10 : c).toLocaleString(ar ? 'ar-EG' : 'en-US')

  //  الرسم بيبدأ من أول ساعة فيها حضور لآخر ساعة (من غير ساعات الفجر الفاضية)
  const first = hourly.findIndex(h => h.count > 0)
  const last = 23 - [...hourly].reverse().findIndex(h => h.count > 0)
  const data = hourly.slice(first, last + 1).map(h => ({ ...h, label: hourName(h.hour) }))

  const ranked = [...hourly].filter(h => h.count > 0).sort((a, b) => b.count - a.count)
  const peak = ranked[0]
  const top3 = ranked.slice(0, 3)
  const quiet = [...data].filter(h => h.count > 0).sort((a, b) => a.count - b.count)[0]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span>{ar ? 'أوقات الزحمة (الراش تايم)' : 'Rush hours'}</span>
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {ar ? 'عدد الأعضاء اللي دخلوا في كل ساعة من اليوم خلال الفترة المختارة' : 'Member check-ins by hour of day for the selected period'}
        </p>
      </div>

      <div className="p-5 space-y-5">
        {/*  الرقم الأهم: أكتر ساعة زحمة */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1 rounded-xl bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-800 p-4">
            <p className="text-xs font-bold text-gray-600 dark:text-gray-300">{ar ? 'أكتر ساعة زحمة' : 'Peak hour'}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{range(peak.hour)}</p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {ar ? `${peak.count} دخول · متوسط ${perDay(peak.count)} عضو في اليوم` : `${peak.count} check-ins · avg ${perDay(peak.count)}/day`}
            </p>
          </div>
          <div className="rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-4">
            <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">{ar ? 'أزحم 3 ساعات' : 'Top 3 hours'}</p>
            <ol className="space-y-1">
              {top3.map((h, i) => (
                <li key={h.hour} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-gray-800 dark:text-gray-200"><span className="text-gray-400 me-1.5">{i + 1}.</span>{range(h.hour)}</span>
                  <span className="font-bold text-gray-900 dark:text-white">{Math.round((h.count / total) * 100)}%</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-4">
            <p className="text-xs font-bold text-gray-600 dark:text-gray-300">{ar ? 'أهدى ساعة' : 'Quietest hour'}</p>
            <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{quiet ? range(quiet.hour) : '—'}</p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {quiet ? (ar ? `${quiet.count} دخول بس — من ساعات الشغل` : `only ${quiet.count} check-ins — within open hours`) : ''}
            </p>
          </div>
        </div>

        {/*  الرسم — ساعة الذروة باللون الكامل والباقي أفتح، والأرقام في التولتيب */}
        <div dir="ltr">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke="#e5e7eb" strokeOpacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#d1d5db' }} interval={0} angle={data.length > 14 ? -40 : 0} textAnchor={data.length > 14 ? 'end' : 'middle'} height={data.length > 14 ? 48 : 24} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.15)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as { hour: number; count: number }
                  return (
                    <div dir={ar ? 'rtl' : 'ltr'} className="rounded-lg bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-700 shadow-lg px-3 py-2 text-xs">
                      <p className="font-bold text-gray-900 dark:text-white">{range(p.hour)}</p>
                      <p className="text-gray-600 dark:text-gray-300">{ar ? `${p.count} دخول · ${Math.round((p.count / total) * 100)}% من اليوم` : `${p.count} check-ins · ${Math.round((p.count / total) * 100)}% of day`}</p>
                      <p className="text-gray-500 dark:text-gray-400">{ar ? `متوسط ${perDay(p.count)} عضو في اليوم` : `avg ${perDay(p.count)}/day`}</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {data.map(d => (
                  <Cell key={d.hour} fill={PRIMARY_COLOR} fillOpacity={d.hour === peak.hour ? 1 : 0.4} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
