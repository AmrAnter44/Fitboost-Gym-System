'use client'

import { useState, useMemo, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { formatDateYMD } from '../lib/dateFormatter'

interface Member {
  id: string
  memberNumber: number
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

  return (
    <div className="space-y-6" dir={direction}>
      {/* اختيار الشهر */}
      <div className="bg-gradient-to-br from-primary-50 via-primary-100 to-primary-50 dark:from-primary-900/30 dark:via-primary-900/30 dark:to-primary-900/30 rounded-2xl shadow-xl p-8 border-2 border-primary-200 dark:border-primary-700">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="text-5xl">📅</div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                {locale === 'ar' ? 'اختر الشهر' : 'Select Month'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {locale === 'ar' ? 'لعرض تحليل الأعضاء المنتهي اشتراكهم' : 'To view expiring members analysis'}
              </p>
            </div>
          </div>
          <div className="flex-1">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-6 py-4 text-lg font-bold border-2 border-primary-300 dark:border-primary-600 bg-white dark:bg-gray-800 dark:text-white rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-200 dark:focus:ring-primary-900 transition-all cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 shadow-md"
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {/* عدد الأعضاء */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl shadow-lg p-6 border-2 border-blue-200 dark:border-blue-700">
          <div className="flex items-center justify-between mb-4">
            <div className="text-4xl">👥</div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                {locale === 'ar' ? 'الأعضاء المنتهي اشتراكهم' : 'Expiring Members'}
              </p>
              <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                {analytics.count}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {locale === 'ar' ? 'عضو سينتهي اشتراكه في هذا الشهر' : 'members expiring this month'}
          </p>
        </div>

        {/* الإيرادات المتوقعة */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl shadow-lg p-6 border-2 border-green-200 dark:border-green-700">
          <div className="flex items-center justify-between mb-4">
            <div className="text-4xl">💰</div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                {locale === 'ar' ? 'الإيرادات المتوقعة' : 'Expected Revenue'}
              </p>
              <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                {analytics.totalExpectedRevenue.toLocaleString()}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {locale === 'ar' ? 'ج.م إذا جدد الجميع' : 'EGP if all renew'}
          </p>
        </div>

        {/* متوسط المصروفات */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl shadow-lg p-6 border-2 border-orange-200 dark:border-orange-700">
          <div className="flex items-center justify-between mb-4">
            <div className="text-4xl">💸</div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                {locale === 'ar' ? 'متوسط المصروفات' : 'Average Expenses'}
              </p>
              <p className="text-4xl font-bold text-orange-600 dark:text-orange-400">
                {loadingExpenses ? '...' : averageExpenses.toLocaleString()}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {locale === 'ar' ? 'ج.م متوسط شهري (آخر 6 شهور)' : 'EGP monthly avg (last 6 months)'}
          </p>
        </div>

        {/* صافي الربح المتوقع */}
        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20 rounded-xl shadow-lg p-6 border-2 border-cyan-200 dark:border-cyan-700">
          <div className="flex items-center justify-between mb-4">
            <div className="text-4xl">📈</div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                {locale === 'ar' ? 'صافي الربح المتوقع' : 'Net Expected Profit'}
              </p>
              <p className={`text-4xl font-bold ${analytics.netExpectedProfit >= 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-red-600 dark:text-red-400'}`}>
                {loadingExpenses ? '...' : analytics.netExpectedProfit.toLocaleString()}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {locale === 'ar' ? 'ج.م (الإيرادات - المصروفات)' : 'EGP (Revenue - Expenses)'}
          </p>
        </div>

        {/* تكلفة العضو الواحد شهرياً */}
        <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 rounded-xl shadow-lg p-6 border-2 border-pink-200 dark:border-pink-700">
          <div className="flex items-center justify-between mb-4">
            <div className="text-4xl">👤</div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                {locale === 'ar' ? 'تكلفة العضو شهرياً' : 'Cost Per Member'}
              </p>
              <p className="text-4xl font-bold text-pink-600 dark:text-pink-400">
                {loadingExpenses ? '...' : Math.round(analytics.costPerMember).toLocaleString()}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {locale === 'ar'
              ? `ج.م (${analytics.activeMembersCount} عضو نشط)`
              : `EGP (${analytics.activeMembersCount} active members)`}
          </p>
        </div>
      </div>

      {/* توزيع الأعضاء حسب الباقة */}
      {analytics.count > 0 && analytics.sortedPackages.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            📊 {locale === 'ar' ? 'توزيع الأعضاء حسب الباقة' : 'Members Distribution by Package'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {analytics.sortedPackages.map((pkg, index) => (
              <div
                key={pkg.packageName}
                className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-lg p-4 border-2 border-primary-200 dark:border-primary-700"
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📦'}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                    {pkg.packageName}
                  </p>
                  <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                    {pkg.count}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {locale === 'ar' ? 'عضو' : 'member'}
                  </p>
                  <div className="mt-2 pt-2 border-t border-primary-200 dark:border-primary-700">
                    <p className="text-xs text-gray-600 dark:text-gray-300">
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            📋 {locale === 'ar' ? 'تفاصيل الأعضاء' : 'Members Details'}
          </h3>
        </div>

        {analytics.count === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              {locale === 'ar' ? 'لا يوجد أعضاء سينتهي اشتراكهم في هذا الشهر' : 'No members expiring this month'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-200 uppercase">
                    {locale === 'ar' ? 'رقم العضوية' : 'Member #'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-200 uppercase">
                    {locale === 'ar' ? 'الاسم' : 'Name'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-200 uppercase">
                    {locale === 'ar' ? 'الهاتف' : 'Phone'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-200 uppercase">
                    {locale === 'ar' ? 'الباقة' : 'Package'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-200 uppercase">
                    {locale === 'ar' ? 'السعر' : 'Price'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-200 uppercase">
                    {locale === 'ar' ? 'تاريخ الانتهاء' : 'Expiry Date'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {analytics.expiringMembers.map(member => (
                  <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      #{member.memberNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {member.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300" dir="ltr">
                      {member.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium">
                        {getPackageName(member.startDate, member.expiryDate, locale)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600 dark:text-green-400">
                      {member.subscriptionPrice.toLocaleString()} {locale === 'ar' ? 'ج.م' : 'EGP'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
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
