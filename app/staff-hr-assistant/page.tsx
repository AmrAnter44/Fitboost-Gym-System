'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useDarkMode } from '@/contexts/DarkModeContext'
import { useToast } from '@/contexts/ToastContext'
// import { usePermissions } from '@/hooks/usePermissions'
import { getStatusColors } from '@/lib/hrCalculations'
import Link from 'next/link'
import { LoadingScreen } from '@/components/Spinner'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface UnderperformanceDay {
  date: string
  actualHours: number
  requiredHours: number
  shortfall: number
}

interface RevenueBreakdown {
  pt: number
  nutrition: number
  physiotherapy: number
  other: number
  total: number
}

interface AdvanceItem {
  id: string
  amount: number
  description: string
  isPaid: boolean
  createdAt: string
  notes: string | null
}

interface AdvancesData {
  total: number
  paid: number
  unpaid: number
  count: number
  items: AdvanceItem[]
}

interface LateArrival {
  date: string
  checkInTime: string
  shiftStart: string
  lateMinutes: number
}

interface EarlyDeparture {
  date: string
  checkOutTime: string
  shiftEnd: string
  earlyMinutes: number
}

interface AttendanceDetail {
  date: string
  checkIn: string
  checkOut: string | null
  duration: number | null
  status: string
  lateMinutes: number
  earlyMinutes: number
}

interface StaffAnalytics {
  staffId: string
  staffCode: string
  staffName: string
  position: string | null
  salary: number | null
  workingHours: number
  monthlyVacationDays: number
  actualHoursWorked: number
  requiredHours: number
  hoursDifference: number
  daysAttended: number
  daysAbsent: number
  vacationDaysRemaining: number
  performancePercentage: number
  underperformanceDays: UnderperformanceDay[]
  status: 'excellent' | 'good' | 'warning' | 'critical'
  alerts: string[]
  revenue: RevenueBreakdown
  revenueToSalaryRatio: number | null
  advances: AdvancesData
  shiftStartTime: string | null
  shiftEndTime: string | null
  lateArrivals: LateArrival[]
  earlyDepartures: EarlyDeparture[]
  attendanceDetails: AttendanceDetail[]
  totalLateMinutes: number
  totalEarlyMinutes: number
  punctualityScore: number
}

interface AnalyticsResponse {
  month: number
  year: number
  workingDaysInMonth: number
  isPartialMonth: boolean
  dataUpToDay: number
  analytics: StaffAnalytics[]
}

export default function StaffHRAssistantPage() {
  const { t, direction } = useLanguage()
  useDarkMode()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)

  // Filters
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [searchQuery, setSearchQuery] = useState('')

  // Advances modal
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const [advanceStaffId, setAdvanceStaffId] = useState<string | null>(null)
  const [advanceAmount, setAdvanceAmount] = useState('')
  const [advanceNotes, setAdvanceNotes] = useState('')
  const [advanceSubmitting, setAdvanceSubmitting] = useState(false)

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/staff/hr-analytics?month=${selectedMonth}&year=${selectedYear}`
      )

      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error || t('staff.hrAssistant.loading'))
        return
      }

      const data = await response.json()
      setAnalytics(data)
    } catch (error) {
      console.error('Error fetching analytics:', error)
      toast.error(t('staff.hrAssistant.loading'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [selectedMonth, selectedYear])

  // Auto-select first staff when data loads
  useEffect(() => {
    if (analytics && analytics.analytics.length > 0 && !selectedStaffId) {
      setSelectedStaffId(analytics.analytics[0].staffId)
    }
  }, [analytics])

  // Calculate overview stats
  const calculateOverview = () => {
    if (!analytics) return { total: 0, excellent: 0, good: 0, underperforming: 0 }

    const total = analytics.analytics.length
    const excellent = analytics.analytics.filter((s) => s.status === 'excellent').length
    const good = analytics.analytics.filter((s) => s.status === 'good').length
    const underperforming = analytics.analytics.filter(
      (s) => s.status === 'warning' || s.status === 'critical'
    ).length

    return { total, excellent, good, underperforming }
  }

  const overview = calculateOverview()

  // حساب إجمالي السلف غير المدفوعة
  const totalUnpaidAdvances = analytics?.analytics.reduce((sum, s) => sum + s.advances.unpaid, 0) || 0

  // إضافة سلفة جديدة
  const handleAddAdvance = async () => {
    if (!advanceStaffId || !advanceAmount || parseFloat(advanceAmount) <= 0) return
    setAdvanceSubmitting(true)
    try {
      const staff = analytics?.analytics.find(s => s.staffId === advanceStaffId)
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'staff_loan',
          amount: parseFloat(advanceAmount),
          description: staff?.staffName || '',
          notes: advanceNotes || '',
          staffId: advanceStaffId
        })
      })
      if (res.ok) {
        toast.success(direction === 'rtl' ? 'تم إضافة السلفة بنجاح' : 'Advance added successfully')
        setShowAdvanceModal(false)
        setAdvanceAmount('')
        setAdvanceNotes('')
        fetchAnalytics()
      } else {
        toast.error(direction === 'rtl' ? 'فشل إضافة السلفة' : 'Failed to add advance')
      }
    } catch {
      toast.error(direction === 'rtl' ? 'فشل إضافة السلفة' : 'Failed to add advance')
    } finally {
      setAdvanceSubmitting(false)
    }
  }

  // تغيير حالة السلفة
  const toggleAdvancePaid = async (expenseId: string, currentPaid: boolean) => {
    try {
      const res = await fetch('/api/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: expenseId, isPaid: !currentPaid })
      })
      if (res.ok) {
        toast.success(direction === 'rtl' ? 'تم تحديث حالة السلفة' : 'Advance status updated')
        fetchAnalytics()
      }
    } catch {
      toast.error(direction === 'rtl' ? 'فشل تحديث الحالة' : 'Failed to update status')
    }
  }

  // Filter staff based on search query
  const filteredAnalytics = analytics?.analytics.filter((staff) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      staff.staffName.toLowerCase().includes(query) ||
      staff.staffCode.toLowerCase().includes(query) ||
      staff.position?.toLowerCase().includes(query)
    )
  }) || []

  // Month options
  const monthOptions = [
    { value: 1, label: t('staff.hrAssistant.months.1') },
    { value: 2, label: t('staff.hrAssistant.months.2') },
    { value: 3, label: t('staff.hrAssistant.months.3') },
    { value: 4, label: t('staff.hrAssistant.months.4') },
    { value: 5, label: t('staff.hrAssistant.months.5') },
    { value: 6, label: t('staff.hrAssistant.months.6') },
    { value: 7, label: t('staff.hrAssistant.months.7') },
    { value: 8, label: t('staff.hrAssistant.months.8') },
    { value: 9, label: t('staff.hrAssistant.months.9') },
    { value: 10, label: t('staff.hrAssistant.months.10') },
    { value: 11, label: t('staff.hrAssistant.months.11') },
    { value: 12, label: t('staff.hrAssistant.months.12') }
  ]

  // Year options (last 3 years)
  const yearOptions = [
    selectedYear - 2,
    selectedYear - 1,
    selectedYear,
    selectedYear + 1
  ]

  if (loading) {
    return <LoadingScreen fullScreen message={t('staff.hrAssistant.loading')} />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6" dir={direction}>
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('staff.hrAssistant.title')}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('staff.hrAssistant.subtitle')}</p>
            </div>
          </div>
          <Link
            href="/staff"
            className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 text-sm"
          >
            <svg {...stroke} className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            <span>{t('common.back')}</span>
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="max-w-7xl mx-auto mb-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          {t('staff.hrAssistant.overview')} - {monthOptions[selectedMonth - 1]?.label} {selectedYear}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            {
              label: t('staff.hrAssistant.totalStaff'),
              value: overview.total,
              valueTone: 'text-gray-900 dark:text-gray-100',
              tone: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
              icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />)
            },
            {
              label: t('staff.hrAssistant.excellent'),
              value: overview.excellent,
              valueTone: 'text-green-600 dark:text-green-400',
              tone: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
              icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />)
            },
            {
              label: t('staff.hrAssistant.good'),
              value: overview.good,
              valueTone: 'text-blue-600 dark:text-blue-400',
              tone: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
              icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />)
            },
            {
              label: t('staff.hrAssistant.underperforming'),
              value: overview.underperforming,
              valueTone: 'text-red-600 dark:text-red-400',
              tone: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
              icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />)
            },
            {
              label: direction === 'rtl' ? 'إجمالي السلف المتبقية' : 'Unpaid Advances',
              value: totalUnpaidAdvances.toFixed(0),
              valueTone: 'text-orange-600 dark:text-orange-400',
              sub: t('common.egp'),
              tone: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
              icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4M9 9V6m6 12v-3" />)
            }
          ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
              <div className={`w-10 h-10 rounded-lg ${s.tone} flex items-center justify-center mb-2`}>
                <svg {...stroke} className="w-5 h-5" aria-hidden="true">{s.icon}</svg>
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{s.label}</div>
              <div className={`mt-1 text-2xl font-bold ${s.valueTone}`}>{s.value}</div>
              {s.sub && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <span>{t('staff.hrAssistant.filters')}</span>
          </h3>

          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('staff.hrAssistant.search')}</label>
            <input
              type="text"
              placeholder={t('staff.hrAssistant.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('staff.hrAssistant.month')}</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
              >
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('staff.hrAssistant.year')}</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchAnalytics}
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 text-sm"
              >
                <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M3.181 14.652a8.25 8.25 0 0 0 13.803 3.7l3.181-3.182m-9.348-4.992H3.825V4.356m0 0L7.006 7.538m12.992 8.924v-4.992" />
                </svg>
                <span>{t('staff.hrAssistant.refresh')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Analytics */}
      <div className="max-w-7xl mx-auto">
        {analytics?.isPartialMonth && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-xl p-3 mb-4 flex items-center gap-2 text-blue-800 dark:text-blue-200 text-sm">
            
            <span
              dangerouslySetInnerHTML={{
                __html: t('staff.hrAssistant.partialMonthNotice', { day: String(analytics.dataUpToDay) })
              }}
            />
          </div>
        )}

        {analytics && analytics.analytics.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
            <p className="text-gray-600 dark:text-gray-300 text-lg">
              {t('staff.hrAssistant.noStaff')}
            </p>
          </div>
        )}

        {searchQuery && filteredAnalytics.length === 0 && analytics && analytics.analytics.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
            <p className="text-gray-600 dark:text-gray-300 text-lg">
              {t('staff.hrAssistant.noResults')}
            </p>
          </div>
        )}

        {filteredAnalytics.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Staff List - Small Cards */}
            <div className="lg:col-span-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                 {t('staff.hrAssistant.staffList')}
                {searchQuery && (
                  <span className="text-base font-normal text-gray-600 dark:text-gray-400">
                    ({filteredAnalytics.length})
                  </span>
                )}
              </h2>
              <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2">
                {filteredAnalytics.map((staff) => {
                  const colors = getStatusColors(staff.status)
                  const isSelected = selectedStaffId === staff.staffId

                  return (
                    <div
                      key={staff.staffId}
                      onClick={() => setSelectedStaffId(staff.staffId)}
                      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md ring-1 ${
                        isSelected ? colors.border + ' ring-4 ring-opacity-50 ' + colors.border : 'border-gray-200 dark:border-gray-700'
                      } p-4 cursor-pointer hover:shadow-lg transition-colors duration-200 ${
                        isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]'
                      }`}
                    >
                      {/* Small Card Content */}
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full ${colors.bg} flex items-center justify-center text-2xl`}>
                          
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                            {staff.staffName}
                          </h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {staff.staffCode} • {staff.position || t('staff.positions.other')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-bold ${colors.text}`}>
                            {staff.performancePercentage.toFixed(0)}%
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {t(`staff.hrAssistant.status.${staff.status}`)}
                          </p>
                          {analytics?.isPartialMonth && (
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              حتى يوم {analytics.dataUpToDay}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Mini Stats */}
                      <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-center">
                          <p className="text-xs text-gray-600 dark:text-gray-400"> {t('staff.hrAssistant.attendance')}</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{staff.daysAttended}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-600 dark:text-gray-400"> {t('staff.hrAssistant.workHours')}</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{staff.actualHoursWorked.toFixed(0)}h</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-600 dark:text-gray-400"> {t('staff.hrAssistant.revenue.total')}</p>
                          <p className="text-sm font-bold text-green-600 dark:text-green-400">{staff.revenue.total.toFixed(0)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-600 dark:text-gray-400"> {direction === 'rtl' ? 'سلف' : 'Advances'}</p>
                          <p className={`text-sm font-bold ${staff.advances.unpaid > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>{staff.advances.unpaid.toFixed(0)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Selected Staff Details */}
            <div className="lg:col-span-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                 {t('staff.hrAssistant.selectedStaffDetails')}
              </h2>

              {selectedStaffId && filteredAnalytics.find(s => s.staffId === selectedStaffId) && (() => {
                const staff = filteredAnalytics.find(s => s.staffId === selectedStaffId)!
                const colors = getStatusColors(staff.status)

                return (
                  <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg ring-1 ${colors.border} overflow-hidden`}>
                    {/* Details Header */}
                    <div className={`${colors.bg} p-6`}>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-20 h-20 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center text-4xl shadow-lg">
                            
                          </div>
                          <div>
                            <h3 className={`text-2xl font-bold ${colors.text}`}>
                              {staff.staffName} ({staff.staffCode})
                            </h3>
                            <p className="text-gray-700 dark:text-gray-300 text-lg">
                              {staff.position || t('staff.positions.other')}
                            </p>
                            <div className="flex gap-3 mt-1 text-xs text-gray-600 dark:text-gray-400">
                              <span> {staff.workingHours} {t('staff.hrAssistant.hoursPerDay')}</span>
                              <span>•</span>
                              <span> {staff.monthlyVacationDays} {t('staff.hrAssistant.vacationDaysPerMonth')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`inline-block px-8 py-4 rounded-full ${colors.bg} ring-1 ${colors.border}`}>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                              {t('staff.hrAssistant.performance')}
                            </p>
                            <p className={`text-4xl font-bold ${colors.text}`}>
                              {staff.performancePercentage.toFixed(1)}%
                            </p>
                            <p className={`text-xs ${colors.text} mt-1`}>
                              {t(`staff.hrAssistant.status.${staff.status}`)}
                            </p>
                            {analytics?.isPartialMonth && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                 حتى يوم {analytics.dataUpToDay}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-6">
                        {/* Attendance */}
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                             {t('staff.hrAssistant.attendance')}
                          </p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {staff.daysAttended} {t('staff.hrAssistant.days')}
                          </p>
                        </div>

                        {/* Absence */}
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                             {t('staff.hrAssistant.absence')}
                          </p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {staff.daysAbsent} {t('staff.hrAssistant.days')}
                          </p>
                        </div>

                        {/* Work Hours */}
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                             {t('staff.hrAssistant.workHours')}
                          </p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {staff.actualHoursWorked.toFixed(1)} / {staff.requiredHours.toFixed(0)}
                          </p>
                        </div>

                        {/* Punctuality Score */}
                        <div className={`rounded-lg p-4 shadow ${staff.punctualityScore >= 90 ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700' : staff.punctualityScore >= 70 ? 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-700' : 'bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-700'}`}>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                             {direction === 'rtl' ? 'الالتزام بالمواعيد' : 'Punctuality'}
                          </p>
                          <p className={`text-2xl font-bold ${staff.punctualityScore >= 90 ? 'text-green-600' : staff.punctualityScore >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {staff.punctualityScore}%
                          </p>
                          {staff.lateArrivals.length > 0 && (
                            <p className="text-xs text-red-500 mt-1">
                              {direction === 'rtl' ? `تأخر ${staff.lateArrivals.length} مرة` : `Late ${staff.lateArrivals.length} times`}
                            </p>
                          )}
                        </div>

                        {/* Vacation */}
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                             {t('staff.hrAssistant.vacationRemaining')}
                          </p>
                          <p className={`text-2xl font-bold ${staff.vacationDaysRemaining < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                            {staff.vacationDaysRemaining} {t('staff.hrAssistant.days')}
                          </p>
                        </div>

                        {/* Revenue */}
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 shadow border border-green-200 dark:border-green-700">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                             {t('staff.hrAssistant.revenue.total')}
                          </p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {staff.revenue.total.toFixed(0)} {t('common.egp')}
                          </p>
                          {staff.revenueToSalaryRatio !== null && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {staff.revenueToSalaryRatio.toFixed(1)}x {t('staff.hrAssistant.revenue.ratio')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('staff.hrAssistant.performance')}
                          </span>
                          <span className={`text-sm font-bold ${colors.text}`}>
                            {staff.performancePercentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-4 overflow-hidden">
                          <div
                            className={`h-full ${colors.progress} rounded-full transition-colors duration-200`}
                            style={{ width: `${Math.min(staff.performancePercentage, 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Alerts */}
                      {staff.alerts.length > 0 && (
                        <div className="mt-6 space-y-2">
                          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                             {t('staff.hrAssistant.alerts')}:
                          </p>
                          {staff.alerts.map((alert, index) => (
                            <div
                              key={index}
                              className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow text-sm text-gray-900 dark:text-white"
                            >
                              • {alert}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Details Body */}
                    <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t-2 border-gray-200 dark:border-gray-700 space-y-6">
                    {/* Revenue Breakdown */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                         {t('staff.hrAssistant.revenue.breakdown')}
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {/* PT Revenue */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                             {t('staff.hrAssistant.revenue.pt')}
                          </p>
                          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                            {staff.revenue.pt.toFixed(0)} {t('common.egp')}
                          </p>
                        </div>

                        {/* Nutrition Revenue */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                             {t('staff.hrAssistant.revenue.nutrition')}
                          </p>
                          <p className="text-xl font-bold text-green-600 dark:text-green-400">
                            {staff.revenue.nutrition.toFixed(0)} {t('common.egp')}
                          </p>
                        </div>

                        {/* Physiotherapy Revenue */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                             {t('staff.hrAssistant.revenue.physiotherapy')}
                          </p>
                          <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                            {staff.revenue.physiotherapy.toFixed(0)} {t('common.egp')}
                          </p>
                        </div>

                        {/* Other Revenue */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                             {t('staff.hrAssistant.revenue.other')}
                          </p>
                          <p className="text-xl font-bold text-gray-600 dark:text-gray-400">
                            {staff.revenue.other.toFixed(0)} {t('common.egp')}
                          </p>
                        </div>
                      </div>

                      {/* Salary Comparison */}
                      {staff.salary && staff.salary > 0 && (
                        <div className="mt-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {t('staff.hrAssistant.revenue.salary')}
                              </p>
                              <p className="text-xl font-bold text-gray-900 dark:text-white">
                                {staff.salary.toFixed(0)} {t('common.egp')}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {t('staff.hrAssistant.revenue.ratio')}
                              </p>
                              <p className={`text-3xl font-bold ${staff.revenueToSalaryRatio && staff.revenueToSalaryRatio >= 1 ? 'text-green-600' : 'text-orange-600'}`}>
                                {staff.revenueToSalaryRatio?.toFixed(1)}x
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {t('staff.hrAssistant.revenue.difference')}
                              </p>
                              <p className={`text-xl font-bold ${staff.revenue.total >= staff.salary ? 'text-green-600' : 'text-red-600'}`}>
                                {(staff.revenue.total - staff.salary).toFixed(0)} {t('common.egp')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* قسم السلف */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                           {direction === 'rtl' ? 'السلف' : 'Advances'} ({staff.advances.count})
                        </h4>
                        <button
                          onClick={() => {
                            setAdvanceStaffId(staff.staffId)
                            setAdvanceAmount('')
                            setAdvanceNotes('')
                            setShowAdvanceModal(true)
                          }}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-sm font-medium"
                        >
                          + {direction === 'rtl' ? 'إضافة سلفة' : 'Add Advance'}
                        </button>
                      </div>

                      {/* Summary Cards */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow text-center">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            {direction === 'rtl' ? 'إجمالي السلف' : 'Total'}
                          </p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white">
                            {staff.advances.total.toFixed(0)} {t('common.egp')}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow text-center">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            {direction === 'rtl' ? 'تم السداد' : 'Paid'}
                          </p>
                          <p className="text-xl font-bold text-green-600 dark:text-green-400">
                            {staff.advances.paid.toFixed(0)} {t('common.egp')}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow text-center">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            {direction === 'rtl' ? 'متبقي' : 'Remaining'}
                          </p>
                          <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                            {staff.advances.unpaid.toFixed(0)} {t('common.egp')}
                          </p>
                        </div>
                      </div>

                      {/* Advances List */}
                      {staff.advances.items.length === 0 ? (
                        <p className="text-gray-600 dark:text-gray-300">
                          {direction === 'rtl' ? 'لا توجد سلف في هذا الشهر' : 'No advances this month'}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {staff.advances.items.map((advance) => (
                            <div
                              key={advance.id}
                              className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow flex items-center justify-between"
                            >
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {advance.amount.toFixed(0)} {t('common.egp')}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {new Date(advance.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                  {advance.notes && ` • ${advance.notes}`}
                                </p>
                              </div>
                              <button
                                onClick={() => toggleAdvancePaid(advance.id, advance.isPaid)}
                                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                                  advance.isPaid
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                                    : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400'
                                }`}
                              >
                                {advance.isPaid
                                  ? (direction === 'rtl' ? ' مدفوع' : ' Paid')
                                  : (direction === 'rtl' ? ' غير مدفوع' : ' Unpaid')
                                }
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Underperformance Days */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                         {t('staff.hrAssistant.underperformanceDays')} ({staff.underperformanceDays.length})
                      </h4>

                      {staff.underperformanceDays.length === 0 ? (
                        <p className="text-gray-600 dark:text-gray-300">
                           {direction === 'rtl' ? 'لا توجد أيام تقصير!' : 'No underperformance days!'}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {staff.underperformanceDays.map((day, index) => (
                            <div
                              key={index}
                              className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow flex items-center justify-between"
                            >
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                   {new Date(day.date).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {day.actualHours.toFixed(1)} {t('staff.hrAssistant.hours')} / {day.requiredHours} {t('staff.hrAssistant.hours')}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-red-600 dark:text-red-400 font-bold">
                                  {Math.abs(day.shortfall).toFixed(1)} {t('staff.hrAssistant.hours')}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {t('staff.hrAssistant.hoursShortfall')}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Late Arrivals */}
                    {staff.shiftStartTime && (
                      <div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                           {direction === 'rtl' ? 'أيام التأخير' : 'Late Arrivals'} ({staff.lateArrivals.length})
                        </h4>

                        {staff.lateArrivals.length === 0 ? (
                          <p className="text-gray-600 dark:text-gray-300">
                             {direction === 'rtl' ? 'لا يوجد تأخير! التزام تام بالمواعيد' : 'No late arrivals! Perfect punctuality'}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {staff.lateArrivals.map((late, index) => (
                              <div
                                key={index}
                                className={`rounded-lg p-4 shadow flex items-center justify-between ${
                                  late.lateMinutes > 30 ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700' :
                                  late.lateMinutes > 15 ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700' :
                                  'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700'
                                }`}
                              >
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                     {new Date(late.date).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'short' })}
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {direction === 'rtl' ? `دخل: ${late.checkInTime} | الموعد: ${late.shiftStart}` : `In: ${late.checkInTime} | Shift: ${late.shiftStart}`}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={`font-bold ${late.lateMinutes > 30 ? 'text-red-600' : late.lateMinutes > 15 ? 'text-orange-600' : 'text-yellow-600'}`}>
                                    {late.lateMinutes} {direction === 'rtl' ? 'دقيقة' : 'min'}
                                  </p>
                                </div>
                              </div>
                            ))}
                            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 text-center">
                              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                {direction === 'rtl' ? `إجمالي التأخير: ${staff.totalLateMinutes} دقيقة` : `Total late: ${staff.totalLateMinutes} min`}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Early Departures */}
                    {staff.shiftEndTime && staff.earlyDepartures.length > 0 && (
                      <div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                           {direction === 'rtl' ? 'أيام الخروج المبكر' : 'Early Departures'} ({staff.earlyDepartures.length})
                        </h4>
                        <div className="space-y-2">
                          {staff.earlyDepartures.map((early, index) => (
                            <div
                              key={index}
                              className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4 shadow flex items-center justify-between"
                            >
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                   {new Date(early.date).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'short' })}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {direction === 'rtl' ? `خرج: ${early.checkOutTime} | الموعد: ${early.shiftEnd}` : `Out: ${early.checkOutTime} | Shift: ${early.shiftEnd}`}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-purple-600">
                                  {early.earlyMinutes} {direction === 'rtl' ? 'دقيقة' : 'min'}
                                </p>
                              </div>
                            </div>
                          ))}
                          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 text-center">
                            <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                              {direction === 'rtl' ? `إجمالي الخروج المبكر: ${staff.totalEarlyMinutes} دقيقة` : `Total early: ${staff.totalEarlyMinutes} min`}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Daily Attendance Log */}
                    {staff.attendanceDetails.length > 0 && (
                      <div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                           {direction === 'rtl' ? 'سجل الحضور اليومي' : 'Daily Attendance Log'}
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-100 dark:bg-gray-700">
                                <th className="p-2 text-right">{direction === 'rtl' ? 'التاريخ' : 'Date'}</th>
                                <th className="p-2 text-center">{direction === 'rtl' ? 'الدخول' : 'In'}</th>
                                <th className="p-2 text-center">{direction === 'rtl' ? 'الخروج' : 'Out'}</th>
                                <th className="p-2 text-center">{direction === 'rtl' ? 'المدة' : 'Duration'}</th>
                                <th className="p-2 text-center">{direction === 'rtl' ? 'الحالة' : 'Status'}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {staff.attendanceDetails.map((att, index) => (
                                <tr key={index} className={`border-b dark:border-gray-600 ${
                                  att.status === 'late' || att.status === 'late-and-early' ? 'bg-red-50/50 dark:bg-red-900/10' :
                                  att.status === 'early' ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''
                                }`}>
                                  <td className="p-2 font-medium text-gray-900 dark:text-white">
                                    {new Date(att.date).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                                  </td>
                                  <td className="p-2 text-center font-mono text-gray-700 dark:text-gray-300">{att.checkIn}</td>
                                  <td className="p-2 text-center font-mono text-gray-700 dark:text-gray-300">{att.checkOut || '-'}</td>
                                  <td className="p-2 text-center text-gray-700 dark:text-gray-300">
                                    {att.duration ? `${(att.duration / 60).toFixed(1)}h` : '-'}
                                  </td>
                                  <td className="p-2 text-center">
                                    {att.status === 'on-time' && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">OK</span>}
                                    {att.status === 'late' && <span className="text-red-600 font-bold text-xs"> -{att.lateMinutes}m</span>}
                                    {att.status === 'early' && <span className="text-purple-600 font-bold text-xs"> -{att.earlyMinutes}m</span>}
                                    {att.status === 'late-and-early' && <span className="text-red-600 font-bold text-xs"> -{att.lateMinutes}m -{att.earlyMinutes}m</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )})()}
            </div>
          </div>
        )}
      </div>

      {/* Add advance modal */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in" role="dialog" aria-modal="true" aria-labelledby="advance-modal-title">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in w-full max-w-md p-6" dir={direction}>
            <div className="flex items-center justify-between mb-5">
              <h3 id="advance-modal-title" className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <svg {...stroke} className="w-5 h-5 text-orange-600 dark:text-orange-400" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4M9 9V6m6 12v-3" />
                </svg>
                <span>{direction === 'rtl' ? 'إضافة سلفة جديدة' : 'Add New Advance'}</span>
              </h3>
              <button
                onClick={() => setShowAdvanceModal(false)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                aria-label={direction === 'rtl' ? 'إلغاء' : 'Cancel'}
              >
                <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {direction === 'rtl' ? 'الموظف' : 'Staff'}
                </label>
                <p className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-900 dark:text-gray-100 font-bold">
                  {analytics?.analytics.find(s => s.staffId === advanceStaffId)?.staffName || ''}
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {direction === 'rtl' ? 'المبلغ' : 'Amount'} ({t('common.egp')})
                </label>
                <input
                  type="number"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="0"
                  min="1"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {direction === 'rtl' ? 'ملاحظات' : 'Notes'}
                </label>
                <input
                  type="text"
                  value={advanceNotes}
                  onChange={(e) => setAdvanceNotes(e.target.value)}
                  placeholder={direction === 'rtl' ? 'اختياري' : 'Optional'}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleAddAdvance}
                disabled={advanceSubmitting || !advanceAmount || parseFloat(advanceAmount) <= 0}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
              >
                {advanceSubmitting && (
                  <svg {...stroke} className="w-4 h-4 animate-spin" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M3.181 14.652a8.25 8.25 0 0 0 13.803 3.7l3.181-3.182m-9.348-4.992H3.825V4.356m0 0L7.006 7.538m12.992 8.924v-4.992" />
                  </svg>
                )}
                <span>{advanceSubmitting ? (direction === 'rtl' ? 'جاري الحفظ' : 'Saving') : (direction === 'rtl' ? 'حفظ السلفة' : 'Save Advance')}</span>
              </button>
              <button
                onClick={() => setShowAdvanceModal(false)}
                className="px-6 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 py-2.5 rounded-lg font-bold transition-colors duration-200 text-sm"
              >
                {direction === 'rtl' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
