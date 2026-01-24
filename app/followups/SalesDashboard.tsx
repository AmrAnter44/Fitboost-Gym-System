'use client'

import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import { useLanguage } from '../../contexts/LanguageContext'

export default function SalesDashboard() {
  const { t, direction } = useLanguage()

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['followup-analytics'],
    queryFn: async () => {
      const res = await fetch('/api/followups/analytics')
      if (!res.ok) throw new Error('Failed to fetch analytics')
      return res.json()
    },
    staleTime: 2 * 60 * 1000
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t('followups.analytics.loading')}</div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{t('followups.analytics.loadError')}</div>
      </div>
    )
  }

  const stageData = Object.entries(analytics.byStage || {}).map(([stage, count]) => ({
    stage: t(`followups.analytics.stages.${stage}`),
    count: count as number
  }))

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B']

  return (
    <div className="space-y-6" dir={direction}>
      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-600 text-sm font-medium">{t('followups.analytics.quickStats.totalFollowups')}</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">{analytics.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-600 text-sm font-medium">{t('followups.analytics.quickStats.converted')}</div>
          <div className="text-3xl font-bold text-green-600 mt-2">{analytics.converted}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-600 text-sm font-medium">{t('followups.analytics.quickStats.conversionRate')}</div>
          <div className="text-3xl font-bold text-purple-600 mt-2">{analytics.conversionRate}%</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-600 text-sm font-medium">{t('followups.analytics.quickStats.unassigned')}</div>
          <div className="text-3xl font-bold text-orange-600 mt-2">{analytics.unassigned}</div>
        </div>
      </div>

      {/* إحصائيات إضافية */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-gray-600 text-xs">{t('followups.analytics.quickStats.contacted')}</div>
          <div className="text-2xl font-bold text-blue-600">{analytics.contacted}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-gray-600 text-xs">{t('followups.analytics.quickStats.notContacted')}</div>
          <div className="text-2xl font-bold text-gray-600">{analytics.notContacted}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-gray-600 text-xs">{t('followups.analytics.quickStats.overdue')}</div>
          <div className="text-2xl font-bold text-red-600">{analytics.overdue}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-gray-600 text-xs">{t('followups.analytics.quickStats.convertedThisMonth')}</div>
          <div className="text-2xl font-bold text-green-600">{analytics.convertedThisMonth}</div>
        </div>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - المراحل */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold mb-4">{t('followups.analytics.charts.byStage')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" style={{ fontSize: '12px' }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - المراحل */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold mb-4">{t('followups.analytics.charts.byStage')}</h3>
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
              >
                {stageData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* أفضل الموظفين */}
      {analytics.topPerformers && analytics.topPerformers.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold mb-4">{t('followups.analytics.leaderboard.title')}</h3>
          <p className="text-sm text-gray-600 mb-4">{t('followups.analytics.leaderboard.subtitle')}</p>
          <div className="space-y-3">
            {analytics.topPerformers.map((performer: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤'}
                  </div>
                  <div>
                    <div className="font-bold">{performer.name}</div>
                    <div className="text-sm text-gray-600">
                      {performer.converted} {t('followups.analytics.quickStats.converted')} {t('common.of')} {performer.total} {t('followups.stats.total')}
                    </div>
                  </div>
                </div>
                <div className="text-xl font-bold text-green-600">{performer.rate}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* معلومات إضافية */}
      {analytics.averageResponseHours !== undefined && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⏱️</span>
            <div>
              <div className="font-bold text-blue-900">
                {direction === 'rtl' ? 'متوسط وقت الاستجابة' : 'Average Response Time'}
              </div>
              <div className="text-blue-700">
                {analytics.averageResponseHours} {direction === 'rtl' ? 'ساعة من إنشاء المتابعة حتى أول تواصل' : 'hours from follow-up creation to first contact'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
