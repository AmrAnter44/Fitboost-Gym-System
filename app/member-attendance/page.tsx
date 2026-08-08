'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useLanguage } from '../../contexts/LanguageContext'
import { PRIMARY_COLOR, THEME_COLORS } from '@/lib/theme/colors'
import LoadingSkeleton from '../../components/LoadingSkeleton'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

export default function MemberAttendancePage() {
  const { t, direction } = useLanguage()
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return date.toISOString().split('T')[0]
  })

  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const [loading, setLoading] = useState(false)
  const [dailyStats, setDailyStats] = useState<any[]>([])
  const [topMembers, setTopMembers] = useState<any[]>([])
  const [totalCheckIns, setTotalCheckIns] = useState(0)
  const [uniqueMembers, setUniqueMembers] = useState(0)
  const [checkIns, setCheckIns] = useState<any[]>([])

  useEffect(() => {
    fetchAttendanceData()
  }, [])

  const fetchAttendanceData = async () => {
    setLoading(true)
    try {
      const historyRes = await fetch(`/api/member-checkin/history?startDate=${startDate}&endDate=${endDate}`)
      const historyData = await historyRes.json()

      if (historyData.stats) {
        setDailyStats(historyData.stats.dailyStats || [])
        setTopMembers(historyData.stats.topMembers || [])
        setTotalCheckIns(historyData.stats.totalCheckIns || 0)
        setUniqueMembers(historyData.stats.uniqueMembers || 0)
      }

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
    <div className="container mx-auto p-4 sm:p-6" dir={direction}>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 sm:gap-4 mb-2">
          <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
            <svg {...stroke} className="w-6 h-6" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('memberAttendance.title')}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('memberAttendance.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 mb-6">
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <span>{t('memberAttendance.selectTimePeriod')}</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('memberAttendance.dateFrom')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('memberAttendance.dateTo')}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>
          <div>
            <button
              onClick={handleApplyFilter}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
            >
              {loading ? (
                <>
                  <svg {...stroke} className="w-4 h-4 animate-spin" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06"/></svg>
                  <span>{t('memberAttendance.loading')}</span>
                </>
              ) : (
                <>
                  <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  <span>{t('memberAttendance.applyFilter')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          {
            label: t('memberAttendance.totalAttendance'),
            value: totalCheckIns,
            tone: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
            icon: (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            )
          },
          {
            label: t('memberAttendance.dailyAverage'),
            value: dailyStats.length > 0 ? Math.round(totalCheckIns / dailyStats.length) : 0,
            tone: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
            icon: (
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
            )
          },
          {
            label: t('memberAttendance.uniqueMembers'),
            // من السيرفر (SQL DISTINCT) — القايمة المحلية بقت محدودة بآخر 500 سجل
            value: uniqueMembers,
            tone: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
            icon: (
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            )
          }
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
            <div className={`w-10 h-10 rounded-lg ${stat.tone} flex items-center justify-center mb-3`}>
              <svg {...stroke} className="w-5 h-5" aria-hidden="true">{stat.icon}</svg>
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{stat.label}</div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Daily Attendance Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
            </svg>
            <span>{t('memberAttendance.dailyAttendanceChart')}</span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('memberAttendance.chartDescription')}</p>
        </div>
        <div className="p-5">
          {dailyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} stroke="#9ca3af" className="dark:opacity-70" />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} stroke="#9ca3af" className="dark:opacity-70" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgb(249 250 251)',
                    border: `1px solid ${PRIMARY_COLOR}`,
                    borderRadius: '8px',
                    color: '#1f2937'
                  }}
                  wrapperClassName="dark:[&>div]:!bg-gray-800 dark:[&>div]:!text-white dark:[&>div]:!border-primary-500"
                  cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }}
                />
                <Legend wrapperStyle={{ fontSize: '14px', fontWeight: 'bold', color: '#374151' }} className="dark:text-gray-200" />
                <Bar dataKey="count" fill={PRIMARY_COLOR} name={t('memberAttendance.attendanceCount')} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg {...stroke} className="w-12 h-12 text-gray-400" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
              <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('memberAttendance.noDataForPeriod')}</h3>
            </div>
          )}
        </div>
      </div>

      {/* Top Members */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg {...stroke} className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
            </svg>
            <span>{t('memberAttendance.topMembers')}</span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('memberAttendance.topMembersDescription')}</p>
        </div>
        {topMembers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-start font-bold">{t('memberAttendance.rank')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('memberAttendance.memberNumber')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('memberAttendance.name')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('memberAttendance.visits')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {topMembers.map((item, index) => {
                  const rankBadge = index === 0
                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                    : index === 1
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                      : index === 2
                        ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  return (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${rankBadge}`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                          {item.member?.memberNumber || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <MemberCell member={item.member} unknownLabel={t('memberAttendance.unknown')} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                          {item.visits}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg {...stroke} className="w-12 h-12 text-gray-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172" />
            </svg>
            <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('memberAttendance.noDataForPeriod')}</h3>
          </div>
        )}
      </div>

      {/* Detailed attendance log */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg {...stroke} className="w-5 h-5 text-green-600 dark:text-green-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
            </svg>
            <span>{t('memberAttendance.dailyAttendanceLog')}</span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('memberAttendance.allRecordsForPeriod')}</p>
        </div>

        {loading ? (
          <div className="p-5">
            <LoadingSkeleton type="table" count={10} />
          </div>
        ) : checkIns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-start font-bold">#</th>
                  <th className="px-4 py-3 text-start font-bold">{t('memberAttendance.memberNumber')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('memberAttendance.name')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('memberAttendance.date')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('memberAttendance.checkInTime')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {checkIns.map((checkIn, index) => {
                  const checkInTime = new Date(checkIn.checkInTime)

                  return (
                    <tr key={checkIn.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-700 dark:text-gray-300">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                          {checkIn.member?.memberNumber || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <MemberCell member={checkIn.member} unknownLabel={t('memberAttendance.unknown')} />
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {checkInTime.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                          {checkInTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg {...stroke} className="w-12 h-12 text-gray-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 0 1-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 0 0 1.183 1.981l6.478 3.488m8.839 2.51-4.66-2.51m0 0-1.023-.55a2.25 2.25 0 0 0-2.134 0l-1.022.55m0 0-4.661 2.51m16.5 1.615a2.25 2.25 0 0 1-1.183 1.981l-6.478 3.488a2.25 2.25 0 0 1-2.134 0L3.432 19.67A2.25 2.25 0 0 1 2.25 17.69V6.31a2.25 2.25 0 0 1 1.183-1.981l6.478-3.488a2.25 2.25 0 0 1 2.134 0l6.478 3.488a2.25 2.25 0 0 1 1.183 1.981v11.38Z" />
            </svg>
            <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('memberAttendance.noRecordsForPeriod')}</h3>
          </div>
        )}
      </div>

    </div>
  )
}

//  خلية العضو — تعرض الصورة والاسم، وتوديك على بروفايل العضو لو الـ id متاح
function MemberCell({ member, unknownLabel }: { member: any; unknownLabel: string }) {
  const inner = (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700 bg-gray-100 dark:bg-gray-700 flex-shrink-0">
        {member?.profileImage ? (
          <img src={member.profileImage} alt={member?.name || ''} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
        )}
      </div>
      <span className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 group-hover:underline transition-colors">
        {member?.name || unknownLabel}
      </span>
    </div>
  )
  return member?.id ? (
    <Link href={`/members/${member.id}`} className="group inline-block" title="فتح ملف العضو">{inner}</Link>
  ) : inner
}
