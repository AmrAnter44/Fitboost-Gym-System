'use client'

import { useState, useMemo, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { formatDateYMD } from '../lib/dateFormatter'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Member {
  id: string
  memberNumber: string
  name: string
  phone: string
  subscriptionPrice: number
  startDate?: string
  expiryDate?: string
}

interface MembersAnalyticsProps {
  members: Member[]
}

// دالة حساب اسم الباقة
const getPackageName = (startDate: string | undefined, expiryDate: string | undefined, locale: string = 'ar'): string => {
  if (!startDate || !expiryDate) return '-'

  const start = new Date(startDate)
  const expiry = new Date(expiryDate)
  const diffTime = expiry.getTime() - start.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return '-'

  const months = Math.round(diffDays / 30)

  if (locale === 'ar') {
    if (diffDays >= 330 && diffDays <= 395) return 'سنة'
    else if (diffDays >= 165 && diffDays <= 195) return '6 شهور'
    else if (diffDays >= 85 && diffDays <= 95) return '3 شهور'
    else if (diffDays >= 55 && diffDays <= 65) return 'شهرين'
    else if (diffDays >= 25 && diffDays <= 35) return 'شهر'
    else if (diffDays >= 10 && diffDays <= 17) return 'أسبوعين'
    else if (diffDays >= 5 && diffDays <= 9) return 'أسبوع'
    else if (diffDays === 1) return 'يوم'
    else if (months > 0) return `${months} ${months === 1 ? 'شهر' : months === 2 ? 'شهرين' : 'شهور'}`
    else return `${diffDays} ${diffDays === 1 ? 'يوم' : diffDays === 2 ? 'يومين' : 'أيام'}`
  } else {
    if (diffDays >= 330 && diffDays <= 395) return 'Year'
    else if (diffDays >= 165 && diffDays <= 195) return '6 Months'
    else if (diffDays >= 85 && diffDays <= 95) return '3 Months'
    else if (diffDays >= 55 && diffDays <= 65) return '2 Months'
    else if (diffDays >= 25 && diffDays <= 35) return 'Month'
    else if (diffDays >= 10 && diffDays <= 17) return '2 Weeks'
    else if (diffDays >= 5 && diffDays <= 9) return 'Week'
    else if (diffDays === 1) return 'Day'
    else if (months > 0) return `${months} ${months === 1 ? 'Month' : 'Months'}`
    else return `${diffDays} ${diffDays === 1 ? 'Day' : 'Days'}`
  }
}

export default function MembersAnalytics({ members }: MembersAnalyticsProps) {
  const { t, locale, direction } = useLanguage()
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [averageExpenses, setAverageExpenses] = useState(0)
  const [loadingExpenses, setLoadingExpenses] = useState(true)

  // جلب متوسط المصروفات
  useEffect(() => {
    const fetchAverageExpenses = async () => {
      try {
        const response = await fetch('/api/analytics/expenses-average')
        if (response.ok) {
          const data = await response.json()
          setAverageExpenses(data.averageMonthly || 0)
        }
      } catch (error) {
        console.error('Error fetching average expenses:', error)
      } finally {
        setLoadingExpenses(false)
      }
    }
    fetchAverageExpenses()
  }, [])

  // إنشاء قائمة الأشهر (الشهر الحالي + 11 شهر قادم)
  const months = useMemo(() => {
    const result = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const label = date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'long'
      })
      result.push({ value, label })
    }
    return result
  }, [locale])

  // تحليل الأعضاء الذين سينتهي اشتراكهم في الشهر المختار
  const analytics = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const expiringMembers = members.filter(member => {
      if (!member.expiryDate) return false
      const expiryDate = new Date(member.expiryDate)
      return expiryDate.getFullYear() === year && expiryDate.getMonth() + 1 === month
    })

    // حساب عدد الأعضاء النشطين (الذين لم ينته اشتراكهم)
    const activeMembers = members.filter(member => {
      if (!member.expiryDate) return false
      const expiryDate = new Date(member.expiryDate)
      return expiryDate >= new Date()
    })

    const totalExpectedRevenue = expiringMembers.reduce((sum, member) => sum + member.subscriptionPrice, 0)
    const netExpectedProfit = totalExpectedRevenue - averageExpenses

    // تكلفة العضو الواحد شهرياً = متوسط المصروفات / عدد الأعضاء النشطين
    const costPerMember = activeMembers.length > 0 ? averageExpenses / activeMembers.length : 0

    // تجميع الأعضاء حسب الباقة
    const packageBreakdown = expiringMembers.reduce((acc, member) => {
      const packageName = getPackageName(member.startDate, member.expiryDate, locale)
      if (!acc[packageName]) {
        acc[packageName] = { count: 0, totalRevenue: 0 }
      }
      acc[packageName].count++
      acc[packageName].totalRevenue += member.subscriptionPrice
      return acc
    }, {} as Record<string, { count: number; totalRevenue: number }>)

    // ترتيب الباقات حسب العدد (من الأكثر إلى الأقل)
    const sortedPackages = Object.entries(packageBreakdown)
      .map(([packageName, data]) => ({ packageName, ...data }))
      .sort((a, b) => b.count - a.count)

    return {
      expiringMembers,
      totalExpectedRevenue,
      netExpectedProfit,
      costPerMember,
      activeMembersCount: activeMembers.length,
      count: expiringMembers.length,
      sortedPackages
    }
  }, [members, selectedMonth, averageExpenses])

  const iconCalendar = (
    <svg {...stroke} className="w-6 h-6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <path d="M3 9h18M8 3v4M16 3v4"/>
    </svg>
  )
  const iconUsers = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      <circle cx="9" cy="7" r="4"/>
    </svg>
  )
  const iconMoney = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8v8m0 0v2m0-10V6"/>
      <circle cx="12" cy="12" r="9"/>
    </svg>
  )
  const iconExpense = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12H4M14 6l-6 6 6 6"/>
    </svg>
  )
  const iconTrendUp = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l6-6 4 4 8-8M14 7h7v7"/>
    </svg>
  )
  const iconUser = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 14a4 4 0 1 0-8 0m12 7a8 8 0 1 0-16 0"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
  const iconChart = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18M7 14l3-3 4 4 5-6"/>
    </svg>
  )
  const iconPackage = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 9.4 7.55 4.24M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <path d="m3.27 6.96 8.73 5.05 8.73-5.05M12 22.08V12"/>
    </svg>
  )
  const iconList = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
    </svg>
  )
  const iconSparkle = (
    <svg {...stroke} className="w-12 h-12" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.8L20 10l-5.8 1.9L12 18l-2.2-6.1L4 10l6.1-1.2L12 3z"/>
    </svg>
  )

  const trophyColors = ['bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    'bg-gray-100 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300',
    'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300']

  return (
    <div className="space-y-6" dir={direction}>
      {/* اختيار الشهر */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
              {iconCalendar}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {locale === 'ar' ? 'اختر الشهر' : 'Select Month'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {locale === 'ar' ? 'لعرض تحليل الأعضاء المنتهي اشتراكهم' : 'To view expiring members analysis'}
              </p>
            </div>
          </div>
          <div className="flex-1">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 font-medium cursor-pointer"
            >
              {months.map(month => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* عدد الأعضاء */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {locale === 'ar' ? 'الأعضاء المنتهي اشتراكهم' : 'Expiring Members'}
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{analytics.count}</div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {locale === 'ar' ? 'عضو سينتهي اشتراكه في هذا الشهر' : 'members expiring this month'}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
              {iconUsers}
            </div>
          </div>
        </div>

        {/* الإيرادات المتوقعة */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {locale === 'ar' ? 'الإيرادات المتوقعة' : 'Expected Revenue'}
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {analytics.totalExpectedRevenue.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {locale === 'ar' ? 'ج.م إذا جدد الجميع' : 'EGP if all renew'}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center shrink-0">
              {iconMoney}
            </div>
          </div>
        </div>

        {/* متوسط المصروفات */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {locale === 'ar' ? 'متوسط المصروفات' : 'Average Expenses'}
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {loadingExpenses ? '...' : averageExpenses.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {locale === 'ar' ? 'ج.م متوسط شهري (آخر 6 شهور)' : 'EGP monthly avg (last 6 months)'}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 flex items-center justify-center shrink-0">
              {iconExpense}
            </div>
          </div>
        </div>

        {/* صافي الربح المتوقع */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {locale === 'ar' ? 'صافي الربح المتوقع' : 'Net Expected Profit'}
              </div>
              <div className={`mt-1 text-2xl font-bold ${analytics.netExpectedProfit >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-red-600 dark:text-red-400'}`}>
                {loadingExpenses ? '...' : analytics.netExpectedProfit.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {locale === 'ar' ? 'ج.م (الإيرادات - المصروفات)' : 'EGP (Revenue - Expenses)'}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 flex items-center justify-center shrink-0">
              {iconTrendUp}
            </div>
          </div>
        </div>

        {/* تكلفة العضو الواحد شهرياً */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {locale === 'ar' ? 'تكلفة العضو شهرياً' : 'Cost Per Member'}
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {loadingExpenses ? '...' : Math.round(analytics.costPerMember).toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {locale === 'ar'
                  ? `ج.م (${analytics.activeMembersCount} عضو نشط)`
                  : `EGP (${analytics.activeMembersCount} active members)`}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 flex items-center justify-center shrink-0">
              {iconUser}
            </div>
          </div>
        </div>
      </div>

      {/* توزيع الأعضاء حسب الباقة */}
      {analytics.count > 0 && analytics.sortedPackages.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
              {iconChart}
            </span>
            <span>{locale === 'ar' ? 'توزيع الأعضاء حسب الباقة' : 'Members Distribution by Package'}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {analytics.sortedPackages.map((pkg, index) => (
              <div
                key={pkg.packageName}
                className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 ring-1 ring-gray-200 dark:ring-gray-700"
              >
                <div className="text-center">
                  <div className={`w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center ${index < 3 ? trophyColors[index] : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'}`}>
                    {iconPackage}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {pkg.packageName}
                  </p>
                  <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {pkg.count}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {locale === 'ar' ? 'عضو' : 'member'}
                  </p>
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {pkg.totalRevenue.toLocaleString()} {locale === 'ar' ? 'ج.م' : 'EGP'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* قائمة الأعضاء */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
              {iconList}
            </span>
            <span>{locale === 'ar' ? 'تفاصيل الأعضاء' : 'Members Details'}</span>
          </h3>
        </div>

        {analytics.count === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-gray-400 dark:text-gray-500">
              {iconSparkle}
            </div>
            <p className="mt-3 text-base text-gray-600 dark:text-gray-300 font-bold">
              {locale === 'ar' ? 'لا يوجد أعضاء سينتهي اشتراكهم في هذا الشهر' : 'No members expiring this month'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="px-4 py-3 text-start text-xs uppercase font-bold text-gray-700 dark:text-gray-300">
                    {locale === 'ar' ? 'رقم العضوية' : 'Member #'}
                  </th>
                  <th className="px-4 py-3 text-start text-xs uppercase font-bold text-gray-700 dark:text-gray-300">
                    {locale === 'ar' ? 'الاسم' : 'Name'}
                  </th>
                  <th className="px-4 py-3 text-start text-xs uppercase font-bold text-gray-700 dark:text-gray-300">
                    {locale === 'ar' ? 'الهاتف' : 'Phone'}
                  </th>
                  <th className="px-4 py-3 text-start text-xs uppercase font-bold text-gray-700 dark:text-gray-300">
                    {locale === 'ar' ? 'الباقة' : 'Package'}
                  </th>
                  <th className="px-4 py-3 text-start text-xs uppercase font-bold text-gray-700 dark:text-gray-300">
                    {locale === 'ar' ? 'السعر' : 'Price'}
                  </th>
                  <th className="px-4 py-3 text-start text-xs uppercase font-bold text-gray-700 dark:text-gray-300">
                    {locale === 'ar' ? 'تاريخ الانتهاء' : 'Expiry Date'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {analytics.expiringMembers.map(member => (
                  <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      #{member.memberNumber}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {member.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300" dir="ltr">
                      {member.phone}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                        {getPackageName(member.startDate, member.expiryDate, locale)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-green-600 dark:text-green-400">
                      {member.subscriptionPrice.toLocaleString()} {locale === 'ar' ? 'ج.م' : 'EGP'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {formatDateYMD(member.expiryDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
