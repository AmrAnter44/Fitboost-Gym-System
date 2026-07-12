'use client'

import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

const POLL_MS = 5000

interface SystemStatsData {
  mem: { total: number; used: number; percent: number }
  cpu: { load: number; cores: number; model: string }
  temp: number | null
  disk: { total: number; used: number; percent: number } | null
  uptime: number
  appMem: number
}

function toGB(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1)
}

function levelClass(percent: number): string {
  if (percent >= 85) return 'text-red-600 dark:text-red-400'
  if (percent >= 70) return 'text-amber-600 dark:text-amber-400'
  return 'text-gray-600 dark:text-gray-400'
}

function tempClass(temp: number): string {
  if (temp >= 85) return 'text-red-600 dark:text-red-400'
  if (temp >= 70) return 'text-amber-600 dark:text-amber-400'
  return 'text-gray-600 dark:text-gray-400'
}

function barClass(percent: number): string {
  if (percent >= 85) return 'bg-red-500'
  if (percent >= 70) return 'bg-amber-500'
  return 'bg-primary-500'
}

export default function SystemStats() {
  const { t } = useLanguage()
  const [stats, setStats] = useState<SystemStatsData | null>(null)
  const [open, setOpen] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const fetchStats = async () => {
      // لا داعي للقراءة والنافذة في الخلفية
      if (document.hidden) return
      try {
        const response = await fetch('/api/system/stats')
        if (!response.ok) return
        const data = await response.json()
        if (mountedRef.current) setStats(data)
      } catch {
        // فشل مؤقت — نحتفظ بآخر قراءة
      }
    }
    fetchStats()
    const interval = setInterval(fetchStats, POLL_MS)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [])

  if (!stats) return null

  const uptimeHours = Math.floor(stats.uptime / 3600)
  const uptimeDays = Math.floor(uptimeHours / 24)
  const uptimeLabel =
    uptimeDays > 0
      ? `${uptimeDays}${t('system.day')} ${uptimeHours % 24}${t('system.hour')}`
      : `${uptimeHours}${t('system.hour')} ${Math.floor((stats.uptime % 3600) / 60)}${t('system.minute')}`

  return (
    <div className="relative ms-auto self-center hidden sm:block">
      <button
        onClick={() => setOpen(prev => !prev)}
        title={t('system.systemHealth')}
        className="flex items-center gap-2.5 px-2.5 py-1 rounded-lg text-[11px] font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150"
      >
        <span className={`flex items-center gap-1 ${levelClass(stats.mem.percent)}`}>
          {/* RAM */}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16v8H4zM7 16v2m4-2v2m4-2v2M7 6v2m4-2v2m4-2v2" />
          </svg>
          {stats.mem.percent}%
        </span>
        <span className={`flex items-center gap-1 ${levelClass(stats.cpu.load)}`}>
          {/* CPU */}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 7h10v10H7zM10 10h4v4h-4z" />
          </svg>
          {stats.cpu.load}%
        </span>
        {stats.temp !== null && (
          <span className={`flex items-center gap-1 ${tempClass(stats.temp)}`}>
            {/* Temperature */}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4a2 2 0 00-2 2v7.5a4 4 0 104 0V6a2 2 0 00-2-2zM12 14v3" />
            </svg>
            {stats.temp}°
          </span>
        )}
      </button>

      {open && (
        <>
          {/* إغلاق عند الضغط خارج اللوحة */}
          <div className="fixed inset-0 z-[109]" onClick={() => setOpen(false)} />
          <div className="absolute top-full end-0 mt-1 w-72 z-[110] rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl p-4 text-xs">
            <div className="font-bold text-sm text-gray-900 dark:text-gray-100 mb-3">
              {t('system.systemHealth')}
            </div>

            {/* RAM */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-500 dark:text-gray-400">{t('system.ram')}</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {toGB(stats.mem.used)} / {toGB(stats.mem.total)} GB ({stats.mem.percent}%)
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div className={`h-full rounded-full ${barClass(stats.mem.percent)}`} style={{ width: `${stats.mem.percent}%` }} />
              </div>
            </div>

            {/* CPU */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-500 dark:text-gray-400">{t('system.cpu')}</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {stats.cpu.load}% · {stats.cpu.cores} {t('system.cores')}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div className={`h-full rounded-full ${barClass(stats.cpu.load)}`} style={{ width: `${stats.cpu.load}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 truncate" title={stats.cpu.model}>
                {stats.cpu.model}
              </div>
            </div>

            {/* Temperature */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-500 dark:text-gray-400">{t('system.temp')}</span>
              <span className={`font-semibold ${stats.temp !== null ? tempClass(stats.temp) : 'text-gray-400 dark:text-gray-500'}`}>
                {stats.temp !== null ? `${stats.temp}°C` : t('system.notAvailable')}
              </span>
            </div>

            {/* Disk */}
            {stats.disk && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-500 dark:text-gray-400">{t('system.disk')}</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {toGB(stats.disk.used)} / {toGB(stats.disk.total)} GB ({stats.disk.percent}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div className={`h-full rounded-full ${barClass(stats.disk.percent)}`} style={{ width: `${stats.disk.percent}%` }} />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-1.5">
              <span className="text-gray-500 dark:text-gray-400">{t('system.uptime')}</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{uptimeLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">{t('system.appMemory')}</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{Math.round(stats.appMem / 1024 ** 2)} MB</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
