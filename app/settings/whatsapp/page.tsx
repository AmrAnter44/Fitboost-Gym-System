'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '../../../contexts/LanguageContext'
import { useToast } from '../../../contexts/ToastContext'
import QRCode from 'qrcode'
import { getWhatsAppBrowserClient } from '../../../lib/whatsappClient'

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = {
  isReady: boolean
  qrCode: string | null
  hasClient: boolean
  sidecarOnline: boolean
}

type Op = 'init' | 'reconnect' | 'reset' | null

type ErrorInfo = {
  code: string
  title: string
  detail: string
  solution: string
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const { t } = useLanguage()
  const toast = useToast()
  const isRTL = t('common.language') === 'ar'

  const [status, setStatus] = useState<Status | null>(null)
  const [qrImg, setQrImg] = useState('')
  const [qrSeconds, setQrSeconds] = useState(60)
  const [qrExpired, setQrExpired] = useState(false)
  const [op, setOp] = useState<Op>(null)
  const [err, setErr] = useState<ErrorInfo | null>(null)

  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    setTestMsg(
      isRTL
        ? 'مرحباً! هذه رسالة تجريبية من نظام Fitboost 💪'
        : 'Hello! Test message from Fitboost 💪'
    )
  }, [isRTL])

  // ── Status polling ──────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const data = (await getWhatsAppBrowserClient().getStatus()) as Status
      setStatus(prev => {
        if (!prev) return data
        if (data.isReady) return data
        if (data.qrCode) return data
        return { ...data, qrCode: prev.qrCode }
      })
      if (data.sidecarOnline) {
        setErr(prev => (prev?.code === 'SERVICE_UNAVAILABLE' ? null : prev))
      }
    } catch {
      setStatus(prev =>
        prev ?? { isReady: false, qrCode: null, hasClient: false, sidecarOnline: false }
      )
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, 3000)
    return () => clearInterval(id)
  }, [fetchStatus])

  // ── SSE ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const client = getWhatsAppBrowserClient()
    client.connectSSE()
    return () => client.disconnectSSE()
  }, [])

  useEffect(() => {
    const client = getWhatsAppBrowserClient()

    const onQR = (qr: string) => {
      setStatus(prev => ({
        ...(prev ?? { hasClient: true, sidecarOnline: true }),
        isReady: false,
        qrCode: qr,
      }))
      setErr(null)
      setOp(null)
      setQrExpired(false)
      setQrSeconds(60)
    }

    const onReady = () => {
      setStatus(prev => ({
        ...(prev ?? { qrCode: null, sidecarOnline: true }),
        hasClient: true,
        isReady: true,
        qrCode: null,
      }))
      setErr(null)
      setOp(null)
      setQrExpired(false)
      toast.success(`✅ ${t('settings.whatsapp.toast.connected')}`)
    }

    const onDisconnected = (reason: string) => {
      setStatus(prev => ({
        ...(prev ?? { qrCode: null, sidecarOnline: true }),
        hasClient: false,
        isReady: false,
        qrCode: null,
      }))
      setOp(null)
      if (reason && reason !== 'Max reconnects reached')
        setErr(classifyError(reason))
    }

    client.on('qr', onQR)
    client.on('ready', onReady)
    client.on('disconnected', onDisconnected)
    return () => {
      client.off('qr', onQR)
      client.off('ready', onReady)
      client.off('disconnected', onDisconnected)
    }
  }, [t, toast])

  // ── QR image ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!status?.qrCode) { setQrImg(''); return }
    QRCode.toDataURL(status.qrCode, {
      width: 280,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setQrImg)
      .catch(() => setQrImg(''))
  }, [status?.qrCode])

  // ── QR countdown ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!status?.qrCode) return
    setQrSeconds(60)
    setQrExpired(false)
    const id = setInterval(() => {
      setQrSeconds(s => {
        if (s <= 1) { clearInterval(id); setQrExpired(true); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [status?.qrCode])

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleInit() {
    if (op) return
    setOp('init'); setErr(null)
    try {
      const res = await getWhatsAppBrowserClient().init()
      if (!res.success) {
        const e = classifyError(res.error ?? 'Unknown error')
        if (e.code !== 'CONFLICT') setErr(e)
      }
    } catch (e) {
      setErr(classifyError(e instanceof Error ? e.message : String(e)))
    } finally { setOp(null) }
  }

  async function handleReconnect() {
    if (op) return
    setOp('reconnect'); setErr(null)
    try {
      const res = await getWhatsAppBrowserClient().reconnect()
      if (!res.success) setErr(classifyError(res.error ?? 'Unknown error'))
    } catch (e) {
      setErr(classifyError(e instanceof Error ? e.message : String(e)))
    } finally { setOp(null) }
  }

  async function handleReset() {
    if (op) return
    setOp('reset'); setErr(null)
    try {
      const res = await getWhatsAppBrowserClient().resetSession()
      if (!res.success) setErr(classifyError(res.error ?? 'Unknown error'))
    } catch (e) {
      setErr(classifyError(e instanceof Error ? e.message : String(e)))
    } finally { setOp(null) }
  }

  async function handleSendTest() {
    if (!testPhone || testPhone.length < 10) {
      toast.error(`⚠️ ${t('settings.whatsapp.toast.invalidPhone')}`); return
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
    } finally { setSending(false) }
  }

  // ── Derived state ────────────────────────────────────────────────────────────

  const loading      = status === null
  const sidecarUp    = status?.sidecarOnline !== false
  const isConnected  = !!status?.isReady
  const hasQR        = !!status?.qrCode && !qrExpired
  const hasClient    = !!status?.hasClient

  // ── Banner config ────────────────────────────────────────────────────────────

  const banner = (() => {
    if (loading)     return { bg: 'from-gray-400 to-gray-500',     icon: '⌛', label: t('settings.whatsapp.loading'),     sub: '...' }
    if (!sidecarUp)  return { bg: 'from-red-500 to-rose-600',      icon: '🔌', label: 'الخدمة غير متاحة',               sub: 'شغّل: npm run whatsapp' }
    if (isConnected) return { bg: 'from-green-500 to-emerald-600', icon: '✅', label: t('settings.whatsapp.connected'),  sub: t('settings.whatsapp.readyToSend') }
    if (hasQR)       return { bg: 'from-blue-500 to-indigo-600',   icon: '📱', label: t('settings.whatsapp.scanQR'),    sub: t('settings.whatsapp.qrInstructions') }
    if (qrExpired)   return { bg: 'from-orange-500 to-amber-600',  icon: '⏰', label: 'انتهت صلاحية QR Code',            sub: 'اضغط "إعادة اتصال" للحصول على QR جديد' }
    if (op === 'init')      return { bg: 'from-yellow-500 to-orange-500', icon: '⏳', label: t('settings.whatsapp.initializing'),  sub: 'جاري التهيئة...' }
    if (op === 'reconnect') return { bg: 'from-yellow-500 to-orange-500', icon: '⏳', label: t('settings.whatsapp.reconnecting'), sub: 'جاري إعادة الاتصال...' }
    if (op === 'reset')     return { bg: 'from-yellow-500 to-orange-500', icon: '⏳', label: t('settings.whatsapp.resetting'),    sub: 'جاري إعادة التعيين...' }
    return { bg: 'from-gray-500 to-gray-600', icon: '⚪', label: t('settings.whatsapp.disconnected'), sub: t('settings.whatsapp.mustBeConnected') }
  })()

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-xl mx-auto space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <span className="text-3xl">💬</span>
            {t('settings.whatsapp.title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {t('settings.whatsapp.subtitle')}
          </p>
        </div>

        {/* Sidecar status pill */}
        {!loading && (
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

        {/* Main card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">

          {/* Status banner */}
          <div className={`bg-gradient-to-r ${banner.bg} px-6 py-5`}>
            <div className="flex items-center gap-4">
              <span className="text-4xl select-none">{banner.icon}</span>
              <div>
                <p className="font-black text-lg text-white leading-tight">{banner.label}</p>
                <p className="text-sm text-white/75 mt-0.5">{banner.sub}</p>
              </div>
              {/* Spinner when op active */}
              {op && (
                <div className="ms-auto w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>

          <div className="p-6 space-y-5">

            {/* QR Code */}
            {hasQR && (
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  {qrImg ? (
                    <div className="p-3 bg-white rounded-2xl shadow-md border-4 border-blue-400">
                      <img src={qrImg} alt="QR Code" className="w-60 h-60 rounded-lg" />
                    </div>
                  ) : (
                    <div className="w-60 h-60 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-2xl border-4 border-gray-200 dark:border-gray-600">
                      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {/* Countdown ring */}
                  <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white shadow-lg transition-colors ${
                    qrSeconds > 30 ? 'bg-blue-500' : qrSeconds > 10 ? 'bg-orange-500' : 'bg-red-500'
                  }`}>
                    ⏱ {qrSeconds}s
                  </div>
                </div>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 pt-2 max-w-xs">
                  {t('settings.whatsapp.qrInstructions')}
                </p>
              </div>
            )}

            {/* QR expired notice */}
            {qrExpired && status?.qrCode && (
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
              </div>
            )}

            {/* Error box */}
            {err && (
              <div className="rounded-xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-red-100 dark:bg-red-900/40 border-b border-red-200 dark:border-red-800">
                  <span className="text-red-500">🚨</span>
                  <span className="font-bold text-sm text-red-800 dark:text-red-300">{err.title}</span>
                  <span className="ms-auto text-xs font-mono text-red-400">[{err.code}]</span>
                  <button
                    onClick={() => setErr(null)}
                    className="text-red-400 hover:text-red-700 dark:hover:text-red-200 transition ms-2 leading-none text-base"
                  >✕</button>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {err.detail && (
                    <code className="block text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 break-all font-mono">
                      {err.detail}
                    </code>
                  )}
                  {err.solution && (
                    <p className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                      <span className="text-blue-500 flex-shrink-0 mt-0.5">💡</span>
                      <span>{err.solution}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            {!hasClient ? (
              <button
                onClick={handleInit}
                disabled={!!op || !sidecarUp}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {op === 'init'
                  ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('settings.whatsapp.initializing')}</>
                  : <><span>🚀</span>{t('settings.whatsapp.initialize')}</>}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleReconnect}
                    disabled={!!op}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    {op === 'reconnect'
                      ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('settings.whatsapp.reconnecting')}</>
                      : <><span>🔄</span>{t('settings.whatsapp.reconnect')}</>}
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={!!op}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white text-sm bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    {op === 'reset'
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

        {/* Test message – only when connected */}
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
