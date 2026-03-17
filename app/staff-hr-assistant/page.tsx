'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useDarkMode } from '@/contexts/DarkModeContext'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import { getStatusColors } from '@/lib/hrCalculations'
import Link from 'next/link'

interface UnderperformanceDay {
  date: string
  actualHours: number
  requiredHours: number
  shortfall: number
}

interface RevenueBreakdown {
  pt: number
  nutrition: number
  physiotherapy: number
  other: number
  total: number
}

interface StaffAnalytics {
  staffId: string
  staffCode: string
  staffName: string
  position: string | null
  salary: number | null
  workingHours: number
  monthlyVacationDays: number
  actualHoursWorked: number
  requiredHours: number
  hoursDifference: number
  daysAttended: number
  daysAbsent: number
  vacationDaysRemaining: number
  performancePercentage: number
  underperformanceDays: UnderperformanceDay[]
  status: 'excellent' | 'good' | 'warning' | 'critical'
  alerts: string[]
  revenue: RevenueBreakdown
  revenueToSalaryRatio: number | null
}

interface AnalyticsResponse {
  month: number
  year: number
  workingDaysInMonth: number
  analytics: StaffAnalytics[]
}

export default function StaffHRAssistantPage() {
  const { t, direction } = useLanguage()
  const { isDarkMode } = useDarkMode()
  const toast = useToast()
  const { hasPermission } = usePermissions()

  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)

  // Filters
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/staff/hr-analytics?month=${selectedMonth}&year=${selectedYear}`
      )

      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error || t('staff.hrAssistant.loading'))
        return
      }

      const data = await response.json()
      setAnalytics(data)
    } catch (error) {
      console.error('Error fetching analytics:', error)
      toast.error(t('staff.hrAssistant.loading'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [selectedMonth, selectedYear])

  // Auto-select first staff when data loads
  useEffect(() => {
    if (analytics && analytics.analytics.length > 0 && !selectedStaffId) {
      setSelectedStaffId(analytics.analytics[0].staffId)
    }
  }, [analytics])

  // Calculate overview stats
  const calculateOverview = () => {
    if (!analytics) return { total: 0, excellent: 0, good: 0, underperforming: 0 }

    const total = analytics.analytics.length
    const excellent = analytics.analytics.filter((s) => s.status === 'excellent').length
    const good = analytics.analytics.filter((s) => s.status === 'good').length
    const underperforming = analytics.analytics.filter(
      (s) => s.status === 'warning' || s.status === 'critical'
    ).length

    return { total, excellent, good, underperforming }
  }

  const overview = calculateOverview()

  // Filter staff based on search query
  const filteredAnalytics = analytics?.analytics.filter((staff) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      staff.staffName.toLowerCase().includes(query) ||
      staff.staffCode.toLowerCase().includes(query) ||
      staff.position?.toLowerCase().includes(query)
    )
  }) || []

  // Month options
  const monthOptions = [
    { value: 1, label: t('staff.hrAssistant.months.1') },
    { value: 2, label: t('staff.hrAssistant.months.2') },
    { value: 3, label: t('staff.hrAssistant.months.3') },
    { value: 4, label: t('staff.hrAssistant.months.4') },
    { value: 5, label: t('staff.hrAssistant.months.5') },
    { value: 6, label: t('staff.hrAssistant.months.6') },
    { value: 7, label: t('staff.hrAssistant.months.7') },
    { value: 8, label: t('staff.hrAssistant.months.8') },
    { value: 9, label: t('staff.hrAssistant.months.9') },
    { value: 10, label: t('staff.hrAssistant.months.10') },
    { value: 11, label: t('staff.hrAssistant.months.11') },
    { value: 12, label: t('staff.hrAssistant.months.12') }
  ]

  // Year options (last 3 years)
  const yearOptions = [
    selectedYear - 2,
    selectedYear - 1,
    selectedYear,
    selectedYear + 1
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            {t('staff.hrAssistant.loading')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6"
      dir={direction}
    >
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
              {t('staff.hrAssistant.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              {t('staff.hrAssistant.subtitle')}
            </p>
          </div>
          <Link
            href="/staff"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition shadow-md"
          >
            ← {t('common.back')}
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="max-w-7xl mx-auto mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          📊 {t('staff.hrAssistant.overview')} - {monthOptions[selectedMonth - 1]?.label} {selectedYear}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Staff */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                  {t('staff.hrAssistant.totalStaff')}
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {overview.total}
                </p>
              </div>
              <div className="text-4xl">👥</div>
            </div>
          </div>

          {/* Excellent */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-green-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                  {t('staff.hrAssistant.excellent')}
                </p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {overview.excellent}
                </p>
              </div>
              <div className="text-4xl">🌟</div>
            </div>
          </div>

          {/* Good */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                  {t('staff.hrAssistant.good')}
                </p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {overview.good}
                </p>
              </div>
              <div className="text-4xl">👍</div>
            </div>
          </div>

          {/* Underperforming */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-red-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                  {t('staff.hrAssistant.underperforming')}
                </p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {overview.underperforming}
                </p>
              </div>
              <div className="text-4xl">⚠️</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            🔍 {t('staff.hrAssistant.filters')}
          </h3>

          {/* Search Bar */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('staff.hrAssistant.search')}
            </label>
            <input
              type="text"
              placeholder={t('staff.hrAssistant.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 dark:focus:border-primary-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            {/* Month Select */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('staff.hrAssistant.month')}
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 dark:focus:border-primary-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Select */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('staff.hrAssistant.year')}
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 dark:focus:border-primary-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <div className="flex items-end">
              <button
                onClick={fetchAnalytics}
                className="w-full md:w-auto px-6 py-3 bg-primary-600 dark:bg-primary-700 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 transition shadow-md"
              >
                🔄 {t('staff.hrAssistant.refresh')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Analytics */}
      <div className="max-w-7xl mx-auto">
        {analytics && analytics.analytics.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
            <p className="text-gray-600 dark:text-gray-300 text-lg">
              {t('staff.hrAssistant.noStaff')}
            </p>
          </div>
        )}

        {searchQuery && filteredAnalytics.length === 0 && analytics && analytics.analytics.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
            <p className="text-gray-600 dark:text-gray-300 text-lg">
              {t('staff.hrAssistant.noResults')}
            </p>
          </div>
        )}

        {filteredAnalytics.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Staff List - Small Cards */}
            <div className="lg:col-span-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                📋 {t('staff.hrAssistant.staffList')}
                {searchQuery && (
                  <span className="text-base font-normal text-gray-600 dark:text-gray-400">
                    {' '}({filteredAnalytics.length})
                  </span>
                )}
              </h2>
              <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2">
                {filteredAnalytics.map((staff) => {
                  const colors = getStatusColors(staff.status)
                  const isSelected = selectedStaffId === staff.staffId

                  return (
                    <div
                      key={staff.staffId}
                      onClick={() => setSelectedStaffId(staff.staffId)}
                      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 ${
                        isSelected ? colors.border + ' ring-4 ring-opacity-50 ' + colors.border : 'border-gray-200 dark:border-gray-700'
                      } p-4 cursor-pointer hover:shadow-lg transition-all duration-200 ${
                        isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]'
                      }`}
                    >
                      {/* Small Card Content */}
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full ${colors.bg} flex items-center justify-center text-2xl`}>
                          👤
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                            {staff.staffName}
                          </h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {staff.staffCode} • {staff.position || t('staff.positions.other')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-bold ${colors.text}`}>
                            {staff.performancePercentage.toFixed(0)}%
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {t(`staff.hrAssistant.status.${staff.status}`)}
                          </p>
                        </div>
                      </div>

                      {/* Mini Stats */}
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-center">
                          <p className="text-xs text-gray-600 dark:text-gray-400">✅ {t('staff.hrAssistant.attendance')}</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{staff.daysAttended}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-600 dark:text-gray-400">⏰ {t('staff.hrAssistant.workHours')}</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{staff.actualHoursWorked.toFixed(0)}h</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-600 dark:text-gray-400">💰 {t('staff.hrAssistant.revenue.total')}</p>
                          <p className="text-sm font-bold text-green-600 dark:text-green-400">{staff.revenue.total.toFixed(0)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Selected Staff Details */}
            <div className="lg:col-span-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                📊 {t('staff.hrAssistant.selectedStaffDetails')}
              </h2>

              {selectedStaffId && filteredAnalytics.find(s => s.staffId === selectedStaffId) && (() => {
                const staff = filteredAnalytics.find(s => s.staffId === selectedStaffId)!
                const colors = getStatusColors(staff.status)

                return (
                  <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 ${colors.border} overflow-hidden`}>
                    {/* Details Header */}
                    <div className={`${colors.bg} p-6`}>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-20 h-20 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center text-4xl shadow-lg">
                            👤
                          </div>
                          <div>
                            <h3 className={`text-2xl font-bold ${colors.text}`}>
                              {staff.staffName} ({staff.staffCode})
                            </h3>
                            <p className="text-gray-700 dark:text-gray-300 text-lg">
                              {staff.position || t('staff.positions.other')}
                            </p>
                            <div className="flex gap-3 mt-1 text-xs text-gray-600 dark:text-gray-400">
                              <span>⏰ {staff.workingHours} {t('staff.hrAssistant.hoursPerDay')}</span>
                              <span>•</span>
                              <span>🏖️ {staff.monthlyVacationDays} {t('staff.hrAssistant.vacationDaysPerMonth')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`inline-block px-8 py-4 rounded-full ${colors.bg} border-2 ${colors.border}`}>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                              {t('staff.hrAssistant.performance')}
                            </p>
                            <p className={`text-4xl font-bold ${colors.text}`}>
                              {staff.performancePercentage.toFixed(1)}%
                            </p>
                            <p className={`text-xs ${colors.text} mt-1`}>
                              {t(`staff.hrAssistant.status.${staff.status}`)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Quick Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
                        {/* Attendance */}
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            ✅ {t('staff.hrAssistant.attendance')}
                          </p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {staff.daysAttended} {t('staff.hrAssistant.days')}
                          </p>
                        </div>

                        {/* Absence */}
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            ❌ {t('staff.hrAssistant.absence')}
                          </p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {staff.daysAbsent} {t('staff.hrAssistant.days')}
                          </p>
                        </div>

                        {/* Work Hours */}
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            ⏰ {t('staff.hrAssistant.workHours')}
                          </p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {staff.actualHoursWorked.toFixed(1)} / {staff.requiredHours.toFixed(0)}
                          </p>
                        </div>

                        {/* Vacation */}
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            🏖️ {t('staff.hrAssistant.vacationRemaining')}
                          </p>
                          <p className={`text-2xl font-bold ${staff.vacationDaysRemaining < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                            {staff.vacationDaysRemaining} {t('staff.hrAssistant.days')}
                          </p>
                        </div>

                        {/* Revenue */}
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 shadow border border-green-200 dark:border-green-700">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            💰 {t('staff.hrAssistant.revenue.total')}
                          </p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {staff.revenue.total.toFixed(0)} {t('common.egp')}
                          </p>
                          {staff.revenueToSalaryRatio !== null && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {staff.revenueToSalaryRatio.toFixed(1)}x {t('staff.hrAssistant.revenue.ratio')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('staff.hrAssistant.performance')}
                          </span>
                          <span className={`text-sm font-bold ${colors.text}`}>
                            {staff.performancePercentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-4 overflow-hidden">
                          <div
                            className={`h-full ${colors.progress} rounded-full transition-all duration-500`}
                            style={{ width: `${Math.min(staff.performancePercentage, 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Alerts */}
                      {staff.alerts.length > 0 && (
                        <div className="mt-6 space-y-2">
                          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                            🚨 {t('staff.hrAssistant.alerts')}:
                          </p>
                          {staff.alerts.map((alert, index) => (
                            <div
                              key={index}
                              className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow text-sm text-gray-900 dark:text-white"
                            >
                              • {alert}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Details Body */}
                    <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t-2 border-gray-200 dark:border-gray-700 space-y-6">
                    {/* Revenue Breakdown */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                        💰 {t('staff.hrAssistant.revenue.breakdown')}
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {/* PT Revenue */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            🏋️ {t('staff.hrAssistant.revenue.pt')}
                          </p>
                          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                            {staff.revenue.pt.toFixed(0)} {t('common.egp')}
                          </p>
                        </div>

                        {/* Nutrition Revenue */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            🥗 {t('staff.hrAssistant.revenue.nutrition')}
                          </p>
                          <p className="text-xl font-bold text-green-600 dark:text-green-400">
                            {staff.revenue.nutrition.toFixed(0)} {t('common.egp')}
                          </p>
                        </div>

                        {/* Physiotherapy Revenue */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            💆 {t('staff.hrAssistant.revenue.physiotherapy')}
                          </p>
                          <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                            {staff.revenue.physiotherapy.toFixed(0)} {t('common.egp')}
                          </p>
                        </div>

                        {/* Other Revenue */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            ➕ {t('staff.hrAssistant.revenue.other')}
                          </p>
                          <p className="text-xl font-bold text-gray-600 dark:text-gray-400">
                            {staff.revenue.other.toFixed(0)} {t('common.egp')}
                          </p>
                        </div>
                      </div>

                      {/* Salary Comparison */}
                      {staff.salary && staff.salary > 0 && (
                        <div className="mt-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {t('staff.hrAssistant.revenue.salary')}
                              </p>
                              <p className="text-xl font-bold text-gray-900 dark:text-white">
                                {staff.salary.toFixed(0)} {t('common.egp')}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {t('staff.hrAssistant.revenue.ratio')}
                              </p>
                              <p className={`text-3xl font-bold ${staff.revenueToSalaryRatio && staff.revenueToSalaryRatio >= 1 ? 'text-green-600' : 'text-orange-600'}`}>
                                {staff.revenueToSalaryRatio?.toFixed(1)}x
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {t('staff.hrAssistant.revenue.difference')}
                              </p>
                              <p className={`text-xl font-bold ${staff.revenue.total >= staff.salary ? 'text-green-600' : 'text-red-600'}`}>
                                {(staff.revenue.total - staff.salary).toFixed(0)} {t('common.egp')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Underperformance Days */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                        📅 {t('staff.hrAssistant.underperformanceDays')} ({staff.underperformanceDays.length})
                      </h4>

                      {staff.underperformanceDays.length === 0 ? (
                        <p className="text-gray-600 dark:text-gray-300">
                          🎉 {direction === 'rtl' ? 'لا توجد أيام تقصير!' : 'No underperformance days!'}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {staff.underperformanceDays.map((day, index) => (
                            <div
                              key={index}
                              className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow flex items-center justify-between"
                            >
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  📆 {new Date(day.date).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {day.actualHours.toFixed(1)} {t('staff.hrAssistant.hours')} / {day.requiredHours} {t('staff.hrAssistant.hours')}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-red-600 dark:text-red-400 font-bold">
                                  {day.shortfall.toFixed(1)} {t('staff.hrAssistant.hours')}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {t('staff.hrAssistant.hoursShortfall')}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )})()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
