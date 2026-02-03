// app/page.tsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useLanguage } from '../contexts/LanguageContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'
import { PRIMARY_COLOR, THEME_COLORS } from '@/lib/theme/colors'

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

      // حساب PT النشطة
      const activePT = ptSessions.filter((pt: any) => pt.sessionsRemaining > 0).length

      setStats({
        members: Array.isArray(members) ? members.length : 0,
        activePT,
        todayRevenue,
        totalReceipts: receipts.length,
        todayCheckIns: statsData.stats?.totalCheckIns || 0,
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
        <div className="bg-white p-4 rounded-lg shadow-xl border-2 border-primary-500">
          <p className="font-bold text-gray-800 mb-2">{payload[0].payload.fullDate}</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
            <p className="text-sm text-gray-600">
              {t('dashboard.revenue')}: <span className="font-bold text-primary-600">{payload[0].value.toLocaleString()}</span> {t('members.egp')}
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-1">
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
        <div className="bg-white p-4 rounded-lg shadow-xl border-2 border-green-500">
          <p className="font-bold text-gray-800 mb-2">{payload[0].payload.fullDate}</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <p className="text-sm text-gray-600">
              {t('dashboard.attendance')}: <span className="font-bold text-green-600">{payload[0].value}</span> {t('members.members')}
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  // لو لسه بيتحقق من الـ Authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">⏳</div>
          <p className="text-xl text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 relative">
      {/* Logo في الخلفية بشفافية 50% */}
      <div className="fixed left-0 top-1/2 -translate-y-1/2 pointer-events-none z-0" style={{ left: '-10%' }}>
        <img
          src="/assets/icon.png"
          alt="Background Logo"
          className="w-96 h-96 md:w-[600px] md:h-[600px] opacity-50 select-none object-contain"
          style={{ opacity: 0.5 }}
        />
      </div>

      {/* المحتوى الأساسي */}
      <div className="relative z-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t('dashboard.welcome', { name: user?.name })} 👋</h1>
          <p className="text-gray-600">{t('dashboard.welcomeMessage')}</p>
        </div>

        {/* Quick Action Buttons for Services */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">{t('dashboard.quickActions')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* PT Button - Always visible */}
            <Link href="/pt">
              <div className="bg-gradient-to-br from-purple-50 to-indigo-100 hover:from-purple-100 hover:to-indigo-200 p-6 rounded-xl shadow-lg border-2 border-purple-300 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl">
                <div className="flex flex-col items-center text-center">
                  <div className="text-5xl mb-3">💪</div>
                  <h3 className="text-lg font-bold text-gray-800 mb-1">{t('nav.pt')}</h3>
                  <p className="text-sm text-gray-600">{t('dashboard.managePTPackages')}</p>
                </div>
              </div>
            </Link>

            {/* Nutrition Button - Conditional */}
            {settings.nutritionEnabled && (
              <Link href="/nutrition">
                <div className="bg-gradient-to-br from-lime-50 to-green-100 hover:from-lime-100 hover:to-green-200 p-6 rounded-xl shadow-lg border-2 border-lime-400 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <div className="flex flex-col items-center text-center">
                    <div className="text-5xl mb-3">🥗</div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">{t('nav.nutrition')}</h3>
                    <p className="text-sm text-gray-600">{t('dashboard.manageNutritionPackages')}</p>
                  </div>
                </div>
              </Link>
            )}

            {/* Physiotherapy Button - Conditional */}
            {settings.physiotherapyEnabled && (
              <Link href="/physiotherapy">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-100 hover:from-blue-100 hover:to-cyan-200 p-6 rounded-xl shadow-lg border-2 border-blue-400 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <div className="flex flex-col items-center text-center">
                    <div className="text-5xl mb-3">🏥</div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">{t('nav.physiotherapy')}</h3>
                    <p className="text-sm text-gray-600">{t('dashboard.managePhysioPackages')}</p>
                  </div>
                </div>
              </Link>
            )}

            {/* Group Classes Button - Conditional */}
            {settings.groupClassEnabled && (
              <Link href="/group-classes">
                <div className="bg-gradient-to-br from-fuchsia-50 to-pink-100 hover:from-fuchsia-100 hover:to-pink-200 p-6 rounded-xl shadow-lg border-2 border-fuchsia-400 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <div className="flex flex-col items-center text-center">
                    <div className="text-5xl mb-3">👥</div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">{t('nav.groupClasses')}</h3>
                    <p className="text-sm text-gray-600">{t('dashboard.manageGroupClassPackages')}</p>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">{t('dashboard.totalMembers')}</p>
              <p className="text-3xl font-bold">{stats.members}</p>
            </div>
            <div className="text-4xl">👥</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">{t('dashboard.activePTSessions')}</p>
              <p className="text-3xl font-bold">{stats.activePT}</p>
            </div>
            <div className="text-4xl">💪</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">{t('dashboard.todayRevenue')}</p>
              <p className="text-3xl font-bold">{stats.todayRevenue.toFixed(0)}</p>
            </div>
            <div className="text-4xl">💰</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">{t('dashboard.totalReceipts')}</p>
              <p className="text-3xl font-bold">{stats.totalReceipts}</p>
            </div>
            <div className="text-4xl">🧾</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary-50 to-cyan-50 p-6 rounded-lg shadow-md border-2 border-primary-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-700 text-sm font-semibold">{t('dashboard.todayAttendance')}</p>
              <p className="text-3xl font-bold text-primary-800">{stats.todayCheckIns}</p>
            </div>
            <div className="text-4xl">📊</div>
          </div>
        </div>
      </div>

      {/* 📊 الجرافات */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* جراف الإيرادات */}
        <div className="bg-gradient-to-br from-primary-50 to-indigo-50 p-6 rounded-2xl shadow-xl border-2 border-primary-200 hover:shadow-2xl transition-shadow duration-300">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-3xl">💰</span>
              <span>{t('dashboard.revenueLast14Days')}</span>
            </h2>
            <p className="text-sm text-gray-600 mt-1">{t('dashboard.revenueChartSubtitle')}</p>
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
              <p className="text-gray-400 font-semibold">{t('dashboard.loadingData')}</p>
            </div>
          )}
        </div>

        {/* جراف حضور الأعضاء */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-2xl shadow-xl border-2 border-green-200 hover:shadow-2xl transition-shadow duration-300">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-3xl">📊</span>
              <span>{t('dashboard.attendanceLast7Days')}</span>
            </h2>
            <p className="text-sm text-gray-600 mt-1">{t('dashboard.attendanceChartSubtitle')}</p>
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
              <p className="text-gray-400 font-semibold">{t('dashboard.loadingData')}</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>

  )
}