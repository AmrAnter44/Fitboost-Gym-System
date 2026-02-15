// app/page.tsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useLanguage } from '../contexts/LanguageContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'
import { PRIMARY_COLOR, THEME_COLORS } from '@/lib/theme/colors'
import TrendIndicator from '@/components/TrendIndicator'
import { DashboardSkeleton } from '@/components/LoadingSkeleton'

export default function HomePage() {
  const router = useRouter()
  const { t, locale } = useLanguage()
  const { settings } = useServiceSettings()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  
  const [stats, setStats] = useState({
    members: 0,
    activePT: 0,
    todayRevenue: 0,
    totalReceipts: 0,
    todayCheckIns: 0,
  })

  const [previousStats, setPreviousStats] = useState({
    members: 0,
    activePT: 0,
    todayRevenue: 0,
    totalReceipts: 0,
    todayCheckIns: 0,
  })

  const [alerts, setAlerts] = useState({
    expiringToday: 0,
    expiringIn3Days: 0,
    pendingFollowups: 0,
  })

  const [revenueChartData, setRevenueChartData] = useState<any[]>([])
  const [attendanceChartData, setAttendanceChartData] = useState<any[]>([])
  const [receiptsData, setReceiptsData] = useState<any[]>([])

  useEffect(() => {
    checkAuth()
  }, [])

  // إعادة تحميل البيانات عند تغيير اللغة
  useEffect(() => {
    if (user) {
      fetchStats()
    }
  }, [locale])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)

        // إذا كان المستخدم مدرب، يوجه لصفحة PT Commission
        if (data.user.role === 'COACH') {
          router.push('/pt/commission')
          return
        }

        fetchStats()
      } else {
        // لو مش مسجل دخول، يروح على صفحة اللوجن
        router.push('/login')
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      // جلب الأعضاء
      const membersRes = await fetch('/api/members')
      const members = await membersRes.json()

      // جلب جلسات PT
      const ptRes = await fetch('/api/pt')
      const ptSessions = await ptRes.json()

      // جلب الإيصالات
      const receiptsRes = await fetch('/api/receipts')
      const receipts = await receiptsRes.json()

      // جلب إحصائيات الحضور
      const statsRes = await fetch('/api/member-checkin/stats')
      const statsData = await statsRes.json()

      // حساب إيرادات اليوم
      const today = new Date().toDateString()
      const todayReceipts = receipts.filter((r: any) => {
        return new Date(r.createdAt).toDateString() === today
      })
      const todayRevenue = todayReceipts.reduce((sum: number, r: any) => sum + r.amount, 0)

      // حساب بيانات الأمس للمقارنة
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toDateString()
      const yesterdayReceipts = receipts.filter((r: any) => {
        return new Date(r.createdAt).toDateString() === yesterdayStr
      })
      const yesterdayRevenue = yesterdayReceipts.reduce((sum: number, r: any) => sum + r.amount, 0)

      // جلب حضور الأمس
      const yesterdayDateFormatted = yesterday.toISOString().split('T')[0]
      const yesterdayCheckInsRes = await fetch(`/api/member-checkin/history?startDate=${yesterdayDateFormatted}&endDate=${yesterdayDateFormatted}`)
      const yesterdayCheckInsData = await yesterdayCheckInsRes.json()
      const yesterdayCheckIns = yesterdayCheckInsData.stats?.dailyStats?.[0]?.count || 0

      // حساب PT النشطة
      const activePT = ptSessions.filter((pt: any) => pt.sessionsRemaining > 0).length

      // حساب التنبيهات
      const todayDate = new Date()
      const in3DaysDate = new Date()
      in3DaysDate.setDate(in3DaysDate.getDate() + 3)

      const expiringToday = Array.isArray(members) ? members.filter((m: any) => {
        if (!m.expiryDate) return false
        const expiry = new Date(m.expiryDate)
        return expiry.toDateString() === todayDate.toDateString()
      }).length : 0

      const expiringIn3Days = Array.isArray(members) ? members.filter((m: any) => {
        if (!m.expiryDate) return false
        const expiry = new Date(m.expiryDate)
        return expiry > todayDate && expiry <= in3DaysDate
      }).length : 0

      // جلب المتابعات المعلقة
      let pendingFollowups = 0
      try {
        const followupsRes = await fetch('/api/followups')
        const followups = await followupsRes.json()
        pendingFollowups = Array.isArray(followups) ? followups.filter((f: any) => !f.contacted).length : 0
      } catch (error) {
        console.error('Error fetching followups:', error)
      }

      setStats({
        members: Array.isArray(members) ? members.length : 0,
        activePT,
        todayRevenue,
        totalReceipts: receipts.length,
        todayCheckIns: statsData.stats?.totalCheckIns || 0,
      })

      setPreviousStats({
        members: Array.isArray(members) ? members.length : 0, // نفس العدد لأن الأعضاء لا يتغيرون يومياً بكثرة
        activePT,
        todayRevenue: yesterdayRevenue,
        totalReceipts: yesterdayReceipts.length,
        todayCheckIns: yesterdayCheckIns,
      })

      setAlerts({
        expiringToday,
        expiringIn3Days,
        pendingFollowups,
      })

      // 📊 تجهيز بيانات جراف الإيرادات (آخر 14 يوم)
      const last14Days = []
      for (let i = 13; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
        const dateKey = date.toDateString()

        const dayReceipts = receipts.filter((r: any) => {
          return new Date(r.createdAt).toDateString() === dateKey
        })
        const dayRevenue = dayReceipts.reduce((sum: number, r: any) => sum + r.amount, 0)
        const dayCount = dayReceipts.length

        last14Days.push({
          date: dateStr,
          fullDate: date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US'),
          revenue: dayRevenue,
          count: dayCount
        })
      }
      setRevenueChartData(last14Days)
      setReceiptsData(receipts)

      // 📊 تجهيز بيانات جراف الحضور (آخر 7 أيام)
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 6)
      const endDate = new Date()

      const historyRes = await fetch(`/api/member-checkin/history?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`)
      const historyData = await historyRes.json()

      if (historyData.stats?.dailyStats) {
        const formattedData = historyData.stats.dailyStats.map((item: any) => ({
          date: new Date(item.date).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          }),
          fullDate: new Date(item.date).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US'),
          attendance: item.count
        }))
        setAttendanceChartData(formattedData)
      }

    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const handleLogout = async () => {
    if (!confirm(t('dashboard.confirmLogout'))) return

    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  // مكون Tooltip مخصص للإيرادات
  const CustomRevenueTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl border-2 border-primary-500 dark:border-primary-400">
          <p className="font-bold text-gray-800 dark:text-gray-100 mb-2">{payload[0].payload.fullDate}</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-primary-500 dark:bg-primary-400 rounded-full"></div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
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

  // مكون Tooltip مخصص للحضور
  const CustomAttendanceTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl border-2 border-green-500 dark:border-green-400">
          <p className="font-bold text-gray-800 dark:text-gray-100 mb-2">{payload[0].payload.fullDate}</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 dark:bg-green-400 rounded-full"></div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t('dashboard.attendance')}: <span className="font-bold text-green-600 dark:text-green-400">{payload[0].value}</span> {t('members.members')}
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  // لو لسه بيتحقق من الـ Authentication
  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="container mx-auto p-6 relative">
      {/* المحتوى الأساسي */}
      <div className="relative z-10">
        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-2 dark:text-white">{t('dashboard.welcome', { name: user?.name })} 👋</h1>
          <p className="text-gray-600 dark:text-gray-300">{t('dashboard.welcomeMessage')}</p>
        </div>

        {/* 🚀 لوحة الإجراءات السريعة */}
        <div className="bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/30 dark:to-primary-900/30 border-2 border-primary-200 dark:border-primary-700 rounded-2xl p-6 mb-6 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🚀</span>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('dashboard.quickActions')}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link
              href="/members?action=new"
              className="bg-white dark:bg-gray-800 hover:bg-gradient-to-br hover:from-blue-500 hover:to-blue-600 text-gray-800 dark:text-gray-100 hover:text-white p-4 rounded-xl shadow-md hover:shadow-xl transition-all transform hover:scale-105 flex flex-col items-center gap-2 group border-2 border-blue-200 dark:border-blue-700"
            >
              <span className="text-3xl">👤</span>
              <span className="font-bold text-sm text-center">{t('dashboard.newMember')}</span>
            </Link>

            <Link
              href="/pt?action=new"
              className="bg-white dark:bg-gray-800 hover:bg-gradient-to-br hover:from-primary-500 hover:to-primary-600 text-gray-800 dark:text-gray-100 hover:text-white p-4 rounded-xl shadow-md hover:shadow-xl transition-all transform hover:scale-105 flex flex-col items-center gap-2 group border-2 border-primary-200 dark:border-primary-700"
            >
              <span className="text-3xl">💪</span>
              <span className="font-bold text-sm text-center">{t('dashboard.newPT')}</span>
            </Link>

            <Link
              href="/receipts"
              className="bg-white dark:bg-gray-800 hover:bg-gradient-to-br hover:from-green-500 hover:to-green-600 text-gray-800 dark:text-gray-100 hover:text-white p-4 rounded-xl shadow-md hover:shadow-xl transition-all transform hover:scale-105 flex flex-col items-center gap-2 group border-2 border-green-200 dark:border-green-700"
            >
              <span className="text-3xl">🧾</span>
              <span className="font-bold text-sm text-center">{t('dashboard.receiptsLink')}</span>
            </Link>

            <Link
              href="/member-checkin"
              className="bg-white dark:bg-gray-800 hover:bg-gradient-to-br hover:from-cyan-500 hover:to-cyan-600 text-gray-800 dark:text-gray-100 hover:text-white p-4 rounded-xl shadow-md hover:shadow-xl transition-all transform hover:scale-105 flex flex-col items-center gap-2 group border-2 border-cyan-200 dark:border-cyan-700"
            >
              <span className="text-3xl">📊</span>
              <span className="font-bold text-sm text-center">{t('dashboard.attendanceLink')}</span>
            </Link>
          </div>
        </div>

        {/* ⚠️ التنبيهات الذكية */}
        {(alerts.expiringToday > 0 || alerts.expiringIn3Days > 0 || alerts.pendingFollowups > 0) && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-6 mb-6 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">⚠️</span>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('dashboard.todayAlerts')}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {alerts.expiringToday > 0 && (
                <Link
                  href="/members?filter=expired"
                  className="bg-white dark:bg-gray-800 border-l-4 border-red-500 p-4 rounded-lg hover:shadow-lg transition-shadow cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full group-hover:bg-red-200 dark:group-hover:bg-red-800/50 transition">
                      <span className="text-2xl">🔴</span>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">{alerts.expiringToday}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{t('dashboard.expiringToday')}</p>
                    </div>
                  </div>
                </Link>
              )}

              {alerts.expiringIn3Days > 0 && (
                <Link
                  href="/members?filter=expiring-soon"
                  className="bg-white dark:bg-gray-800 border-l-4 border-yellow-500 p-4 rounded-lg hover:shadow-lg transition-shadow cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-full group-hover:bg-yellow-200 dark:group-hover:bg-yellow-800/50 transition">
                      <span className="text-2xl">🟡</span>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{alerts.expiringIn3Days}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{t('dashboard.expiringIn3Days')}</p>
                    </div>
                  </div>
                </Link>
              )}

              {alerts.pendingFollowups > 0 && (
                <Link
                  href="/followups"
                  className="bg-white dark:bg-gray-800 border-l-4 border-blue-500 p-4 rounded-lg hover:shadow-lg transition-shadow cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition">
                      <span className="text-2xl">📞</span>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{alerts.pendingFollowups}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{t('dashboard.pendingFollowups')}</p>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* إجمالي الأعضاء */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow border-2 border-blue-200 dark:border-blue-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-700 dark:text-blue-300 text-sm font-semibold">{t('dashboard.totalMembers')}</p>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-4xl font-bold text-blue-800 dark:text-blue-100">{stats.members}</p>
                <TrendIndicator value={stats.members} previousValue={previousStats.members} showLabel={false} />
              </div>
            </div>
            <div className="bg-blue-100 dark:bg-blue-800/50 p-4 rounded-full">
              <div className="text-4xl">👥</div>
            </div>
          </div>
        </div>

        {/* جلسات PT النشطة */}
        <div className="bg-gradient-to-br from-primary-50 to-pink-50 dark:from-primary-900/30 dark:to-pink-900/30 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow border-2 border-primary-200 dark:border-primary-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-700 dark:text-primary-300 text-sm font-semibold">{t('dashboard.activePTSessions')}</p>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-4xl font-bold text-primary-800 dark:text-primary-100">{stats.activePT}</p>
                <TrendIndicator value={stats.activePT} previousValue={previousStats.activePT} showLabel={false} />
              </div>
            </div>
            <div className="bg-primary-100 dark:bg-primary-800/50 p-4 rounded-full">
              <div className="text-4xl">💪</div>
            </div>
          </div>
        </div>

        {/* إيرادات اليوم */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow border-2 border-green-300 dark:border-green-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-700 dark:text-green-300 text-sm font-semibold">{t('dashboard.todayRevenue')}</p>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-4xl font-bold text-green-800 dark:text-green-100">{stats.todayRevenue.toFixed(0)}</p>
                <TrendIndicator value={stats.todayRevenue} previousValue={previousStats.todayRevenue} format="currency" showLabel={false} />
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">{t('dashboard.egp')}</p>
            </div>
            <div className="bg-green-100 dark:bg-green-800/50 p-4 rounded-full">
              <div className="text-4xl">💰</div>
            </div>
          </div>
        </div>

        {/* إجمالي الإيصالات */}
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow border-2 border-orange-200 dark:border-orange-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-700 dark:text-orange-300 text-sm font-semibold">{t('dashboard.totalReceipts')}</p>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-4xl font-bold text-orange-800 dark:text-orange-100">{stats.totalReceipts}</p>
                <TrendIndicator value={stats.totalReceipts} previousValue={previousStats.totalReceipts} showLabel={false} />
              </div>
            </div>
            <div className="bg-orange-100 dark:bg-orange-800/50 p-4 rounded-full">
              <div className="text-4xl">🧾</div>
            </div>
          </div>
        </div>

        {/* حضور اليوم */}
        <div className="bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-900/30 dark:to-teal-900/30 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow border-2 border-cyan-300 dark:border-cyan-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-cyan-700 dark:text-cyan-300 text-sm font-semibold">{t('dashboard.todayAttendance')}</p>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-4xl font-bold text-cyan-800 dark:text-cyan-100">{stats.todayCheckIns}</p>
                <TrendIndicator value={stats.todayCheckIns} previousValue={previousStats.todayCheckIns} showLabel={false} />
              </div>
              <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">{t('dashboard.memberAttendedToday')}</p>
            </div>
            <div className="bg-cyan-100 dark:bg-cyan-800/50 p-4 rounded-full">
              <div className="text-4xl">📊</div>
            </div>
          </div>
        </div>
      </div>

      {/* 📊 الجرافات */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* جراف الإيرادات */}
        <div className="bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/30 dark:to-primary-900/30 p-6 rounded-2xl shadow-xl border-2 border-primary-200 dark:border-primary-700 hover:shadow-2xl transition-shadow duration-300">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <span className="text-3xl">💰</span>
              <span>{t('dashboard.revenueLast14Days')}</span>
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{t('dashboard.revenueChartSubtitle')}</p>
          </div>
          {revenueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={revenueChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PRIMARY_COLOR} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={PRIMARY_COLOR} stopOpacity={0}/>
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
                  stroke={PRIMARY_COLOR}
                  strokeWidth={4}
                  dot={{ fill: PRIMARY_COLOR, strokeWidth: 2, r: 6, stroke: '#fff' }}
                  activeDot={{ r: 8, stroke: '#fff', strokeWidth: 3 }}
                  fill="url(#revenueGradient)"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[350px]">
              <div className="text-6xl mb-4 animate-pulse">📊</div>
              <p className="text-gray-400 dark:text-gray-500 font-semibold">{t('dashboard.loadingData')}</p>
            </div>
          )}
        </div>

        {/* جراف حضور الأعضاء */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 p-6 rounded-2xl shadow-xl border-2 border-green-200 dark:border-green-700 hover:shadow-2xl transition-shadow duration-300">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <span className="text-3xl">📊</span>
              <span>{t('dashboard.attendanceLast7Days')}</span>
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{t('dashboard.attendanceChartSubtitle')}</p>
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
            <div className="flex flex-col items-center justify-center h-[350px]">
              <div className="text-6xl mb-4 animate-pulse">📊</div>
              <p className="text-gray-400 dark:text-gray-500 font-semibold">{t('dashboard.loadingData')}</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>

  )
}