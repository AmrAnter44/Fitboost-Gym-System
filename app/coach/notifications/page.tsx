'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../contexts/LanguageContext'

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
  const { locale } = useLanguage()
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
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-700 dark:text-white text-2xl flex items-center gap-3">
          <span className="animate-spin">⏳</span>
          {locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 text-red-800 max-w-md">
          ❌ {error}
        </div>
      </div>
    )
  }

  if (!data) return null

  const totalCount = data.renewals.length + data.expiringSoon.length + data.halfTimeWithBalance.length + data.newAssignments.length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                <span className="text-4xl">🔔</span>
                {locale === 'ar' ? 'إشعاراتي' : 'My Notifications'}
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                {locale === 'ar'
                  ? `${totalCount} إشعار من الأسبوع اللي فات`
                  : `${totalCount} notifications from the past week`}
              </p>
            </div>
            <button
              onClick={() => checkAuthAndFetch()}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium flex items-center gap-2"
            >
              🔄 {locale === 'ar' ? 'تحديث' : 'Refresh'}
            </button>
          </div>
        </div>

        {totalCount === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-12 text-center">
            <div className="text-7xl mb-4">📭</div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              {locale === 'ar' ? 'مفيش إشعارات حالياً' : 'No notifications'}
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              {locale === 'ar'
                ? 'كل الاشتراكات بتاعتك مظبوطة 👍'
                : "All your subscriptions are looking good 👍"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* اتأسند ليك */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 flex items-center gap-3">
                <span className="text-3xl">🎉</span>
                <div>
                  <h2 className="text-xl font-bold">{locale === 'ar' ? 'اتأسند ليك' : 'Newly Assigned to You'}</h2>
                  <p className="text-sm text-purple-50">
                    {data.newAssignments.length} {locale === 'ar' ? 'تأسيس جديد في آخر ٧ أيام' : 'new in last 7 days'}
                  </p>
                </div>
              </div>
              {data.newAssignments.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  {locale === 'ar' ? 'مفيش تأسيسات جديدة' : 'No new assignments'}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {data.newAssignments.map((n, i) => {
                    const label = n.type === 'Member'
                      ? (locale === 'ar' ? 'عضو جديد' : 'New Member')
                      : `${subTypeLabel(n.type as SubscriptionKind, locale)} ${locale === 'ar' ? '— اشتراك جديد' : 'new subscription'}`
                    return (
                      <li key={i} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800 dark:text-gray-100">{n.memberName}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            {label}{n.subscriptionId ? ` · #${n.subscriptionId}` : ''}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            📅 {new Date(n.createdAt).toLocaleDateString(dateLocale)} ·{' '}
                            {n.daysAgo === 0
                              ? (locale === 'ar' ? 'النهاردة' : 'today')
                              : `${n.daysAgo} ${locale === 'ar' ? 'يوم' : 'days ago'}`}
                          </p>
                        </div>
                        <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                          🎉 {locale === 'ar' ? 'جديد' : 'new'}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* تجديدات */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 flex items-center gap-3">
                <span className="text-3xl">✅</span>
                <div>
                  <h2 className="text-xl font-bold">{locale === 'ar' ? 'تجديدات أخيرة' : 'Recent Renewals'}</h2>
                  <p className="text-sm text-green-50">
                    {data.renewals.length} {locale === 'ar' ? 'تجديد في آخر ٧ أيام' : 'renewals in last 7 days'}
                  </p>
                </div>
              </div>
              {data.renewals.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  {locale === 'ar' ? 'مفيش تجديدات' : 'No renewals'}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {data.renewals.map((r, i) => (
                    <li key={i} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 dark:text-gray-100">{r.memberName}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {subTypeLabel(r.type, locale)} · #{r.subscriptionId} · {Math.round(r.amount)} {locale === 'ar' ? 'ج' : 'EGP'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          📅 {new Date(r.receivedAt).toLocaleDateString(dateLocale)} ·{' '}
                          {r.daysAgo === 0
                            ? (locale === 'ar' ? 'النهاردة' : 'today')
                            : `${r.daysAgo} ${locale === 'ar' ? 'يوم' : 'days ago'}`}
                        </p>
                      </div>
                      <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                        ✅ {locale === 'ar' ? 'جدّد' : 'renewed'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* قارب على الانتهاء */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 flex items-center gap-3">
                <span className="text-3xl">⏰</span>
                <div>
                  <h2 className="text-xl font-bold">{locale === 'ar' ? 'قارب على الانتهاء' : 'Expiring Soon'}</h2>
                  <p className="text-sm text-orange-50">
                    {data.expiringSoon.length} {locale === 'ar' ? 'اشتراك ينتهي خلال ٧ أيام' : 'subscriptions expiring in 7 days'}
                  </p>
                </div>
              </div>
              {data.expiringSoon.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  {locale === 'ar' ? 'ولا اشتراك قارب على الانتهاء' : 'Nothing expiring soon'}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {data.expiringSoon.map((e, i) => (
                    <li key={i} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 dark:text-gray-100">{e.memberName}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {subTypeLabel(e.type, locale)} · #{e.subscriptionId} · {locale === 'ar' ? 'متبقي' : 'remaining'}: {e.sessionsRemaining}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          📅 {new Date(e.expiryDate).toLocaleDateString(dateLocale)}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                        e.daysLeft <= 2
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                          : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200'
                      }`}>
                        ⏰ {e.daysLeft === 0
                          ? (locale === 'ar' ? 'النهاردة' : 'today')
                          : `${e.daysLeft} ${locale === 'ar' ? 'يوم' : 'days'}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* نص الوقت + بواقي */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-4 flex items-center gap-3">
                <span className="text-3xl">💰</span>
                <div>
                  <h2 className="text-xl font-bold">{locale === 'ar' ? 'نص الوقت + بواقي' : 'Half-time + Balance'}</h2>
                  <p className="text-sm text-red-50">
                    {data.halfTimeWithBalance.length} {locale === 'ar' ? 'عضو محتاج متابعة' : 'members need follow-up'}
                  </p>
                </div>
              </div>
              {data.halfTimeWithBalance.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  {locale === 'ar' ? 'كل الأعضاء سادّين باقي اشتراكاتهم' : 'All members paid up'}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {data.halfTimeWithBalance.map((h, i) => {
                    const progress = h.sessionsTotal > 0 ? (h.sessionsUsed / h.sessionsTotal) * 100 : 0
                    return (
                      <li key={i} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800 dark:text-gray-100">{h.memberName}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {subTypeLabel(h.type, locale)} · #{h.subscriptionId} · {h.sessionsUsed}/{h.sessionsTotal} {locale === 'ar' ? 'حصة' : 'sessions'}
                            </p>
                          </div>
                          <span className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap">
                            💰 {Math.round(h.remainingAmount)} {locale === 'ar' ? 'ج' : 'EGP'}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${progress >= 80 ? 'bg-red-500' : progress >= 50 ? 'bg-orange-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
