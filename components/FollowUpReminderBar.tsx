'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '../contexts/LanguageContext'

//  بار تذكير عام — بيظهر في كل الصفحات لو فيه متابعات محتاجة تواصل (متأخرة أو النهاردة).
//  بيتقفل لباقي اليوم بس (بيرجع تاني بكرة أو بعد إعادة الدخول).
export default function FollowUpReminderBar() {
  const { user, hasPermission, isAdmin } = usePermissions()
  const { locale } = useLanguage()
  const pathname = usePathname()
  const [total, setTotal] = useState(0)
  const [overdue, setOverdue] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const startedRef = useRef(false)

  //  مبيظهرش للأونر والمدير (isAdmin = OWNER أو ADMIN).
  //  السيلز ليهم بار تذكيرات خاص (SalesRemindersBar) بيغطّي المتابعات + الاشتراكات، فبنخفي ده عنهم.
  const canView = hasPermission('canViewFollowUps') && !isAdmin && !user?.isSales
  const ar = locale === 'ar'

  //  استرجاع حالة الإغلاق لباقي اليوم
  useEffect(() => {
    try {
      const d = sessionStorage.getItem('fu-reminder-dismissed')
      if (d === new Date().toDateString()) setDismissed(true)
    } catch { /* ignore */ }
  }, [])

  //  جلب العدّاد + تحديث دوري
  useEffect(() => {
    if (!user || !canView) return
    let active = true
    const check = async () => {
      try {
        const r = await fetch('/api/followups/due-count')
        if (!r.ok || !active) return
        const d = await r.json()
        setTotal(d.total || 0)
        setOverdue(d.overdue || 0)
      } catch { /* ignore */ }
    }
    check()
    const iv = setInterval(check, 120000)
    startedRef.current = true
    return () => { active = false; clearInterval(iv) }
  }, [user, canView])

  if (!user || !canView || dismissed || total <= 0) return null
  //  على صفحة المتابعات نفسها البار زيادة (الأرقام ظاهرة فوق)
  if (pathname === '/followups') return null

  const dismiss = () => {
    setDismissed(true)
    try { sessionStorage.setItem('fu-reminder-dismissed', new Date().toDateString()) } catch { /* ignore */ }
  }

  return (
    <div
      dir={ar ? 'rtl' : 'ltr'}
      className="flex-shrink-0 relative overflow-hidden bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 shadow-md"
    >
      {/*  لمعة قطرية خفيفة زي بانر الكباتن */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-y-0 -inset-x-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-banner-shine" />
      </div>

      <div className="relative flex items-center gap-3 px-4 py-2.5">
        {/*  أيقونة تليفون */}
        <div className="w-9 h-9 rounded-xl bg-primary-contrast/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-primary-contrast" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
          </svg>
        </div>

        {/*  النص */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-primary-contrast leading-tight truncate">
            {ar
              ? `عندك ${total} متابعة محتاجة تواصل النهاردة`
              : `You have ${total} follow-up${total === 1 ? '' : 's'} to contact`}
            {overdue > 0 && (
              <span className="ms-2 inline-flex items-center gap-1 bg-red-600/90 text-white text-[11px] font-black px-2 py-0.5 rounded-full align-middle">
                {ar ? `${overdue} متأخرة` : `${overdue} overdue`}
              </span>
            )}
          </p>
        </div>

        {/*  زرار المتابعة */}
        <Link
          href="/followups"
          className="inline-flex items-center gap-1.5 bg-white text-primary-700 hover:bg-primary-50 font-bold text-xs sm:text-sm px-3 sm:px-4 py-1.5 rounded-lg transition-colors duration-200 flex-shrink-0"
        >
          {ar ? 'تابع دلوقتي' : 'Follow up now'}
          <svg className={`w-4 h-4 ${ar ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/*  إغلاق لباقي اليوم */}
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
