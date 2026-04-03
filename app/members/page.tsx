// app/members/page.tsx - إصلاح الأرقام العشرية
'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionDenied from '../../components/PermissionDenied'
import { useAdminDate } from '../../contexts/AdminDateContext'
import { formatDateYMD, calculateRemainingDays } from '../../lib/dateFormatter'
import { getPackageName } from '../../lib/memberUtils'
import { useLanguage } from '../../contexts/LanguageContext'
import { fetchMembers, fetchOffers } from '../../lib/api/members'
import { useToast } from '../../contexts/ToastContext'
import { MembersSkeleton } from '../../components/LoadingSkeleton'
import { useDebounce } from '../../hooks/useDebounce'

// ✅ Dynamic imports - تحميل المكونات الثقيلة عند الحاجة فقط
const MemberForm = nextDynamic(() => import('../../components/MemberForm'), {
  ssr: false,
  loading: () => <div className="animate-pulse h-40 bg-gray-200 dark:bg-gray-700 rounded-xl" />
})

const MembersAnalytics = nextDynamic(() => import('../../components/MembersAnalytics'), {
  ssr: false,
  loading: () => <div className="animate-pulse h-64 bg-gray-200 dark:bg-gray-700 rounded-xl mt-4" />
})

const VirtualMemberList = nextDynamic(() => import('../../components/VirtualMemberList'), {
  ssr: false,
  loading: () => <div className="animate-pulse h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
})

interface Member {
  id: string
  memberNumber: number | null
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
  isBanned: boolean
  freezeUntil?: string
  startDate?: string
  expiryDate?: string
  createdAt: string
}

// ✅ Fuzzy search helper
import { normalizeArabic } from '@/lib/arabicNormalization'

function fuzzyMatch(str: string, pattern: string): boolean {
  if (!pattern) return true
  const s = normalizeArabic(str)
  const p = normalizeArabic(pattern)
  // If pattern is contained, match immediately (faster path)
  if (s.includes(p)) return true
  // Fuzzy: all chars of pattern appear in order in str
  let pi = 0
  for (let si = 0; si < s.length && pi < p.length; si++) {
    if (s[si] === p[pi]) pi++
  }
  return pi === p.length
}

// ✅ التحقق من حالة العضو (هل بدأ الاشتراك ولم ينتهي؟)
function isMemberActiveNow(member: Member): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // التحقق من تاريخ البداية
  const startDate = member.startDate ? new Date(member.startDate) : null
  const hasStarted = !startDate || startDate <= today

  // التحقق من تاريخ الانتهاء
  const expiryDate = member.expiryDate ? new Date(member.expiryDate) : null
  const notExpired = !expiryDate || expiryDate >= today

  return member.isActive && hasStarted && notExpired
}

export default function MembersPage() {
  const router = useRouter()
  const { hasPermission, loading: permissionsLoading, user } = usePermissions()
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

  // ✅ Debounced search values - تأخير البحث لتحسين الأداء
  const debouncedSearchId = useDebounce(searchId, 300)
  const debouncedSearchName = useDebounce(searchName, 300)
  const debouncedSearchPhone = useDebounce(searchPhone, 300)

  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired' | 'expiring-soon' | 'has-remaining' | 'other' | 'analytics' | 'banned'>('all')
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

  // Infinite Scroll
  const [displayCount, setDisplayCount] = useState(30)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // WhatsApp جماعي
  const [showBulkWA, setShowBulkWA] = useState(false)

  // المحظورون
  const [bannedMembers, setBannedMembers] = useState<any[]>([])
  const [bannedLoading, setBannedLoading] = useState(false)
  const [showAddBanModal, setShowAddBanModal] = useState(false)
  const [banForm, setBanForm] = useState({ name: '', phone: '', nationalId: '', reason: '', notes: '' })
  const [banSubmitting, setBanSubmitting] = useState(false)
  const [banError, setBanError] = useState('')
  const [bulkWAMessage, setBulkWAMessage] = useState('السلام عليكم {name}، اشتراكك في الجيم انتهى أو قارب على الانتهاء. تواصل معنا لتجديد اشتراكك. 💪')
  const [bulkWASent, setBulkWASent] = useState(0)

  // استخدام useMemo بدل useState للـ filteredMembers لتجنب infinite loop
  // ✅ استخدام الـ debounced values لتحسين الأداء
  const filteredMembers = useMemo(() => {
    let filtered = membersData.map((m: any) => ({
      ...m,
      freezeUntil: m.isFrozen && m.freezeRequests?.[0]?.endDate ? m.freezeRequests[0].endDate : undefined
    }))

    if (debouncedSearchId || debouncedSearchName || debouncedSearchPhone) {
      filtered = filtered.filter((member) => {
        const idMatch = debouncedSearchId
          ? member.memberNumber !== null && (member.memberNumber === parseInt(debouncedSearchId) || member.memberNumber.toString() === debouncedSearchId)
          : true

        const nameMatch = debouncedSearchName
          ? fuzzyMatch(member.name, debouncedSearchName)
          : true

        const phoneMatch = debouncedSearchPhone
          ? member.phone.includes(debouncedSearchPhone)
          : true

        return idMatch && nameMatch && phoneMatch
      })
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((member) => {
        const isActiveNow = isMemberActiveNow(member)
        const daysRemaining = calculateRemainingDays(member.expiryDate)
        const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7

        if (filterStatus === 'expired') {
          // استثناء اللي لسه ما بدأوش - دول مش منتهيين
          const startDate = member.startDate ? new Date(member.startDate) : null
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const notStartedYet = member.isActive && startDate && startDate > today
          return !isActiveNow && !notStartedYet
        } else if (filterStatus === 'expiring-soon') {
          return isExpiringSoon && isActiveNow
        } else if (filterStatus === 'active') {
          return isActiveNow
        } else if (filterStatus === 'has-remaining') {
          return member.remainingAmount > 0
        } else if (filterStatus === 'other') {
          return member.memberNumber === null
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
  }, [debouncedSearchId, debouncedSearchName, debouncedSearchPhone, filterStatus, filterPackage, specificDate, membersData])

  // ✅ جلب المحظورين عند التحميل (لو عنده صلاحية)
  useEffect(() => {
    if (!permissionsLoading && hasPermission('canManageBannedMembers')) {
      fetchBannedMembers()
    }
  }, [permissionsLoading])

  // ✅ Set سريع للبحث عن المحظورين بالهاتف
  const bannedPhones = useMemo(
    () => new Set(bannedMembers.map(b => b.phone).filter(Boolean)),
    [bannedMembers]
  )

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
    // ✅ فقط إذا كان لديه صلاحية عرض الإيصالات
    if (!permissionsLoading && hasPermission('canViewReceipts')) {
      fetchLastReceipts()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsLoading])

  // إعادة تعيين الصفحة عند تغيير الفلاتر (مش البيانات)
  useEffect(() => {
    setCurrentPage(1)
    setDisplayCount(30)
  }, [searchId, searchName, searchPhone, filterStatus, filterPackage, specificDate])

  // ✅ Infinite Scroll - IntersectionObserver for desktop table
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setDisplayCount(c => Math.min(c + 20, filteredMembers.length))
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [filteredMembers.length])

  // حساب الصفحات (للـ pagination controls القديمة - محتفظ بها للـ backward compat)
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentMembers = filteredMembers.slice(startIndex, endIndex)

  // ✅ Infinite Scroll - visible members for desktop table
  const visibleMembers = filteredMembers.slice(0, displayCount)

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
    const isActiveNow = isMemberActiveNow(member)
    const daysRemaining = calculateRemainingDays(member.expiryDate)
    const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7

    if (filterStatus === 'all') return true
    if (filterStatus === 'expired') {
      const startDate = member.startDate ? new Date(member.startDate) : null
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const notStartedYet = member.isActive && startDate && startDate > today
      return !isActiveNow && !notStartedYet
    }
    if (filterStatus === 'expiring-soon') return isExpiringSoon && isActiveNow
    if (filterStatus === 'active') return isActiveNow
    if (filterStatus === 'has-remaining') return member.remainingAmount > 0
    if (filterStatus === 'other') return member.memberNumber === null
    return true
  }

  const stats = {
    total: membersData.length,
    active: membersData.filter(m => isMemberActiveNow(m)).length,
    expired: membersData.filter(m => {
      if (isMemberActiveNow(m)) return false
      const startDate = m.startDate ? new Date(m.startDate) : null
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const notStartedYet = m.isActive && startDate && startDate > today
      return !notStartedYet
    }).length,
    expiringSoon: membersData.filter(m => {
      const daysRemaining = calculateRemainingDays(m.expiryDate)
      return isMemberActiveNow(m) && daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7
    }).length,
    hasRemaining: membersData.filter(m => m.remainingAmount > 0).length,
    other: membersData.filter(m => m.memberNumber === null).length,
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

  // ✅ جلب المحظورين
  const fetchBannedMembers = async () => {
    setBannedLoading(true)
    try {
      const res = await fetch('/api/banned-members')
      const data = await res.json()
      setBannedMembers(Array.isArray(data) ? data : [])
    } catch {
      setBannedMembers([])
    } finally {
      setBannedLoading(false)
    }
  }

  const handleAddBan = async () => {
    if (!banForm.phone && !banForm.nationalId) {
      setBanError('يجب إدخال رقم الهاتف أو الرقم القومي على الأقل')
      return
    }
    setBanSubmitting(true)
    setBanError('')
    try {
      const res = await fetch('/api/banned-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(banForm)
      })
      if (res.ok) {
        setBanForm({ name: '', phone: '', nationalId: '', reason: '', notes: '' })
        setShowAddBanModal(false)
        fetchBannedMembers()
      } else {
        const err = await res.json()
        setBanError(err.error || 'فشل الإضافة')
      }
    } catch {
      setBanError('خطأ في الاتصال')
    } finally {
      setBanSubmitting(false)
    }
  }

  const handleRemoveBan = async (id: string) => {
    if (!confirm('هل تريد إزالة هذا الشخص من قائمة المحظورين؟')) return
    try {
      await fetch(`/api/banned-members?id=${id}`, { method: 'DELETE' })
      fetchBannedMembers()
    } catch {}
  }

  // ✅ WhatsApp جماعي
  const sendBulkWhatsApp = () => {
    setBulkWASent(0)
    const membersWithPhone = filteredMembers.filter(m => m.phone)
    membersWithPhone.forEach((member, i) => {
      setTimeout(() => {
        const msg = bulkWAMessage.replace('{name}', member.name)
        const phone = member.phone.replace(/\D/g, '').replace(/^0/, '20')
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
        setBulkWASent(i + 1)
      }, i * 800)
    })
  }

  // ✅ تصدير CSV
  const exportToCSV = () => {
    const headers = ['رقم العضو', 'الاسم', 'الهاتف', 'الحالة', 'تاريخ البداية', 'تاريخ الانتهاء', 'المبلغ المدفوع', 'المبلغ المتبقي', 'مجمد']
    const rows = filteredMembers.map(m => [
      m.memberNumber ?? 'Other',
      m.name,
      m.phone,
      m.isActive ? 'نشط' : 'منتهي',
      m.startDate || '',
      m.expiryDate || '',
      m.subscriptionPrice,
      m.remainingAmount,
      m.isFrozen ? 'نعم' : 'لا',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `members_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
          {user?.role === 'OWNER' && (
          <button
            onClick={exportToCSV}
            title={locale === 'ar' ? 'تصدير CSV' : 'Export CSV'}
            className="bg-green-600 dark:bg-green-700 text-white px-4 sm:px-5 py-2 rounded-lg hover:bg-green-700 dark:hover:bg-green-800 text-xs sm:text-sm font-bold flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            CSV
          </button>
          )}
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

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
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

          {stats.other > 0 && (
            <button
              onClick={() => setFilterStatus('other')}
              className={`px-6 py-4 rounded-xl font-bold transition-all transform hover:scale-105 ${
                filterStatus === 'other'
                  ? 'bg-gradient-to-br from-gray-500 to-gray-600 text-white shadow-xl border-2 border-gray-400'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              <div className="text-2xl mb-1">🏷️</div>
              <div className="text-sm">{locale === 'ar' ? 'بدون عضوية' : 'Non-Members'}</div>
              <div className="text-2xl font-bold">{stats.other}</div>
            </button>
          )}

          <button
            onClick={() => setFilterStatus('analytics')}
            className={`px-6 py-4 rounded-xl font-bold transition-all transform hover:scale-105 ${
              filterStatus === 'analytics'
                ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-xl border-2 border-purple-400'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-2 border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500'
            }`}
          >
            <div className="text-2xl mb-1">📈</div>
            <div className="text-sm">{locale === 'ar' ? 'التحليلات' : 'Analytics'}</div>
          </button>

          {hasPermission('canManageBannedMembers') && (
            <button
              onClick={() => { setFilterStatus('banned'); fetchBannedMembers() }}
              className={`px-6 py-4 rounded-xl font-bold transition-all transform hover:scale-105 ${
                filterStatus === 'banned'
                  ? 'bg-gradient-to-br from-red-700 to-red-800 text-white shadow-xl border-2 border-red-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-2 border-gray-300 dark:border-gray-600 hover:border-red-400 dark:hover:border-red-500'
              }`}
            >
              <div className="text-2xl mb-1">🚫</div>
              <div className="text-sm">{locale === 'ar' ? 'المحظورون' : 'Banned'}</div>
              <div className="text-2xl font-bold">{bannedMembers.length || ''}</div>
            </button>
          )}
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
            {/* عرض مؤشر البحث إذا كان هناك فرق بين القيمة المدخلة والقيمة المؤجلة */}
            {(searchId !== debouncedSearchId || searchName !== debouncedSearchName || searchPhone !== debouncedSearchPhone) ? (
              <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                🔍 {locale === 'ar' ? 'جاري البحث...' : 'Searching...'}
              </span>
            ) : (
              <span className="bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 px-4 py-2 rounded-lg text-sm font-medium">
                📊 {t('members.showing', { count: filteredMembers.length.toString(), total: membersData.length.toString() })}
              </span>
            )}
          </div>
        )}
      </div>

      {(searchId || searchName || searchPhone || filterStatus !== 'all' || filterPackage !== 'all' || specificDate) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 p-4 rounded-xl mb-6 flex flex-wrap items-center justify-between gap-2" dir={direction}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔎</span>
            <div>
              <p className="font-bold text-yellow-800 dark:text-yellow-300">{t('members.filtersActive')}</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">{t('members.showing', { count: filteredMembers.length.toString(), total: membersData.length.toString() })}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {filteredMembers.some(m => m.phone) && (
              <button
                onClick={() => { setBulkWASent(0); setShowBulkWA(true) }}
                className="bg-green-600 dark:bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-700 dark:hover:bg-green-800 font-medium text-sm flex items-center gap-2"
              >
                <span>📲</span> WhatsApp جماعي ({filteredMembers.filter(m => m.phone).length})
              </button>
            )}
            <button
              onClick={clearAllFilters}
              className="bg-yellow-600 dark:bg-yellow-700 text-white px-6 py-2 rounded-lg hover:bg-yellow-700 dark:hover:bg-yellow-800 font-medium"
            >
              🗑️ {t('members.clearAllFilters')}
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Bulk Modal */}
      {showBulkWA && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir={direction}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="bg-green-600 dark:bg-green-700 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <span>📲</span> WhatsApp جماعي
              </h3>
              <button onClick={() => setShowBulkWA(false)} className="text-white/80 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                سيتم إرسال رسالة لـ <strong className="text-green-600 dark:text-green-400">{filteredMembers.filter(m => m.phone).length}</strong> عضو.
                استخدم <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">{'{name}'}</code> لاسم العضو.
              </p>
              <textarea
                value={bulkWAMessage}
                onChange={e => setBulkWAMessage(e.target.value)}
                rows={4}
                className="w-full border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500 mb-4"
                dir="rtl"
              />
              {bulkWASent > 0 && (
                <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">
                  ✅ تم إرسال {bulkWASent} من {filteredMembers.filter(m => m.phone).length}...
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={sendBulkWhatsApp}
                  disabled={!bulkWAMessage.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <span>📲</span> بدء الإرسال
                </button>
                <button
                  onClick={() => setShowBulkWA(false)}
                  className="px-6 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 rounded-xl font-medium transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 dark:text-white">{t('common.loading')}</div>
      ) : filterStatus === 'banned' ? (
        /* ===== قسم المحظورين ===== */
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6" dir={direction}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
              <span>🚫</span>
              <span>{locale === 'ar' ? 'قائمة المحظورين' : 'Banned Members List'}</span>
            </h2>
            <button
              onClick={() => { setBanError(''); setShowAddBanModal(true) }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <span>＋</span>
              <span>{locale === 'ar' ? 'إضافة محظور' : 'Add Ban'}</span>
            </button>
          </div>

          {bannedLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
          ) : bannedMembers.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <div className="text-5xl mb-3">✅</div>
              <p className="text-lg font-medium">{locale === 'ar' ? 'لا يوجد محظورون' : 'No banned members'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" dir={direction}>
                <thead className="bg-red-50 dark:bg-red-900/20">
                  <tr>
                    <th className="px-4 py-3 text-right text-red-700 dark:text-red-400 font-bold">#</th>
                    <th className="px-4 py-3 text-right text-red-700 dark:text-red-400 font-bold">{locale === 'ar' ? 'الاسم' : 'Name'}</th>
                    <th className="px-4 py-3 text-right text-red-700 dark:text-red-400 font-bold">{locale === 'ar' ? 'رقم الهاتف' : 'Phone'}</th>
                    <th className="px-4 py-3 text-right text-red-700 dark:text-red-400 font-bold">{locale === 'ar' ? 'الرقم القومي' : 'National ID'}</th>
                    <th className="px-4 py-3 text-right text-red-700 dark:text-red-400 font-bold">{locale === 'ar' ? 'السبب' : 'Reason'}</th>
                    <th className="px-4 py-3 text-right text-red-700 dark:text-red-400 font-bold">{locale === 'ar' ? 'بواسطة' : 'By'}</th>
                    <th className="px-4 py-3 text-right text-red-700 dark:text-red-400 font-bold">{locale === 'ar' ? 'التاريخ' : 'Date'}</th>
                    <th className="px-4 py-3 text-right text-red-700 dark:text-red-400 font-bold">{locale === 'ar' ? 'إجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {bannedMembers.map((ban, idx) => (
                    <tr key={ban.id} className="border-t dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/10">
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-100">{ban.name || '-'}</td>
                      <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-200">{ban.phone || '-'}</td>
                      <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-200">{ban.nationalId || '-'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{ban.reason || '-'}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{ban.bannedBy || '-'}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {new Date(ban.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleRemoveBan(ban.id)}
                          className="bg-gray-200 hover:bg-red-100 dark:bg-gray-700 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 font-bold px-3 py-1 rounded-lg text-xs transition-colors"
                        >
                          🗑️ {locale === 'ar' ? 'إزالة' : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal إضافة محظور */}
          {showAddBanModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir={direction}>
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span>🚫</span>
                    <span>{locale === 'ar' ? 'إضافة محظور جديد' : 'Add New Ban'}</span>
                  </h3>
                  <button onClick={() => setShowAddBanModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
                </div>

                {banError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 p-3 rounded-lg mb-4 text-sm">
                    {banError}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{locale === 'ar' ? 'الاسم' : 'Name'}</label>
                    <input type="text" value={banForm.name} onChange={e => setBanForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border-2 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:border-red-500 text-sm"
                      placeholder={locale === 'ar' ? 'اسم الشخص (اختياري)' : 'Name (optional)'} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{locale === 'ar' ? 'رقم الهاتف' : 'Phone'}</label>
                    <input type="text" value={banForm.phone} onChange={e => setBanForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full px-3 py-2 border-2 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:border-red-500 text-sm font-mono"
                      placeholder="01xxxxxxxxx" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{locale === 'ar' ? 'الرقم القومي' : 'National ID'}</label>
                    <input type="text" value={banForm.nationalId} onChange={e => setBanForm(f => ({ ...f, nationalId: e.target.value }))}
                      className="w-full px-3 py-2 border-2 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:border-red-500 text-sm font-mono"
                      placeholder="xxxxxxxxxxxxxxx" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{locale === 'ar' ? 'سبب الحظر' : 'Reason'} <span className="text-red-500">*</span></label>
                    <input type="text" value={banForm.reason} onChange={e => setBanForm(f => ({ ...f, reason: e.target.value }))}
                      className="w-full px-3 py-2 border-2 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:border-red-500 text-sm"
                      placeholder={locale === 'ar' ? 'سبب الحظر' : 'Ban reason'} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{locale === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                    <textarea value={banForm.notes} onChange={e => setBanForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full px-3 py-2 border-2 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:border-red-500 text-sm resize-none"
                      rows={2} placeholder={locale === 'ar' ? 'ملاحظات إضافية...' : 'Additional notes...'} />
                  </div>
                </div>

                <div className="flex gap-3 mt-5">
                  <button
                    onClick={handleAddBan}
                    disabled={banSubmitting}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
                  >
                    {banSubmitting ? '...' : `🚫 ${locale === 'ar' ? 'إضافة للقائمة' : 'Add to List'}`}
                  </button>
                  <button
                    onClick={() => setShowAddBanModal(false)}
                    className="px-6 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 rounded-xl font-medium transition-colors"
                  >
                    {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : filterStatus === 'analytics' ? (
        <MembersAnalytics members={membersData} />
      ) : (
        <>
          {/* Desktop Cards - Hidden on mobile/tablet */}
          <div className="hidden lg:block" dir={direction}>
            <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {Array.isArray(visibleMembers) && visibleMembers.map((member) => {
                const isActiveNow = isMemberActiveNow(member)
                const daysRemaining = calculateRemainingDays(member.expiryDate)
                const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7 && isActiveNow
                const startDate = member.startDate ? new Date(member.startDate) : null
                const todayCheck = new Date(); todayCheck.setHours(0, 0, 0, 0)
                const isNotStartedYet = member.isActive && startDate && startDate > todayCheck
                const daysUntilStart = isNotStartedYet ? Math.ceil((startDate!.getTime() - todayCheck.getTime()) / (1000 * 60 * 60 * 24)) : 0
                const isBanned = member.isBanned

                const borderColor = isBanned
                  ? 'border-gray-800'
                  : member.isFrozen
                    ? 'border-blue-400 dark:border-blue-600'
                    : isNotStartedYet
                      ? 'border-purple-400 dark:border-purple-600'
                      : isExpiringSoon
                        ? 'border-orange-400'
                        : isActiveNow
                          ? 'border-green-400'
                          : 'border-red-400'

                return (
                  <div
                    key={member.id}
                    onClick={() => handleViewDetails(member.id)}
                    className={`bg-white dark:bg-gray-800 rounded-xl shadow-md border-2 ${borderColor} hover:shadow-xl transition-all cursor-pointer ${isBanned ? 'opacity-75' : ''}`}
                  >
                    {/* Header: صورة + اسم + رقم */}
                    <div className="p-4 flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                        {member.profileImage ? (
                          <img src={member.profileImage} alt={member.name} loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 dark:text-white truncate">{member.name}</h3>
                          {isBanned && (
                            <span className="bg-gray-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">🚫</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {member.memberNumber !== null ? (
                            <span className="text-primary-600 font-bold text-sm">#{member.memberNumber}</span>
                          ) : (
                            <span className="text-gray-500 text-xs">{locale === 'ar' ? 'بدون عضوية' : 'Non-Member'}</span>
                          )}
                          <span className="text-gray-400 dark:text-gray-500">|</span>
                          <a
                            href={`https://wa.me/+20${member.phone.startsWith('0') ? member.phone.substring(1) : member.phone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-green-600 hover:text-green-700 text-sm font-medium"
                          >
                            {member.phone}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Body: تفاصيل */}
                    <div className="px-4 pb-3 space-y-2">
                      {/* Status Badge */}
                      <div className="flex items-center justify-between">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow-sm ${
                          isBanned
                            ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-white border border-gray-700'
                            : member.isFrozen
                              ? 'bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                              : isNotStartedYet
                                ? 'bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                                : isExpiringSoon
                                  ? 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border border-orange-300'
                                  : isActiveNow
                                    ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-300'
                                    : 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border border-red-300'
                        }`}>
                          {isBanned
                            ? <><span>🚫</span> {locale === 'ar' ? 'محظور' : 'Banned'}</>
                            : member.isFrozen
                              ? <><span>❄️</span> {locale === 'ar' ? 'مجمد' : 'Frozen'}{member.freezeUntil ? <span className="text-[10px] font-normal ms-1">{locale === 'ar' ? 'لحد' : 'until'} {new Date(member.freezeUntil).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })}</span> : null}</>
                              : isNotStartedYet
                                ? <><span>🕐</span> {locale === 'ar' ? `يبدأ بعد ${daysUntilStart} يوم` : `Starts in ${daysUntilStart}d`}</>
                                : isExpiringSoon
                                  ? <><span>🟡</span> {locale === 'ar' ? 'ينتهي قريباً' : 'Expiring Soon'}</>
                                  : isActiveNow
                                    ? <><span>🟢</span> {t('members.active')}</>
                                    : <><span>🔴</span> {t('members.expired')}</>
                          }
                        </span>
                        <span className="text-primary-600 font-bold text-xs">
                          {getPackageName(member.startDate, member.expiryDate, locale)}
                        </span>
                      </div>

                      {/* Price + Dates */}
                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                        <div>
                          <span className="font-bold text-gray-800 dark:text-gray-200">{member.subscriptionPrice}</span> {t('members.egp')}
                        </div>
                        <div className="flex items-center gap-1 font-mono">
                          <span>{formatDateYMD(member.startDate)}</span>
                          <span className="text-gray-400">→</span>
                          <span className={isNotStartedYet ? 'text-purple-600 font-bold' : !isActiveNow ? 'text-red-600 font-bold' : isExpiringSoon ? 'text-orange-600 font-bold' : ''}>
                            {member.expiryDate ? formatDateYMD(member.expiryDate) : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Remaining days info */}
                      {member.expiryDate && !isNotStartedYet && daysRemaining !== null && daysRemaining > 0 && (
                        <p className={`text-xs text-center ${isExpiringSoon ? 'text-orange-600 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                          {isExpiringSoon && '⚠️ '}{t('members.daysRemaining', { days: daysRemaining.toString() })}
                        </p>
                      )}
                      {member.expiryDate && !isNotStartedYet && !isActiveNow && daysRemaining !== null && (
                        <p className="text-xs text-center text-red-600 font-bold">
                          ❌ {t('members.expiredSince', { days: Math.abs(daysRemaining).toString() })}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Infinite Scroll Sentinel */}
            {displayCount < filteredMembers.length && (
              <div ref={sentinelRef} className="flex items-center justify-center py-4 gap-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                <span>{locale === 'ar' ? `جاري تحميل المزيد... (${visibleMembers.length} من ${filteredMembers.length})` : `Loading more... (${visibleMembers.length} of ${filteredMembers.length})`}</span>
              </div>
            )}
          </div>

          {/* Mobile/Tablet Cards - Hidden on desktop (Virtualized) */}
          <div className="lg:hidden">
            <VirtualMemberList
              members={filteredMembers}
              lastReceipts={lastReceipts}
              onViewDetails={handleViewDetails}
              onShowReceipts={handleShowReceipts}
              t={t}
              locale={locale}
              direction={direction}
            />
          </div>
        </>
      )}

      {/* Results Summary */}
      {!loading && filteredMembers.length > 0 && displayCount >= filteredMembers.length && (
        <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400 py-3">
          ✅ {locale === 'ar'
            ? `تم عرض كل ${filteredMembers.length} عضو`
            : `All ${filteredMembers.length} members shown`}
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
                    className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    dir={direction}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">{t('members.toDate')}</label>
                  <input
                    type="date"
                    value={attendanceEndDate}
                    onChange={(e) => setAttendanceEndDate(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                            <td className="px-4 py-3 font-mono font-bold">
                              {item.member?.memberNumber != null ? (
                                <span className="text-primary-600">#{item.member.memberNumber}</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
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
                        className="bg-gradient-to-r from-gray-50 to-white border-2 border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
