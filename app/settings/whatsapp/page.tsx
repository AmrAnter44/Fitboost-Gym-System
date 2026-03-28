'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useLanguage } from '../../../contexts/LanguageContext'
import { useToast } from '../../../contexts/ToastContext'
import QRCode from 'qrcode'
import { getWhatsAppBrowserClient, SessionInfo } from '../../../lib/whatsappClient'

// ─── Constants ───────────────────────────────────────────────────────────────

const SESSION_COUNT = 4

const SESSION_COLORS: Record<number, { tab: string; ring: string; bg: string; text: string; border: string; dot: string }> = {
  0: {
    tab: 'bg-blue-500',
    ring: 'border-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-700',
    dot: 'bg-blue-500',
  },
  1: {
    tab: 'bg-green-500',
    ring: 'border-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-700',
    dot: 'bg-green-500',
  },
  2: {
    tab: 'bg-purple-500',
    ring: 'border-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-700',
    dot: 'bg-purple-500',
  },
  3: {
    tab: 'bg-orange-500',
    ring: 'border-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-700',
    dot: 'bg-orange-500',
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Op = 'init' | 'reconnect' | 'reset' | null

type ErrorInfo = {
  code: string
  title: string
  detail: string
  solution: string
}

type SessionState = {
  status: SessionInfo | null
  qrImg: string
  qrSeconds: number
  qrExpired: boolean
  op: Op
  err: ErrorInfo | null
  label: string
  dailyCount: number
  dailyLimit: number
  warmupDaysLeft: number | null // null = complete
}

// ─── Error classifier ─────────────────────────────────────────────────────────

function classifyError(msg: string): ErrorInfo {
  const m = msg.toLowerCase()
  if (m.includes('unavailable') || m.includes('503') || m.includes('service'))
    return {
      code: 'SERVICE_UNAVAILABLE',
      title: 'خدمة الواتساب غير متاحة',
      detail: msg,
      solution: 'افتح تيرمنال جديد وشغّل: npm run whatsapp',
    }
  if (m.includes('already connected') || m.includes('already initializing'))
    return {
      code: 'CONFLICT',
      title: 'يوجد اتصال نشط بالفعل',
      detail: msg,
      solution: 'انتظر ظهور QR Code أو اضغط "إعادة اتصال"',
    }
  if (m.includes('logged out') || m.includes('auth') || m.includes('logged_out'))
    return {
      code: 'AUTH_FAILED',
      title: 'انتهت صلاحية الجلسة',
      detail: msg,
      solution: 'اضغط "بداية جديدة" لحذف الجلسة والبدء من الأول',
    }
  if (m.includes('timeout') || m.includes('econnrefused') || m.includes('network'))
    return {
      code: 'NETWORK',
      title: 'مشكلة في الاتصال بالشبكة',
      detail: msg,
      solution: 'تأكد من اتصال الإنترنت وحاول مجدداً',
    }
  return {
    code: 'UNKNOWN',
    title: 'حدث خطأ غير متوقع',
    detail: msg,
    solution: 'جرب "إعادة اتصال" أو "بداية جديدة"',
  }
}

function defaultSessionState(idx: number): SessionState {
  return {
    status: null,
    qrImg: '',
    qrSeconds: 60,
    qrExpired: false,
    op: null,
    err: null,
    label: `Session ${idx + 1}`,
    dailyCount: 0,
    dailyLimit: 250,
    warmupDaysLeft: null,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const { t } = useLanguage()
  const toast = useToast()
  const isRTL = t('common.language') === 'ar'

  const [activeTab, setActiveTab] = useState(0)
  const [sessions, setSessions] = useState<SessionState[]>(() =>
    Array.from({ length: SESSION_COUNT }, (_, i) => defaultSessionState(i))
  )
  const [sidecarUp, setSidecarUp] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)

  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [sending, setSending] = useState(false)

  // Refs for QR countdown intervals
  const qrTimers = useRef<Record<number, ReturnType<typeof setInterval>>>({})

  useEffect(() => {
    setTestMsg(
      isRTL
        ? 'مرحباً! هذه رسالة تجريبية من نظام Fitboost 💪'
        : 'Hello! Test message from Fitboost 💪'
    )
  }, [isRTL])

  // ── Helper to update a specific session ─────────────────────────────────────

  const updateSession = useCallback((idx: number, patch: Partial<SessionState>) => {
    setSessions(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }, [])

  // ── Start QR countdown for a session ────────────────────────────────────────

  const startQrCountdown = useCallback((idx: number) => {
    // Clear any existing timer
    if (qrTimers.current[idx]) clearInterval(qrTimers.current[idx])

    qrTimers.current[idx] = setInterval(() => {
      setSessions(prev => {
        const s = prev[idx]
        if (s.qrSeconds <= 1) {
          clearInterval(qrTimers.current[idx])
          delete qrTimers.current[idx]
          return prev.map((ss, i) => (i === idx ? { ...ss, qrSeconds: 0, qrExpired: true } : ss))
        }
        return prev.map((ss, i) => (i === idx ? { ...ss, qrSeconds: ss.qrSeconds - 1 } : ss))
      })
    }, 1000)
  }, [])

  // Clean up QR timers on unmount
  useEffect(() => {
    return () => {
      Object.values(qrTimers.current).forEach(clearInterval)
    }
  }, [])

  // ── Status polling (all sessions) ───────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    try {
      const client = getWhatsAppBrowserClient()
      const data = await client.getSessions()

      if (data && data.length > 0) {
        setSidecarUp(true)
        setInitialLoading(false)

        setSessions(prev =>
          prev.map((s, i) => {
            const remote = data.find(d => d.sessionIndex === i)
            if (!remote) return s

            const newStatus: SessionInfo = {
              sessionIndex: remote.sessionIndex,
              isReady: remote.isReady,
              qrCode: remote.qrCode,
              hasClient: remote.hasClient,
              phoneNumber: remote.phoneNumber,
            }

            // Preserve existing QR if new data has no QR and isn't ready
            if (!newStatus.isReady && !newStatus.qrCode && s.status?.qrCode) {
              newStatus.qrCode = s.status.qrCode
            }

            return { ...s, status: newStatus }
          })
        )
      } else {
        setInitialLoading(false)
      }
    } catch {
      setInitialLoading(false)
      setSidecarUp(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
    const id = setInterval(fetchSessions, 3000)
    return () => clearInterval(id)
  }, [fetchSessions])

  // ── Multi-session SSE ───────────────────────────────────────────────────────

  useEffect(() => {
    const client = getWhatsAppBrowserClient()
    client.connectMultiSSE()
    return () => client.disconnectMultiSSE()
  }, [])

  useEffect(() => {
    const client = getWhatsAppBrowserClient()

    const onQR = (data: any) => {
      const idx = data?.sessionIndex ?? 0
      if (idx < 0 || idx >= SESSION_COUNT) return
      const qr = data?.qrCode ?? data

      updateSession(idx, {
        status: {
          sessionIndex: idx,
          isReady: false,
          qrCode: typeof qr === 'string' ? qr : null,
          hasClient: true,
        },
        err: null,
        op: null,
        qrExpired: false,
        qrSeconds: 60,
      })
      startQrCountdown(idx)
    }

    const onReady = (data: any) => {
      const idx = data?.sessionIndex ?? 0
      if (idx < 0 || idx >= SESSION_COUNT) return

      updateSession(idx, {
        status: {
          sessionIndex: idx,
          isReady: true,
          qrCode: null,
          hasClient: true,
          phoneNumber: data?.phoneNumber,
        },
        err: null,
        op: null,
        qrExpired: false,
      })

      // Clear QR timer
      if (qrTimers.current[idx]) {
        clearInterval(qrTimers.current[idx])
        delete qrTimers.current[idx]
      }

      toast.success(`✅ ${t('settings.whatsapp.toast.connected')} (${t('whatsappInbox.sessions.session')} ${idx + 1})`)
    }

    const onDisconnected = (data: any) => {
      const idx = data?.sessionIndex ?? 0
      const reason = data?.reason ?? (typeof data === 'string' ? data : '')
      if (idx < 0 || idx >= SESSION_COUNT) return

      updateSession(idx, {
        status: {
          sessionIndex: idx,
          isReady: false,
          qrCode: null,
          hasClient: false,
        },
        op: null,
      })

      if (reason && reason !== 'Max reconnects reached') {
        updateSession(idx, { err: classifyError(reason) })
      }

      // Clear QR timer
      if (qrTimers.current[idx]) {
        clearInterval(qrTimers.current[idx])
        delete qrTimers.current[idx]
      }
    }

    const onStatusAll = (data: any) => {
      if (!Array.isArray(data)) return
      setSessions(prev =>
        prev.map((s, i) => {
          const remote = data.find((d: any) => d.sessionIndex === i)
          if (!remote) return s
          return {
            ...s,
            status: {
              sessionIndex: remote.sessionIndex,
              isReady: remote.isReady,
              qrCode: remote.qrCode,
              hasClient: remote.hasClient,
              phoneNumber: remote.phoneNumber,
            },
          }
        })
      )
    }

    client.on('qr', onQR)
    client.on('ready', onReady)
    client.on('disconnected', onDisconnected)
    client.on('status_all', onStatusAll)

    return () => {
      client.off('qr', onQR)
      client.off('ready', onReady)
      client.off('disconnected', onDisconnected)
      client.off('status_all', onStatusAll)
    }
  }, [t, toast, updateSession, startQrCountdown])

  // ── QR image generation (per session) ───────────────────────────────────────

  useEffect(() => {
    sessions.forEach((s, idx) => {
      const qrCode = s.status?.qrCode
      if (!qrCode) {
        if (s.qrImg) updateSession(idx, { qrImg: '' })
        return
      }
      QRCode.toDataURL(qrCode, {
        width: 260,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
        .then(img => updateSession(idx, { qrImg: img }))
        .catch(() => updateSession(idx, { qrImg: '' }))
    })
    // Only re-run when QR codes change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.map(s => s.status?.qrCode).join(',')])

  // ── Actions (per session) ──────────────────────────────────────────────────

  async function handleInit(idx: number) {
    const s = sessions[idx]
    if (s.op) return
    updateSession(idx, { op: 'init', err: null })
    try {
      const res = await getWhatsAppBrowserClient().initSession(idx)
      if (!res.success) {
        const e = classifyError(res.error ?? 'Unknown error')
        if (e.code !== 'CONFLICT') updateSession(idx, { err: e })
      }
    } catch (e) {
      updateSession(idx, { err: classifyError(e instanceof Error ? e.message : String(e)) })
    } finally {
      updateSession(idx, { op: null })
    }
  }

  async function handleReconnect(idx: number) {
    const s = sessions[idx]
    if (s.op) return
    updateSession(idx, { op: 'reconnect', err: null })
    try {
      const res = await getWhatsAppBrowserClient().reconnectSession(idx)
      if (!res.success) updateSession(idx, { err: classifyError(res.error ?? 'Unknown error') })
    } catch (e) {
      updateSession(idx, { err: classifyError(e instanceof Error ? e.message : String(e)) })
    } finally {
      updateSession(idx, { op: null })
    }
  }

  async function handleReset(idx: number) {
    const s = sessions[idx]
    if (s.op) return
    updateSession(idx, { op: 'reset', err: null })
    try {
      const res = await getWhatsAppBrowserClient().resetSessionByIndex(idx)
      if (!res.success) updateSession(idx, { err: classifyError(res.error ?? 'Unknown error') })
    } catch (e) {
      updateSession(idx, { err: classifyError(e instanceof Error ? e.message : String(e)) })
    } finally {
      updateSession(idx, { op: null })
    }
  }

  async function handleSendTest() {
    if (!testPhone || testPhone.length < 10) {
      toast.error(`⚠️ ${t('settings.whatsapp.toast.invalidPhone')}`)
      return
    }
    setSending(true)
    try {
      const res = await getWhatsAppBrowserClient().sendMessage(testPhone, testMsg)
      if (res.success) {
        toast.success(`✅ ${t('settings.whatsapp.toast.testSent')}`)
        setTestPhone('')
      } else {
        toast.error(`❌ ${res.error ?? t('settings.whatsapp.toast.sendFailed')}`)
      }
    } catch {
      toast.error(`❌ ${t('settings.whatsapp.toast.sendError')}`)
    } finally {
      setSending(false)
    }
  }

  // ── Derived state for active session ─────────────────────────────────────────

  const s = sessions[activeTab]
  const loading = s.status === null && initialLoading
  const isConnected = !!s.status?.isReady
  const hasQR = !!s.status?.qrCode && !s.qrExpired
  const hasClient = !!s.status?.hasClient

  // ── Banner config for active session ──────────────────────────────────────

  const banner = (() => {
    if (loading) return { bg: 'from-gray-400 to-gray-500', icon: '⌛', label: t('settings.whatsapp.loading'), sub: '...' }
    if (!sidecarUp) return { bg: 'from-red-500 to-rose-600', icon: '🔌', label: 'الخدمة غير متاحة', sub: 'شغّل: npm run whatsapp' }
    if (isConnected) return { bg: 'from-green-500 to-emerald-600', icon: '✅', label: t('settings.whatsapp.connected'), sub: t('settings.whatsapp.readyToSend') }
    if (hasQR) return { bg: 'from-blue-500 to-indigo-600', icon: '📱', label: t('settings.whatsapp.scanQR'), sub: t('settings.whatsapp.qrInstructions') }
    if (s.qrExpired) return { bg: 'from-orange-500 to-amber-600', icon: '⏰', label: 'انتهت صلاحية QR Code', sub: 'اضغط "إعادة اتصال" للحصول على QR جديد' }
    if (s.op === 'init') return { bg: 'from-yellow-500 to-orange-500', icon: '⏳', label: t('settings.whatsapp.initializing'), sub: 'جاري التهيئة...' }
    if (s.op === 'reconnect') return { bg: 'from-yellow-500 to-orange-500', icon: '⏳', label: t('settings.whatsapp.reconnecting'), sub: 'جاري إعادة الاتصال...' }
    if (s.op === 'reset') return { bg: 'from-yellow-500 to-orange-500', icon: '⏳', label: t('settings.whatsapp.resetting'), sub: 'جاري إعادة التعيين...' }
    return { bg: 'from-gray-500 to-gray-600', icon: '⚪', label: t('settings.whatsapp.disconnected'), sub: t('settings.whatsapp.mustBeConnected') }
  })()

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <span className="text-3xl">💬</span>
            {t('whatsappInbox.sessions.title') !== 'whatsappInbox.sessions.title'
              ? t('whatsappInbox.sessions.title')
              : t('settings.whatsapp.title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {t('settings.whatsapp.subtitle')}
          </p>
        </div>

        {/* Sidecar status pill */}
        {!initialLoading && (
          <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold border ${
            sidecarUp
              ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300'
          }`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sidecarUp ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs font-mono opacity-70">port 4002</span>
            <span>{sidecarUp ? 'WhatsApp Service Online' : 'WhatsApp Service Offline'}</span>
            <span className="ms-auto text-xs">{sidecarUp ? '✓' : '✗'}</span>
          </div>
        )}

        {/* Session Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sessions.map((sess, idx) => {
            const colors = SESSION_COLORS[idx] || SESSION_COLORS[0]
            const connected = !!sess.status?.isReady
            return (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap border-2 ${
                  activeTab === idx
                    ? `${colors.bg} ${colors.text} ${colors.border} shadow-md scale-105`
                    : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${connected ? colors.dot : 'bg-gray-300 dark:bg-gray-600'} ${connected ? 'animate-pulse' : ''}`} />
                <span>رقم {idx + 1}</span>
                {connected && sess.status?.phoneNumber && (
                  <span className="text-xs font-mono opacity-70" dir="ltr">{sess.status.phoneNumber}</span>
                )}
                {connected && <span className="text-xs">✅</span>}
              </button>
            )
          })}
        </div>

        {/* Session card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">

          {/* Session header */}
          <div className={`flex items-center gap-3 px-5 py-3 border-b ${(SESSION_COLORS[activeTab] || SESSION_COLORS[0]).border} ${(SESSION_COLORS[activeTab] || SESSION_COLORS[0]).bg}`}>
            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${(SESSION_COLORS[activeTab] || SESSION_COLORS[0]).dot} ${isConnected ? 'animate-pulse' : 'opacity-40'}`} />
            <span className={`font-bold text-sm ${(SESSION_COLORS[activeTab] || SESSION_COLORS[0]).text}`}>
              WhatsApp - رقم {activeTab + 1}
            </span>
            {isConnected && s.status?.phoneNumber && (
              <span className="ms-auto text-xs font-mono text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <span>📞</span>
                <span dir="ltr">{s.status.phoneNumber}</span>
              </span>
            )}
          </div>

          {/* Status banner */}
          <div className={`bg-gradient-to-r ${banner.bg} px-6 py-5`}>
            <div className="flex items-center gap-4">
              <span className="text-4xl select-none">{banner.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-black text-lg text-white leading-tight">{banner.label}</p>
                <p className="text-sm text-white/75 mt-0.5">{banner.sub}</p>
              </div>
              {/* Spinner when op active */}
              {s.op && (
                <div className="ms-auto w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
              )}
            </div>
          </div>

          <div className="p-6 space-y-5">

            {/* Session info badges */}
            {!loading && (<>
              <div className="flex flex-wrap gap-2">
                {/* Daily count */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${SESSION_COLORS[0].border} ${SESSION_COLORS[0].bg} ${SESSION_COLORS[0].text}`}>
                  <span>📨</span>
                  <span>{t('whatsappInbox.sessions.dailyCount') !== 'whatsappInbox.sessions.dailyCount' ? t('whatsappInbox.sessions.dailyCount') : 'Daily'}: {s.dailyCount}/{s.dailyLimit}</span>
                </div>

                {/* Warm-up status */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  s.warmupDaysLeft === null
                    ? 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                }`}>
                  <span>{s.warmupDaysLeft === null ? '✅' : '🔥'}</span>
                  <span>
                    {s.warmupDaysLeft === null
                      ? (t('whatsappInbox.sessions.warmupComplete') !== 'whatsappInbox.sessions.warmupComplete' ? t('whatsappInbox.sessions.warmupComplete') : 'Warm-up complete')
                      : `${t('whatsappInbox.sessions.warmupDaysLeft') !== 'whatsappInbox.sessions.warmupDaysLeft' ? t('whatsappInbox.sessions.warmupDaysLeft') : 'Warm-up'}: ${s.warmupDaysLeft} ${isRTL ? 'يوم' : 'days'}`
                    }
                  </span>
                </div>

                {/* Connection status badge */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  isConnected
                    ? 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span>
                    {isConnected
                      ? (t('whatsappInbox.sessions.connected') !== 'whatsappInbox.sessions.connected' ? t('whatsappInbox.sessions.connected') : 'Connected')
                      : (t('whatsappInbox.sessions.disconnected') !== 'whatsappInbox.sessions.disconnected' ? t('whatsappInbox.sessions.disconnected') : 'Disconnected')
                    }
                  </span>
                </div>

              </div>
            </>)}

            {/* QR Code */}
            {hasQR && (
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  {s.qrImg ? (
                    <div className={`p-3 bg-white rounded-2xl shadow-md border-4 ${SESSION_COLORS[0].ring}`}>
                      <img src={s.qrImg} alt="QR Code" className="w-56 h-56 rounded-lg" />
                    </div>
                  ) : (
                    <div className="w-56 h-56 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-2xl border-4 border-gray-200 dark:border-gray-600">
                      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {/* Countdown ring */}
                  <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white shadow-lg transition-colors ${
                    s.qrSeconds > 30 ? 'bg-blue-500' : s.qrSeconds > 10 ? 'bg-orange-500' : 'bg-red-500'
                  }`}>
                    ⏱ {s.qrSeconds}s
                  </div>
                </div>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 pt-2 max-w-xs">
                  {t('settings.whatsapp.qrInstructions')}
                </p>
              </div>
            )}

            {/* QR expired notice */}
            {s.qrExpired && s.status?.qrCode && (
              <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl text-sm text-orange-800 dark:text-orange-300">
                <span>⏰</span>
                <span>انتهت صلاحية QR Code – اضغط "إعادة اتصال" للحصول على كود جديد</span>
              </div>
            )}

            {/* Connected */}
            {isConnected && (
              <div className="flex items-center gap-3 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl text-sm font-semibold text-green-800 dark:text-green-300">
                <span>🟢</span>
                <span>{t('settings.whatsapp.readyToSend')}</span>
                {s.status?.phoneNumber && (
                  <span className="ms-auto text-xs font-mono opacity-75" dir="ltr">{s.status.phoneNumber}</span>
                )}
              </div>
            )}

            {/* Error box */}
            {s.err && (
              <div className="rounded-xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-red-100 dark:bg-red-900/40 border-b border-red-200 dark:border-red-800">
                  <span className="text-red-500">🚨</span>
                  <span className="font-bold text-sm text-red-800 dark:text-red-300">{s.err.title}</span>
                  <span className="ms-auto text-xs font-mono text-red-400">[{s.err.code}]</span>
                  <button
                    onClick={() => updateSession(activeTab, { err: null })}
                    className="text-red-400 hover:text-red-700 dark:hover:text-red-200 transition ms-2 leading-none text-base"
                  >✕</button>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {s.err.detail && (
                    <code className="block text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 break-all font-mono">
                      {s.err.detail}
                    </code>
                  )}
                  {s.err.solution && (
                    <p className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                      <span className="text-blue-500 flex-shrink-0 mt-0.5">💡</span>
                      <span>{s.err.solution}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            {!hasClient ? (
              <button
                onClick={() => handleInit(activeTab)}
                disabled={!!s.op || !sidecarUp}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {s.op === 'init'
                  ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('settings.whatsapp.initializing')}</>
                  : <><span>🚀</span>{t('settings.whatsapp.initialize')}</>}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleReconnect(activeTab)}
                    disabled={!!s.op}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    {s.op === 'reconnect'
                      ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('settings.whatsapp.reconnecting')}</>
                      : <><span>🔄</span>{t('settings.whatsapp.reconnect')}</>}
                  </button>
                  <button
                    onClick={() => handleReset(activeTab)}
                    disabled={!!s.op}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white text-sm bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    {s.op === 'reset'
                      ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('settings.whatsapp.resetting')}</>
                      : <><span>🔥</span>{t('settings.whatsapp.resetSession')}</>}
                  </button>
                </div>
                <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                  {isConnected ? t('settings.whatsapp.restartInfo') : t('settings.whatsapp.reconnectInfo')}
                </p>
                <p className="text-center text-xs text-red-500 dark:text-red-400">
                  {t('settings.whatsapp.resetInfo')}
                </p>
              </div>
            )}

          </div>
        </div>

        {/* Test message -- only when active session is connected */}
        {isConnected && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>🧪</span>{t('settings.whatsapp.testSending')}
            </h2>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                📞 {t('settings.whatsapp.phoneNumber')}
              </label>
              <input
                type="tel"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                💬 {t('settings.whatsapp.message')}
              </label>
              <textarea
                value={testMsg}
                onChange={e => setTestMsg(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none transition resize-none"
              />
            </div>
            <button
              onClick={handleSendTest}
              disabled={sending || !testPhone}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {sending
                ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('settings.whatsapp.sending')}</>
                : <><span>📲</span>{t('settings.whatsapp.sendTestMessage')}</>}
            </button>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
          <h3 className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-3">
            <span>ℹ️</span>{t('settings.whatsapp.importantInfo')}
          </h3>
          <ul className="space-y-1.5 text-sm text-blue-700 dark:text-blue-300">
            <li>• {t('settings.whatsapp.infoItems.qrOnce')}</li>
            <li>• {t('settings.whatsapp.infoItems.sessionPersists')}</li>
            <li>• {t('settings.whatsapp.infoItems.autoSend')}</li>
            <li>• {t('settings.whatsapp.infoItems.fromConnected')}</li>
            <li>• {t('settings.whatsapp.infoItems.keepConnected')}</li>
          </ul>
        </div>

      </div>
    </div>
  )
}
