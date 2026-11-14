'use client'

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import { useLanguage } from '../../contexts/LanguageContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const IconClock = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)
const IconTrophy = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
  </svg>
)
const IconUser = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </svg>
)

//  📍 فلاتر المصدر — نفس تقسيمة أزرار المصادر في قايمة المتابعات
const SOURCE_FILTERS: Array<{ key: string; ar: string; en: string; on: string }> = [
  { key: 'all', ar: 'كل المصادر', en: 'All sources', on: 'bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-800' },
  { key: 'expired', ar: 'أعضاء منتهيين', en: 'Expired members', on: 'bg-red-600 text-white' },
  { key: 'expiring', ar: 'قربوا يخلصوا', en: 'Expiring soon', on: 'bg-amber-500 text-white' },
  { key: 'invitations', ar: 'دعوات أعضاء', en: 'Member invitations', on: 'bg-cyan-600 text-white' },
  { key: 'dayuse', ar: 'Day Use', en: 'Day Use', on: 'bg-pink-600 text-white' },
  { key: 'others', ar: 'باقي المصادر', en: 'Other sources', on: 'bg-primary-600 text-primary-contrast' },
]

export default function SalesDashboard() {
  const { t, direction, locale } = useLanguage()
  const ar = locale === 'ar'
  const [staffId, setStaffId] = useState('')
  const [source, setSource] = useState('all')

  const { data: analytics, isLoading, isFetching } = useQuery({
    queryKey: ['followup-analytics', staffId, source],
    queryFn: async () => {
      const qs = new URLSearchParams()
      if (staffId) qs.set('staffId', staffId)
      if (source !== 'all') qs.set('source', source)
      const res = await fetch(`/api/followups/analytics${qs.toString() ? `?${qs}` : ''}`)
      if (!res.ok) throw new Error('Failed to fetch analytics')
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
    //  الأرقام القديمة تفضل ظاهرة وهو بيحمّل الفلتر الجديد (من غير ما الشاشة تفضى)
    placeholderData: keepPreviousData,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" aria-busy="true" aria-live="polite">
        <div className="text-sm text-gray-500 dark:text-gray-400">{t('followups.analytics.loading')}</div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-red-600 dark:text-red-400">{t('followups.analytics.loadError')}</div>
      </div>
    )
  }

  const stageData = Object.entries(analytics.byStage || {}).map(([stage, count]) => ({
    stage: t(`followups.analytics.stages.${stage}`),
    count: count as number
  }))

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B']

  const cardCls = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5'

  return (
    <div className="space-y-6" dir={direction}>
      {/* 🔎 الفلاتر: السيلز + المصدر */}
      <div className={`${cardCls} !p-4 flex flex-col gap-3`}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-bold text-gray-700 dark:text-gray-300">{ar ? 'السيلز' : 'Sales'}</label>
          <select
            value={staffId}
            onChange={e => setStaffId(e.target.value)}
            className="min-w-[200px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">{ar ? 'كل السيلز' : 'All sales'}</option>
            <option value="__unassigned__">{ar ? 'بدون سيلز' : 'Unassigned'}</option>
            {(analytics.salesStaff || []).map((s: { id: string; name: string }) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {isFetching && <span className="text-xs text-gray-400" aria-live="polite">{ar ? 'بيحدّث...' : 'Updating...'}</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SOURCE_FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setSource(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${source === f.key
                ? f.on
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              {ar ? f.ar : f.en}
            </button>
          ))}
        </div>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={cardCls}>
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('followups.analytics.quickStats.totalFollowups')}</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{analytics.total}</div>
        </div>
        <div className={cardCls}>
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('followups.analytics.quickStats.converted')}</div>
          <div className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{analytics.converted}</div>
        </div>
        <div className={cardCls}>
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('followups.analytics.quickStats.conversionRate')}</div>
          <div className="mt-1 text-2xl font-bold text-primary-700 dark:text-primary-400">{analytics.conversionRate}%</div>
        </div>
        <div className={cardCls}>
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('followups.analytics.quickStats.unassigned')}</div>
          <div className="mt-1 text-2xl font-bold text-orange-600 dark:text-orange-400">{analytics.unassigned}</div>
        </div>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400">{t('followups.analytics.quickStats.contacted')}</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{analytics.contacted}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400">{t('followups.analytics.quickStats.notContacted')}</div>
          <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{analytics.notContacted}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400">{t('followups.analytics.quickStats.overdue')}</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{analytics.overdue}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400">{t('followups.analytics.quickStats.convertedThisMonth')}</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{analytics.convertedThisMonth}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={cardCls}>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">{t('followups.analytics.charts.byStage')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="stage" style={{ fontSize: '12px', fill: '#6B7280' }} stroke="#6B7280" />
              <YAxis style={{ fontSize: '12px', fill: '#6B7280' }} stroke="#6B7280" />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F3F4F6' }} />
              <Bar dataKey="count" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={cardCls}>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">{t('followups.analytics.charts.byStage')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stageData}
                dataKey="count"
                nameKey="stage"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                style={{ fontSize: '12px' }}
              >
                {stageData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F3F4F6' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Leaderboard */}
      {analytics.topPerformers && analytics.topPerformers.length > 0 && (
        <div className={cardCls}>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{t('followups.analytics.leaderboard.title')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('followups.analytics.leaderboard.subtitle')}</p>
          <div className="space-y-3">
            {analytics.topPerformers.map((performer: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                    index === 0
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      : index === 1
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      : index === 2
                      ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                      : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                  }`}>
                    {index < 3 ? <IconTrophy className="w-5 h-5" /> : <IconUser className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-gray-100">{performer.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {performer.converted} {t('followups.analytics.quickStats.converted')} {t('common.of')} {performer.total} {t('followups.stats.total')}
                    </div>
                  </div>
                </div>
                <div className="text-xl font-bold text-green-600 dark:text-green-400">{performer.rate}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Average response time */}
      {analytics.averageResponseHours !== undefined && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-primary-200 dark:ring-primary-900/50 p-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
              <IconClock className="w-5 h-5" />
            </span>
            <div>
              <div className="font-bold text-gray-900 dark:text-gray-100">
                {direction === 'rtl' ? 'متوسط وقت الاستجابة' : 'Average Response Time'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {analytics.averageResponseHours} {direction === 'rtl' ? 'ساعة من إنشاء المتابعة حتى أول تواصل' : 'hours from follow-up creation to first contact'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
