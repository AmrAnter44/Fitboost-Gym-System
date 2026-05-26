'use client'

import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useLanguage } from '../contexts/LanguageContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const REVENUE_COLOR = '#10b981' // green

interface DashboardChartsProps {
  revenueChartData: any[]
  attendanceChartData: any[]
}

export default function DashboardCharts({ revenueChartData, attendanceChartData }: DashboardChartsProps) {
  const { t } = useLanguage()

  const iconRevenue = (
    <svg {...stroke} className="w-6 h-6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8v8m0 0v2m0-10V6"/>
      <circle cx="12" cy="12" r="9"/>
    </svg>
  )
  const iconChart = (
    <svg {...stroke} className="w-6 h-6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18M7 14l3-3 4 4 5-6"/>
    </svg>
  )
  const iconEmpty = (
    <svg {...stroke} className="w-12 h-12" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18M7 14l3-3 4 4 5-6"/>
    </svg>
  )

  const CustomRevenueTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-xl ring-1 ring-primary-200 dark:ring-primary-900/50">
          <p className="font-bold text-gray-900 dark:text-gray-100 mb-2">{payload[0].payload.fullDate}</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-primary-500 dark:bg-primary-400 rounded-full"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('dashboard.revenue')}: <span className="font-bold text-primary-600 dark:text-primary-400">{payload[0].value.toLocaleString()}</span> {t('members.egp')}
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('receipts.stats.todayReceipts')}: {payload[0].payload.count}
          </p>
        </div>
      )
    }
    return null
  }

  const CustomAttendanceTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-xl ring-1 ring-green-200 dark:ring-green-900/50">
          <p className="font-bold text-gray-900 dark:text-gray-100 mb-2">{payload[0].payload.fullDate}</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 dark:bg-green-400 rounded-full"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('dashboard.attendance')}: <span className="font-bold text-green-600 dark:text-green-400">{payload[0].value}</span> {t('members.members')}
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* جراف الإيرادات */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
              {iconRevenue}
            </span>
            <span>{t('dashboard.revenueLast14Days')}</span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('dashboard.revenueChartSubtitle')}</p>
        </div>
        {revenueChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={revenueChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={REVENUE_COLOR} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={REVENUE_COLOR} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.5} />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                style={{ fontSize: '12px', fontWeight: 600 }}
                tick={{ fill: '#475569' }}
              />
              <YAxis
                stroke="#64748b"
                style={{ fontSize: '12px', fontWeight: 600 }}
                tick={{ fill: '#475569' }}
              />
              <Tooltip content={<CustomRevenueTooltip />} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke={REVENUE_COLOR}
                strokeWidth={4}
                dot={{ fill: REVENUE_COLOR, strokeWidth: 2, r: 6, stroke: '#fff' }}
                activeDot={{ r: 8, stroke: '#fff', strokeWidth: 3 }}
                fill="url(#revenueGradient)"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-[350px] text-gray-400 dark:text-gray-500">
            {iconEmpty}
            <p className="mt-3 font-semibold">{t('dashboard.loadingData')}</p>
          </div>
        )}
      </div>

      {/* جراف حضور الأعضاء */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center">
              {iconChart}
            </span>
            <span>{t('dashboard.attendanceLast7Days')}</span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('dashboard.attendanceChartSubtitle')}</p>
        </div>
        {attendanceChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={attendanceChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.3}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.5} />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                style={{ fontSize: '12px', fontWeight: 600 }}
                tick={{ fill: '#475569' }}
              />
              <YAxis
                stroke="#64748b"
                style={{ fontSize: '12px', fontWeight: 600 }}
                tick={{ fill: '#475569' }}
              />
              <Tooltip content={<CustomAttendanceTooltip />} />
              <Bar
                dataKey="attendance"
                fill="url(#attendanceGradient)"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-[350px] text-gray-400 dark:text-gray-500">
            {iconEmpty}
            <p className="mt-3 font-semibold">{t('dashboard.loadingData')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
