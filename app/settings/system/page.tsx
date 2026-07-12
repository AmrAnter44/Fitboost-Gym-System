'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useDarkMode } from '@/contexts/DarkModeContext'
import { LoadingScreen } from '@/components/Spinner'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

// ألوان السلاسل — متحقق منها بمدقق الـ palette للوضعين الفاتح والداكن
const SERIES = {
  mem: { light: '#2a78d6', dark: '#3987e5' },
  cpu: { light: '#1baf7a', dark: '#199e70' },
  temp: { light: '#eb6834', dark: '#d95926' },
}

interface SystemInfo {
  os: { platform: string; distro: string; release: string; arch: string; hostname: string }
  device: { manufacturer: string; model: string } | null
  cpu: { model: string; cores: number; physicalCores: number; speedMax: number | null }
  memTotal: number
  gpu: string[]
  network: { iface: string; ip4: string; mac: string } | null
  app: { version: string; node: string }
  disks: { mount: string; size: number; used: number; percent: number }[]
  uptime: number
}

interface LogEntry {
  at: number
  mem: number
  cpu: number
  temp: number | null
  app: number
}

interface LiveStats {
  mem: { total: number; used: number; percent: number }
  cpu: { load: number; cores: number; model: string }
  temp: number | null
}

function toGB(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1)
}

function levelText(percent: number): string {
  if (percent >= 85) return 'text-red-600 dark:text-red-400'
  if (percent >= 70) return 'text-amber-600 dark:text-amber-400'
  return 'text-gray-900 dark:text-gray-100'
}

function barTone(percent: number): string {
  if (percent >= 85) return 'bg-red-500'
  if (percent >= 70) return 'bg-amber-500'
  return 'bg-primary-500'
}

const RANGES = [
  { hours: 6, key: 'system.range6h' },
  { hours: 24, key: 'system.range24h' },
  { hours: 168, key: 'system.range7d' },
] as const

export default function SystemInfoPage() {
  const { t, locale } = useLanguage()
  const { isDarkMode } = useDarkMode()

  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [log, setLog] = useState<LogEntry[] | null>(null)
  const [live, setLive] = useState<LiveStats | null>(null)
  const [hours, setHours] = useState<number>(24)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const response = await fetch('/api/system/info')
        if (response.ok) setInfo(await response.json())
      } catch (error) {
        console.error('Error fetching system info:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchInfo()
  }, [])

  useEffect(() => {
    let cancelled = false
    const fetchLog = async () => {
      try {
        const response = await fetch(`/api/system/log?hours=${hours}`)
        if (response.ok && !cancelled) {
          const data = await response.json()
          setLog(data.entries ?? [])
        }
      } catch (error) {
        console.error('Error fetching stats log:', error)
      }
    }
    fetchLog()
    const interval = setInterval(fetchLog, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [hours])

  useEffect(() => {
    const fetchLive = async () => {
      if (document.hidden) return
      try {
        const response = await fetch('/api/system/stats')
        if (response.ok) setLive(await response.json())
      } catch {
        // نحتفظ بآخر قراءة
      }
    }
    fetchLive()
    const interval = setInterval(fetchLive, 5000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <LoadingScreen />

  const dateLocale = locale === 'ar' ? 'ar-EG' : 'en-GB'
  const formatTick = (at: number) =>
    hours > 24
      ? new Date(at).toLocaleString(dateLocale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : new Date(at).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })

  // تخفيف النقاط للرسم — الأسبوع الكامل = ~5000 قراءة
  const chartData = (() => {
    if (!log) return []
    const stride = Math.max(1, Math.ceil(log.length / 700))
    return log.filter((_, i) => i % stride === 0 || i === log.length - 1)
  })()
  const hasTemp = chartData.some(e => e.temp !== null)

  const gridStroke = isDarkMode ? '#374151' : '#e5e7eb'
  const tickFill = isDarkMode ? '#9ca3af' : '#6b7280'
  const tooltipStyle = {
    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
    border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
    borderRadius: '8px',
    fontSize: '12px',
    color: isDarkMode ? '#f3f4f6' : '#111827',
  }
  const seriesColor = (key: keyof typeof SERIES) => SERIES[key][isDarkMode ? 'dark' : 'light']

  const uptimeDays = info ? Math.floor(info.uptime / 86400) : 0
  const uptimeHours = info ? Math.floor((info.uptime % 86400) / 3600) : 0

  const infoRows: Array<{ label: string; value: string }> = info
    ? [
        { label: t('system.os'), value: `${info.os.distro} ${info.os.release} (${info.os.arch})` },
        { label: t('system.hostname'), value: info.os.hostname },
        ...(info.device && (info.device.manufacturer || info.device.model)
          ? [{ label: t('system.device'), value: `${info.device.manufacturer} ${info.device.model}`.trim() }]
          : []),
        {
          label: t('system.processor'),
          value: `${info.cpu.model} — ${info.cpu.cores} ${t('system.cores')}${info.cpu.speedMax ? ` · ${info.cpu.speedMax} GHz` : ''}`,
        },
        { label: t('system.totalRam'), value: `${toGB(info.memTotal)} GB` },
        ...(info.gpu.length ? [{ label: t('system.gpu'), value: info.gpu.join(' · ') }] : []),
        ...(info.network?.ip4
          ? [{ label: t('system.network'), value: `${info.network.ip4} (${info.network.iface})` }]
          : []),
        { label: t('system.uptime'), value: `${uptimeDays}${t('system.day')} ${uptimeHours}${t('system.hour')}` },
        { label: t('system.appVersion'), value: `${info.app.version} · Node ${info.app.node}` },
      ]
    : []

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
            <svg {...stroke} className="w-6 h-6" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 7h10v10H7zM10 10h4v4h-4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('system.systemHealth')}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('system.pageDescription')}</p>
          </div>
        </div>
      </div>

      {/* Live tiles */}
      {live && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('system.ram')}</div>
            <div className={`text-2xl font-bold ${levelText(live.mem.percent)}`}>{live.mem.percent}%</div>
            <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
              {toGB(live.mem.used)} / {toGB(live.mem.total)} GB
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('system.cpu')}</div>
            <div className={`text-2xl font-bold ${levelText(live.cpu.load)}`}>{live.cpu.load}%</div>
            <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{live.cpu.cores} {t('system.cores')}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('system.temp')}</div>
            <div className={`text-2xl font-bold ${live.temp !== null ? levelText(live.temp) : 'text-gray-400 dark:text-gray-500'}`}>
              {live.temp !== null ? `${live.temp}°C` : t('system.notAvailable')}
            </div>
          </div>
        </div>
      )}

      {/* Device info */}
      {info && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4">{t('system.deviceInfo')}</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {infoRows.map(row => (
              <div key={row.label} className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-100 dark:border-gray-700/60">
                <dt className="text-gray-500 dark:text-gray-400 flex-shrink-0">{row.label}</dt>
                <dd className="font-semibold text-gray-900 dark:text-gray-100 text-end" dir="ltr">{row.value}</dd>
              </div>
            ))}
          </dl>

          {/* Disks */}
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-5 mb-3">{t('system.disks')}</h3>
          <div className="space-y-3">
            {info.disks.map(disk => (
              <div key={disk.mount}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500 dark:text-gray-400" dir="ltr">{disk.mount}</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {toGB(disk.used)} / {toGB(disk.size)} GB ({disk.percent}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div className={`h-full rounded-full ${barTone(disk.percent)}`} style={{ width: `${disk.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance log */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{t('system.performanceLog')}</h2>
          <div className="flex items-center gap-1.5">
            {RANGES.map(range => (
              <button
                key={range.hours}
                onClick={() => setHours(range.hours)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
                  hours === range.hours
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t(range.key)}
              </button>
            ))}
          </div>
        </div>

        {!log || log.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">{t('system.noLogYet')}</p>
        ) : (
          <>
            {/* RAM & CPU (%) */}
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{t('system.ramCpuChart')}</div>
            <div dir="ltr" className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="at" tickFormatter={formatTick} tick={{ fontSize: 10, fill: tickFill }} tickLine={false} axisLine={{ stroke: gridStroke }} minTickGap={40} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: tickFill }} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(at: number) => formatTick(at)} formatter={(value: number, name: string) => [`${value}%`, name]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="mem" name={t('system.ram')} stroke={seriesColor('mem')} strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="cpu" name={t('system.cpu')} stroke={seriesColor('cpu')} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Temperature (°C) — محور مختلف = رسم منفصل */}
            {hasTemp && (
              <>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-5 mb-2">{t('system.tempChart')}</div>
                <div dir="ltr" className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                      <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="at" tickFormatter={formatTick} tick={{ fontSize: 10, fill: tickFill }} tickLine={false} axisLine={{ stroke: gridStroke }} minTickGap={40} />
                      <YAxis tick={{ fontSize: 10, fill: tickFill }} tickLine={false} axisLine={false} unit="°" />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={(at: number) => formatTick(at)} formatter={(value: number) => [`${value}°C`, t('system.temp')]} />
                      <Line type="monotone" dataKey="temp" name={t('system.temp')} stroke={seriesColor('temp')} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {/* Latest readings table */}
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-5 mb-2">{t('system.latestReadings')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 text-start font-medium">{t('system.time')}</th>
                    <th className="py-2 text-start font-medium">{t('system.ram')}</th>
                    <th className="py-2 text-start font-medium">{t('system.cpu')}</th>
                    <th className="py-2 text-start font-medium">{t('system.temp')}</th>
                    <th className="py-2 text-start font-medium">{t('system.appMemory')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...log].slice(-20).reverse().map(entry => (
                    <tr key={entry.at} className="border-b border-gray-100 dark:border-gray-700/60 text-gray-900 dark:text-gray-100">
                      <td className="py-1.5" dir="ltr">
                        {new Date(entry.at).toLocaleString(dateLocale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className={`py-1.5 font-semibold ${levelText(entry.mem)}`}>{entry.mem}%</td>
                      <td className={`py-1.5 font-semibold ${levelText(entry.cpu)}`}>{entry.cpu}%</td>
                      <td className="py-1.5">{entry.temp !== null ? `${entry.temp}°C` : '—'}</td>
                      <td className="py-1.5">{entry.app} MB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
