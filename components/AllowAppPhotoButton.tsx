'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'

//  📷 «السماح للعضو برفع صورة مرة واحدة من الأبليكيشن» — 10 دقايق، بعدها بيتقفل لوحده
//  (أو أول ما العضو يرفع صورة). وهو مفتوح بنعرض العدّاد، ولما العضو يرفع بنبلّغ ونحدّث البروفايل.

export default function AllowAppPhotoButton({ memberId, onUploaded }: { memberId: string; onUploaded?: () => void }) {
  const { tr } = useLanguage()
  const toast = useToast()
  const [until, setUntil] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/members/${memberId}/app-photo-upload`, { cache: 'no-store' })
      const d = await r.json()
      return d.photoUploadUntil ? new Date(d.photoUploadUntil).getTime() : null
    } catch { return null }
  }, [memberId])

  useEffect(() => { load().then(setUntil) }, [load])

  const open = !!until && until > now

  //  وهو مفتوح: عدّاد كل ثانية + نشيّك كل 10 ثواني لو العضو رفع (السماح بيتقفل لوحده بعد الرفع)
  useEffect(() => {
    if (!open) return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const poll = setInterval(async () => {
      const u = await load()
      if (!u) {
        setUntil(null)
        toast.success(tr('العضو رفع صورته من الأبليكيشن ✅', 'The member uploaded a photo from the app ✅'))
        onUploaded?.()
      }
    }, 10000)
    return () => { clearInterval(tick); clearInterval(poll) }
  }, [open, load, onUploaded, toast, tr])

  const act = async (allow: boolean) => {
    setBusy(true)
    try {
      const r = await fetch(`/api/members/${memberId}/app-photo-upload`, { method: allow ? 'POST' : 'DELETE' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setUntil(d.photoUploadUntil ? new Date(d.photoUploadUntil).getTime() : null)
      setNow(Date.now())
      if (allow) toast.success(tr('العضو يقدر يرفع صورته من الأبليكيشن خلال 10 دقايق', 'The member can upload a photo from the app within 10 minutes'))
    } catch (e: any) {
      toast.error(e?.message || tr('العملية فشلت', 'Failed'))
    } finally {
      setBusy(false)
    }
  }

  if (open) {
    const left = Math.max(0, Math.ceil((until! - now) / 1000))
    const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0')
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800 text-sm">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span className="flex-1 text-emerald-800 dark:text-emerald-300 font-semibold">
          {tr('الرفع من الأبليكيشن مفتوح — فاضل', 'App upload open — ')} <span dir="ltr" className="font-mono">{mm}:{ss}</span>
        </span>
        <button type="button" onClick={() => act(false)} disabled={busy}
          className="px-2.5 py-1 rounded-lg text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50">
          {tr('اقفل', 'Close')}
        </button>
      </div>
    )
  }

  return (
    <button type="button" onClick={() => act(true)} disabled={busy}
      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold ring-1 ring-primary-300 dark:ring-primary-700 bg-white dark:bg-gray-800 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 disabled:opacity-50 transition-colors">
      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
      {busy ? '…' : tr('السماح للعضو برفع صورة مرة واحدة من الأبليكيشن (10 دقايق)', 'Allow the member to upload a photo once from the app (10 min)')}
    </button>
  )
}
