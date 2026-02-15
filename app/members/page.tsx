// app/members/page.tsx - إصلاح الأرقام العشرية
'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionDenied from '../../components/PermissionDenied'
import MemberForm from '../../components/MemberForm'
import { useAdminDate } from '../../contexts/AdminDateContext'
import { formatDateYMD, calculateRemainingDays } from '../../lib/dateFormatter'
import { useLanguage } from '../../contexts/LanguageContext'
import { fetchMembers, fetchOffers } from '../../lib/api/members'
import { useToast } from '../../contexts/ToastContext'
import { MembersSkeleton } from '../../components/LoadingSkeleton'

interface Member {
  id: string
  memberNumber: number
  name: string
  phone: string
  profileImage?: string | null
  inBodyScans: number
  invitations: number
  remainingFreezeDays: number
  subscriptionPrice: number
  remainingAmount: number
  notes?: string
  isActive: boolean
  isFrozen: boolean
  startDate?: string
  expiryDate?: string
  createdAt: string
}

// دالة حساب اسم الباقة بناءً على عدد أيام الاشتراك
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

export default function MembersPage() {
  const router = useRouter()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const { customCreatedAt } = useAdminDate()
  const { t, locale, direction } = useLanguage()
  const toast = useToast()

  // ✅ استخدام useQuery لجلب الأعضاء
  const {
    data: membersData = [],
    isLoading: loading,
    error: membersError,
    refetch: refetchMembers
  } = useQuery({
    queryKey: ['members'],
    queryFn: fetchMembers,
    enabled: !permissionsLoading && hasPermission('canViewMembers'),
    retry: 1,
    staleTime: 2 * 60 * 1000, // البيانات تعتبر fresh لمدة دقيقتين
  })

  const [showForm, setShowForm] = useState(false)

  // سجل الحضور
  const [showAttendanceModal, setShowAttendanceModal] = useState(false)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceSummary, setAttendanceSummary] = useState<any[]>([])
  const [attendanceStartDate, setAttendanceStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [attendanceEndDate, setAttendanceEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const [searchId, setSearchId] = useState('')
  const [searchName, setSearchName] = useState('')
  const [searchPhone, setSearchPhone] = useState('')

  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired' | 'expiring-soon' | 'has-remaining'>('all')
  const [filterPackage, setFilterPackage] = useState<'all' | 'month' | '3-months' | '6-months' | 'year'>('all')
  const [specificDate, setSpecificDate] = useState('')

  // سجل الإيصالات
  const [showReceiptsModal, setShowReceiptsModal] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [memberReceipts, setMemberReceipts] = useState<any[]>([])
  const [receiptsLoading, setReceiptsLoading] = useState(false)
  const [lastReceipts, setLastReceipts] = useState<{ [memberId: string]: any }>({})

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // استخدام useMemo بدل useState للـ filteredMembers لتجنب infinite loop
  const filteredMembers = useMemo(() => {
    let filtered = membersData

    if (searchId || searchName || searchPhone) {
      filtered = filtered.filter((member) => {
        const idMatch = searchId
          ? member.memberNumber === parseInt(searchId) || member.memberNumber.toString() === searchId
          : true

        const nameMatch = searchName
          ? member.name.toLowerCase().includes(searchName.toLowerCase())
          : true

        const phoneMatch = searchPhone
          ? member.phone.includes(searchPhone)
          : true

        return idMatch && nameMatch && phoneMatch
      })
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((member) => {
        const isExpired = member.expiryDate ? new Date(member.expiryDate) < new Date() : false
        const daysRemaining = calculateRemainingDays(member.expiryDate)
        const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7

        if (filterStatus === 'expired') {
          return isExpired
        } else if (filterStatus === 'expiring-soon') {
          return isExpiringSoon
        } else if (filterStatus === 'active') {
          return member.isActive && !isExpired
        } else if (filterStatus === 'has-remaining') {
          return member.remainingAmount > 0
        }
        return true
      })
    }

    if (filterPackage !== 'all') {
      filtered = filtered.filter((member) => {
        if (!member.startDate || !member.expiryDate) return false

        const start = new Date(member.startDate)
        const expiry = new Date(member.expiryDate)
        const diffDays = Math.round((expiry.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

        if (filterPackage === 'month') {
          return diffDays >= 25 && diffDays <= 35
        } else if (filterPackage === '3-months') {
          return diffDays >= 85 && diffDays <= 95
        } else if (filterPackage === '6-months') {
          return diffDays >= 165 && diffDays <= 195
        } else if (filterPackage === 'year') {
          return diffDays >= 330 && diffDays <= 395
        }
        return true
      })
    }

    if (specificDate) {
      filtered = filtered.filter((member) => {
        if (!member.expiryDate) return false
        const expiryDate = new Date(member.expiryDate)
        const selectedDate = new Date(specificDate)

        return (
          expiryDate.getFullYear() === selectedDate.getFullYear() &&
          expiryDate.getMonth() === selectedDate.getMonth() &&
          expiryDate.getDate() === selectedDate.getDate()
        )
      })
    }

    return filtered
  }, [searchId, searchName, searchPhone, filterStatus, filterPackage, specificDate, membersData])

  // ✅ معالجة أخطاء الأعضاء
  useEffect(() => {
    if (membersError) {
      const errorMessage = (membersError as Error).message

      if (errorMessage === 'UNAUTHORIZED') {
        toast.error('يجب تسجيل الدخول أولاً')
        setTimeout(() => router.push('/login'), 2000)
      } else if (errorMessage === 'FORBIDDEN') {
        toast.error('ليس لديك صلاحية عرض الأعضاء')
      } else {
        toast.error(errorMessage || 'حدث خطأ أثناء جلب بيانات الأعضاء')
      }
    }
  }, [membersError, toast, router])

  const fetchAttendanceSummary = async () => {
    setAttendanceLoading(true)
    try {
      const response = await fetch(
        `/api/members/attendance-summary?startDate=${attendanceStartDate}&endDate=${attendanceEndDate}`
      )
      const data = await response.json()

      if (data.success) {
        setAttendanceSummary(data.summary || [])
      } else {
        console.error('Error fetching attendance summary')
        setAttendanceSummary([])
      }
    } catch (error) {
      console.error('Error fetching attendance summary:', error)
      setAttendanceSummary([])
    } finally {
      setAttendanceLoading(false)
    }
  }

  const fetchLastReceipts = async () => {
    try {
      const response = await fetch('/api/receipts')

      // تحقق من نجاح الطلب
      if (!response.ok) {
        console.error('Failed to fetch receipts:', response.status)
        return
      }

      const receipts = await response.json()

      // تحقق من أن receipts هو array
      if (!Array.isArray(receipts)) {
        console.error('Receipts is not an array:', receipts)
        return
      }

      const lastReceiptsMap: { [memberId: string]: any } = {}

      receipts.forEach((receipt: any) => {
        if (receipt.type === 'Member' || receipt.type === 'تجديد عضويه') {
          const itemDetails = JSON.parse(receipt.itemDetails)
          const memberId = itemDetails.memberId

          if (memberId) {
            if (!lastReceiptsMap[memberId] || new Date(receipt.createdAt) > new Date(lastReceiptsMap[memberId].createdAt)) {
              lastReceiptsMap[memberId] = receipt
            }
          }
        }
      })

      setLastReceipts(lastReceiptsMap)
    } catch (error) {
      console.error('Error fetching last receipts:', error)
    }
  }

  const fetchMemberReceipts = async (memberNumber: number) => {
    setReceiptsLoading(true)
    try {
      const response = await fetch('/api/receipts')
      const allReceipts = await response.json()

      const filtered = allReceipts.filter((receipt: any) => {
        if (receipt.type === 'Member' || receipt.type === 'تجديد عضويه') {
          try {
            const itemDetails = JSON.parse(receipt.itemDetails)
            // البحث برقم العضوية (memberNumber) بدلاً من memberId
            return itemDetails.memberNumber === memberNumber
          } catch (error) {
            return false
          }
        }
        return false
      })

      setMemberReceipts(filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    } catch (error) {
      console.error('Error fetching member receipts:', error)
      setMemberReceipts([])
    } finally {
      setReceiptsLoading(false)
    }
  }

  const handleShowReceipts = (memberId: string, memberNumber: number) => {
    setSelectedMemberId(memberId)
    fetchMemberReceipts(memberNumber)
    setShowReceiptsModal(true)
  }

  useEffect(() => {
    fetchLastReceipts()
  }, [])

  // إعادة تعيين الصفحة عند تغيير الفلاتر (مش البيانات)
  useEffect(() => {
    setCurrentPage(1)
  }, [searchId, searchName, searchPhone, filterStatus, filterPackage, specificDate])

  // حساب الصفحات
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentMembers = filteredMembers.slice(startIndex, endIndex)

  const handleViewDetails = (memberId: string) => {
    router.push(`/members/${memberId}`)
  }

  const goToPage = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const clearSearch = () => {
    setSearchId('')
    setSearchName('')
    setSearchPhone('')
  }

  const clearAllFilters = () => {
    setSearchId('')
    setSearchName('')
    setSearchPhone('')
    setFilterStatus('all')
    setFilterPackage('all')
    setSpecificDate('')
  }

  // دالة مساعدة لفلترة الأعضاء حسب الحالة
  const filterByStatus = (member: Member) => {
    const isExpired = member.expiryDate ? new Date(member.expiryDate) < new Date() : false
    const daysRemaining = calculateRemainingDays(member.expiryDate)
    const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7

    if (filterStatus === 'all') return true
    if (filterStatus === 'expired') return isExpired
    if (filterStatus === 'expiring-soon') return isExpiringSoon
    if (filterStatus === 'active') return member.isActive && !isExpired
    if (filterStatus === 'has-remaining') return member.remainingAmount > 0
    return true
  }

  const stats = {
    total: membersData.length,
    active: membersData.filter(m => {
      const isExpired = m.expiryDate ? new Date(m.expiryDate) < new Date() : false
      return m.isActive && !isExpired
    }).length,
    expired: membersData.filter(m => {
      return m.expiryDate ? new Date(m.expiryDate) < new Date() : false
    }).length,
    expiringSoon: membersData.filter(m => {
      const daysRemaining = calculateRemainingDays(m.expiryDate)
      return daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7
    }).length,
    hasRemaining: membersData.filter(m => m.remainingAmount > 0).length,
    packageMonth: membersData.filter(m => {
      if (!filterByStatus(m)) return false
      if (!m.startDate || !m.expiryDate) return false
      const diffDays = Math.round((new Date(m.expiryDate).getTime() - new Date(m.startDate).getTime()) / (1000 * 60 * 60 * 24))
      return diffDays >= 25 && diffDays <= 35
    }).length,
    package3Months: membersData.filter(m => {
      if (!filterByStatus(m)) return false
      if (!m.startDate || !m.expiryDate) return false
      const diffDays = Math.round((new Date(m.expiryDate).getTime() - new Date(m.startDate).getTime()) / (1000 * 60 * 60 * 24))
      return diffDays >= 85 && diffDays <= 95
    }).length,
    package6Months: membersData.filter(m => {
      if (!filterByStatus(m)) return false
      if (!m.startDate || !m.expiryDate) return false
      const diffDays = Math.round((new Date(m.expiryDate).getTime() - new Date(m.startDate).getTime()) / (1000 * 60 * 60 * 24))
      return diffDays >= 165 && diffDays <= 195
    }).length,
    packageYear: membersData.filter(m => {
      if (!filterByStatus(m)) return false
      if (!m.startDate || !m.expiryDate) return false
      const diffDays = Math.round((new Date(m.expiryDate).getTime() - new Date(m.startDate).getTime()) / (1000 * 60 * 60 * 24))
      return diffDays >= 330 && diffDays <= 395
    }).length
  }

  // ✅ التحقق من الصلاحيات
  if (permissionsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">{t('common.loading')}</div>
      </div>
    )
  }

  if (!hasPermission('canViewMembers')) {
    return <PermissionDenied message={t('members.permissionDeniedViewMembers')} />
  }

  // ✅ حالة التحميل مع Skeleton
  if (loading) {
    return <MembersSkeleton />
  }

  return (
    <div className="container mx-auto p-6" dir={direction}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold dark:text-white">{t('members.managementTitle')}</h1>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <Link
            href="/member-attendance"
            className="bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800 text-white px-4 sm:px-6 py-2 rounded-lg hover:from-primary-700 hover:to-primary-800 dark:hover:from-primary-800 dark:hover:to-primary-900 transition transform hover:scale-105 shadow-lg flex items-center justify-center gap-2 text-xs sm:text-sm font-bold"
          >
            <span>🏋️</span>
            <span>{t('nav.memberAttendance')}</span>
          </Link>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-primary-600 dark:bg-primary-700 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-primary-700 dark:hover:bg-primary-800 text-xs sm:text-sm font-bold"
          >
            {showForm ? t('members.hideForm') : t('members.addMember')}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6" dir={direction}>
          <h2 className="text-xl font-semibold mb-4 dark:text-white">{t('members.addMember')}</h2>
          <MemberForm
            onSuccess={() => {
              refetchMembers()
              setShowForm(false)
            }}
            customCreatedAt={customCreatedAt}
          />
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg mb-6 border-2 border-primary-200 dark:border-primary-700" dir={direction}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2 dark:text-white">
            <span>🎯</span>
            <span>{t('members.quickFilters')}</span>
          </h3>
          {(filterStatus !== 'all' || filterPackage !== 'all' || specificDate) && (
            <button
              onClick={() => {
                setFilterStatus('all')
                setFilterPackage('all')
                setSpecificDate('')
              }}
              className="bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 px-4 py-2 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-800/50 text-sm font-medium"
            >
              ✖️ {t('members.clearFilters')}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-6 py-4 rounded-xl font-bold transition-all transform hover:scale-105 ${
              filterStatus === 'all'
                ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-xl border-2 border-primary-400'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-2 border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
            }`}
          >
            <div className="text-2xl mb-1">📊</div>
            <div className="text-sm">{t('members.all')}</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </button>

          <button
            onClick={() => setFilterStatus('active')}
            className={`px-6 py-4 rounded-xl font-bold transition-all transform hover:scale-105 ${
              filterStatus === 'active'
                ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-xl border-2 border-green-400'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-2 border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-500'
            }`}
          >
            <div className="text-2xl mb-1">🟢</div>
            <div className="text-sm">{t('members.active')}</div>
            <div className="text-2xl font-bold">{stats.active}</div>
          </button>

          <button
            onClick={() => setFilterStatus('expiring-soon')}
            className={`px-6 py-4 rounded-xl font-bold transition-all transform hover:scale-105 ${
              filterStatus === 'expiring-soon'
                ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-xl border-2 border-orange-400'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-2 border-gray-300 dark:border-gray-600 hover:border-orange-400 dark:hover:border-orange-500'
            }`}
          >
            <div className="text-2xl mb-1">🟡</div>
            <div className="text-sm">{t('members.expiringSoon7Days')}</div>
            <div className="text-2xl font-bold">{stats.expiringSoon}</div>
          </button>

          <button
            onClick={() => setFilterStatus('expired')}
            className={`px-6 py-4 rounded-xl font-bold transition-all transform hover:scale-105 ${
              filterStatus === 'expired'
                ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-xl border-2 border-red-400'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-2 border-gray-300 dark:border-gray-600 hover:border-red-400 dark:hover:border-red-500'
            }`}
          >
            <div className="text-2xl mb-1">🔴</div>
            <div className="text-sm">{t('members.expiredMembers')}</div>
            <div className="text-2xl font-bold">{stats.expired}</div>
          </button>
        </div>

        <div className="border-t dark:border-gray-700 pt-4 mt-4">
          <h4 className="text-lg font-bold mb-3 flex items-center gap-2 dark:text-white">
            <span>📦</span>
            <span>{locale === 'ar' ? 'فلترة حسب الباقة' : 'Filter by Package'}</span>
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <button
              onClick={() => setFilterPackage('all')}
              className={`px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105 ${
                filterPackage === 'all'
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg border-2 border-primary-400'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-2 border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
              }`}
            >
              <div className="text-base">{locale === 'ar' ? 'الكل' : 'All'}</div>
              <div className="text-lg font-bold mt-1">{membersData.length}</div>
            </button>

            <button
              onClick={() => setFilterPackage('month')}
              className={`px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105 ${
                filterPackage === 'month'
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg border-2 border-primary-400'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-2 border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
              }`}
            >
              <div className="text-base">{locale === 'ar' ? 'شهر' : 'Month'}</div>
              <div className="text-lg font-bold mt-1">{stats.packageMonth}</div>
            </button>

            <button
              onClick={() => setFilterPackage('3-months')}
              className={`px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105 ${
                filterPackage === '3-months'
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg border-2 border-primary-400'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-2 border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
              }`}
            >
              <div className="text-base">{locale === 'ar' ? '3 شهور' : '3 Months'}</div>
              <div className="text-lg font-bold mt-1">{stats.package3Months}</div>
            </button>

            <button
              onClick={() => setFilterPackage('6-months')}
              className={`px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105 ${
                filterPackage === '6-months'
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg border-2 border-primary-400'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-2 border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
              }`}
            >
              <div className="text-base">{locale === 'ar' ? '6 شهور' : '6 Months'}</div>
              <div className="text-lg font-bold mt-1">{stats.package6Months}</div>
            </button>

            <button
              onClick={() => setFilterPackage('year')}
              className={`px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105 ${
                filterPackage === 'year'
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg border-2 border-primary-400'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-2 border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
              }`}
            >
              <div className="text-base">{locale === 'ar' ? 'سنة' : 'Year'}</div>
              <div className="text-lg font-bold mt-1">{stats.packageYear}</div>
            </button>
          </div>
        </div>

        <div className="border-t dark:border-gray-700 pt-4 mt-4">
          <label className="block text-sm font-medium mb-2 dark:text-gray-200">
            📅 {t('members.filterByExpiryDate')}
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
              className="flex-1 px-3 py-2 md:px-4 md:py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-primary-500 focus:outline-none transition"
              dir={direction}
            />
            {specificDate && (
              <button
                onClick={() => setSpecificDate('')}
                className="px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                ✖️
              </button>
            )}
          </div>
          {specificDate && (
            <p className="text-sm text-primary-600 dark:text-primary-400 mt-2">
              🔍 {t('members.showingMembersExpiring')}: {new Date(specificDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg mb-6 border-2 border-primary-200 dark:border-primary-700" dir={direction}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2 dark:text-white">
            <span>🔍</span>
            <span>{t('members.directSearch')}</span>
          </h3>
          {(searchId || searchName || searchPhone) && (
            <button
              onClick={clearSearch}
              className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg hover:bg-red-200 dark:hover:bg-red-800/50 text-sm font-medium"
            >
              ✖️ {t('members.clearSearch')}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-200">{t('members.membershipNumber')} (ID)</label>
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className="w-full px-3 py-2 md:px-4 md:py-3 border-2 border-gray-300 dark:border-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-primary-500 focus:outline-none transition"
              placeholder={t('members.searchByMembershipNumber')}
              dir={direction}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-200">{t('members.name')}</label>
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="w-full px-3 py-2 md:px-4 md:py-3 border-2 border-gray-300 dark:border-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-primary-500 focus:outline-none transition"
              placeholder={t('members.searchByName')}
              dir={direction}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-200">{t('members.phone')}</label>
            <input
              type="text"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              className="w-full px-3 py-2 md:px-4 md:py-3 border-2 border-gray-300 dark:border-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-primary-500 focus:outline-none transition"
              placeholder={t('members.searchByPhone')}
              dir={direction}
            />
          </div>
        </div>

        {(searchId || searchName || searchPhone) && (
          <div className="mt-4 text-center">
            <span className="bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 px-4 py-2 rounded-lg text-sm font-medium">
              📊 {t('members.showing', { count: filteredMembers.length.toString(), total: membersData.length.toString() })}
            </span>
          </div>
        )}
      </div>

      {(searchId || searchName || searchPhone || filterStatus !== 'all' || filterPackage !== 'all' || specificDate) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 p-4 rounded-xl mb-6 flex items-center justify-between" dir={direction}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔎</span>
            <div>
              <p className="font-bold text-yellow-800 dark:text-yellow-300">{t('members.filtersActive')}</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">{t('members.showing', { count: filteredMembers.length.toString(), total: membersData.length.toString() })}</p>
            </div>
          </div>
          <button
            onClick={clearAllFilters}
            className="bg-yellow-600 dark:bg-yellow-700 text-white px-6 py-2 rounded-lg hover:bg-yellow-700 dark:hover:bg-yellow-800 font-medium"
          >
            🗑️ {t('members.clearAllFilters')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 dark:text-white">{t('common.loading')}</div>
      ) : (
        <>
          {/* Desktop Table - Hidden on mobile/tablet */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" dir={direction}>
                <thead className="bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 dark:bg-gray-700 dark:bg-gray-700">
                  <tr>
                    <th className={`px-4 py-3 dark:text-gray-200 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('members.image')}</th>
                    <th className={`px-4 py-3 dark:text-gray-200 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>ID</th>
                    <th className={`px-4 py-3 dark:text-gray-200 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('members.name')}</th>
                    <th className={`px-4 py-3 dark:text-gray-200 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('members.phone')}</th>
                    <th className={`px-4 py-3 dark:text-gray-200 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('members.price')}</th>
                    <th className={`px-4 py-3 dark:text-gray-200 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{locale === 'ar' ? 'الباقة' : 'Package'}</th>
                    <th className={`px-4 py-3 dark:text-gray-200 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('members.status')}</th>
                    <th className={`px-4 py-3 dark:text-gray-200 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('members.startDate')}</th>
                    <th className={`px-4 py-3 dark:text-gray-200 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('members.expiryDate')}</th>
                    <th className={`px-4 py-3 dark:text-gray-200 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('members.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(currentMembers) && currentMembers.map((member) => {
                    const isExpired = member.expiryDate ? new Date(member.expiryDate) < new Date() : false
                    const daysRemaining = calculateRemainingDays(member.expiryDate)
                    const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7

                    return (
                      <tr key={member.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3">
                          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 dark:bg-gray-700">
                            {member.profileImage ? (
                              <img
                                src={member.profileImage}
                                alt={member.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500 dark:text-gray-400">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 font-bold text-primary-600">#{member.memberNumber}</td>
                        <td className="px-4 py-3">{member.name}</td>
                        <td className="px-4 py-3">
                          <a
                            href={`https://wa.me/+20${member.phone.startsWith('0') ? member.phone.substring(1) : member.phone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 hover:text-green-700 hover:underline font-medium"
                          >
                            {member.phone}
                          </a>
                        </td>
                        <td className="px-4 py-3">{member.subscriptionPrice} {t('members.egp')}</td>
                        <td className="px-4 py-3">
                          <span className="text-primary-600 font-bold">
                            {getPackageName(member.startDate, member.expiryDate, locale)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1.5 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 shadow-sm ${
                            member.isFrozen
                              ? 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 border border-blue-300'
                              : isExpiringSoon
                                ? 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border border-orange-300'
                                : member.isActive && !isExpired
                                  ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-300'
                                  : 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border border-red-300'
                          }`}>
                            {member.isFrozen
                              ? <><span className="text-lg">❄️</span> {locale === 'ar' ? 'مجمد' : 'Frozen'}</>
                              : isExpiringSoon
                                ? <><span className="text-lg">🟡</span> {locale === 'ar' ? 'ينتهي قريباً' : 'Expiring Soon'}</>
                                : member.isActive && !isExpired
                                  ? <><span className="text-lg">🟢</span> {t('members.active')}</>
                                  : <><span className="text-lg">🔴</span> {t('members.expired')}</>
                            }
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-700 dark:text-gray-200 font-mono">
                            {formatDateYMD(member.startDate)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {member.expiryDate ? (
                            <div>
                              <span className={`font-mono ${isExpired ? 'text-red-600 font-bold' : isExpiringSoon ? 'text-orange-600 font-bold' : ''}`}>
                                {formatDateYMD(member.expiryDate)}
                              </span>
                              {daysRemaining !== null && daysRemaining > 0 && (
                                <p className={`text-xs ${isExpiringSoon ? 'text-orange-600' : 'text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400'}`}>
                                  {isExpiringSoon && '⚠️ '} {t('members.daysRemaining', { days: daysRemaining.toString() })}
                                </p>
                              )}
                              {isExpired && daysRemaining !== null && (
                                <p className="text-xs text-red-600">
                                  ❌ {t('members.expiredSince', { days: Math.abs(daysRemaining).toString() })}
                                </p>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleViewDetails(member.id)}
                            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 transition shadow-md hover:shadow-lg font-medium"
                          >
                            👁️ {t('members.viewDetails')}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile/Tablet Cards - Hidden on desktop */}
          <div className="lg:hidden space-y-3">
            {Array.isArray(currentMembers) && currentMembers.map((member) => {
              const isExpired = member.expiryDate ? new Date(member.expiryDate) < new Date() : false
              const daysRemaining = calculateRemainingDays(member.expiryDate)
              const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7

              return (
                <div key={member.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border-2 border-gray-200 dark:border-gray-600 hover:shadow-lg dark:hover:shadow-2xl transition" dir={direction}>
                  {/* Header with Image and Member Number */}
                  <div className="bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800 p-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-3 border-white shadow-lg bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 flex-shrink-0">
                        {member.profileImage ? (
                          <img
                            src={member.profileImage}
                            alt={member.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500 dark:text-gray-400">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xl font-bold text-white mb-1">#{member.memberNumber}</div>
                        <div className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          member.isFrozen
                            ? 'bg-primary-400 dark:bg-primary-500 text-white'
                            : member.isActive && !isExpired
                              ? 'bg-green-500 dark:bg-green-600 text-white'
                              : 'bg-red-500 dark:bg-red-600 text-white'
                        }`}>
                          {member.isFrozen
                            ? `❄️ ${locale === 'ar' ? 'مجمد' : 'Frozen'}`
                            : member.isActive && !isExpired
                              ? `✓ ${t('members.active')}`
                              : `✕ ${t('members.expired')}`
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-3 space-y-2.5">
                    {/* Name */}
                    <div className="pb-2.5 border-b-2 border-gray-100 dark:border-gray-700 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">👤</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 font-semibold">{t('members.name')}</span>
                      </div>
                      <div className="text-base font-bold text-gray-800 dark:text-gray-100">{member.name}</div>
                    </div>

                    {/* Phone */}
                    <div className="pb-2.5 border-b-2 border-gray-100 dark:border-gray-700 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">📱</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 font-semibold">{t('members.phone')}</span>
                      </div>
                      <a
                        href={`https://wa.me/+20${member.phone.startsWith('0') ? member.phone.substring(1) : member.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-mono text-green-600 hover:text-green-700 hover:underline direction-ltr text-right block font-medium"
                      >
                        {member.phone}
                      </a>
                    </div>

                    {/* Price and Package Info */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700 rounded-lg p-2.5">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-sm">💰</span>
                          <span className="text-xs text-green-700 dark:text-green-300 font-semibold">{t('members.price')}</span>
                        </div>
                        <div className="text-base font-bold text-green-600 dark:text-green-400">{member.subscriptionPrice} {t('members.egp')}</div>
                      </div>

                      <div className="bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-200 dark:border-primary-700 rounded-lg p-2.5">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-sm">📦</span>
                          <span className="text-xs text-primary-700 dark:text-primary-300 font-semibold">{locale === 'ar' ? 'الباقة' : 'Package'}</span>
                        </div>
                        <div className="text-base font-bold text-primary-600 dark:text-primary-400">{getPackageName(member.startDate, member.expiryDate, locale)}</div>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="space-y-1.5 pt-1">
                      <div className="bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-200 dark:border-primary-700 rounded-lg p-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">📅</span>
                          <span className="text-xs text-primary-700 dark:text-primary-300 font-semibold">{t('members.startDate')}</span>
                        </div>
                        <div className="text-sm font-mono text-gray-700 dark:text-gray-200">{formatDateYMD(member.startDate)}</div>
                      </div>

                      {member.expiryDate && (
                        <div className={`border-2 rounded-lg p-2.5 ${
                          isExpired ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' : isExpiringSoon ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">{isExpired ? '❌' : isExpiringSoon ? '⚠️' : '📅'}</span>
                            <span className={`text-xs font-semibold ${
                              isExpired ? 'text-red-700 dark:text-red-400' : isExpiringSoon ? 'text-orange-700 dark:text-orange-400' : 'text-gray-700 dark:text-gray-200'
                            }`}>{t('members.expiryDate')}</span>
                          </div>
                          <div className={`text-sm font-mono font-bold ${
                            isExpired ? 'text-red-600 dark:text-red-400' : isExpiringSoon ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-200'
                          }`}>
                            {formatDateYMD(member.expiryDate)}
                          </div>
                          {daysRemaining !== null && daysRemaining > 0 && (
                            <div className={`text-xs mt-1 font-semibold ${isExpiringSoon ? 'text-orange-700 dark:text-orange-400' : 'text-gray-600 dark:text-gray-300'}`}>
                              {isExpiringSoon && '⚠️ '} {t('members.daysRemaining', { days: daysRemaining.toString() })}
                            </div>
                          )}
                          {isExpired && daysRemaining !== null && (
                            <div className="text-xs mt-1 font-semibold text-red-700 dark:text-red-400">
                              ❌ {t('members.expiredSince', { days: Math.abs(daysRemaining).toString() })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Last Receipt Box */}
                    {lastReceipts[member.id] && (
                      <div
                        onClick={() => handleShowReceipts(member.id, member.memberNumber)}
                        className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-lg p-2.5 cursor-pointer hover:shadow-md dark:hover:shadow-lg transition"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">🧾</span>
                          <span className="text-xs text-orange-700 dark:text-orange-300 font-semibold">{locale === 'ar' ? 'آخر إيصال' : 'Last Receipt'}</span>
                        </div>
                        <div className="text-sm font-bold text-orange-600 dark:text-orange-400">
                          #{lastReceipts[member.id].receiptNumber} - {lastReceipts[member.id].amount} {t('members.egp')}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          {new Date(lastReceipts[member.id].createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                        <div className="text-xs text-primary-600 dark:text-primary-400 mt-1 font-semibold">
                          {locale === 'ar' ? '⬅️ اضغط لعرض السجل' : 'Click to view history ➡️'}
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    <button
                      onClick={() => handleViewDetails(member.id)}
                      className="w-full bg-primary-600 text-white py-2.5 rounded-lg text-sm hover:bg-primary-700 transition shadow-md hover:shadow-lg font-bold mt-1.5"
                    >
                      👁️ {t('members.viewDetails')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Pagination Controls */}
      {!loading && filteredMembers.length > 0 && (
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6" dir={direction}>
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                {/* معلومات الصفحة */}
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {t('members.showingXToYOfZ', {
                    start: (startIndex + 1).toString(),
                    end: Math.min(endIndex, filteredMembers.length).toString(),
                    total: filteredMembers.length.toString()
                  })}
                </div>

                {/* عدد العناصر في الصفحة */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-300">{t('members.itemsPerPage')}:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-primary-500 focus:outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                {/* أزرار التنقل */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => goToPage(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                      {t('members.firstPage')}
                    </button>
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                      {t('members.previousPage')}
                    </button>

                    {/* أرقام الصفحات */}
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => goToPage(pageNum)}
                            className={`px-3 py-2 rounded-lg font-medium ${
                              currentPage === pageNum
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                    </div>

                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                      {t('members.nextPage')}
                    </button>
                    <button
                      onClick={() => goToPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                      {t('members.lastPage')}
                    </button>
                  </div>
                )}
              </div>

              {/* معلومات إضافية */}
              <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                {t('members.pageXOfY', { current: currentPage.toString(), total: totalPages.toString() })}
              </div>
            </div>
          )}

      {filteredMembers.length === 0 && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center text-gray-500 dark:text-gray-400" dir={direction}>
          {(searchId || searchName || searchPhone || filterStatus !== 'all' || specificDate) ? (
            <>
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-xl">{t('members.noMatchingResults')}</p>
              <button
                onClick={clearAllFilters}
                className="mt-4 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
              >
                {t('members.clearAllFilters')}
              </button>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4">📋</div>
              <p className="text-xl">{t('members.noMembers')}</p>
            </>
          )}
        </div>
      )}

      {/* Modal سجل الحضور */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden" dir={direction}>
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-3xl">📊</span>
                <h2 className="text-2xl font-bold">{t('members.memberAttendanceLog')}</h2>
              </div>
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="text-white hover:bg-white dark:bg-gray-800 hover:text-green-600 rounded-full w-10 h-10 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {/* Filters */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700 dark:bg-gray-700 border-b" dir={direction}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">{t('members.fromDate')}</label>
                  <input
                    type="date"
                    value={attendanceStartDate}
                    onChange={(e) => setAttendanceStartDate(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg focus:border-green-500 focus:outline-none"
                    dir={direction}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">{t('members.toDate')}</label>
                  <input
                    type="date"
                    value={attendanceEndDate}
                    onChange={(e) => setAttendanceEndDate(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg focus:border-green-500 focus:outline-none"
                    dir={direction}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={fetchAttendanceSummary}
                    disabled={attendanceLoading}
                    className="w-full bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold"
                  >
                    {attendanceLoading ? t('common.loading') : t('members.applyFilter')}
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {attendanceLoading ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">⏳</div>
                  <p className="text-gray-600 dark:text-gray-300">{t('members.loadingData')}</p>
                </div>
              ) : attendanceSummary.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📭</div>
                  <p className="text-xl text-gray-600 dark:text-gray-300">{t('members.noAttendanceRecords')}</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between bg-primary-50 p-4 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{t('members.membersWhoAttended')}</p>
                      <p className="text-3xl font-bold text-primary-600">{attendanceSummary.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{t('members.totalAttendance')}</p>
                      <p className="text-3xl font-bold text-green-600">
                        {attendanceSummary.reduce((sum, item) => sum + item.count, 0)}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full" dir={direction}>
                      <thead className="bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 dark:bg-gray-700 sticky top-0">
                        <tr>
                          <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('members.rank')}</th>
                          <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('members.membershipNumber')}</th>
                          <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('members.name')}</th>
                          <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('members.phone')}</th>
                          <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('members.attendanceCount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceSummary.map((item, index) => (
                          <tr key={item.member?.id || index} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-700">
                            <td className="px-4 py-3">
                              <span className="font-bold text-lg">
                                {index === 0 && '🥇'}
                                {index === 1 && '🥈'}
                                {index === 2 && '🥉'}
                                {index > 2 && `#${index + 1}`}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-primary-600 font-bold">
                              #{item.member?.memberNumber || '-'}
                            </td>
                            <td className="px-4 py-3 font-semibold">{item.member?.name || t('members.unknown')}</td>
                            <td className="px-4 py-3 font-mono">
                              {item.member?.phone ? (
                                <a
                                  href={`https://wa.me/+2${item.member.phone.startsWith('0') ? item.member.phone.substring(1) : item.member.phone}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-green-600 hover:text-green-700 hover:underline font-medium"
                                >
                                  {item.member.phone}
                                </a>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-bold text-xl">
                                {item.count}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700 dark:bg-gray-700 border-t flex justify-end">
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Receipts Modal */}
      {showReceiptsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir={direction}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" dir={direction}>
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600 to-yellow-600 text-white p-6 rounded-t-lg">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span>🧾</span>
                <span>{locale === 'ar' ? 'سجل الإيصالات' : 'Receipts History'}</span>
              </h2>
              <p className="text-orange-100 mt-1">
                {selectedMemberId && membersData.find(m => m.id === selectedMemberId)?.name}
              </p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {receiptsLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin text-6xl mb-4">⏳</div>
                  <p className="text-xl text-gray-600 dark:text-gray-300">{locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
                </div>
              ) : memberReceipts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 text-xl">
                    {locale === 'ar' ? 'لا توجد إيصالات' : 'No receipts found'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {memberReceipts.map((receipt) => {
                    const itemDetails = JSON.parse(receipt.itemDetails)
                    return (
                      <div
                        key={receipt.id}
                        className="bg-gradient-to-r from-gray-50 to-white border-2 border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-bold">
                                #{receipt.receiptNumber}
                              </span>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                receipt.isCancelled
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {receipt.isCancelled
                                  ? (locale === 'ar' ? '❌ ملغي' : '❌ Cancelled')
                                  : (locale === 'ar' ? '✓ نشط' : '✓ Active')
                                }
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'المبلغ:' : 'Amount:'}</span>
                                <span className="font-bold text-green-600 mr-2">{receipt.amount} {t('members.egp')}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'الطريقة:' : 'Method:'}</span>
                                <span className="font-semibold mr-2">
                                  {receipt.paymentMethod === 'cash' ? (locale === 'ar' ? 'كاش 💵' : 'Cash 💵')
                                    : receipt.paymentMethod === 'visa' ? (locale === 'ar' ? 'فيزا 💳' : 'Visa 💳')
                                    : receipt.paymentMethod === 'instapay' ? (locale === 'ar' ? 'إنستاباي 📱' : 'Instapay 📱')
                                    : (locale === 'ar' ? 'محفظة 💰' : 'Wallet 💰')
                                  }
                                </span>
                              </div>
                              {itemDetails.packageType && (
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'الباقة:' : 'Package:'}</span>
                                  <span className="font-semibold mr-2">{itemDetails.packageType}</span>
                                </div>
                              )}
                              <div>
                                <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'التاريخ:' : 'Date:'}</span>
                                <span className="font-mono text-xs mr-2">
                                  {new Date(receipt.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                            {itemDetails.startDate && itemDetails.expiryDate && (
                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                <div className="text-xs text-gray-600 dark:text-gray-300">
                                  <span className="font-semibold">{locale === 'ar' ? 'الفترة:' : 'Period:'}</span>
                                  <span className="font-mono mr-2">
                                    {new Date(itemDetails.startDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                  </span>
                                  <span className="mx-1">→</span>
                                  <span className="font-mono">
                                    {new Date(itemDetails.expiryDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700 dark:bg-gray-700 border-t flex justify-between items-center">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {locale === 'ar' ? 'إجمالي الإيصالات:' : 'Total Receipts:'} <span className="font-bold">{memberReceipts.length}</span>
              </div>
              <button
                onClick={() => {
                  setShowReceiptsModal(false)
                  setSelectedMemberId(null)
                  setMemberReceipts([])
                }}
                className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}