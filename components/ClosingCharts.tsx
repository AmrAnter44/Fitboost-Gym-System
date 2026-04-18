'use client'

import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts'
import { useLanguage } from '../contexts/LanguageContext'
import { PRIMARY_COLOR, THEME_COLORS } from '@/lib/theme/colors'

interface ClosingChartsProps {
  monthlyComparison: any[]
}

export default function ClosingCharts({ monthlyComparison }: ClosingChartsProps) {
  const { t } = useLanguage()

  const pieData = (() => {
    const totalCash = monthlyComparison.reduce((sum, m) => sum + (m.cash || 0), 0)
    const totalVisa = monthlyComparison.reduce((sum, m) => sum + (m.visa || 0), 0)
    const totalInstapay = monthlyComparison.reduce((sum, m) => sum + (m.instapay || 0), 0)
    const totalWallet = monthlyComparison.reduce((sum, m) => sum + (m.wallet || 0), 0)
    const totalPoints = monthlyComparison.reduce((sum, m) => sum + (m.points || 0), 0)
    return [
      { name: t('closing.comparison.cash'), value: totalCash, color: THEME_COLORS.primary[500] },
      { name: t('closing.comparison.visa'), value: totalVisa, color: '#3b82f6' },
      { name: t('closing.comparison.instapay'), value: totalInstapay, color: '#f59e0b' },
      { name: t('closing.comparison.wallet'), value: totalWallet, color: '#10b981' },
      { name: t('closing.comparison.points'), value: totalPoints, color: '#eab308' },
    ].filter(item => item.value > 0)
  })()

  const pieColors = [THEME_COLORS.primary[500], '#3b82f6', '#f59e0b', '#10b981', '#eab308']

  const cumulativeData = (() => {
    let cumulativeRevenue = 0
    let cumulativeExpenses = 0
    let cumulativeProfit = 0
    return monthlyComparison.map(month => {
      cumulativeRevenue += month.totalRevenue
      cumulativeExpenses += month.totalExpenses
      cumulativeProfit += month.netProfit
      return { ...month, cumulativeRevenue, cumulativeExpenses, cumulativeProfit }
    })
  })()

  return (
    <>
      {/* Revenue & Expenses Trend Chart */}
      <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 md:p-6 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-2xl transition-shadow duration-300 border border-transparent dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-700">
        <h3 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">{t('closing.comparison.revenueExpensesTrend')}</h3>
        <ResponsiveContainer width="100%" height={300} className="sm:!h-[350px] md:!h-[400px]">
          <LineChart data={monthlyComparison}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="monthName" angle={-45} textAnchor="end" height={100} style={{ fontSize: '12px' }} />
            <YAxis style={{ fontSize: '12px' }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="totalRevenue" stroke="#10b981" strokeWidth={3} name={t('closing.comparison.revenue')} />
            <Line type="monotone" dataKey="totalExpenses" stroke="#ef4444" strokeWidth={3} name={t('closing.comparison.expenses')} />
            <Line type="monotone" dataKey="netProfit" stroke={PRIMARY_COLOR} strokeWidth={3} name={t('closing.comparison.netProfit')} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue Breakdown Chart */}
      <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 md:p-6 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-2xl transition-shadow duration-300 border border-transparent dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-700">
        <h3 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">{t('closing.comparison.revenueBreakdown')}</h3>
        <ResponsiveContainer width="100%" height={300} className="sm:!h-[350px] md:!h-[400px]">
          <BarChart data={monthlyComparison}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="monthName" angle={-45} textAnchor="end" height={100} style={{ fontSize: '12px' }} />
            <YAxis style={{ fontSize: '12px' }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="floorRevenue" fill={THEME_COLORS.primary[400]} name={t('closing.comparison.floorRevenue')} />
            <Bar dataKey="ptRevenue" fill="#34d399" name={t('closing.comparison.ptRevenue')} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Subscriptions Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-2xl transition-shadow duration-300 border border-transparent dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-700">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{t('closing.comparison.subscriptionsChart')}</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={monthlyComparison}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="monthName" angle={-45} textAnchor="end" height={100} style={{ fontSize: '12px' }} />
            <YAxis style={{ fontSize: '12px' }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="memberSubscriptions" fill="#8b5cf6" name={t('closing.comparison.memberSubscriptions')} />
            <Bar dataKey="ptSubscriptions" fill="#ec4899" name={t('closing.comparison.ptSubscriptions')} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Payment Methods Distribution (PieChart) */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-2xl transition-shadow duration-300 border border-transparent dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-700">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{t('closing.comparison.paymentMethodsDistribution')}</h3>
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
              outerRadius={120}
              fill="#8884d8"
              dataKey="value"
            >
              {pieColors.map((color, index) => <Cell key={`cell-${index}`} fill={color} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Cumulative Growth (AreaChart) */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-2xl transition-shadow duration-300 border border-transparent dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-700">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{t('closing.comparison.cumulativeGrowth')}</h3>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={cumulativeData}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={THEME_COLORS.primary[500]} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={THEME_COLORS.primary[500]} stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="monthName" angle={-45} textAnchor="end" height={100} style={{ fontSize: '12px' }} />
            <YAxis style={{ fontSize: '12px' }} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="cumulativeRevenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" name={t('closing.comparison.cumulativeRevenue')} />
            <Area type="monotone" dataKey="cumulativeExpenses" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpenses)" name={t('closing.comparison.cumulativeExpenses')} />
            <Area type="monotone" dataKey="cumulativeProfit" stroke={THEME_COLORS.primary[500]} fillOpacity={1} fill="url(#colorProfit)" name={t('closing.comparison.cumulativeProfit')} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Performance Radar Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-2xl transition-shadow duration-300 border border-transparent dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-700">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{t('closing.comparison.performanceRadar')}</h3>
        <ResponsiveContainer width="100%" height={500}>
          <RadarChart data={monthlyComparison.slice(-6)}>
            <PolarGrid />
            <PolarAngleAxis dataKey="monthName" style={{ fontSize: '12px' }} />
            <PolarRadiusAxis style={{ fontSize: '10px' }} />
            <Radar name={t('closing.comparison.revenue')} dataKey="totalRevenue" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
            <Radar name={t('closing.comparison.subscriptions')} dataKey="totalSubscriptions" stroke={THEME_COLORS.primary[500]} fill={THEME_COLORS.primary[500]} fillOpacity={0.6} />
            <Legend />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
