'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useLanguage } from '../../contexts/LanguageContext'
import { PRIMARY_COLOR, THEME_COLORS } from '@/lib/theme/colors'

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
    <div className="container mx-auto p-6" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-3 rounded-lg">
            <span className="text-3xl">📊</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{t('memberAttendance.title')}</h1>
            <p className="text-gray-600 text-sm mt-1">{t('memberAttendance.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-gradient-to-br from-white to-primary-50 p-6 rounded-xl shadow-lg mb-6 border-2 border-primary-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">🔍 {t('memberAttendance.selectTimePeriod')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('memberAttendance.dateFrom')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('memberAttendance.dateTo')}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
            />
          </div>
          <div>
            <button
              onClick={handleApplyFilter}
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-2 rounded-lg hover:from-primary-700 hover:to-primary-800 disabled:bg-gray-400 font-semibold shadow-md transition-all transform hover:scale-105"
            >
              {loading ? `⏳ ${t('memberAttendance.loading')}` : `✓ ${t('memberAttendance.applyFilter')}`}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-gradient-to-br from-primary-50 to-cyan-50 p-6 rounded-lg shadow-md border-2 border-primary-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-700 text-sm font-semibold mb-1">{t('memberAttendance.totalAttendance')}</p>
              <p className="text-3xl font-bold text-primary-800">{totalCheckIns}</p>
            </div>
            <div className="text-4xl opacity-70">📊</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-lg shadow-md border-2 border-purple-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-700 text-sm font-semibold mb-1">{t('memberAttendance.dailyAverage')}</p>
              <p className="text-3xl font-bold text-purple-800">
                {dailyStats.length > 0 ? Math.round(totalCheckIns / dailyStats.length) : 0}
              </p>
            </div>
            <div className="text-4xl opacity-70">📈</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg shadow-md border-2 border-green-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-700 text-sm font-semibold mb-1">{t('memberAttendance.uniqueMembers')}</p>
              <p className="text-3xl font-bold text-green-800">
                {new Set(checkIns.map(c => c.memberId)).size}
              </p>
            </div>
            <div className="text-4xl opacity-70">👥</div>
          </div>
        </div>
      </div>

      {/* Daily Attendance Chart */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
          <h2 className="text-xl font-bold text-white">📈 {t('memberAttendance.dailyAttendanceChart')}</h2>
          <p className="text-purple-100 text-sm mt-1">{t('memberAttendance.chartDescription')}</p>
        </div>
        <div className="p-6">
          {dailyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#f9fafb',
                    border: `2px solid ${PRIMARY_COLOR}`,
                    borderRadius: '8px'
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '14px', fontWeight: 'bold' }}
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
            <div className="text-center text-gray-500 py-12">
              <div className="text-5xl mb-4">📊</div>
              <p className="text-lg">{t('memberAttendance.noDataForPeriod')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Members */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4">
          <h2 className="text-xl font-bold text-white">🏆 {t('memberAttendance.topMembers')}</h2>
          <p className="text-amber-100 text-sm mt-1">{t('memberAttendance.topMembersDescription')}</p>
        </div>
        {topMembers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-right font-bold text-gray-700">{t('memberAttendance.rank')}</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-700">{t('memberAttendance.memberNumber')}</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-700">{t('memberAttendance.name')}</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-700">{t('memberAttendance.visits')}</th>
                </tr>
              </thead>
              <tbody>
                {topMembers.map((item, index) => (
                  <tr key={index} className="border-t hover:bg-amber-50 transition-colors">
                    <td className="px-6 py-4 text-2xl">
                      {index === 0 && '🥇'}
                      {index === 1 && '🥈'}
                      {index === 2 && '🥉'}
                      {index > 2 && <span className="text-gray-600 font-bold text-base">#{index + 1}</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-lg font-bold text-sm">
                        {item.member?.memberNumber || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-800">{item.member?.name || t('memberAttendance.unknown')}</td>
                    <td className="px-6 py-4">
                      <span className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-bold text-lg">
                        {item.visits}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            <div className="text-5xl mb-4">🏆</div>
            <p className="text-lg">{t('memberAttendance.noDataForPeriod')}</p>
          </div>
        )}
      </div>

      {/* سجل الحضور اليومي التفصيلي */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
          <h2 className="text-xl font-bold text-white">📋 {t('memberAttendance.dailyAttendanceLog')}</h2>
          <p className="text-green-100 text-sm mt-1">{t('memberAttendance.allRecordsForPeriod')}</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-gray-600">{t('memberAttendance.loading')}</p>
          </div>
        ) : checkIns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-right font-bold text-gray-700">#</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-700">{t('memberAttendance.memberNumber')}</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-700">{t('memberAttendance.name')}</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-700">{t('memberAttendance.date')}</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-700">{t('memberAttendance.checkInTime')}</th>
                </tr>
              </thead>
              <tbody>
                {checkIns.map((checkIn, index) => {
                  const checkInTime = new Date(checkIn.checkInTime)

                  return (
                    <tr key={checkIn.id} className="border-t hover:bg-green-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-600">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-lg font-bold text-sm">
                          {checkIn.member?.memberNumber || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-800">
                        {checkIn.member?.name || t('memberAttendance.unknown')}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {checkInTime.toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg font-bold text-sm">
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
            <p className="text-xl text-gray-600">{t('memberAttendance.noRecordsForPeriod')}</p>
          </div>
        )}
      </div>

    </div>
  )
}
