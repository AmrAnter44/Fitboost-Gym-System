'use client'

/**
 * ⬆️ بار ثابت فوق السيستم لما يكون فيه نسخة أحدث منشورة.
 * - مش بيقفل ولا بيغطي حاجة (جزء من الصفحة نفسها، مش overlay) — الشغل ماشي عادي.
 * - بيختفي لوحده أول ما السيستم يتحدّث.
 * - في تطبيق الكمبيوتر: زرار «حدّث دلوقتي» بيفتح نافذة التحديث الموجودة.
 */
import { useEffect, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

type Status = { current: string; latest: string | null; outdated: boolean }

const RECHECK_MS = 60 * 60 * 1000

export default function OutdatedBanner() {
  const { tr, direction } = useLanguage()
  const [st, setSt] = useState<Status | null>(null)
  const [isElectron, setIsElectron] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // جوه أبلكيشن FB Team الموظف مش بيحدّث السيستم — مالوش لازمة هناك
    if (/FBTeam\//.test(navigator.userAgent)) return
    setIsElectron(!!(window as any).electron?.isElectron)
    let alive = true
    const load = () =>
      fetch('/api/system/version-status', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (alive && d) setSt(d) })
        .catch(() => {})
    load()
    const id = setInterval(load, RECHECK_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])

  if (!st?.outdated || !st.latest) return null

  const update = async () => {
    const electron = (window as any).electron
    if (!electron?.checkForUpdates) return
    setChecking(true)
    try { await electron.checkForUpdates() } catch {} finally { setTimeout(() => setChecking(false), 4000) }
  }

  return (
    <div
      dir={direction}
      role="status"
      className="shrink-0 bg-amber-500 text-amber-950 text-xs sm:text-sm px-3 py-1.5 flex items-center justify-center gap-2 sm:gap-3 flex-wrap text-center"
    >
      <span className="font-semibold">
        ⬆️ {tr('فيه نسخة أحدث من السيستم', 'A newer version of the system is available')}{' '}
        <span dir="ltr" className="font-bold">{st.latest}</span>
        <span className="opacity-80"> — {tr('إنت على', "you're on")} <span dir="ltr">{st.current}</span></span>
      </span>
      {isElectron ? (
        <button
          onClick={update}
          disabled={checking}
          className="px-3 py-0.5 rounded-md bg-amber-950 text-amber-50 font-bold hover:bg-black disabled:opacity-60"
        >
          {checking ? tr('بيدوّر على التحديث...', 'Checking...') : tr('حدّث دلوقتي', 'Update now')}
        </button>
      ) : (
        <span className="opacity-90">{tr('حدّث السيستم من الجهاز الرئيسي', 'Update the system from the main computer')}</span>
      )}
    </div>
  )
}
