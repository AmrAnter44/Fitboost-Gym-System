'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLanguage } from '../contexts/LanguageContext'
import { LoadingScreen } from './Spinner'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

//  تنسيق تاريخ محلي YYYY-MM-DD (بدون timezone shift)
const toLocalISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

interface PTSessionLite {
  id: string
  sessionDate: string
  notes: string | null
  isFreeSession: boolean
  attended: boolean
}

interface ActivePTInfo {
  ptNumber: number
  sessionsPurchased: number
  sessionsRemaining: number
  startDate: string | null
  expiryDate: string | null
}

interface MemberRow {
  id: string
  memberNumber: string | null
  name: string
  phone: string | null
  profileImage: string | null
  isActive: boolean
  startDate: string | null
  expiryDate: string | null
  freePTSessions: number
  subscriptionPrice: number
  coachConversionNote: string | null
  coachConversionNoteAt: string | null
  joinedCoachAt: string | null
  ptSessions: PTSessionLite[]
  hasPaidPT: boolean
  activePT: ActivePTInfo | null
  status: 'subscribed' | 'didnt_subscribe' | 'pending_decision' | 'still_has_free'
  services?: {
    nutrition: 'subscribed' | 'free' | 'none'
    physio: 'subscribed' | 'free' | 'none'
    more: 'subscribed' | 'free' | 'none'
  }
}

interface CoachGroup {
  coach: {
    id: string
    name: string
    staffCode: string
  }
  stats: {
    total: number
    subscribed: number
    didnt_subscribe: number
    pending_decision: number
    still_has_free: number
    conversionRate: number | null
    revenue: number
  }
  members: MemberRow[]
}

// لوحة متابعة الكباتن مع العملاء — قابلة للتضمين كتاب داخل صفحة الحصص المخصصة
export default function CoachConversionsPanel() {
  const { locale, direction } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<CoachGroup[]>([])
  const [error, setError] = useState('')
  const [expandedCoach, setExpandedCoach] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'subscribed' | 'didnt_subscribe' | 'pending_decision' | 'still_has_free'>('all')
  const [search, setSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState<MemberRow | null>(null)
  //  فلتر الفترة الزمنية للمبلغ — الافتراضي: الشهر الحالي
  const [dateFrom, setDateFrom] = useState(() => {
    const n = new Date(); return toLocalISO(new Date(n.getFullYear(), n.getMonth(), 1))
  })
  const [dateTo, setDateTo] = useState(() => {
    const n = new Date(); return toLocalISO(new Date(n.getFullYear(), n.getMonth() + 1, 0))
  })

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo])

  const fetchData = async () => {
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set('startDate', dateFrom)
      if (dateTo) params.set('endDate', dateTo)
      const res = await fetch(`/api/manager/coach-conversions?${params.toString()}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d?.error || (locale === 'ar' ? 'فشل تحميل البيانات' : 'Failed to load data'))
        setLoading(false)
        return
      }
      const json = await res.json()
      setData(json)
      setLoading(false)
    } catch (e: any) {
      setError(e?.message || (locale === 'ar' ? 'خطأ في الاتصال' : 'Connection error'))
      setLoading(false)
    }
  }

  if (loading) return <LoadingScreen message={locale === 'ar' ? 'جاري التحميل...' : 'Loading...'} />

  const totalsAll = data.reduce(
    (acc, c) => ({
      total: acc.total + c.stats.total,
      subscribed: acc.subscribed + c.stats.subscribed,
      didnt_subscribe: acc.didnt_subscribe + c.stats.didnt_subscribe,
      pending_decision: acc.pending_decision + c.stats.pending_decision,
      still_has_free: acc.still_has_free + c.stats.still_has_free,
      revenue: acc.revenue + (c.stats.revenue || 0),
    }),
    { total: 0, subscribed: 0, didnt_subscribe: 0, pending_decision: 0, still_has_free: 0, revenue: 0 }
  )
  //  تنسيق المبلغ
  const fmtMoney = (n: number) =>
    `${Math.round(n).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')} ${locale === 'ar' ? 'ج.م' : 'EGP'}`
  //  وصف الفترة المختارة
  const periodLabel = (!dateFrom && !dateTo)
    ? (locale === 'ar' ? 'كل الفترات' : 'All time')
    : `${dateFrom || '…'} → ${dateTo || '…'}`

  return (
    <div dir={direction}>
      {/* Summary line */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {locale === 'ar'
          ? `${data.length} كوتش · ${totalsAll.total} عميل`
          : `${data.length} coaches · ${totalsAll.total} clients`}
      </p>

      {/* إجمالي المبلغ اللي دخله الكباتن */}
      <div className="mb-6 rounded-xl p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex w-10 h-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex-shrink-0">
            <svg {...stroke} className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              {locale === 'ar' ? 'إجمالي المبلغ اللي دخله الكباتن (PT)' : 'Total PT revenue by coaches'}
            </p>
            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
              {locale === 'ar' ? 'من إيصالات البي تي الفعلية · ' : 'From actual PT receipts · '}{periodLabel}
            </p>
          </div>
        </div>
        <p className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
          {fmtMoney(totalsAll.revenue)}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 ring-1 ring-red-300 dark:ring-red-800 text-red-700 dark:text-red-300 font-bold">
          {error}
        </div>
      )}

      {/* Global stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard
          label={locale === 'ar' ? 'إجمالي' : 'Total'}
          value={totalsAll.total}
          color="gray"
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
        />
        <StatCard
          label={locale === 'ar' ? 'اشتركوا PT' : 'Subscribed'}
          value={totalsAll.subscribed}
          color="emerald"
          active={statusFilter === 'subscribed'}
          onClick={() => setStatusFilter('subscribed')}
          iconType="check"
        />
        <StatCard
          label={locale === 'ar' ? 'ما اشتركوش' : 'Did not subscribe'}
          value={totalsAll.didnt_subscribe}
          color="red"
          active={statusFilter === 'didnt_subscribe'}
          onClick={() => setStatusFilter('didnt_subscribe')}
          iconType="x"
        />
        <StatCard
          label={locale === 'ar' ? 'لسه ما اتقررش' : 'Pending'}
          value={totalsAll.pending_decision}
          color="amber"
          active={statusFilter === 'pending_decision'}
          onClick={() => setStatusFilter('pending_decision')}
          iconType="clock"
        />
        <StatCard
          label={locale === 'ar' ? 'لسه عنده حصص' : 'Has free sessions'}
          value={totalsAll.still_has_free}
          color="purple"
          active={statusFilter === 'still_has_free'}
          onClick={() => setStatusFilter('still_has_free')}
          iconType="sparkles"
        />
      </div>

      {/* فلتر الفترة الزمنية للمبلغ */}
      <div className="mb-4 rounded-xl bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
            <svg {...stroke} className="w-4 h-4 text-primary-600 dark:text-primary-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            {locale === 'ar' ? 'فترة حساب المبلغ' : 'Revenue period'}
          </div>
          <div className="inline-flex items-center gap-1 rounded-xl ring-1 ring-gray-200 dark:ring-gray-600 bg-gray-50 dark:bg-gray-700/40 p-1">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
            <svg {...stroke} className={`w-4 h-4 text-gray-400 dark:text-gray-500 mx-0.5 flex-shrink-0 ${direction === 'rtl' ? 'rotate-180' : ''}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 ms-auto">
            {locale === 'ar' ? 'بيأثّر على المبلغ بس' : 'Affects revenue only'}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={locale === 'ar' ? 'بحث باسم العضو أو الكوتش...' : 'Search by member or coach name...'}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
        />
      </div>

      {/* Coaches list */}
      {data.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center ring-1 ring-gray-200 dark:ring-gray-700">
          <p className="text-gray-600 dark:text-gray-400 font-bold">
            {locale === 'ar' ? 'مفيش كباتن نشطين' : 'No active coaches'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data
            .map(group => {
              const filteredMembers = group.members.filter(m => {
                if (statusFilter !== 'all' && m.status !== statusFilter) return false
                const q = search.trim().toLowerCase()
                if (q && !group.coach.name.toLowerCase().includes(q)) {
                  return m.name.toLowerCase().includes(q)
                }
                return true
              })
              return { group, filteredMembers }
            })
            .filter(({ group, filteredMembers }) => {
              if (statusFilter === 'all' && !search.trim()) return true
              const q = search.trim().toLowerCase()
              if (q && group.coach.name.toLowerCase().includes(q)) return true
              return filteredMembers.length > 0
            })
            .map(({ group, filteredMembers }) => {
              const isFiltered = statusFilter !== 'all' || search.trim().length > 0
              const isExpanded = isFiltered ? true : expandedCoach === group.coach.id
              return (
                <div
                  key={group.coach.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden"
                >
                  <button
                    onClick={() => {
                      if (statusFilter !== 'all' || search.trim()) return
                      setExpandedCoach(isExpanded ? null : group.coach.id)
                    }}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/50 dark:to-primary-800/50 text-primary-700 dark:text-primary-300 flex items-center justify-center text-xl font-black flex-shrink-0">
                        {group.coach.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 text-start">
                        <p className="font-bold text-gray-900 dark:text-gray-100 truncate">{group.coach.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(statusFilter !== 'all' || search.trim())
                            ? (locale === 'ar'
                                ? `${filteredMembers.length} من ${group.stats.total} عميل مطابق`
                                : `${filteredMembers.length} of ${group.stats.total} matching`)
                            : (locale === 'ar' ? `${group.stats.total} عميل` : `${group.stats.total} clients`)}
                          <span className="ms-2 font-bold text-emerald-600 dark:text-emerald-400">
                            · {locale === 'ar' ? 'دفع' : 'Paid'} {group.stats.subscribed}
                          </span>
                          <span className="ms-2 font-bold text-purple-600 dark:text-purple-400">
                            · {locale === 'ar' ? 'فري' : 'Free'} {group.stats.still_has_free}
                          </span>
                          <span className="ms-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold align-middle tabular-nums">
                            <svg {...stroke} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            {fmtMoney(group.stats.revenue)}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* عدّادات الحالة — أيقونات خفيفة بدون خلفية عشان متبقاش زحمة */}
                      <div className="hidden sm:flex items-center gap-3">
                        {group.stats.subscribed > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            <svg {...stroke} className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                            {group.stats.subscribed}
                          </span>
                        )}
                        {group.stats.didnt_subscribe > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500 dark:text-red-400 tabular-nums">
                            <svg {...stroke} className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                            {group.stats.didnt_subscribe}
                          </span>
                        )}
                        {group.stats.pending_decision > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 dark:text-amber-400 tabular-nums">
                            <svg {...stroke} className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {group.stats.pending_decision}
                          </span>
                        )}
                        {group.stats.still_has_free > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-500 dark:text-purple-400 tabular-nums">
                            <svg {...stroke} className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                            {group.stats.still_has_free}
                          </span>
                        )}
                      </div>
                      <svg
                        {...stroke}
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-700">
                      {filteredMembers.length === 0 ? (
                        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                          {locale === 'ar' ? 'مفيش عملاء في الفلتر ده' : 'No clients in this filter'}
                        </p>
                      ) : (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                          {filteredMembers.map(m => (
                            <MemberRowItem key={m.id} member={m} locale={locale} onClick={() => setSelectedMember(m)} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}

      {/* مودال تفاصيل العضو */}
      {selectedMember && (
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedMember(null) }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" dir={direction}>
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-primary-500 to-primary-600 text-primary-contrast sticky top-0 z-10">
              <div className="min-w-0">
                <h3 className="text-lg font-bold truncate">{selectedMember.name}</h3>
                <p className="text-xs opacity-90 truncate">
                  {selectedMember.memberNumber ? `#${selectedMember.memberNumber}` : (locale === 'ar' ? 'بدون رقم' : 'No #')} · {selectedMember.phone || '-'}
                </p>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="w-9 h-9 rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <StatusBanner member={selectedMember} locale={locale} />

              {selectedMember.joinedCoachAt && (
                <div className="bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-300 dark:ring-blue-800 rounded-lg p-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-blue-800 dark:text-blue-200 flex items-center gap-1.5">
                      📅 {locale === 'ar' ? 'تاريخ الدخول مع الكوتش' : 'Joined coach on'}
                    </h4>
                    <div className="text-end">
                      <p className="text-sm font-bold text-blue-900 dark:text-blue-100">
                        {new Date(selectedMember.joinedCoachAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        {(() => {
                          const days = Math.floor((Date.now() - new Date(selectedMember.joinedCoachAt).getTime()) / (1000 * 60 * 60 * 24))
                          if (days === 0) return locale === 'ar' ? 'اتعيّن النهارده' : 'assigned today'
                          if (days === 1) return locale === 'ar' ? 'من يوم واحد' : '1 day ago'
                          if (days < 30) return locale === 'ar' ? `من ${days} يوم` : `${days} days ago`
                          if (days < 365) {
                            const months = Math.floor(days / 30)
                            return locale === 'ar' ? `من ${months} شهر` : `${months} month${months === 1 ? '' : 's'} ago`
                          }
                          const years = Math.floor(days / 365)
                          return locale === 'ar' ? `من ${years} سنة` : `${years} year${years === 1 ? '' : 's'} ago`
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedMember.coachConversionNote && (
                <div className="bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-300 dark:ring-amber-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                      📝 {locale === 'ar' ? 'ملاحظة الكوتش' : 'Coach note'}
                    </h4>
                    {selectedMember.coachConversionNoteAt && (
                      <span className="text-xs text-amber-700 dark:text-amber-400">
                        {new Date(selectedMember.coachConversionNoteAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap">{selectedMember.coachConversionNote}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                  📋 {locale === 'ar' ? 'سجل الجلسات' : 'Sessions log'}
                  <span className="text-xs text-gray-500 dark:text-gray-400">({selectedMember.ptSessions.length})</span>
                </h4>
                {selectedMember.ptSessions.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-6">
                    {locale === 'ar' ? 'لا توجد جلسات مسجّلة' : 'No sessions recorded'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedMember.ptSessions.map(s => (
                      <div
                        key={s.id}
                        className={`rounded-lg p-3 ring-1 ${
                          s.isFreeSession
                            ? 'bg-purple-50 dark:bg-purple-900/20 ring-purple-200 dark:ring-purple-800'
                            : 'bg-blue-50 dark:bg-blue-900/20 ring-blue-200 dark:ring-blue-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            s.isFreeSession
                              ? 'bg-purple-200 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200'
                              : 'bg-blue-200 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200'
                          }`}>
                            {s.isFreeSession
                              ? (locale === 'ar' ? '🆓 مجانية' : '🆓 Free')
                              : (locale === 'ar' ? '💰 مدفوعة' : '💰 Paid')}
                          </span>
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                            {new Date(s.sessionDate).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {s.notes ? (
                          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{s.notes}</p>
                        ) : (
                          <p className="text-xs text-gray-400 italic">{locale === 'ar' ? 'بدون ملاحظات' : 'No notes'}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                <Link
                  href={`/members/${selectedMember.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {locale === 'ar' ? 'فتح صفحة العضو' : 'Open member page'}
                  <svg {...stroke} className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper components
function StatIcon({ type }: { type?: 'check' | 'x' | 'clock' | 'sparkles' }) {
  if (!type) return null
  const paths: Record<string, string> = {
    check: 'm4.5 12.75 6 6 9-13.5',
    x: 'M6 18 18 6M6 6l12 12',
    clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    sparkles: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  }
  return (
    <svg {...stroke} className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[type]} />
    </svg>
  )
}

function StatCard({ label, value, color, active, onClick, iconType }: {
  label: string; value: number; color: 'gray' | 'emerald' | 'red' | 'amber' | 'purple'
  active: boolean; onClick: () => void
  iconType?: 'check' | 'x' | 'clock' | 'sparkles'
}) {
  const colorClasses: Record<string, string> = {
    gray: active ? 'bg-gray-100 dark:bg-gray-700 ring-2 ring-gray-400 text-gray-900 dark:text-gray-100' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-200',
    emerald: active ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-2 ring-emerald-400 text-emerald-800 dark:text-emerald-200' : 'bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
    red: active ? 'bg-red-100 dark:bg-red-900/40 ring-2 ring-red-400 text-red-800 dark:text-red-200' : 'bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-700 dark:text-red-300',
    amber: active ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-amber-400 text-amber-800 dark:text-amber-200' : 'bg-white dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-700 dark:text-amber-300',
    purple: active ? 'bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-400 text-purple-800 dark:text-purple-200' : 'bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-700 dark:text-purple-300',
  }
  return (
    <button
      onClick={onClick}
      className={`rounded-xl p-3 text-start ring-1 ring-gray-200 dark:ring-gray-700 transition-all ${colorClasses[color]}`}
    >
      <div className="inline-flex items-center gap-1.5 opacity-80">
        <StatIcon type={iconType} />
        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-xl sm:text-2xl font-black mt-0.5">{value}</p>
    </button>
  )
}

function MemberRowItem({ member, locale, onClick }: { member: MemberRow; locale: string; onClick: () => void }) {
  const statusInfo = {
    subscribed: { iconType: 'check' as const, label: locale === 'ar' ? 'اشترك PT' : 'Subscribed', cls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' },
    didnt_subscribe: { iconType: 'x' as const, label: locale === 'ar' ? 'ما اشتركش' : 'Did not subscribe', cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' },
    pending_decision: { iconType: 'clock' as const, label: locale === 'ar' ? 'لسه ما اتقررش' : 'Pending', cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
    still_has_free: { iconType: 'sparkles' as const, label: locale === 'ar' ? `لسه ${member.freePTSessions} حصص` : `${member.freePTSessions} free left`, cls: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' },
  }[member.status]
  const iconPaths: Record<string, string> = {
    check: 'm4.5 12.75 6 6 9-13.5',
    x: 'M6 18 18 6M6 6l12 12',
    clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    sparkles: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  }

  return (
    <button
      onClick={onClick}
      className="w-full p-3 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors text-start"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {member.profileImage ? (
            <img src={member.profileImage} alt={member.name} className="w-full h-full object-cover" />
          ) : (
            <svg {...stroke} className="w-5 h-5 text-gray-500 dark:text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-gray-900 dark:text-gray-100 truncate">{member.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {/* حالة الـ PT: دفع / فري — عشان نميّز بسرعة مين دفع ومين لسه فري */}
            {member.hasPaidPT ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                <svg {...stroke} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {locale === 'ar' ? 'دفع' : 'Paid'}
              </span>
            ) : member.freePTSessions > 0 ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                <svg {...stroke} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>
                {locale === 'ar' ? `فري (${member.freePTSessions})` : `Free (${member.freePTSessions})`}
              </span>
            ) : null}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 ${statusInfo.cls}`}>
              <svg {...stroke} className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[statusInfo.iconType]} />
              </svg>
              {statusInfo.label}
            </span>
            {member.services && (['nutrition', 'physio', 'more'] as const).map((svc) => {
              const st = member.services![svc]
              if (st === 'none') return null
              const labels = {
                nutrition: locale === 'ar' ? 'تغذية' : 'Nutrition',
                physio: locale === 'ar' ? 'علاج طبيعي' : 'Physio',
                more: locale === 'ar' ? 'مزيد' : 'More',
              }
              const cls = st === 'subscribed'
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
              const mark = st === 'subscribed' ? '✓' : (locale === 'ar' ? 'مجاني' : 'free')
              return (
                <span key={svc} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cls}`}>
                  {labels[svc]} {mark}
                </span>
              )
            })}
            {member.joinedCoachAt && (
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold inline-flex items-center gap-1">
                <svg {...stroke} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                {(() => {
                  const days = Math.floor((Date.now() - new Date(member.joinedCoachAt).getTime()) / (1000 * 60 * 60 * 24))
                  if (days === 0) return locale === 'ar' ? 'النهارده' : 'today'
                  if (days === 1) return locale === 'ar' ? 'إمبارح' : 'yesterday'
                  if (days < 30) return locale === 'ar' ? `من ${days} يوم` : `${days}d ago`
                  if (days < 365) return locale === 'ar' ? `من ${Math.floor(days / 30)} شهر` : `${Math.floor(days / 30)}mo ago`
                  return locale === 'ar' ? `من ${Math.floor(days / 365)} سنة` : `${Math.floor(days / 365)}y ago`
                })()}
              </span>
            )}
            {member.ptSessions.length > 0 && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                · {member.ptSessions.length} {locale === 'ar' ? 'جلسة' : 'sessions'}
              </span>
            )}
            {member.coachConversionNote && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold inline-flex items-center gap-1">
                <svg {...stroke} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                {locale === 'ar' ? 'فيه ملاحظة' : 'has note'}
              </span>
            )}
          </div>
        </div>
      </div>
      <svg {...stroke} className="w-4 h-4 text-gray-400 flex-shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  )
}

function StatusBanner({ member, locale }: { member: MemberRow; locale: string }) {
  if (member.status === 'subscribed' && member.activePT) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-300 dark:ring-emerald-800 rounded-lg p-4">
        <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200 mb-1">
          ✅ {locale === 'ar' ? 'اشترك في PT' : 'Subscribed to PT'}
        </p>
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          PT #{member.activePT.ptNumber} · {locale === 'ar' ? 'متبقي' : 'Remaining'}: {member.activePT.sessionsRemaining}/{member.activePT.sessionsPurchased}
        </p>
      </div>
    )
  }
  if (member.status === 'didnt_subscribe') {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 ring-1 ring-red-300 dark:ring-red-800 rounded-lg p-4">
        <p className="text-sm font-bold text-red-800 dark:text-red-200">
          🔴 {locale === 'ar' ? 'ما اشتركش في PT' : 'Did not subscribe to PT'}
        </p>
      </div>
    )
  }
  if (member.status === 'pending_decision') {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-300 dark:ring-amber-800 rounded-lg p-4">
        <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
          ⏳ {locale === 'ar' ? 'الحصص المجانية خلصت — الكوتش لسه ما سجلش رد العميل' : 'Free sessions ran out — coach hasn\'t logged client response'}
        </p>
      </div>
    )
  }
  return (
    <div className="bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-300 dark:ring-purple-800 rounded-lg p-4">
      <p className="text-sm font-bold text-purple-800 dark:text-purple-200">
        🆓 {locale === 'ar' ? `لسه عنده ${member.freePTSessions} حصة مجانية` : `Still has ${member.freePTSessions} free sessions`}
      </p>
    </div>
  )
}
