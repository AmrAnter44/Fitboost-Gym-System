'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '../contexts/LanguageContext'

//  بار تذكيرات ثابت لأكونت السيلز — بيظهر في كل الصفحات ويفضل ثابت (مش توست بيختفي):
//   📞 متابعات النهاردة  ⏰ اشتراكات بتخلص النهاردة  📅 هتخلص بكره  ❗ اشتراكات خلصت
export default function SalesRemindersBar() {
  const { user } = usePermissions()
  const { locale } = useLanguage()
  const [d, setD] = useState<{ followUpsToday: number; expiringToday: number; expiringTomorrow: number; expired: number } | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const startedRef = useRef(false)

  const ar = locale === 'ar'
  const isSales = !!user?.isSales

  //  استرجاع حالة الإغلاق لباقي اليوم
  useEffect(() => {
    try {
      if (sessionStorage.getItem('sales-reminders-bar-dismissed') === new Date().toDateString()) setDismissed(true)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!isSales) return
    let active = true
    const check = async () => {
      try {
        const r = await fetch('/api/sales/reminders')
        if (!r.ok || !active) return
        const j = await r.json()
        setD({
          followUpsToday: j.followUpsToday || 0,
          expiringToday: j.expiringToday || 0,
          expiringTomorrow: j.expiringTomorrow || 0,
          expired: j.expired || 0,
        })
      } catch { /* ignore */ }
    }
    check()
    const iv = setInterval(check, 120000)
    startedRef.current = true
    return () => { active = false; clearInterval(iv) }
  }, [isSales])

  if (!isSales || dismissed || !d) return null
  const total = d.followUpsToday + d.expiringToday + d.expiringTomorrow + d.expired
  if (total <= 0) return null

  const dismiss = () => {
    setDismissed(true)
    try { sessionStorage.setItem('sales-reminders-bar-dismissed', new Date().toDateString()) } catch { /* ignore */ }
  }

  //  segment واحد لكل تذكير عنده عدد — بأيقونة SVG متناسقة مع السيستم
  const Seg = ({ show, href, cls, icon, children }: { show: boolean; href: string; cls: string; icon: string; children: React.ReactNode }) => {
    if (!show) return null
    return (
      <Link href={href} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap transition-transform duration-150 hover:scale-[1.03] ${cls}`}>
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
        {children}
      </Link>
    )
  }
  //  أيقونات (نفس ستايل الـ stroke بتاع السيستم)
  const ICON_PHONE = 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z'
  const ICON_CLOCK = 'M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z'
  const ICON_CALENDAR = 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0V11.25A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5'
  const ICON_WARN = 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z'

  return (
    <div
      dir={ar ? 'rtl' : 'ltr'}
      className="flex-shrink-0 relative overflow-hidden bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 shadow-md"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-y-0 -inset-x-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-banner-shine" />
      </div>

      <div className="relative flex items-center gap-2 px-3 sm:px-4 py-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-primary-contrast font-black text-sm flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {ar ? 'تذكيرات النهاردة' : "Today's reminders"}
        </span>

        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          <Seg show={d.followUpsToday > 0} href="/followups?due=today" icon={ICON_PHONE} cls="bg-white/90 text-primary-700 hover:bg-white">
            {ar ? `${d.followUpsToday} متابعة النهاردة` : `${d.followUpsToday} follow-ups today`}
          </Seg>
          <Seg show={d.expiringToday > 0} href="/members?status=expiring-today" icon={ICON_CLOCK} cls="bg-amber-400 text-amber-950 hover:bg-amber-300">
            {ar ? `${d.expiringToday} بيخلص النهاردة` : `${d.expiringToday} ending today`}
          </Seg>
          <Seg show={d.expiringTomorrow > 0} href="/members?status=expiring-tomorrow" icon={ICON_CALENDAR} cls="bg-orange-400 text-orange-950 hover:bg-orange-300">
            {ar ? `${d.expiringTomorrow} هيخلص بكره` : `${d.expiringTomorrow} ending tomorrow`}
          </Seg>
          <Seg show={d.expired > 0} href="/members?status=expired" icon={ICON_WARN} cls="bg-red-500 text-white hover:bg-red-400">
            {ar ? `${d.expired} اشتراك خلص` : `${d.expired} expired`}
          </Seg>
        </div>

        <button
          onClick={dismiss}
          aria-label={ar ? 'إخفاء' : 'Dismiss'}
          title={ar ? 'إخفاء لباقي اليوم' : 'Hide for today'}
          className="w-7 h-7 rounded-lg text-primary-contrast/80 hover:text-primary-contrast hover:bg-primary-contrast/15 transition-colors duration-200 flex items-center justify-center flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
