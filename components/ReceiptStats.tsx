'use client'

import { useEffect, useState } from 'react'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface StatsProps {
  receipts: any[]
}

interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
}

function StatCard({ label, value, subtitle, icon }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
          {subtitle && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</div>}
        </div>
        <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
    </div>
  )
}

export function ReceiptStats({ receipts }: StatsProps) {
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    byType: {
      Member: 0,
      PT: 0,
      DayUse: 0,
      InBody: 0
    }
  })

  useEffect(() => {
    if (!receipts || receipts.length === 0) return

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const newStats = {
      total: receipts.length,
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      totalRevenue: 0,
      todayRevenue: 0,
      byType: {
        Member: 0,
        PT: 0,
        DayUse: 0,
        InBody: 0
      }
    }

    receipts.forEach(receipt => {
      const receiptDate = new Date(receipt.createdAt)

      // Count by date
      if (receiptDate >= todayStart) {
        newStats.today++
        newStats.todayRevenue += receipt.amount
      }
      if (receiptDate >= weekStart) newStats.thisWeek++
      if (receiptDate >= monthStart) newStats.thisMonth++

      // Total revenue
      newStats.totalRevenue += receipt.amount

      // Count by type
      if (receipt.type in newStats.byType) {
        newStats.byType[receipt.type as keyof typeof newStats.byType]++
      }
    })

    setStats(newStats)
  }, [receipts])

  const iconChart = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18M7 14l3-3 4 4 5-6"/>
    </svg>
  )
  const iconCalendar = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <path d="M3 9h18M8 3v4M16 3v4"/>
    </svg>
  )
  const iconCalendarRange = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <path d="M3 11h18M8 3v4M16 3v4M8 15h2M14 15h2"/>
    </svg>
  )
  const iconMoney = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8v8m0 0v2m0-10V6"/>
      <circle cx="12" cy="12" r="9"/>
    </svg>
  )
  const iconUsers = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      <circle cx="9" cy="7" r="4"/>
    </svg>
  )
  const iconDumbbell = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6v12M3 9v6M18 6v12M21 9v6M6 12h12"/>
    </svg>
  )
  const iconClock = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v5l3 2"/>
    </svg>
  )
  const iconScale = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M6 6l2 12h8l2-12M9 10h6"/>
    </svg>
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="إجمالي الإيصالات"
        value={stats.total}
        subtitle="منذ البداية"
        icon={iconChart}
      />
      <StatCard
        label="إيصالات اليوم"
        value={stats.today}
        subtitle={`${stats.todayRevenue.toFixed(0)} ج.م`}
        icon={iconCalendar}
      />
      <StatCard
        label="هذا الأسبوع"
        value={stats.thisWeek}
        subtitle="آخر 7 أيام"
        icon={iconCalendarRange}
      />
      <StatCard
        label="إجمالي الإيرادات"
        value={stats.totalRevenue.toFixed(0)}
        subtitle="جنيه مصري"
        icon={iconMoney}
      />
      <StatCard
        label="اشتراكات العضوية"
        value={stats.byType.Member}
        subtitle={`${stats.total > 0 ? ((stats.byType.Member / stats.total) * 100).toFixed(0) : 0}% من الإجمالي`}
        icon={iconUsers}
      />
      <StatCard
        label="التدريب الشخصي"
        value={stats.byType.PT}
        subtitle={`${stats.total > 0 ? ((stats.byType.PT / stats.total) * 100).toFixed(0) : 0}% من الإجمالي`}
        icon={iconDumbbell}
      />
      <StatCard
        label="يوم استخدام"
        value={stats.byType.DayUse}
        subtitle={`${stats.total > 0 ? ((stats.byType.DayUse / stats.total) * 100).toFixed(0) : 0}% من الإجمالي`}
        icon={iconClock}
      />
      <StatCard
        label="فحص InBody"
        value={stats.byType.InBody}
        subtitle={`${stats.total > 0 ? ((stats.byType.InBody / stats.total) * 100).toFixed(0) : 0}% من الإجمالي`}
        icon={iconScale}
      />
    </div>
  )
}
