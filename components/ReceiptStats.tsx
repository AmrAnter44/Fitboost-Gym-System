'use client'

import { useEffect, useState } from 'react'

interface StatsProps {
  receipts: any[]
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Receipts */}
      <div className="bg-white p-4 rounded-lg shadow-md border-r-4 border-primary-500">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">إجمالي الإيصالات</h3>
          <span className="text-2xl">📊</span>
        </div>
        <p className="text-3xl font-bold text-primary-600">{stats.total}</p>
        <p className="text-xs text-gray-500 mt-1">منذ البداية</p>
      </div>

      {/* Today */}
      <div className="bg-white p-4 rounded-lg shadow-md border-r-4 border-green-500">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">إيصالات اليوم</h3>
          <span className="text-2xl">📅</span>
        </div>
        <p className="text-3xl font-bold text-green-600">{stats.today}</p>
        <p className="text-xs text-gray-500 mt-1">{stats.todayRevenue.toFixed(0)} ج.م</p>
      </div>

      {/* This Week */}
      <div className="bg-white p-4 rounded-lg shadow-md border-r-4 border-purple-500">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">هذا الأسبوع</h3>
          <span className="text-2xl">📆</span>
        </div>
        <p className="text-3xl font-bold text-purple-600">{stats.thisWeek}</p>
        <p className="text-xs text-gray-500 mt-1">آخر 7 أيام</p>
      </div>

      {/* Total Revenue */}
      <div className="bg-white p-4 rounded-lg shadow-md border-r-4 border-orange-500">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">إجمالي الإيرادات</h3>
          <span className="text-2xl">💰</span>
        </div>
        <p className="text-3xl font-bold text-orange-600">{stats.totalRevenue.toFixed(0)}</p>
        <p className="text-xs text-gray-500 mt-1">جنيه مصري</p>
      </div>

      {/* By Type - Members */}
      <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white p-4 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">اشتراكات العضوية</h3>
          <span className="text-2xl">👥</span>
        </div>
        <p className="text-3xl font-bold">{stats.byType.Member}</p>
        <p className="text-xs opacity-80 mt-1">
          {stats.total > 0 ? ((stats.byType.Member / stats.total) * 100).toFixed(0) : 0}% من الإجمالي
        </p>
      </div>

      {/* By Type - PT */}
      <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">التدريب الشخصي</h3>
          <span className="text-2xl">💪</span>
        </div>
        <p className="text-3xl font-bold">{stats.byType.PT}</p>
        <p className="text-xs opacity-80 mt-1">
          {stats.total > 0 ? ((stats.byType.PT / stats.total) * 100).toFixed(0) : 0}% من الإجمالي
        </p>
      </div>

      {/* By Type - Day Use */}
      <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">يوم استخدام</h3>
          <span className="text-2xl">📊</span>
        </div>
        <p className="text-3xl font-bold">{stats.byType.DayUse}</p>
        <p className="text-xs opacity-80 mt-1">
          {stats.total > 0 ? ((stats.byType.DayUse / stats.total) * 100).toFixed(0) : 0}% من الإجمالي
        </p>
      </div>

      {/* By Type - InBody */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">فحص InBody</h3>
          <span className="text-2xl">⚖️</span>
        </div>
        <p className="text-3xl font-bold">{stats.byType.InBody}</p>
        <p className="text-xs opacity-80 mt-1">
          {stats.total > 0 ? ((stats.byType.InBody / stats.total) * 100).toFixed(0) : 0}% من الإجمالي
        </p>
      </div>
    </div>
  )
}