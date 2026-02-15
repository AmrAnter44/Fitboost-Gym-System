'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useLanguage } from '../../contexts/LanguageContext'
import { PRIMARY_COLOR, THEME_COLORS } from '@/lib/theme/colors'
import LoadingSkeleton from '../../components/LoadingSkeleton'

export default function MemberAttendancePage() {
  const { t } = useLanguage()
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7) // آخر 7 أيام
    return date.toISOString().split('T')[0]
  })

  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const [loading, setLoading] = useState(false)
  const [dailyStats, setDailyStats] = useState<any[]>([])
  const [topMembers, setTopMembers] = useState<any[]>([])
  const [totalCheckIns, setTotalCheckIns] = useState(0)
  const [checkIns, setCheckIns] = useState<any[]>([])

  useEffect(() => {
    fetchAttendanceData()
  }, [])

  const fetchAttendanceData = async () => {
    setLoading(true)
    try {
      // جلب إحصائيات الفترة المحددة
      const historyRes = await fetch(`/api/member-checkin/history?startDate=${startDate}&endDate=${endDate}`)
      const historyData = await historyRes.json()

      if (historyData.stats) {
        setDailyStats(historyData.stats.dailyStats || [])
        setTopMembers(historyData.stats.topMembers || [])
        setTotalCheckIns(historyData.stats.totalCheckIns || 0)
      }

      // ✅ جلب سجلات الحضور التفصيلية
      if (historyData.checkIns) {
        setCheckIns(historyData.checkIns)
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyFilter = () => {
    fetchAttendanceData()
  }

  return (
    <div className="container mx-auto p-4 sm:p-6" dir="rtl">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 sm:gap-4 mb-2">
          <div className="bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 p-3 sm:p-4 rounded-xl shadow-lg">
            <span className="text-3xl sm:text-4xl">📊</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">{t('memberAttendance.title')}</h1>
            <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mt-1">{t('memberAttendance.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-gradient-to-br from-white to-primary-50 dark:from-gray-800 dark:to-primary-900/40 p-6 rounded-xl shadow-lg mb-6 border-2 border-primary-100 dark:border-primary-600">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">🔍 {t('memberAttendance.selectTimePeriod')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('memberAttendance.dateFrom')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('memberAttendance.dateTo')}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <button
              onClick={handleApplyFilter}
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-500 dark:to-primary-600 text-white px-6 py-2 rounded-lg hover:from-primary-700 hover:to-primary-800 dark:hover:from-primary-600 dark:hover:to-primary-700 disabled:bg-gray-400 disabled:dark:bg-gray-600 font-semibold shadow-md transition-all transform hover:scale-105"
            >
              {loading ? `⏳ ${t('memberAttendance.loading')}` : `✓ ${t('memberAttendance.applyFilter')}`}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-gradient-to-br from-primary-50 to-cyan-50 dark:from-primary-900/40 dark:to-cyan-900/40 p-5 sm:p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-primary-400 dark:border-primary-600 transform hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-700 dark:text-primary-200 text-xs sm:text-sm font-semibold mb-2">{t('memberAttendance.totalAttendance')}</p>
              <p className="text-3xl sm:text-4xl font-bold text-primary-800 dark:text-primary-100">{totalCheckIns}</p>
            </div>
            <div className="text-4xl sm:text-5xl opacity-80">📊</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary-50 to-pink-50 dark:from-primary-900/40 dark:to-pink-900/40 p-5 sm:p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-primary-400 dark:border-primary-600 transform hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-700 dark:text-primary-200 text-xs sm:text-sm font-semibold mb-2">{t('memberAttendance.dailyAverage')}</p>
              <p className="text-3xl sm:text-4xl font-bold text-primary-800 dark:text-primary-100">
                {dailyStats.length > 0 ? Math.round(totalCheckIns / dailyStats.length) : 0}
              </p>
            </div>
            <div className="text-4xl sm:text-5xl opacity-80">📈</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/40 dark:to-emerald-900/40 p-5 sm:p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-green-400 dark:border-green-600 transform hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-700 dark:text-green-200 text-xs sm:text-sm font-semibold mb-2">{t('memberAttendance.uniqueMembers')}</p>
              <p className="text-3xl sm:text-4xl font-bold text-green-800 dark:text-green-100">
                {new Set(checkIns.map(c => c.memberId)).size}
              </p>
            </div>
            <div className="text-4xl sm:text-5xl opacity-80">👥</div>
          </div>
        </div>
      </div>

      {/* Daily Attendance Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl hover:shadow-2xl transition-shadow duration-300 overflow-hidden mb-6 sm:mb-8 border border-gray-200 dark:border-gray-700">
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 px-4 sm:px-6 py-4 sm:py-5">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">📈</span>
            <span>{t('memberAttendance.dailyAttendanceChart')}</span>
          </h2>
          <p className="text-primary-100 text-xs sm:text-sm mt-1">{t('memberAttendance.chartDescription')}</p>
        </div>
        <div className="p-4 sm:p-6 bg-gray-50 dark:bg-gray-800/60">
          {dailyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyStats}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e5e7eb"
                  className="dark:opacity-20"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  stroke="#9ca3af"
                  className="dark:opacity-70"
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  stroke="#9ca3af"
                  className="dark:opacity-70"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgb(249 250 251)',
                    border: `2px solid ${PRIMARY_COLOR}`,
                    borderRadius: '8px',
                    color: '#1f2937'
                  }}
                  wrapperClassName="dark:[&>div]:!bg-gray-800 dark:[&>div]:!text-white dark:[&>div]:!border-primary-500"
                  cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '14px', fontWeight: 'bold', color: '#374151' }}
                  className="dark:text-gray-200"
                />
                <Bar
                  dataKey="count"
                  fill={PRIMARY_COLOR}
                  name={t('memberAttendance.attendanceCount')}
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-12">
              <div className="text-5xl mb-4">📊</div>
              <p className="text-lg">{t('memberAttendance.noDataForPeriod')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Members */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl hover:shadow-2xl transition-shadow duration-300 overflow-hidden mb-6 sm:mb-8 border border-gray-200 dark:border-gray-700">
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 px-4 sm:px-6 py-4 sm:py-5">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <span>{t('memberAttendance.topMembers')}</span>
          </h2>
          <p className="text-amber-100 text-xs sm:text-sm mt-1">{t('memberAttendance.topMembersDescription')}</p>
        </div>
        {topMembers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-650">
                <tr>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-right font-bold text-sm sm:text-base text-gray-700 dark:text-gray-100">{t('memberAttendance.rank')}</th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-right font-bold text-sm sm:text-base text-gray-700 dark:text-gray-100">{t('memberAttendance.memberNumber')}</th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-right font-bold text-sm sm:text-base text-gray-700 dark:text-gray-100">{t('memberAttendance.name')}</th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-right font-bold text-sm sm:text-base text-gray-700 dark:text-gray-100">{t('memberAttendance.visits')}</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800/80">
                {topMembers.map((item, index) => (
                  <tr key={index} className="border-t dark:border-gray-600 hover:bg-gradient-to-r hover:from-amber-50 hover:to-yellow-50 dark:hover:from-amber-900/40 dark:hover:to-yellow-900/40 transition-all duration-200 transform hover:scale-[1.01]">
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-xl sm:text-2xl">
                      {index === 0 && '🥇'}
                      {index === 1 && '🥈'}
                      {index === 2 && '🥉'}
                      {index > 2 && <span className="text-gray-600 dark:text-gray-300 font-bold text-sm sm:text-base">#{index + 1}</span>}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4">
                      <span className="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-800/80 dark:to-primary-700/80 text-primary-900 dark:text-primary-100 px-3 py-1.5 rounded-lg font-bold text-xs sm:text-sm shadow-sm border border-primary-400 dark:border-primary-600">
                        {item.member?.memberNumber || '-'}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-50">{item.member?.name || t('memberAttendance.unknown')}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4">
                      <span className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-800/80 dark:to-emerald-800/80 text-gray-900 dark:text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold text-base sm:text-lg shadow-sm border border-green-400 dark:border-green-600">
                        {item.visits}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">
            <div className="text-5xl mb-4">🏆</div>
            <p className="text-lg">{t('memberAttendance.noDataForPeriod')}</p>
          </div>
        )}
      </div>

      {/* سجل الحضور اليومي التفصيلي */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl hover:shadow-2xl transition-shadow duration-300 overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 px-4 sm:px-6 py-4 sm:py-5">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">📋</span>
            <span>{t('memberAttendance.dailyAttendanceLog')}</span>
          </h2>
          <p className="text-green-100 text-xs sm:text-sm mt-1">{t('memberAttendance.allRecordsForPeriod')}</p>
        </div>

        {loading ? (
          <div className="py-6">
            <LoadingSkeleton type="table" count={10} />
          </div>
        ) : checkIns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-650">
                <tr>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-right font-bold text-sm sm:text-base text-gray-700 dark:text-gray-100">#</th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-right font-bold text-sm sm:text-base text-gray-700 dark:text-gray-100">{t('memberAttendance.memberNumber')}</th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-right font-bold text-sm sm:text-base text-gray-700 dark:text-gray-100">{t('memberAttendance.name')}</th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-right font-bold text-sm sm:text-base text-gray-700 dark:text-gray-100">{t('memberAttendance.date')}</th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-right font-bold text-sm sm:text-base text-gray-700 dark:text-gray-100">{t('memberAttendance.checkInTime')}</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800/80">
                {checkIns.map((checkIn, index) => {
                  const checkInTime = new Date(checkIn.checkInTime)

                  return (
                    <tr key={checkIn.id} className="border-t dark:border-gray-600 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 dark:hover:from-green-900/40 dark:hover:to-emerald-900/40 transition-all duration-200 transform hover:scale-[1.01]">
                      <td className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-sm sm:text-base text-gray-600 dark:text-gray-200">
                        {index + 1}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4">
                        <span className="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-800/80 dark:to-primary-700/80 text-primary-900 dark:text-primary-100 px-3 py-1.5 rounded-lg font-bold text-xs sm:text-sm shadow-sm border border-primary-400 dark:border-primary-600">
                          {checkIn.member?.memberNumber || '-'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-50">
                        {checkIn.member?.name || t('memberAttendance.unknown')}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base text-gray-700 dark:text-gray-100">
                        {checkInTime.toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4">
                        <span className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-800/80 dark:to-emerald-800/80 text-gray-900 dark:text-white px-3 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm shadow-sm border border-green-400 dark:border-green-600">
                          {checkInTime.toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-xl text-gray-600 dark:text-gray-300">{t('memberAttendance.noRecordsForPeriod')}</p>
          </div>
        )}
      </div>

    </div>
  )
}
