'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../contexts/LanguageContext'
import { LoadingScreen } from '../../../components/Spinner'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

type SubscriptionKind = 'PT' | 'Nutrition' | 'Physiotherapy' | 'GroupClass' | 'More'

interface RenewalItem {
  type: SubscriptionKind
  memberName: string
  subscriptionId: number
  amount: number
  daysAgo: number
  receivedAt: string
}

interface ExpiringItem {
  type: SubscriptionKind
  memberName: string
  subscriptionId: number
  daysLeft: number
  sessionsRemaining: number
  expiryDate: string
}

interface HalfTimeItem {
  type: SubscriptionKind
  memberName: string
  subscriptionId: number
  sessionsUsed: number
  sessionsTotal: number
  remainingAmount: number
}

interface NewAssignmentItem {
  type: SubscriptionKind | 'Member'
  memberName: string
  subscriptionId?: number
  memberId?: string
  daysAgo: number
  createdAt: string
}

interface NotificationsData {
  renewals: RenewalItem[]
  expiringSoon: ExpiringItem[]
  halfTimeWithBalance: HalfTimeItem[]
  newAssignments: NewAssignmentItem[]
}

const subTypeLabel = (type: SubscriptionKind, locale: string): string => {
  if (locale !== 'ar') return type
  return ({ PT: 'PT', Nutrition: 'تغذية', Physiotherapy: 'علاج طبيعي', GroupClass: 'جروب كلاس', More: 'More' } as Record<string, string>)[type] || type
}

export default function CoachNotificationsPage() {
  const router = useRouter()
  const { locale, direction } = useLanguage()
  const dateLocale = locale === 'ar' ? 'ar-EG' : 'en-US'
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<NotificationsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAuthAndFetch()
  }, [])

  const checkAuthAndFetch = async () => {
    try {
      const authRes = await fetch('/api/auth/me')
      if (!authRes.ok) {
        router.push('/login')
        return
      }
      const authData = await authRes.json()
      if (authData.user.role !== 'COACH') {
        router.push('/')
        return
      }

      const res = await fetch('/api/coach/notifications')
      if (!res.ok) {
        setError(locale === 'ar' ? 'فشل تحميل الإشعارات' : 'Failed to load notifications')
        setLoading(false)
        return
      }
      const json = await res.json()
      setData({
        renewals: json.renewals || [],
        expiringSoon: json.expiringSoon || [],
        halfTimeWithBalance: json.halfTimeWithBalance || [],
        newAssignments: json.newAssignments || [],
      })
    } catch {
      setError(locale === 'ar' ? 'حدث خطأ' : 'Error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingScreen fullScreen />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 rounded-xl p-6 text-red-800 dark:text-red-300 max-w-md flex items-center gap-3">
          <svg {...stroke} className="w-5 h-5 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span>{error}</span>
        </div>
      </div>
    )
  }

  if (!data) return null

  const totalCount = data.renewals.length + data.expiringSoon.length + data.halfTimeWithBalance.length + data.newAssignments.length

  const sections = [
    {
      key: 'new',
      title: locale === 'ar' ? 'اتأسند ليك' : 'Newly Assigned to You',
      subtitle: `${data.newAssignments.length} ${locale === 'ar' ? 'تأسيس جديد في آخر ٧ أيام' : 'new in last 7 days'}`,
      tone: 'purple',
      icon: (
        <svg {...stroke} className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
        </svg>
      ),
      empty: locale === 'ar' ? 'مفيش تأسيسات جديدة' : 'No new assignments',
      renderItems: () => data.newAssignments.map((n, i) => {
        const label = n.type === 'Member'
          ? (locale === 'ar' ? 'عضو جديد' : 'New Member')
          : `${subTypeLabel(n.type as SubscriptionKind, locale)} ${locale === 'ar' ? '— اشتراك جديد' : 'new subscription'}`
        return (
          <li key={i} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 flex items-center justify-between gap-3 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 dark:text-gray-100">{n.memberName}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {label}{n.subscriptionId ? ` · #${n.subscriptionId}` : ''}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                <svg {...stroke} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                {new Date(n.createdAt).toLocaleDateString(dateLocale)} ·{' '}
                {n.daysAgo === 0
                  ? (locale === 'ar' ? 'النهاردة' : 'today')
                  : `${n.daysAgo} ${locale === 'ar' ? 'يوم' : 'days ago'}`}
              </p>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 whitespace-nowrap">
              {locale === 'ar' ? 'جديد' : 'new'}
            </span>
          </li>
        )
      })
    },
    {
      key: 'renewals',
      title: locale === 'ar' ? 'تجديدات أخيرة' : 'Recent Renewals',
      subtitle: `${data.renewals.length} ${locale === 'ar' ? 'تجديد في آخر ٧ أيام' : 'renewals in last 7 days'}`,
      tone: 'green',
      icon: (
        <svg {...stroke} className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      ),
      empty: locale === 'ar' ? 'مفيش تجديدات' : 'No renewals',
      renderItems: () => data.renewals.map((r, i) => (
        <li key={i} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 flex items-center justify-between gap-3 transition-colors">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 dark:text-gray-100">{r.memberName}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              {subTypeLabel(r.type, locale)} · #{r.subscriptionId} · {Math.round(r.amount)} {locale === 'ar' ? 'ج' : 'EGP'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {new Date(r.receivedAt).toLocaleDateString(dateLocale)} ·{' '}
              {r.daysAgo === 0
                ? (locale === 'ar' ? 'النهاردة' : 'today')
                : `${r.daysAgo} ${locale === 'ar' ? 'يوم' : 'days ago'}`}
            </p>
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 whitespace-nowrap">
            {locale === 'ar' ? 'جدّد' : 'renewed'}
          </span>
        </li>
      ))
    },
    {
      key: 'expiring',
      title: locale === 'ar' ? 'قارب على الانتهاء' : 'Expiring Soon',
      subtitle: `${data.expiringSoon.length} ${locale === 'ar' ? 'اشتراك ينتهي خلال ٧ أيام' : 'subscriptions expiring in 7 days'}`,
      tone: 'orange',
      icon: (
        <svg {...stroke} className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
      empty: locale === 'ar' ? 'ولا اشتراك قارب على الانتهاء' : 'Nothing expiring soon',
      renderItems: () => data.expiringSoon.map((e, i) => (
        <li key={i} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 flex items-center justify-between gap-3 transition-colors">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 dark:text-gray-100">{e.memberName}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              {subTypeLabel(e.type, locale)} · #{e.subscriptionId} · {locale === 'ar' ? 'متبقي' : 'remaining'}: {e.sessionsRemaining}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {new Date(e.expiryDate).toLocaleDateString(dateLocale)}
            </p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${
            e.daysLeft <= 2
              ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
              : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
          }`}>
            {e.daysLeft === 0
              ? (locale === 'ar' ? 'النهاردة' : 'today')
              : `${e.daysLeft} ${locale === 'ar' ? 'يوم' : 'days'}`}
          </span>
        </li>
      ))
    },
    {
      key: 'halftime',
      title: locale === 'ar' ? 'نص الوقت + بواقي' : 'Half-time + Balance',
      subtitle: `${data.halfTimeWithBalance.length} ${locale === 'ar' ? 'عضو محتاج متابعة' : 'members need follow-up'}`,
      tone: 'red',
      icon: (
        <svg {...stroke} className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      ),
      empty: locale === 'ar' ? 'كل الأعضاء سادّين باقي اشتراكاتهم' : 'All members paid up',
      renderItems: () => data.halfTimeWithBalance.map((h, i) => {
        const progress = h.sessionsTotal > 0 ? (h.sessionsUsed / h.sessionsTotal) * 100 : 0
        return (
          <li key={i} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 dark:text-gray-100">{h.memberName}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {subTypeLabel(h.type, locale)} · #{h.subscriptionId} · {h.sessionsUsed}/{h.sessionsTotal} {locale === 'ar' ? 'حصة' : 'sessions'}
                </p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 whitespace-nowrap">
                {Math.round(h.remainingAmount)} {locale === 'ar' ? 'ج' : 'EGP'}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-[width] duration-200 ${progress >= 80 ? 'bg-red-500' : progress >= 50 ? 'bg-orange-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </li>
        )
      })
    },
  ] as const

  const toneClasses: Record<string, { bg: string; text: string }> = {
    purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
    green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
    orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
    red: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4" dir={direction}>
      <div className="max-w-5xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                <svg {...stroke} className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {locale === 'ar' ? 'إشعاراتي' : 'My Notifications'}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {locale === 'ar'
                    ? `${totalCount} إشعار من الأسبوع اللي فات`
                    : `${totalCount} notifications from the past week`}
                </p>
              </div>
            </div>
            <button
              onClick={() => checkAuthAndFetch()}
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
            >
              <svg {...stroke} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992m-4.992 0a8.25 8.25 0 0 0 13.803 3.7l3.181-3.182m-13.803-3.7a8.25 8.25 0 0 1 13.803-3.7L21 7.5" />
              </svg>
              <span>{locale === 'ar' ? 'تحديث' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {totalCount === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-12 flex flex-col items-center justify-center text-center">
            <svg {...stroke} className="w-12 h-12 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" />
            </svg>
            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mt-3">
              {locale === 'ar' ? 'مفيش إشعارات حالياً' : 'No notifications'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {locale === 'ar'
                ? 'كل الاشتراكات بتاعتك مظبوطة'
                : 'All your subscriptions are looking good'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sections.map((sec) => {
              const tone = toneClasses[sec.tone]
              const items = sec.renderItems()
              return (
                <div key={sec.key} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${tone.bg} ${tone.text} flex items-center justify-center flex-shrink-0`}>
                      {sec.icon}
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{sec.title}</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sec.subtitle}</p>
                    </div>
                  </div>
                  {items.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      {sec.empty}
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
                      {items}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
