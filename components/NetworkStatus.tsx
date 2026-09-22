'use client'

import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

//  علامة حالة الإنترنت جنب مراقب موارد الجهاز:
//   🟢 أخضر = شغّال وسريع، 🟡 أصفر = بطيء، 🔴 أحمر = مقطوع.
//  الفحص من السيرفر (/api/system/net-status) — الـ CSP بتمنع المتصفح من الاتصال الخارجي،
//  والنت اللي بيهمّنا هو نت جهاز السيرفر (الرخصة/الباك أب). لما تدوس بيفتح بوب-اب فيه
//  الحالة + زمن الاستجابة + زرار قياس سرعة التحميل الحقيقية (Mbps).
const POLL_MS = 15000
const TIMEOUT_MS = 6000
const SLOW_THRESHOLD_MS = 1200

type NetState = 'good' | 'slow' | 'offline'

export default function NetworkStatus() {
  const { locale } = useLanguage()
  const ar = locale === 'ar'
  const [state, setState] = useState<NetState | null>(null)
  const [latency, setLatency] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [speed, setSpeed] = useState<{ mbps: number } | null>(null)
  const [testing, setTesting] = useState(false)
  const [speedFailed, setSpeedFailed] = useState(false)
  const mountedRef = useRef(true)

  const check = async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch('/api/system/net-status', { cache: 'no-store', signal: controller.signal })
      const data = await res.json()
      if (!mountedRef.current) return
      if (!data.online) {
        setState('offline'); setLatency(null)
      } else {
        const ms = typeof data.latencyMs === 'number' ? data.latencyMs : 0
        setLatency(ms)
        setState(ms > SLOW_THRESHOLD_MS ? 'slow' : 'good')
      }
    } catch {
      if (mountedRef.current) { setState('offline'); setLatency(null) }
    } finally {
      clearTimeout(timer)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    check()
    const interval = setInterval(check, POLL_MS)
    const onOnline = () => check()
    const onOffline = () => { if (mountedRef.current) { setState('offline'); setLatency(null) } }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runSpeedTest = async () => {
    setTesting(true); setSpeedFailed(false); setSpeed(null)
    try {
      const res = await fetch('/api/system/speed-test', { cache: 'no-store' })
      const data = await res.json()
      if (!mountedRef.current) return
      if (data.ok) setSpeed({ mbps: data.mbps })
      else setSpeedFailed(true)
    } catch {
      if (mountedRef.current) setSpeedFailed(true)
    } finally {
      if (mountedRef.current) setTesting(false)
    }
  }

  if (state === null) return null

  const color = state === 'good' ? 'text-green-500 dark:text-green-400'
    : state === 'slow' ? 'text-amber-500 dark:text-amber-400'
      : 'text-red-500 dark:text-red-400'
  const dot = state === 'good' ? 'bg-green-400' : state === 'slow' ? 'bg-amber-400' : 'bg-red-400'
  const label = state === 'good' ? (ar ? 'الإنترنت سريع' : 'Internet fast')
    : state === 'slow' ? (ar ? 'الإنترنت بطيء' : 'Internet slow')
      : (ar ? 'الإنترنت مقطوع' : 'Internet down')

  //  تقييم بسيط للسرعة المقاسة
  const speedLabel = (mbps: number) => {
    if (mbps >= 25) return ar ? 'ممتازة' : 'Excellent'
    if (mbps >= 10) return ar ? 'جيدة' : 'Good'
    if (mbps >= 4) return ar ? 'متوسطة' : 'Fair'
    return ar ? 'ضعيفة' : 'Weak'
  }

  return (
    <div className="relative self-center flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        title={label}
        aria-label={label}
        className="flex items-center px-1.5 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150"
      >
        <svg className={`w-4 h-4 ${color}`} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
          {state === 'offline' && <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 3.5l17 17" />}
        </svg>
      </button>

      {open && (
        <>
          {/* إغلاق عند الضغط خارج اللوحة */}
          <div className="fixed inset-0 z-[129]" onClick={() => setOpen(false)} />
          <div className="absolute top-full end-0 mt-1 w-60 z-[130] rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl p-4 text-xs" dir={ar ? 'rtl' : 'ltr'}>
            <div className="font-bold text-sm text-gray-900 dark:text-gray-100 mb-3">
              {ar ? 'حالة الإنترنت' : 'Internet Status'}
            </div>

            {/* الحالة */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 dark:text-gray-400">{ar ? 'الحالة' : 'Status'}</span>
              <span className="font-bold flex items-center gap-1.5">
                <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
                <span className={color}>{label}</span>
              </span>
            </div>

            {/* زمن الاستجابة (Ping) */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 dark:text-gray-400">{ar ? 'زمن الاستجابة' : 'Ping'}</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {latency != null ? `${latency} ms` : '—'}
              </span>
            </div>

            {/* سرعة التحميل */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-500 dark:text-gray-400">{ar ? 'سرعة التحميل' : 'Download'}</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {testing
                  ? (ar ? 'جاري القياس…' : 'Measuring…')
                  : speed
                    ? `${speed.mbps} Mbps · ${speedLabel(speed.mbps)}`
                    : speedFailed
                      ? (ar ? 'فشل القياس' : 'Test failed')
                      : '—'}
              </span>
            </div>

            <button
              onClick={runSpeedTest}
              disabled={testing || state === 'offline'}
              className="w-full py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold text-xs transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? (ar ? 'جاري القياس…' : 'Measuring…') : (ar ? 'قياس السرعة' : 'Test Speed')}
            </button>
            <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
              {ar ? 'القياس بيتم من جهاز السيرفر (اللي عليه الرخصة والباك أب).' : 'Measured from the server device (license & backup).'}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
