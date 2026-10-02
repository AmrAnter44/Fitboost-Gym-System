'use client'

export const dynamic = 'force-dynamic'

// 📅 «يومي» — صفحة الموظف (بتفتح جوه أبلكيشن FB Team وكمان من المتصفح)
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import dynamicImport from 'next/dynamic'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../contexts/ToastContext'
import { LoadingScreen } from '../../components/Spinner'
import { getAppLocation, inFBTeamApp } from '../../lib/fbTeam'
import { compressImage } from '../../lib/imageCompress'

const CameraModal = dynamicImport(() => import('../../components/CameraModal'), { ssr: false })

interface TodayData {
  name: string
  role: string
  isManager: boolean
  smart: { enabled: boolean; hasLocation: boolean; radiusM: number; requireSelfie: boolean }
  tasks: { id: string; title: string; dueDate: string | null; priority: string }[]
  staff: { name: string; staffCode: string } | null
  shift?: { start: string | null; end: string | null; off: boolean }
  open?: { checkIn: string } | null
  today?: { checkIn: string; checkOut: string | null; duration: number | null; selfie: boolean }[]
  month?: { minutes: number; days: number }
  pendingLeaves?: number
}

const card = 'bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5'

export default function MyDayPage() {
  const { t, locale, direction } = useLanguage()
  const toast = useToast()
  const [data, setData] = useState<TodayData | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<'' | 'attend' | 'location'>('')
  const [selfieFor, setSelfieFor] = useState<null | { lat: number; lng: number; accuracy: number; mocked: boolean }>(null)
  const inApp = typeof window !== 'undefined' && inFBTeamApp()

  const load = useCallback(() => {
    setFailed(false)
    fetch('/api/me/today', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true))
  }, [])
  useEffect(load, [load])

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' })

  async function submitAttendance(loc: { lat: number; lng: number; accuracy: number; mocked: boolean }, selfie?: string) {
    const res = await fetch('/api/attendance/smart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...loc, ...(selfie ? { selfie } : {}) }),
    })
    const j = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success(j.action === 'check-in' ? t('me.checkedIn') : t('me.checkedOut'))
      load()
    } else if (j.needSelfie) {
      setSelfieFor(loc)
    } else {
      toast.error(j.error || t('me.error'))
    }
  }

  async function attend() {
    setBusy('attend')
    try {
      const loc = await getAppLocation()
      const willCheckIn = !data?.open
      if (willCheckIn && data?.smart.requireSelfie) setSelfieFor(loc)
      else await submitAttendance(loc)
    } catch (e: any) {
      toast.error(e?.message && e.message !== 'timeout' && e.message !== 'not-in-app' ? e.message : t('me.error'))
    } finally {
      setBusy('')
    }
  }

  async function onSelfie(file: File) {
    const loc = selfieFor
    setSelfieFor(null)
    if (!loc) return
    setBusy('attend')
    try {
      const small = await compressImage(file, 800, 0.8)
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = reject
        r.readAsDataURL(small)
      })
      await submitAttendance(loc, dataUrl)
    } catch {
      toast.error(t('me.error'))
    } finally {
      setBusy('')
    }
  }

  async function setLocation() {
    if (!confirm(t('me.confirmSetLocation'))) return
    setBusy('location')
    try {
      const loc = await getAppLocation()
      const res = await fetch('/api/attendance/smart/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loc),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(j.synced ? t('me.locationSaved') : t('me.locationSavedLocal'))
        load()
      } else toast.error(j.error || t('me.error'))
    } catch (e: any) {
      toast.error(e?.message && e.message !== 'timeout' && e.message !== 'not-in-app' ? e.message : t('me.error'))
    } finally {
      setBusy('')
    }
  }

  if (failed) {
    return (
      <div className="p-6 text-center" dir={direction}>
        <p className="text-gray-600 dark:text-gray-300 mb-3">{t('me.error')}</p>
        <button onClick={load} className="px-4 min-h-[44px] rounded-xl bg-primary-500 text-primary-contrast font-bold">{t('me.retry')}</button>
      </div>
    )
  }
  if (!data) return <LoadingScreen />

  const hours = data.month ? (data.month.minutes / 60).toFixed(1) : '0'
  const canSmart = data.smart.enabled && data.smart.hasLocation && !!data.staff

  return (
    <div className="max-w-xl mx-auto px-4 py-4 sm:py-6 space-y-4" dir={direction}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 truncate">{t('me.hello', { name: data.staff?.name || data.name })}</h1>
        <Link href="/me/money" className="shrink-0 px-3 min-h-[40px] inline-flex items-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
          💰 {t('me.myMoney')}
        </Link>
      </div>

      {!data.staff && (
        <div className={`${card} text-sm text-amber-700 dark:text-amber-300`}>{t('me.noStaff')}</div>
      )}

      {data.staff && (
        <div className={card}>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{t('me.todayShift')}</p>
          <p className="text-2xl font-black text-gray-900 dark:text-gray-100" dir="ltr" style={{ textAlign: direction === 'rtl' ? 'right' : 'left' }}>
            {data.shift?.off ? t('me.dayOff') : data.shift?.start ? `${data.shift.start} – ${data.shift.end || '…'}` : t('me.noShift')}
          </p>
          <p className={`mt-3 text-sm font-semibold ${data.open ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {data.open ? t('me.inNow', { time: fmtTime(data.open.checkIn) }) : t('me.notIn')}
          </p>

          <div className="mt-4">
            {!data.smart.enabled ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('me.smartOff')}</p>
            ) : !data.smart.hasLocation ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">{t('me.noLocation')}</p>
            ) : !inApp ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('me.openInApp')}</p>
            ) : (
              <button
                onClick={attend}
                disabled={!!busy || !canSmart}
                className={`w-full min-h-[56px] rounded-2xl text-lg font-black text-white transition-colors disabled:opacity-60 ${data.open ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
              >
                {busy === 'attend' ? t('me.locating') : data.open ? t('me.checkOut') : t('me.checkIn')}
              </button>
            )}
          </div>
        </div>
      )}

      {data.isManager && inApp && (
        <div className={card}>
          <button
            onClick={setLocation}
            disabled={!!busy}
            className="w-full min-h-[48px] rounded-xl border-2 border-primary-500 text-primary-600 dark:text-primary-400 font-bold disabled:opacity-60"
          >
            📍 {busy === 'location' ? t('me.locating') : t('me.setLocation')}
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('me.setLocationHint')}</p>
        </div>
      )}

      {data.staff && (
        <div className="grid grid-cols-2 gap-3">
          <div className={card}>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{t('me.thisMonth')}</p>
            <p className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1">{hours} <span className="text-sm font-bold text-gray-500">{t('me.hours')}</span></p>
          </div>
          <div className={card}>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{t('me.thisMonth')}</p>
            <p className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1">{data.month?.days ?? 0} <span className="text-sm font-bold text-gray-500">{t('me.days')}</span></p>
          </div>
        </div>
      )}

      {!!data.today?.length && (
        <div className={card}>
          <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-2">{t('me.todayLog')}</p>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {data.today.map((r, i) => (
              <li key={i} className="py-2 flex items-center justify-between text-sm gap-2">
                <span className="text-gray-700 dark:text-gray-200">{t('me.in')} {fmtTime(r.checkIn)}{r.selfie ? ' 📸' : ''}</span>
                <span className="text-gray-500 dark:text-gray-400">{r.checkOut ? `${t('me.out')} ${fmtTime(r.checkOut)}` : t('me.stillIn')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={card}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{t('me.myTasks')}</p>
          <Link href="/tasks" className="text-xs font-bold text-primary-600 dark:text-primary-400 min-h-[32px] inline-flex items-center">{t('me.allTasks')}</Link>
        </div>
        {data.tasks.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('me.noTasks')}</p>
        ) : (
          <ul className="space-y-2">
            {data.tasks.map(task => (
              <li key={task.id} className="flex items-start gap-2 text-sm">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${task.priority === 'high' ? 'bg-rose-500' : task.priority === 'low' ? 'bg-gray-400' : 'bg-amber-500'}`} />
                <span className="text-gray-800 dark:text-gray-100 break-words min-w-0">{task.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.staff && (
        <Link href="/my-payslips" className={`${card} flex items-center justify-between min-h-[56px]`}>
          <span className="font-bold text-gray-800 dark:text-gray-100">{t('me.payslipsLeaves')}</span>
          {!!data.pendingLeaves && <span className="text-xs text-amber-600 dark:text-amber-400">{t('me.pendingLeaves', { n: String(data.pendingLeaves) })}</span>}
        </Link>
      )}

      <CameraModal
        isOpen={!!selfieFor}
        autoCapture
        autoCaptureSeconds={2}
        title={t('me.selfieTitle')}
        onClose={() => setSelfieFor(null)}
        onCapture={onSelfie}
      />
    </div>
  )
}
