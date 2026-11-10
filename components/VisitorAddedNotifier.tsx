'use client'

import { useEffect, useRef, useState } from 'react'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '../contexts/LanguageContext'
import { displayPhone } from '../lib/maskPhone'

//  👋 «زوار جدد» — نافذة في صفحة المتابعات بالزوار اللي اتضافوا من آخر مرة المستخدم فتحها.
//  بتسأل السيرفر كل شوية وهو جوه الصفحة (بوقت السيرفر مش الجهاز)، وآخر فحص بيتحفظ لكل مستخدم.
//  اللي ضاف الزائر بنفسه مابيظهرلوش، والسيلز بيشوف زواره + غير المُسنّدين بس (الفلترة في الـ API)،
//  والرقم بيتخفي للي عليه قيد إخفاء أرقام المتابعات.

type NewVisitor = {
  id: string
  name: string
  phone: string
  source: string | null
  createdAt: string
  addedBy: string | null
  salesName: string | null
}

const POLL_MS = 20000

const SOURCE_LABELS: Record<string, { ar: string; en: string }> = {
  'walk-in': { ar: 'واك إن', en: 'Walk-in' },
  'call-in': { ar: 'اتصال', en: 'Call-in' },
  'suggestion': { ar: 'ترشيح', en: 'Suggestion' },
  'facebook': { ar: 'فيسبوك', en: 'Facebook' },
  'instagram': { ar: 'انستجرام', en: 'Instagram' },
  'tiktok': { ar: 'تيك توك', en: 'TikTok' },
  'chatgpt': { ar: 'ChatGPT', en: 'ChatGPT' },
  'google_maps': { ar: 'خرايط جوجل', en: 'Google Maps' },
  'website': { ar: 'الموقع', en: 'Website' },
  'friend_referral': { ar: 'ترشيح صديق', en: 'Referral' },
}

function timeAgo(iso: string, ar: boolean): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return ar ? 'دلوقتي' : 'just now'
  if (min < 60) return ar ? `من ${min} دقيقة` : `${min} min ago`
  const h = Math.round(min / 60)
  return ar ? `من ${h} ساعة` : `${h} h ago`
}

type Props = {
  /** يفتح الزائر في قايمة المتابعات (بحث بالرقم أو بالاسم لو الأرقام مخفية) */
  onOpen: (query: string) => void
}

export default function VisitorAddedNotifier({ onOpen }: Props) {
  const { user, hasPermission, loading, permissions } = usePermissions()
  const { locale, direction } = useLanguage()
  const [items, setItems] = useState<NewVisitor[]>([])
  const seen = useRef<Set<string>>(new Set())
  const userId = (user as any)?.userId || (user as any)?.id || null
  const canView = !loading && !!userId && (hasPermission('canViewVisitors') || hasPermission('canViewFollowUps'))
  //  نفس قيد المتابعات: القيمة الخام (الأونر/الأدمن مش عليهم قيد)
  const hideNumbers = permissions?.hideFollowUpNumbers === true
  const ar = locale === 'ar'

  useEffect(() => {
    if (!canView || !userId) return
    let active = true
    //  آخر فحص لكل مستخدم على الجهاز ده (وقت السيرفر)
    const key = `visitorNotifier:lastSeen:${userId}`
    const readSince = (): number | null => {
      try { const v = Number(localStorage.getItem(key)); return Number.isFinite(v) && v > 0 ? v : null } catch { return null }
    }

    const check = async () => {
      try {
        const since = readSince()
        const r = await fetch(`/api/visitors/recent${since ? `?since=${since}` : ''}`, { cache: 'no-store' })
        if (!r.ok || !active) return
        const d = await r.json()
        const fresh: NewVisitor[] = (d.visitors || []).filter((v: NewVisitor) => !seen.current.has(v.id))
        fresh.forEach(v => seen.current.add(v.id))
        if (fresh.length) setItems(prev => [...fresh, ...prev])
        if (typeof d.now === 'number') { try { localStorage.setItem(key, String(d.now)) } catch { /* ignore */ } }
      } catch { /* الشبكة — نجرّب المرة الجاية */ }
    }

    check()
    const iv = setInterval(check, POLL_MS)
    return () => { active = false; clearInterval(iv) }
  }, [canView, userId])

  if (!canView || items.length === 0) return null

  const close = () => setItems([])
  const open = (v: NewVisitor) => {
    setItems([])
    onOpen(hideNumbers ? v.name : v.phone)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-fadeIn" onClick={close}>
      <div dir={direction} role="dialog" aria-modal="true"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
        {/* الهيدر */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center">
            <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {ar ? 'زوار جدد' : 'New visitors'}
              <span className="ms-2 align-middle px-2 py-0.5 rounded-full bg-primary-500 text-primary-contrast text-xs font-bold">{items.length}</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {ar ? 'اتضافوا من آخر مرة فتحت المتابعات' : 'Added since you last opened follow-ups'}
            </p>
          </div>
          <button type="button" onClick={close} aria-label={ar ? 'إغلاق' : 'Close'}
            className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* القايمة */}
        <ul className="max-h-[50vh] overflow-y-auto border-y border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {items.map(v => {
            const src = v.source ? SOURCE_LABELS[v.source] : null
            return (
              <li key={v.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                <div className="w-9 h-9 shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center text-sm font-bold">
                  {(v.name || '?').trim().charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{v.name}</span>
                    <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">{timeAgo(v.createdAt, ar)}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    <span dir="ltr">{displayPhone(v.phone, hideNumbers)}</span>
                    {src && <> · {ar ? src.ar : src.en}</>}
                    {v.addedBy && <> · {ar ? 'ضافه' : 'by'} {v.addedBy}</>}
                  </div>
                </div>
                <button type="button" onClick={() => open(v)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold ring-1 ring-primary-300 dark:ring-primary-700 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors">
                  {ar ? 'افتح' : 'Open'}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="px-5 py-4">
          <button type="button" onClick={close}
            className="w-full py-2.5 rounded-xl text-sm font-bold bg-primary-500 hover:bg-primary-600 text-primary-contrast transition-colors">
            {ar ? 'تمام' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  )
}
