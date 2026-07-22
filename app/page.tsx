// app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useLanguage } from '../contexts/LanguageContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'
import TrendIndicator from '@/components/TrendIndicator'
import { DashboardSkeleton } from '@/components/LoadingSkeleton'
import DashboardSmartSearch from '@/components/DashboardSmartSearch'
import ConfirmDialog from '@/components/ConfirmDialog'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const DashboardCharts = dynamic(() => import('@/components/DashboardCharts'), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="skeleton-shimmer h-[450px] rounded-2xl" />
      <div className="skeleton-shimmer h-[450px] rounded-2xl" />
    </div>
  ),
})

const IconUsers = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
  </svg>
)
const IconBolt = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
  </svg>
)
const IconUser = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </svg>
)
const IconDumbbell = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9v6m12-6v6M3 10.5v3m18-3v3M9 6v12m6-12v12" />
  </svg>
)
const IconReceipt = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 3h6m2 6.75H7A2.25 2.25 0 0 1 4.75 19.5V4.5A2.25 2.25 0 0 1 7 2.25h10A2.25 2.25 0 0 1 19.25 4.5v15A2.25 2.25 0 0 1 17 21.75Z" />
  </svg>
)
const IconChartBar = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>
)
const IconAlert = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
  </svg>
)
const IconPhone = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
  </svg>
)
const IconPencil = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
  </svg>
)
const IconCalendar = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
  </svg>
)
const IconClock = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)
const IconCheck = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)
const IconInbox = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" />
  </svg>
)
const IconMoney = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V12Zm-12 0h.008v.008H6V12Z" />
  </svg>
)
const IconGlobe = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
  </svg>
)
const IconTicket = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
  </svg>
)

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

  //  مكالمات السيلز النهاردة (للسيلز والأدمن)
  const [calls, setCalls] = useState({
    today: 0,
    notInterested: 0,
    noAnswer: 0,
  })

  //  تارجت المكالمات اليومي + تقدّم الفريق
  const [salesCalls, setSalesCalls] = useState<any>(null)
  const [editingTarget, setEditingTarget] = useState(false)
  const [targetInput, setTargetInput] = useState('')

  const saveCallTarget = async () => {
    const t = Math.max(0, parseInt(targetInput) || 0)
    try {
      const res = await fetch('/api/dashboard/sales-calls', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: t }),
      })
      if (res.ok) {
        const d = await res.json()
        setSalesCalls((prev: any) => (prev ? { ...prev, target: d.target } : prev))
        setEditingTarget(false)
      }
    } catch { /* ignore */ }
  }

  const [revenueChartData, setRevenueChartData] = useState<any[]>([])
  const [attendanceChartData, setAttendanceChartData] = useState<any[]>([])
  const [todayClasses, setTodayClasses] = useState<any[]>([])
  const [classBookings, setClassBookings] = useState<any[]>([])

  const [websiteVisits, setWebsiteVisits] = useState<{ branch: number; gym: number; configured: boolean; branchName?: string; gymName?: string }>({
    branch: 0,
    gym: 0,
    configured: false
  })
  const [confirmState, setConfirmState] = useState<{ open: boolean; message: string; title?: string; onConfirm: () => void }>({ open: false, message: '', onConfirm: () => {} })

  useEffect(() => {
    checkAuth()
    fetchTodayClasses()
    fetchClassBookings()
    fetchWebsiteVisits()
    autoBirthdayCheck()
  }, [])

  const fetchWebsiteVisits = async () => {
    try {
      const res = await fetch('/api/dashboard/website-visits')
      if (!res.ok) return
      const data = await res.json()
      if (data?.configured) {
        setWebsiteVisits({
          branch: data.branchVisits || 0,
          gym: data.gymVisits || 0,
          configured: true,
          branchName: data.branchName,
          gymName: data.gymName
        })
      }
    } catch {
      // silent
    }
  }

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

        if (data.user.role === 'COACH') {
          router.push('/coach')
          return
        }

        fetchStats()
      } else {
        router.push('/login')
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const autoBirthdayCheck = async () => {
    try {
      await fetch('/api/auto-birthday-check')
    } catch (error) {
      // Silent failure
    }
  }

  const fetchStats = async () => {
    try {
      // كل الأرقام من endpoint تجميعي واحد بدل تحميل جداول كاملة،
      // وباقي الطلبات بالتوازي بدل التتابع
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayDateFormatted = yesterday.toISOString().split('T')[0]
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - 6)
      const todayFormatted = new Date().toISOString().split('T')[0]

      const [summaryRes, statsRes, yesterdayCheckInsRes, historyRes, salesCallsRes] = await Promise.all([
        fetch('/api/dashboard/summary'),
        fetch('/api/member-checkin/stats'),
        fetch(`/api/member-checkin/history?startDate=${yesterdayDateFormatted}&endDate=${yesterdayDateFormatted}`),
        fetch(`/api/member-checkin/history?startDate=${weekStart.toISOString().split('T')[0]}&endDate=${todayFormatted}`),
        fetch('/api/dashboard/sales-calls'),
      ])

      //  تارجت المكالمات — بيظهر بس لو enabled (سيلز/أدمن)
      try {
        const sc = salesCallsRes.ok ? await salesCallsRes.json() : null
        setSalesCalls(sc?.enabled ? sc : null)
      } catch { setSalesCalls(null) }

      const summary = summaryRes.ok ? await summaryRes.json() : null
      const statsData = statsRes.ok ? await statsRes.json() : {}
      const yesterdayCheckInsData = yesterdayCheckInsRes.ok ? await yesterdayCheckInsRes.json() : {}
      const historyData = historyRes.ok ? await historyRes.json() : {}

      if (!summary) return

      const yesterdayCheckIns = yesterdayCheckInsData.stats?.dailyStats?.[0]?.count || 0

      setStats({
        members: summary.members,
        activePT: summary.activePT,
        todayRevenue: summary.todayRevenue,
        totalReceipts: summary.totalReceipts,
        todayCheckIns: statsData.stats?.totalCheckIns || 0,
      })

      setPreviousStats({
        members: summary.members,
        activePT: summary.activePT,
        todayRevenue: summary.yesterdayRevenue,
        totalReceipts: summary.yesterdayReceiptsCount,
        todayCheckIns: yesterdayCheckIns,
      })

      setAlerts({
        expiringToday: summary.expiringToday,
        expiringIn3Days: summary.expiringIn3Days,
        pendingFollowups: summary.pendingFollowups,
      })

      setCalls({
        today: summary.callsToday ?? 0,
        notInterested: summary.callsNotInterestedToday ?? 0,
        noAnswer: summary.callsNoAnswerToday ?? 0,
      })

      // رسم الإيرادات: السيرفر بيرجع الأيام اللي فيها إيصالات — بنكمّل الأيام الفاضية بصفر
      const revenueByDay = new Map<string, { revenue: number; count: number }>(
        (summary.revenueLast14Days || []).map((row: any) => [row.day, { revenue: row.revenue, count: row.count }])
      )
      const last14Days = []
      for (let i = 13; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
        const dayKey = date.toLocaleDateString('en-CA') // YYYY-MM-DD بتوقيت محلي — نفس مفتاح السيرفر
        const dayData = revenueByDay.get(dayKey) || { revenue: 0, count: 0 }

        last14Days.push({
          date: dateStr,
          fullDate: date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US'),
          revenue: dayData.revenue,
          count: dayData.count
        })
      }
      setRevenueChartData(last14Days)

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

  const fetchTodayClasses = async () => {
    try {
      const res = await fetch('/api/group-classes/schedule?today=true')
      if (res.ok) {
        const data = await res.json()
        setTodayClasses(Array.isArray(data) ? data : [])
      }
    } catch {
      // non-fatal
    }
  }

  const fetchClassBookings = async () => {
    try {
      const res = await fetch('/api/class-bookings/today')
      if (res.ok) {
        const data = await res.json()
        setClassBookings(Array.isArray(data.bookings) ? data.bookings : [])
      }
    } catch (error) {
      console.error('Error fetching class bookings:', error)
      setClassBookings([])
    }
  }

  const handleLogout = async () => {
    setConfirmState({
      open: true,
      message: t('dashboard.confirmLogout'),
      title: t('auth.logout'),
      onConfirm: async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        window.location.href = '/login'
      },
    })
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  type StatCardProps = {
    label: string
    value: React.ReactNode
    sub?: string
    icon: React.ReactNode
    trend?: React.ReactNode
  }
  const StatCard = ({ label, value, sub, icon, trend }: StatCardProps) => (
    <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</div>
          <div className="flex items-center gap-2 mt-1">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
            {trend}
          </div>
          {sub && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</div>}
        </div>
        <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
    </div>
  )

  return (
    <div className="container mx-auto p-6 relative">
      <div className="relative z-10">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            {t('dashboard.welcome', { name: user?.name })}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('dashboard.welcomeMessage')}</p>
        </div>

        {/*  Smart Search — رقم/اسم/تليفون عبر الأعضاء، الزوار، والاستخدام اليومي */}
        <DashboardSmartSearch />

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
              <IconBolt className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('dashboard.quickActions')}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link
              href="/members?action=new"
              className="bg-gray-50 dark:bg-gray-900/40 hover:bg-primary-50 dark:hover:bg-primary-900/30 text-gray-900 dark:text-gray-100 p-4 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 transition-colors duration-200 flex flex-col items-center gap-2"
            >
              <IconUser className="w-7 h-7 text-primary-700 dark:text-primary-400" />
              <span className="font-bold text-sm text-center">{t('dashboard.newMember')}</span>
            </Link>

            <Link
              href="/pt?action=new"
              className="bg-gray-50 dark:bg-gray-900/40 hover:bg-primary-50 dark:hover:bg-primary-900/30 text-gray-900 dark:text-gray-100 p-4 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 transition-colors duration-200 flex flex-col items-center gap-2"
            >
              <IconDumbbell className="w-7 h-7 text-primary-700 dark:text-primary-400" />
              <span className="font-bold text-sm text-center">{t('dashboard.newPT')}</span>
            </Link>

            <Link
              href="/receipts"
              className="bg-gray-50 dark:bg-gray-900/40 hover:bg-primary-50 dark:hover:bg-primary-900/30 text-gray-900 dark:text-gray-100 p-4 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 transition-colors duration-200 flex flex-col items-center gap-2"
            >
              <IconReceipt className="w-7 h-7 text-primary-700 dark:text-primary-400" />
              <span className="font-bold text-sm text-center">{t('dashboard.receiptsLink')}</span>
            </Link>

            <Link
              href="/member-attendance"
              className="bg-gray-50 dark:bg-gray-900/40 hover:bg-primary-50 dark:hover:bg-primary-900/30 text-gray-900 dark:text-gray-100 p-4 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 transition-colors duration-200 flex flex-col items-center gap-2"
            >
              <IconChartBar className="w-7 h-7 text-primary-700 dark:text-primary-400" />
              <span className="font-bold text-sm text-center">{t('dashboard.attendanceLink')}</span>
            </Link>
          </div>
        </div>

        {/* Smart Alerts */}
        {(alerts.expiringToday > 0 || alerts.expiringIn3Days > 0 || alerts.pendingFollowups > 0) && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-amber-200 dark:ring-amber-900/50 p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                <IconAlert className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('dashboard.todayAlerts')}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {alerts.expiringToday > 0 && (
                <Link
                  href="/members?filter=expired"
                  className="bg-gray-50 dark:bg-gray-900/40 ring-1 ring-red-200 dark:ring-red-900/50 p-4 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 flex items-center justify-center">
                      <IconAlert className="w-5 h-5" />
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
                  className="bg-gray-50 dark:bg-gray-900/40 ring-1 ring-yellow-200 dark:ring-yellow-900/50 p-4 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 flex items-center justify-center">
                      <IconClock className="w-5 h-5" />
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
                  className="bg-gray-50 dark:bg-gray-900/40 ring-1 ring-blue-200 dark:ring-blue-900/50 p-4 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                      <IconPhone className="w-5 h-5" />
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

        {/* Today Classes */}
        {todayClasses.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-center">
                <IconCalendar className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('homepageClassBookings.todayClasses')}</h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">{todayClasses.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {todayClasses
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((cls) => (
                  <div
                    key={cls.id}
                    className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 ring-1 ring-gray-200 dark:ring-gray-700 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <IconUsers className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 dark:text-gray-100 truncate flex items-center gap-2">
                        <span className="truncate">{cls.className}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          cls.gender === 'male'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                            : cls.gender === 'female'
                            ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        }`}>
                          {cls.gender === 'male'
                            ? t('settingsPage.groupClassSchedules.genderMale')
                            : cls.gender === 'female'
                            ? t('settingsPage.groupClassSchedules.genderFemale')
                            : t('settingsPage.groupClassSchedules.genderMixed')}
                        </span>
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <IconUser className="w-3.5 h-3.5" />
                        <span className="truncate">{cls.coachName}</span>
                      </p>
                      <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                        <IconClock className="w-3.5 h-3.5" />
                        <span>{cls.startTime} · {cls.duration} {t('homepageClassBookings.minutes')}</span>
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Class Bookings */}
        {(todayClasses.length > 0 || classBookings.length > 0) && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                <IconTicket className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('homepageClassBookings.todayClassBookings')}</h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">{classBookings.length}</span>
            </div>

            {classBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <IconInbox className="w-12 h-12 text-gray-400" />
                <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('homepageClassBookings.noBookingsYet')}</h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {classBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 ring-1 ring-gray-200 dark:ring-gray-700"
                  >
                    <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <IconCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 dark:text-gray-100 truncate">
                          {booking.member?.name || t('homepageClassBookings.deletedMember')}
                        </p>
                        <p className="text-sm text-emerald-700 dark:text-emerald-300 font-semibold">
                          #{booking.member?.memberNumber || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <IconPhone className="w-3 h-3" />
                          <span>{booking.member?.phone || '-'}</span>
                        </p>
                      </div>
                    </div>
                    {booking.class && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 ring-1 ring-gray-200 dark:ring-gray-700">
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-1">
                          <IconDumbbell className="w-4 h-4 text-purple-700 dark:text-purple-400" />
                          <span>{booking.class.className}</span>
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                          <IconUser className="w-3 h-3" />
                          <span>{booking.class.coachName}</span>
                        </p>
                        <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold mt-1 flex items-center gap-1">
                          <IconClock className="w-3 h-3" />
                          <span>{booking.class.startTime}</span>
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8 items-stretch">
          <StatCard
            label={t('dashboard.totalMembers')}
            value={stats.members}
            icon={<IconUsers className="w-5 h-5" />}
            trend={<TrendIndicator value={stats.members} previousValue={previousStats.members} showLabel={false} />}
          />
          <StatCard
            label={t('dashboard.activePTSessions')}
            value={stats.activePT}
            icon={<IconDumbbell className="w-5 h-5" />}
            trend={<TrendIndicator value={stats.activePT} previousValue={previousStats.activePT} showLabel={false} />}
          />
          <StatCard
            label={t('dashboard.todayRevenue')}
            value={stats.todayRevenue.toFixed(0)}
            sub={t('dashboard.egp')}
            icon={<IconMoney className="w-5 h-5" />}
            trend={<TrendIndicator value={stats.todayRevenue} previousValue={previousStats.todayRevenue} format="currency" showLabel={false} />}
          />
          <StatCard
            label={t('dashboard.totalReceipts')}
            value={stats.totalReceipts}
            icon={<IconReceipt className="w-5 h-5" />}
            trend={<TrendIndicator value={stats.totalReceipts} previousValue={previousStats.totalReceipts} showLabel={false} />}
          />
          <StatCard
            label={t('dashboard.todayAttendance')}
            value={stats.todayCheckIns}
            sub={t('dashboard.memberAttendedToday')}
            icon={<IconChartBar className="w-5 h-5" />}
            trend={<TrendIndicator value={stats.todayCheckIns} previousValue={previousStats.todayCheckIns} showLabel={false} />}
          />
          {websiteVisits.configured && (
            <StatCard
              label={locale === 'ar' ? 'زوار الموقع' : 'Website Visitors'}
              value={websiteVisits.gym}
              sub={locale === 'ar' ? 'كل الفروع - آخر 30 يوم' : 'All branches - last 30 days'}
              icon={<IconGlobe className="w-5 h-5" />}
            />
          )}
        </div>

        {/*  مكالمات السيلز النهاردة — كارت واحد مدمج (للسيلز والأدمن/الأونر) */}
        {(user?.isSales || user?.role === 'OWNER' || user?.role === 'ADMIN') && (
          <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="inline-flex w-8 h-8 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400">
                  <IconPhone className="w-4 h-4" />
                </span>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {locale === 'ar' ? 'مكالمات السيلز اليوم' : "Today's Sales Calls"}
                </h2>
              </div>
              {/* الأدمن يعدّل التارجت */}
              {salesCalls?.isAdmin && (
                editingTarget ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                      className="w-20 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                      autoFocus
                    />
                    <button onClick={saveCallTarget} className="px-3 py-1.5 rounded-lg bg-primary-600 text-primary-contrast text-sm font-bold hover:bg-primary-700">
                      {locale === 'ar' ? 'حفظ' : 'Save'}
                    </button>
                    <button onClick={() => setEditingTarget(false)} className="px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-bold">
                      {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setTargetInput(String(salesCalls.target || 0)); setEditingTarget(true) }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <IconPencil className="w-4 h-4" />
                    {locale === 'ar' ? `التارجت: ${salesCalls.target}/يوم` : `Target: ${salesCalls.target}/day`}
                  </button>
                )
              )}
            </div>

            {/* 3 أرقام مصغّرة */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/40 ring-1 ring-gray-100 dark:ring-gray-700 p-3 text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{calls.today}</div>
                <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mt-0.5">{locale === 'ar' ? 'إجمالي المكالمات' : 'Total calls'}</div>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 ring-1 ring-red-100 dark:ring-red-900/40 p-3 text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">{calls.notInterested}</div>
                <div className="text-[11px] font-semibold text-red-500/90 dark:text-red-400/80 mt-0.5">{locale === 'ar' ? 'مش مهتم' : 'Not interested'}</div>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/40 ring-1 ring-gray-100 dark:ring-gray-700 p-3 text-center">
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-300 tabular-nums">{calls.noAnswer}</div>
                <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mt-0.5">{locale === 'ar' ? 'لم يرد' : 'No answer'}</div>
              </div>
            </div>

            {/* التقدّم مقابل التارجت */}
            {salesCalls && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                {/* موظف السيلز — تقدّمه هو */}
                {salesCalls.isSales && (() => {
                  const done = salesCalls.myCallsToday || 0
                  const target = salesCalls.target || 0
                  const remaining = Math.max(0, target - done)
                  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0
                  const reached = target > 0 && done >= target
                  return (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-bold text-gray-700 dark:text-gray-200">
                          {reached
                            ? (locale === 'ar' ? '🎉 خلّصت تارجت النهاردة!' : '🎉 Target reached!')
                            : (locale === 'ar' ? `المطلوب اليومي · باقي ${remaining} مكالمة` : `Daily target · ${remaining} left`)}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-gray-100 tabular-nums">{done} / {target}</span>
                      </div>
                      <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-3 rounded-full transition-all ${reached ? 'bg-emerald-500' : 'bg-primary-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })()}

                {/* الأدمن — تقدّم كل الفريق */}
                {salesCalls.isAdmin && (
                  <>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">
                      {locale === 'ar' ? 'تقدّم الفريق مقابل التارجت' : 'Team vs target'}
                    </p>
                    {salesCalls.perRep && salesCalls.perRep.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 items-stretch">
                        {salesCalls.perRep.map((rep: any) => {
                          const target = salesCalls.target || 0
                          const pctRaw = target > 0 ? (rep.calls / target) * 100 : 0
                          const pct = Math.min(100, pctRaw)
                          const pctLabel = Math.round(pctRaw)
                          const reached = target > 0 && rep.calls >= target
                          const remaining = Math.max(0, target - rep.calls)
                          //  r=15.9155 → المحيط = 100 فالـ dasharray بيبقى نسبة مباشرة
                          const ringColor = reached ? 'text-emerald-500' : 'text-indigo-500 dark:text-indigo-400'
                          return (
                            <div
                              key={rep.staffId}
                              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-gray-50/70 dark:bg-gray-700/30 ring-1 ring-gray-100 dark:ring-gray-700 hover:ring-indigo-200 dark:hover:ring-indigo-800 hover:shadow-sm transition"
                            >
                              <div className="relative w-16 h-16">
                                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                  <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth="3"
                                    className="stroke-gray-200/80 dark:stroke-gray-600/60" />
                                  <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth="3" strokeLinecap="round"
                                    className={`${ringColor} transition-all duration-700 ease-out`}
                                    stroke="currentColor"
                                    strokeDasharray={`${pct} 100`} />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <span className="text-xl font-black text-gray-900 dark:text-gray-100 tabular-nums leading-none">{rep.calls}</span>
                                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tabular-nums mt-0.5">/ {target}</span>
                                </div>
                                {reached && (
                                  <span className="absolute -top-0.5 -end-0.5 w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] flex items-center justify-center shadow ring-2 ring-white dark:ring-gray-800">✓</span>
                                )}
                              </div>
                              <div className="text-center min-w-0 w-full">
                                <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{rep.name}</p>
                                <p className={`text-[11px] font-semibold mt-0.5 ${reached ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                  {reached
                                    ? (locale === 'ar' ? 'اكتمل 🎉' : 'Done 🎉')
                                    : (locale === 'ar' ? `باقي ${remaining} · ${pctLabel}%` : `${remaining} left · ${pctLabel}%`)}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'مفيش موظفين سيلز مسجّلين' : 'No sales reps configured'}</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <DashboardCharts
          revenueChartData={revenueChartData}
          attendanceChartData={attendanceChartData}
        />
      </div>

      <ConfirmDialog
        isOpen={confirmState.open}
        title={confirmState.title || ''}
        message={confirmState.message}
        type="warning"
        onConfirm={() => {
          confirmState.onConfirm()
          setConfirmState((s) => ({ ...s, open: false }))
        }}
        onCancel={() => setConfirmState((s) => ({ ...s, open: false }))}
      />
    </div>
  )
}
