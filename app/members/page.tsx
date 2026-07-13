// app/members/page.tsx - إصلاح الأرقام العشرية
'use client'

import { Suspense, useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { useInfiniteQuery } from '@tanstack/react-query'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionDenied from '../../components/PermissionDenied'
import { useAdminDate } from '../../contexts/AdminDateContext'
import { formatDateYMD, calculateRemainingDays } from '../../lib/dateFormatter'
import { getPackageName } from '../../lib/memberUtils'
import { useLanguage } from '../../contexts/LanguageContext'
import { fetchMembersPage, fetchOffers } from '../../lib/api/members'
import { useToast } from '../../contexts/ToastContext'
import { MembersSkeleton } from '../../components/LoadingSkeleton'
import { LoadingScreen } from '../../components/Spinner'
import { useDebounce } from '../../hooks/useDebounce'
import { useServiceSettings } from '../../contexts/ServiceSettingsContext'
import ConfirmDialog from '../../components/ConfirmDialog'

// Dynamic imports - تحميل المكونات الثقيلة عند الحاجة فقط
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

const LazyAvatar = nextDynamic(() => import('../../components/LazyAvatar'), {
  ssr: false,
  loading: () => <div className="w-full h-full" />,
})

interface Member {
  id: string
  memberNumber: string | null
  name: string
  phone: string
  profileImage?: string | null
  inBodyScans: number
  invitations: number
  remainingFreezeDays: number
  subscriptionPrice: number
  remainingAmount: number
  remainingDueDate?: string | null
  notes?: string
  isActive: boolean
  isFrozen: boolean
  isBanned: boolean
  freezeUntil?: string
  startDate?: string
  expiryDate?: string
  createdAt: string
}

// Fuzzy search helper
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

// تطبيع التاريخ إلى local midnight لمقارنة صحيحة (بدون تأثير timezone)
function normalizeDate(date: Date | string | null | undefined): Date | null {
  if (!date) return null
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

// التحقق من حالة العضو (هل بدأ الاشتراك ولم ينتهي؟)
function isMemberActiveNow(member: Member): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // التحقق من تاريخ البداية (مطبّع لـ local midnight)
  const startDate = normalizeDate(member.startDate)
  const hasStarted = !startDate || startDate <= today

  // التحقق من تاريخ الانتهاء (مطبّع لـ local midnight)
  const expiryDate = normalizeDate(member.expiryDate)
  const notExpired = !expiryDate || expiryDate >= today

  return member.isActive && hasStarted && notExpired
}

function MembersPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, loading: permissionsLoading, user } = usePermissions()
  const { customCreatedAt } = useAdminDate()
  const { t, locale, direction } = useLanguage()
  const toast = useToast()
  const { settings } = useServiceSettings()

  // Pagination + Streaming — بنحمّل الأعضاء على دفعات بدل ما نستنى كلهم مع بعض
  // - أول دفعة (200 عضو) بتظهر فوراً → الـ skeleton يختفي بعد ثانية تقريباً
  // - الباقي بيتحمّل في الـ background (chunks of 200) ويتضاف للقايمة تلقائياً
  // - الـ memory cost أقل، والـ time-to-first-paint أحسن بكتير على الشبكات البطيئة (port forwarding)
  const MEMBERS_PAGE_SIZE = 200
  const {
    data: pagesData,
    isLoading: loading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    error: membersError,
    refetch: refetchMembers
  } = useInfiniteQuery({
    queryKey: ['members', 'paged', MEMBERS_PAGE_SIZE],
    queryFn: ({ pageParam }) => fetchMembersPage(pageParam as number, MEMBERS_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    enabled: !permissionsLoading && hasPermission('canViewMembers'),
    retry: 1,
    staleTime: 2 * 60 * 1000,
    refetchOnMount: 'always',
  })

  // Auto-stream: بمجرد ما أول صفحة توصل، نكمّل تحميل الباقي في الـ background
  useEffect(() => {
    if (!loading && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [loading, hasNextPage, isFetchingNextPage, fetchNextPage])

  // Flatten الـ pages → array واحدة بنفس الـ shape القديم
  const membersData = useMemo<any[]>(
    () => pagesData?.pages?.flatMap((p: any) => p.members) ?? [],
    [pagesData]
  )

  // العدد الكلي من السيرفر (متاح من أول صفحة) → بنستخدمه في progress indicator
  const totalMembersCount = pagesData?.pages?.[0]?.total ?? membersData.length

  const [showForm, setShowForm] = useState(false)
  //  Prefill data من URL params (smart search من الـ Dashboard)
  const [prefillData, setPrefillData] = useState<{ name?: string; phone?: string } | null>(null)

  //  لو URL فيه ?action=new فتح فورم الإضافة + prefill من الـ params
  useEffect(() => {
    const action = searchParams.get('action')
    const pName = searchParams.get('prefillName')
    const pPhone = searchParams.get('prefillPhone')
    if (action === 'new') {
      setShowForm(true)
      if (pName || pPhone) {
        setPrefillData({ name: pName || undefined, phone: pPhone || undefined })
      }
      // نظّف الـ URL بعد ما نقرأ القيم — عشان لو رفرش الصفحة ميـ re-open الفورم
      router.replace('/members', { scroll: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const [search, setSearch] = useState('')
  const [searchId, setSearchId] = useState('')

  // Debounced search values - تأخير البحث لتحسين الأداء
  const debouncedSearch = useDebounce(search, 300)
  const debouncedSearchId = useDebounce(searchId, 300)

  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired' | 'expiring-soon' | 'has-remaining' | 'other' | 'analytics' | 'banned' | 'no-coach'>('all')
  const [filterPackage, setFilterPackage] = useState<'all' | 'month' | '3-months' | '6-months' | 'year'>('all')
  const [filterSalesId, setFilterSalesId] = useState<string>('all') // فلتر السيلز ('all' / '__none__' / staff.id)
  const [filterCoachId, setFilterCoachId] = useState<string>('all') // ‍ فلتر الكوتش ('all' / '__none__' / staff.id)
  // فلتر تاريخ الاشتراك — مدى (من/إلى) يحدده المستخدم (YYYY-MM-DD)
  const [filterSubFrom, setFilterSubFrom] = useState<string>('')
  const [filterSubTo, setFilterSubTo] = useState<string>('')
  // بوب أب اختيار مدى تاريخ الاشتراك — بنختار من/إلى وندوس حفظ
  const [showDateRangeModal, setShowDateRangeModal] = useState(false)
  const [tempSubFrom, setTempSubFrom] = useState<string>('')
  const [tempSubTo, setTempSubTo] = useState<string>('')
  const openDateRangeModal = () => {
    setTempSubFrom(filterSubFrom)
    setTempSubTo(filterSubTo)
    setShowDateRangeModal(true)
  }
  const saveDateRange = () => {
    setFilterSubFrom(tempSubFrom)
    setFilterSubTo(tempSubTo)
    setShowDateRangeModal(false)
  }
  const clearDateRange = () => {
    setTempSubFrom('')
    setTempSubTo('')
    setFilterSubFrom('')
    setFilterSubTo('')
    setShowDateRangeModal(false)
  }
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string; position: string | null }>>([])

  // Mobile UI state
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  // سجل الإيصالات
  const [showReceiptsModal, setShowReceiptsModal] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [memberReceipts, setMemberReceipts] = useState<any[]>([])
  const [receiptsLoading, setReceiptsLoading] = useState(false)
  const [lastReceipts, setLastReceipts] = useState<{ [memberId: string]: any }>({})

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // WhatsApp جماعي
  const [showBulkWA, setShowBulkWA] = useState(false)

  // المحظورون
  const [bannedMembers, setBannedMembers] = useState<any[]>([])
  const [bannedLoading, setBannedLoading] = useState(false)
  const [showAddBanModal, setShowAddBanModal] = useState(false)
  const [banForm, setBanForm] = useState({ name: '', phone: '', nationalId: '', reason: '', notes: '' })
  const [banSubmitting, setBanSubmitting] = useState(false)
  const [banError, setBanError] = useState('')
  const [confirmState, setConfirmState] = useState<{ open: boolean; onConfirm: () => void; message: string; title?: string }>({ open: false, onConfirm: () => {}, message: '' })
  const [bulkWAMessage, setBulkWAMessage] = useState('السلام عليكم {name}، اشتراكك في الجيم انتهى أو قارب على الانتهاء. تواصل معنا لتجديد اشتراكك. ')
  const [bulkWASent, setBulkWASent] = useState(0)

  // استخدام useMemo بدل useState للـ filteredMembers لتجنب infinite loop
  // استخدام الـ debounced values لتحسين الأداء
  const filteredMembers = useMemo(() => {
    let filtered = membersData.map((m: any) => ({
      ...m,
      freezeUntil: m.isFrozen && m.freezeRequests?.[0]?.endDate ? m.freezeRequests[0].endDate : undefined
    }))

    //  بحث برقم العضوية — exact match (نتيجة واحدة بالرقم المكتوب)
    // بنقارن بطريقتين: exact string + numeric — عشان نتجاوز فرق الأصفار البادئة
    if (debouncedSearchId) {
      const qid = debouncedSearchId.trim()
      const qidNum = /^\d+$/.test(qid) ? parseInt(qid, 10) : NaN
      filtered = filtered.filter((member) => {
        if (member.memberNumber === null) return false
        const mid = String(member.memberNumber)
        if (mid === qid) return true
        if (!Number.isNaN(qidNum)) {
          const midNum = parseInt(mid, 10)
          if (!Number.isNaN(midNum) && midNum === qidNum) return true
        }
        return false
      })
    }

    //  بحث بالاسم أو رقم التلفون
    if (debouncedSearch) {
      const q = debouncedSearch.trim()
      const isAllDigits = /^\d+$/.test(q)

      filtered = filtered.filter((member) => {
        if (isAllDigits) {
          // أرقام → بحث بالـ substring على التليفون فقط
          return member.phone.includes(q)
        }
        // نص → بحث بالاسم
        return fuzzyMatch(member.name, q)
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
        } else if (filterStatus === 'no-coach') {
          //  أعضاء بدون كوتش متعيّن
          return !((member as any).coachId)
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

    // فلتر السيلز ('__none__' = اللي مش محدد لهم سيلز)
    if (filterSalesId !== 'all') {
      filtered = filtered.filter((member) => {
        if (filterSalesId === '__none__') return !member.salesStaffId
        return member.salesStaffId === filterSalesId
      })
    }

    // ‍ فلتر الكوتش
    if (filterCoachId !== 'all') {
      filtered = filtered.filter((member) => {
        if (filterCoachId === '__none__') return !member.coachId
        return member.coachId === filterCoachId
      })
    }

    //  فلتر تاريخ الاشتراك — مدى (من/إلى) حسب startDate
    if (filterSubFrom || filterSubTo) {
      filtered = filtered.filter((member) => {
        if (!member.startDate) return false
        const d = new Date(member.startDate)
        if (isNaN(d.getTime())) return false
        const dymd = formatDateYMD(d) // 'YYYY-MM-DD' — مقارنة باليوم بس
        if (filterSubFrom && dymd < filterSubFrom) return false
        if (filterSubTo && dymd > filterSubTo) return false
        return true
      })
    }

    // ترتيب الأعضاء — الأحدث أولاً
    // الأساس: memberNumber desc (لأن العضو الجديد بياخد رقم أعلى من اللي قبله)
    // لو memberNumber null (Other) → في الآخر
    // tiebreakers: createdAt desc → id desc
    const sorted = [...filtered].sort((a, b) => {
      // Other members (no memberNumber) دايماً في الآخر
      const aHasNum = a.memberNumber != null && a.memberNumber !== ''
      const bHasNum = b.memberNumber != null && b.memberNumber !== ''
      if (aHasNum && !bHasNum) return -1
      if (!aHasNum && bHasNum) return 1

      // الأساسي: memberNumber desc (الأعلى رقم = الأحدث)
      if (aHasNum && bHasNum) {
        const aNum = parseInt(a.memberNumber as any, 10) || 0
        const bNum = parseInt(b.memberNumber as any, 10) || 0
        if (aNum !== bNum) return bNum - aNum
      }

      // tiebreaker 1: createdAt desc
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
      if (bTime !== aTime) return bTime - aTime

      // tiebreaker 2: id desc (cuid time-ordered prefix)
      return String(b.id || '').localeCompare(String(a.id || ''))
    })

    return sorted
  }, [debouncedSearch, debouncedSearchId, filterStatus, filterPackage, filterSalesId, filterCoachId, filterSubFrom, filterSubTo, membersData])

  // جلب المحظورين عند التحميل (لو عنده صلاحية)
  useEffect(() => {
    if (!permissionsLoading && hasPermission('canManageBannedMembers')) {
      fetchBannedMembers()
    }
  }, [permissionsLoading])

  // جلب الموظفين عشان نملي الفلاتر (سيلز + كوتش)
  useEffect(() => {
    fetch('/api/staff')
      .then(r => r.ok ? r.json() : [])
      .then((data: Array<{ id: string; name: string; position: string | null; isActive?: boolean }>) => {
        if (Array.isArray(data)) {
          setStaffList(data.filter(s => s.isActive !== false))
        }
      })
      .catch(() => {})
  }, [])

  // Set سريع للبحث عن المحظورين بالهاتف
  const bannedPhones = useMemo(
    () => new Set(bannedMembers.map(b => b.phone).filter(Boolean)),
    [bannedMembers]
  )

  // معالجة أخطاء الأعضاء
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
      // endpoint تجميعي خفيف (~120KB) بدل تحميل كل الإيصالات (~2MB) وفلترتها هنا.
      // كمان بيصلّح البادج: الكود القديم كان بيدور على memberId جوه itemDetails وهو مش موجود
      const response = await fetch('/api/receipts/last-per-member')

      if (!response.ok) {
        console.error('Failed to fetch last receipts:', response.status)
        return
      }

      const map = await response.json()
      if (map && typeof map === 'object' && !Array.isArray(map)) {
        setLastReceipts(map)
      }
    } catch (error) {
      console.error('Error fetching last receipts:', error)
    }
  }

  const fetchMemberReceipts = async (memberNumber: string) => {
    setReceiptsLoading(true)
    try {
      // السيرفر بيضيّق النطاق لإيصالات العضو ده بس — والفلترة الدقيقة تحت بتفضل زي ما هي
      const response = await fetch(`/api/receipts?memberNumber=${encodeURIComponent(memberNumber)}`)
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

  const handleShowReceipts = (memberId: string, memberNumber: string) => {
    setSelectedMemberId(memberId)
    fetchMemberReceipts(memberNumber)
    setShowReceiptsModal(true)
  }

  useEffect(() => {
    // فقط إذا كان لديه صلاحية عرض الإيصالات
    if (!permissionsLoading && hasPermission('canViewReceipts')) {
      fetchLastReceipts()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsLoading])

  // إعادة تعيين الصفحة عند تغيير الفلاتر
  useEffect(() => {
    setCurrentPage(1)
  }, [search, searchId, filterStatus, filterPackage, filterSalesId, filterCoachId, filterSubFrom, filterSubTo])

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
    setSearch('')
    setSearchId('')
  }

  const clearAllFilters = () => {
    setSearch('')
    setSearchId('')
    setFilterStatus('all')
    setFilterPackage('all')
    setFilterSalesId('all')
    setFilterCoachId('all')
    setFilterSubFrom('')
    setFilterSubTo('')
  }

  // Active filters count (used by mobile filter button badge)
  const activeFiltersCount =
    (filterStatus !== 'all' && filterStatus !== 'analytics' ? 1 : 0) +
    (filterPackage !== 'all' ? 1 : 0) +
    (filterSalesId !== 'all' ? 1 : 0) +
    (filterCoachId !== 'all' ? 1 : 0)

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (showMobileFilters) {
      document.body.style.overflow = 'hidden'
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMobileFilters(false) }
      window.addEventListener('keydown', onKey)
      return () => {
        document.body.style.overflow = 'unset'
        window.removeEventListener('keydown', onKey)
      }
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [showMobileFilters])

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
    if (filterStatus === 'no-coach') return !((member as any).coachId)
    return true
  }

  // useMemo: كانت بتتحسب من جديد (~12 مرور كامل على كل الأعضاء + آلاف الـ Date)
  // مع كل render — بما فيها كل حرف في خانة البحث
  const stats = useMemo(() => ({
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
    noCoach: membersData.filter(m => !((m as any).coachId)).length, //  أعضاء بدون كوتش
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [membersData, filterStatus])

  // جلب المحظورين
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

  const handleRemoveBan = (id: string) => {
    setConfirmState({
      open: true,
      title: t('common.confirm'),
      message: 'هل تريد إزالة هذا الشخص من قائمة المحظورين؟',
      onConfirm: async () => {
        try {
          await fetch(`/api/banned-members?id=${id}`, { method: 'DELETE' })
          fetchBannedMembers()
        } catch {}
      }
    })
  }

  // WhatsApp جماعي
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

  // تصدير CSV
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

  // التحقق من الصلاحيات
  if (permissionsLoading) {
    return (
      <LoadingScreen fullScreen message={t('common.loading')} />
    )
  }

  if (!hasPermission('canViewMembers')) {
    return <PermissionDenied message={t('members.permissionDeniedViewMembers')} />
  }

  // حالة التحميل مع Skeleton
  if (loading) {
    return <MembersSkeleton />
  }

  return (
    <div className="container mx-auto p-3 sm:p-6" dir={direction}>
      {/* ============ Mobile-only compact header (< md) ============ */}
      <div className="md:hidden mb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{t('members.managementTitle')}</h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{locale === 'ar' ? `${stats.total} عضو` : `${stats.total} members`}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* More menu */}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(v => !v)}
                aria-label={locale === 'ar' ? 'المزيد' : 'More'}
                aria-haspopup="menu"
                aria-expanded={showMoreMenu}
                className="w-11 h-11 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors duration-200 flex items-center justify-center ring-1 ring-gray-200 dark:ring-gray-700"
              >
                <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
                </svg>
              </button>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} aria-hidden="true" />
                  <div className={`absolute mt-2 ${direction === 'rtl' ? 'left-0' : 'right-0'} w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 z-50 animate-modal-in overflow-hidden`} role="menu">
                    <Link
                      href="/member-attendance"
                      onClick={() => setShowMoreMenu(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                      role="menuitem"
                    >
                      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5 text-gray-500 dark:text-gray-400 shrink-0" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9v6m12-6v6M3 10.5v3m18-3v3M9 6v12m6-12v12" />
                      </svg>
                      <span>{t('nav.memberAttendance')}</span>
                    </Link>
                    <button
                      onClick={() => { setFilterStatus(filterStatus === 'analytics' ? 'all' : 'analytics'); setShowMoreMenu(false) }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                      role="menuitem"
                    >
                      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                      </svg>
                      <span>{filterStatus === 'analytics' ? (locale === 'ar' ? 'إخفاء التحليلات' : 'Hide Analytics') : (locale === 'ar' ? 'التحليلات' : 'Analytics')}</span>
                    </button>
                    {user?.role === 'OWNER' && (
                      <button
                        onClick={() => { exportToCSV(); setShowMoreMenu(false) }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 border-t border-gray-100 dark:border-gray-700"
                        role="menuitem"
                      >
                        <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        <span>{locale === 'ar' ? 'تصدير CSV' : 'Export CSV'}</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            {/* Primary add button */}
            <button
              onClick={() => setShowForm(!showForm)}
              type="button"
              aria-label={showForm ? t('members.hideForm') : t('members.addMember')}
              className="min-h-[44px] inline-flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-3 py-2.5 rounded-lg transition-colors duration-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
            >
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={showForm ? "M6 18 18 6M6 6l12 12" : "M12 4.5v15m7.5-7.5h-15"} />
              </svg>
              <span>{showForm ? (locale === 'ar' ? 'إغلاق' : 'Close') : (locale === 'ar' ? 'عضو' : 'Add')}</span>
            </button>
          </div>
        </div>

        {/* Mobile sticky toolbar: search + filters button */}
        <div className="sticky top-0 z-20 -mx-3 px-3 py-2 mt-3 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm">
          <div className="flex gap-2">
            {/*  ID search - small */}
            <div className="relative w-24 shrink-0">
              <input
                type="search"
                inputMode="numeric"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="w-full min-h-[44px] px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm text-center font-mono"
                placeholder="ID"
                dir="ltr"
              />
            </div>
            {/*  Name / Phone search */}
            <div className="relative flex-1">
              <span className={`absolute inset-y-0 ${direction === 'rtl' ? 'right-3' : 'left-3'} flex items-center text-gray-400 pointer-events-none`}>
                <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full min-h-[44px] ${direction === 'rtl' ? 'pr-10 pl-10' : 'pl-10 pr-10'} py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm`}
                placeholder={locale === 'ar' ? 'اسم أو تليفون...' : 'Name or phone...'}
                dir={direction}
              />
              {(search || searchId) && (
                <button
                  onClick={clearSearch}
                  type="button"
                  aria-label={t('members.clearSearch')}
                  className={`absolute inset-y-0 ${direction === 'rtl' ? 'left-3' : 'right-3'} flex items-center text-gray-400 hover:text-red-500 transition-colors duration-200`}
                >
                  <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              onClick={() => setShowMobileFilters(true)}
              aria-label={locale === 'ar' ? 'الفلاتر' : 'Filters'}
              className="relative min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-3 rounded-lg bg-white dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors duration-200 font-bold text-sm"
            >
              <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
              </svg>
              <span className="hidden xs:inline">{locale === 'ar' ? 'فلاتر' : 'Filters'}</span>
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] inline-flex items-center justify-center bg-primary-500 text-primary-contrast text-[10px] font-bold rounded-full px-1 ring-2 ring-gray-50 dark:ring-gray-900">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ============ Desktop header (≥ md) ============ */}
      <div className="hidden md:flex flex-col gap-3 mb-5 sm:mb-6 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('members.managementTitle')}</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">{locale === 'ar' ? 'إدارة الأعضاء والاشتراكات' : 'Manage members and subscriptions'}</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <Link
            href="/member-attendance"
            className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 sm:px-6 py-2.5 min-h-[44px] rounded-lg transition-colors duration-200 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold"
          >
            <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9v6m12-6v6M3 10.5v3m18-3v3M9 6v12m6-12v12" />
            </svg>
            <span className="truncate">{t('nav.memberAttendance')}</span>
          </Link>
          <button
            onClick={() => setFilterStatus(filterStatus === 'analytics' ? 'all' : 'analytics')}
            type="button"
            aria-pressed={filterStatus === 'analytics'}
            className={`px-3 sm:px-6 py-2.5 min-h-[44px] rounded-lg transition-colors duration-200 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold ${
              filterStatus === 'analytics'
                ? 'bg-purple-700 text-white'
                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50'
            }`}
          >
            <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
            </svg>
            <span className="truncate">{locale === 'ar' ? 'التحليلات' : 'Analytics'}</span>
          </button>
          {user?.role === 'OWNER' && (
          <button
            onClick={exportToCSV}
            type="button"
            aria-label={locale === 'ar' ? 'تصدير CSV' : 'Export CSV'}
            title={locale === 'ar' ? 'تصدير CSV' : 'Export CSV'}
            className="bg-green-600 hover:bg-green-700 text-white px-3 sm:px-5 py-2.5 min-h-[44px] rounded-lg transition-colors duration-200 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span>CSV</span>
          </button>
          )}
          <button
            onClick={() => setShowForm(!showForm)}
            type="button"
            className={`bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-3 sm:px-6 py-2.5 min-h-[44px] rounded-lg transition-colors duration-200 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 flex items-center justify-center gap-1.5 sm:gap-2 ${user?.role === 'OWNER' ? 'col-span-2 sm:col-span-1' : ''}`}
          >
            <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d={showForm ? "M6 18 18 6M6 6l12 12" : "M12 4.5v15m7.5-7.5h-15"} />
            </svg>
            <span className="truncate">{showForm ? t('members.hideForm') : t('members.addMember')}</span>
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
              setPrefillData(null)
            }}
            onCancel={() => {
              setShowForm(false)
              setPrefillData(null)
            }}
            customCreatedAt={customCreatedAt}
            prefillData={prefillData || undefined}
          />
        </div>
      )}

      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-3 sm:p-5 mb-5 sm:mb-6" dir={direction}>
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-base sm:text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100 min-w-0">
            <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5 text-primary-700 dark:text-primary-400 shrink-0" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="truncate">{t('members.quickFilters')}</span>
          </h3>
          {(filterStatus !== 'all' || filterPackage !== 'all' || filterSalesId !== 'all' || filterCoachId !== 'all') && (
            <button
              onClick={() => {
                setFilterStatus('all')
                setFilterPackage('all')
                setFilterSalesId('all')
                setFilterCoachId('all')
              }}
              type="button"
              className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors duration-200 inline-flex items-center gap-1.5"
            >
              <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              <span>{t('members.clearFilters')}</span>
            </button>
          )}
        </div>

        {/* Search — صغير لـ ID + كبير للاسم/التليفون */}
        <div className="flex gap-2 mb-3">
          {/*  ID search - smaller */}
          <div className="relative w-32 shrink-0">
            <input
              type="search"
              inputMode="numeric"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm text-center font-mono"
              placeholder={locale === 'ar' ? 'رقم العضو' : 'Member #'}
              dir="ltr"
            />
          </div>
          {/*  Name / Phone search - larger */}
          <div className="relative flex-1">
            <span className={`absolute inset-y-0 ${direction === 'rtl' ? 'right-3' : 'left-3'} flex items-center text-gray-400 pointer-events-none`}>
              <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full ${direction === 'rtl' ? 'pr-10 pl-10' : 'pl-10 pr-10'} py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm`}
              placeholder={locale === 'ar' ? 'ابحث بالاسم أو رقم التليفون...' : 'Search by name or phone...'}
              dir={direction}
            />
            {(search || searchId) && (
              <button
                onClick={clearSearch}
                type="button"
                aria-label={t('members.clearSearch')}
                title={t('members.clearSearch')}
                className={`absolute inset-y-0 ${direction === 'rtl' ? 'left-3' : 'right-3'} flex items-center text-gray-400 hover:text-red-500 transition-colors duration-200`}
              >
                <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Quick filters — pill chips بتلف على أكتر من سطر لو محتاجة */}
        <div className="flex flex-wrap gap-2 mb-1">
          {([
            { id: 'all', dot: 'bg-primary-500', label: t('members.all'), count: stats.total, activeBg: 'bg-primary-500 text-primary-contrast ring-primary-500', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700' },
            { id: 'active', dot: 'bg-green-500', label: t('members.active'), count: stats.active, activeBg: 'bg-green-600 text-white ring-green-600', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700' },
            { id: 'expiring-soon',dot: 'bg-amber-500', label: t('members.expiringSoon7Days'), count: stats.expiringSoon, activeBg: 'bg-orange-500 text-white ring-orange-500', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700' },
            { id: 'expired', dot: 'bg-red-500', label: t('members.expiredMembers'), count: stats.expired, activeBg: 'bg-red-600 text-white ring-red-600', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700' },
            ...(stats.other > 0 ? [{ id: 'other', dot: 'bg-gray-400', label: locale === 'ar' ? 'بدون عضوية' : 'Non-Members', count: stats.other, activeBg: 'bg-gray-600 text-white ring-gray-600', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700' }] : []),
            ...(settings.remainingEnabled && stats.hasRemaining > 0 ? [{ id: 'has-remaining', dot: 'bg-amber-500', label: locale === 'ar' ? 'بواقي' : 'Has Remaining', count: stats.hasRemaining, activeBg: 'bg-amber-600 text-white ring-amber-600', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700' }] : []),
            ...(stats.noCoach > 0 ? [{ id: 'no-coach', dot: 'bg-purple-500', label: locale === 'ar' ? '🏋️ بدون كوتش' : '🏋️ No Coach', count: stats.noCoach, activeBg: 'bg-purple-600 text-white ring-purple-600', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700' }] : []),
            ...(hasPermission('canManageBannedMembers') ? [{ id: 'banned', dot: 'bg-red-700', label: locale === 'ar' ? 'محظورون' : 'Banned', count: bannedMembers.length, activeBg: 'bg-red-800 text-white ring-red-800', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700' }] : [])
          ] as const).map(chip => {
            const isActive = filterStatus === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setFilterStatus(chip.id as any)
                  if (chip.id === 'banned') fetchBannedMembers()
                }}
                className={`shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full ring-1 text-sm font-bold transition-colors duration-200 ${
                  isActive ? chip.activeBg : chip.inactiveBg
                }`}
              >
                <span className={`inline-block w-2 h-2 rounded-full ${chip.dot}`} aria-hidden="true" />
                <span>{chip.label}</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.5rem] text-center ${
                  isActive ? 'bg-white/25' : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  {chip.count || 0}
                </span>
              </button>
            )
          })}
        </div>

        {/* Package + Sales + Coach + Date filters */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              {locale === 'ar' ? 'الباقة' : 'Package'}
            </label>
            <select
              value={filterPackage}
              onChange={(e) => setFilterPackage(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            >
              <option value="all">{locale === 'ar' ? '— كل الباقات —' : '— All Packages —'} ({membersData.length})</option>
              <option value="month">{locale === 'ar' ? 'شهر' : 'Month'} ({stats.packageMonth})</option>
              <option value="3-months">{locale === 'ar' ? '3 شهور' : '3 Months'} ({stats.package3Months})</option>
              <option value="6-months">{locale === 'ar' ? '6 شهور' : '6 Months'} ({stats.package6Months})</option>
              <option value="year">{locale === 'ar' ? 'سنة' : 'Year'} ({stats.packageYear})</option>
            </select>
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              {locale === 'ar' ? 'السيلز' : 'Sales'}
            </label>
            <select
              value={filterSalesId}
              onChange={(e) => setFilterSalesId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            >
              <option value="all">{locale === 'ar' ? '— كل السيلز —' : '— All Sales —'}</option>
              <option value="__none__">{locale === 'ar' ? 'بدون سيلز' : 'No Sales'}</option>
              {staffList
                .filter(s => s.position && s.position.split(',').map(p => p.trim()).includes('sales'))
                .map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
            </select>
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              {locale === 'ar' ? 'الكوتش' : 'Coach'}
            </label>
            <select
              value={filterCoachId}
              onChange={(e) => setFilterCoachId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            >
              <option value="all">{locale === 'ar' ? '— كل الكوتشات —' : '— All Coaches —'}</option>
              <option value="__none__">{locale === 'ar' ? 'بدون كوتش' : 'No Coach'}</option>
              {staffList
                .filter(s => s.position && (
                  s.position.split(',').map(p => p.trim()).includes('coach') ||
                  s.position.split(',').map(p => p.trim()).includes('مدرب')
                ))
                .map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
            </select>
          </div>

          {/* تاريخ الاشتراك — زرار جنب الفلاتر */}
          <div className="shrink-0">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              {locale === 'ar' ? 'تاريخ الاشتراك (من / إلى)' : 'Subscription Date (From / To)'}
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={openDateRangeModal}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-[11px] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <span className={`truncate ${filterSubFrom || filterSubTo ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                  {filterSubFrom || filterSubTo
                    ? `${filterSubFrom || '…'} → ${filterSubTo || '…'}`
                    : (locale === 'ar' ? 'اختر التاريخ' : 'Select date')}
                </span>
                <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-400 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              </button>
              {(filterSubFrom || filterSubTo) && (
                <button type="button" onClick={() => { setFilterSubFrom(''); setFilterSubTo('') }} aria-label={locale === 'ar' ? 'مسح' : 'Clear'} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0">
                  <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============ Mobile-only horizontal status chips (visible always for quick tap) ============ */}
      <div className="md:hidden mb-3 -mx-3 px-3 overflow-x-auto hide-scrollbar">
        <div className="flex gap-2 w-max">
          {([
            { id: 'all', label: t('members.all'), count: stats.total, activeBg: 'bg-primary-500 text-primary-contrast', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700' },
            { id: 'active', label: t('members.active'), count: stats.active, activeBg: 'bg-green-600 text-white', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700' },
            { id: 'expiring-soon', label: locale === 'ar' ? 'ينتهي قريباً' : 'Expiring', count: stats.expiringSoon, activeBg: 'bg-orange-500 text-white', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700' },
            { id: 'expired', label: t('members.expiredMembers'), count: stats.expired, activeBg: 'bg-red-600 text-white', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700' },
            ...(stats.other > 0 ? [{ id: 'other', label: locale === 'ar' ? 'بدون عضوية' : 'Non-Members', count: stats.other, activeBg: 'bg-gray-600 text-white', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700' }] : []),
            ...(settings.remainingEnabled && stats.hasRemaining > 0 ? [{ id: 'has-remaining', label: locale === 'ar' ? 'بواقي' : 'Remaining', count: stats.hasRemaining, activeBg: 'bg-amber-600 text-white', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700' }] : []),
            ...(stats.noCoach > 0 ? [{ id: 'no-coach', label: locale === 'ar' ? '🏋️ بدون كوتش' : '🏋️ No Coach', count: stats.noCoach, activeBg: 'bg-purple-600 text-white', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700' }] : []),
            ...(hasPermission('canManageBannedMembers') ? [{ id: 'banned', label: locale === 'ar' ? 'محظور' : 'Banned', count: bannedMembers.length, activeBg: 'bg-red-800 text-white', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700' }] : []),
          ] as const).map(chip => {
            const isActive = filterStatus === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setFilterStatus(chip.id as any)
                  if (chip.id === 'banned') fetchBannedMembers()
                }}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-full ring-1 text-xs font-bold transition-colors duration-200 ${isActive ? chip.activeBg : chip.inactiveBg}`}
              >
                <span>{chip.label}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${isActive ? 'bg-black/15 dark:bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  {chip.count || 0}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ============ Mobile filters bottom sheet ============ */}
      {showMobileFilters && (
        <div
          className="md:hidden fixed inset-0 z-[10000] flex items-end justify-center animate-backdrop-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-filters-title"
          onClick={(e) => { if (e.target === e.currentTarget) setShowMobileFilters(false) }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" aria-hidden="true" />

          {/* Sheet */}
          <div
            dir={direction}
            className="relative w-full max-h-[88vh] bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 flex flex-col animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" aria-hidden="true" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b border-gray-200 dark:border-gray-700">
              <h2 id="mobile-filters-title" className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5 text-primary-700 dark:text-primary-400" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
                </svg>
                <span>{locale === 'ar' ? 'الفلاتر' : 'Filters'}</span>
                {activeFiltersCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-300">
                    {activeFiltersCount}
                  </span>
                )}
              </h2>
              <button
                onClick={() => setShowMobileFilters(false)}
                aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
                className="w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 flex items-center justify-center"
              >
                <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-5">
              {/* Status section */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{locale === 'ar' ? 'الحالة' : 'Status'}</h3>
                <div className="flex flex-wrap gap-2">
                  {([
                    { id: 'all', dot: 'bg-primary-500', label: t('members.all'), count: stats.total, activeBg: 'bg-primary-500 text-primary-contrast ring-primary-500', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700' },
                    { id: 'active', dot: 'bg-green-500', label: t('members.active'), count: stats.active, activeBg: 'bg-green-600 text-white ring-green-600', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700' },
                    { id: 'expiring-soon', dot: 'bg-amber-500', label: t('members.expiringSoon7Days'), count: stats.expiringSoon, activeBg: 'bg-orange-500 text-white ring-orange-500', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700' },
                    { id: 'expired', dot: 'bg-red-500', label: t('members.expiredMembers'), count: stats.expired, activeBg: 'bg-red-600 text-white ring-red-600', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700' },
                    ...(stats.other > 0 ? [{ id: 'other', dot: 'bg-gray-400', label: locale === 'ar' ? 'بدون عضوية' : 'Non-Members', count: stats.other, activeBg: 'bg-gray-600 text-white ring-gray-600', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700' }] : []),
                    ...(settings.remainingEnabled && stats.hasRemaining > 0 ? [{ id: 'has-remaining', dot: 'bg-amber-500', label: locale === 'ar' ? 'بواقي' : 'Has Remaining', count: stats.hasRemaining, activeBg: 'bg-amber-600 text-white ring-amber-600', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700' }] : []),
                    ...(stats.noCoach > 0 ? [{ id: 'no-coach', dot: 'bg-purple-500', label: locale === 'ar' ? '🏋️ بدون كوتش' : '🏋️ No Coach', count: stats.noCoach, activeBg: 'bg-purple-600 text-white ring-purple-600', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700' }] : []),
                    ...(hasPermission('canManageBannedMembers') ? [{ id: 'banned', dot: 'bg-red-700', label: locale === 'ar' ? 'محظورون' : 'Banned', count: bannedMembers.length, activeBg: 'bg-red-800 text-white ring-red-800', inactiveBg: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700' }] : []),
                  ] as const).map(chip => {
                    const isActive = filterStatus === chip.id
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => {
                          setFilterStatus(chip.id as any)
                          if (chip.id === 'banned') fetchBannedMembers()
                        }}
                        className={`inline-flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-full ring-1 text-sm font-bold transition-colors duration-200 ${isActive ? chip.activeBg : chip.inactiveBg}`}
                      >
                        <span className={`inline-block w-2 h-2 rounded-full ${chip.dot}`} aria-hidden="true" />
                        <span>{chip.label}</span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.5rem] text-center ${isActive ? 'bg-white/25 dark:bg-black/15' : 'bg-gray-100 dark:bg-gray-700'}`}>
                          {chip.count || 0}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* Package */}
              <section>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{locale === 'ar' ? 'الباقة' : 'Package'}</label>
                <select
                  value={filterPackage}
                  onChange={(e) => setFilterPackage(e.target.value as any)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                >
                  <option value="all">{locale === 'ar' ? '— كل الباقات —' : '— All Packages —'} ({membersData.length})</option>
                  <option value="month">{locale === 'ar' ? 'شهر' : 'Month'} ({stats.packageMonth})</option>
                  <option value="3-months">{locale === 'ar' ? '3 شهور' : '3 Months'} ({stats.package3Months})</option>
                  <option value="6-months">{locale === 'ar' ? '6 شهور' : '6 Months'} ({stats.package6Months})</option>
                  <option value="year">{locale === 'ar' ? 'سنة' : 'Year'} ({stats.packageYear})</option>
                </select>
              </section>

              {/* Subscription Date */}
              <section>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{locale === 'ar' ? 'تاريخ الاشتراك (من / إلى)' : 'Subscription Date (From / To)'}</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={openDateRangeModal}
                    className="flex-1 min-h-[44px] flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <span className={`truncate ${filterSubFrom || filterSubTo ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                      {filterSubFrom || filterSubTo
                        ? `${filterSubFrom || '…'} → ${filterSubTo || '…'}`
                        : (locale === 'ar' ? 'اختر التاريخ' : 'Select date')}
                    </span>
                    <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4 text-gray-400 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  </button>
                  {(filterSubFrom || filterSubTo) && (
                    <button type="button" onClick={() => { setFilterSubFrom(''); setFilterSubTo('') }} aria-label={locale === 'ar' ? 'مسح' : 'Clear'} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0">
                      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
              </section>

              {/* Sales */}
              <section>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{locale === 'ar' ? 'السيلز' : 'Sales'}</label>
                <select
                  value={filterSalesId}
                  onChange={(e) => setFilterSalesId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                >
                  <option value="all">{locale === 'ar' ? '— كل السيلز —' : '— All Sales —'}</option>
                  <option value="__none__">{locale === 'ar' ? 'بدون سيلز' : 'No Sales'}</option>
                  {staffList
                    .filter(s => s.position && s.position.split(',').map(p => p.trim()).includes('sales'))
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
              </section>

              {/* Coach */}
              <section>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{locale === 'ar' ? 'الكوتش' : 'Coach'}</label>
                <select
                  value={filterCoachId}
                  onChange={(e) => setFilterCoachId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                >
                  <option value="all">{locale === 'ar' ? '— كل الكوتشات —' : '— All Coaches —'}</option>
                  <option value="__none__">{locale === 'ar' ? 'بدون كوتش' : 'No Coach'}</option>
                  {staffList
                    .filter(s => s.position && (
                      s.position.split(',').map(p => p.trim()).includes('coach') ||
                      s.position.split(',').map(p => p.trim()).includes('مدرب')
                    ))
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
              </section>
            </div>

            {/* Footer actions */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex gap-2 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
              <button
                onClick={() => { clearAllFilters() }}
                disabled={activeFiltersCount === 0 && !search}
                className="flex-1 min-h-[44px] bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-bold transition-colors duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {locale === 'ar' ? 'مسح الفلاتر' : 'Clear Filters'}
              </button>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="flex-1 min-h-[44px] bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold rounded-lg transition-colors duration-200 text-sm"
              >
                {locale === 'ar' ? `عرض ${filteredMembers.length} عضو` : `Show ${filteredMembers.length} members`}
              </button>
            </div>
          </div>
        </div>
      )}

      {(isFetchingNextPage || hasNextPage) && totalMembersCount > membersData.length && (
        <div className="bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 p-3 rounded-xl mb-4 flex items-center gap-3" dir={direction} aria-busy="true" aria-live="polite">
          <div className="animate-spin h-4 w-4 ring-1 ring-blue-500 border-t-transparent rounded-full shrink-0"></div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-blue-800 dark:text-blue-300">
              {locale === 'ar'
                ? `جارٍ تحميل باقي الأعضاء في الخلفية... ${membersData.length} / ${totalMembersCount}`
                : `Loading remaining members in background... ${membersData.length} / ${totalMembersCount}`}
            </div>
            <div className="mt-1 h-1.5 w-full bg-blue-100 dark:bg-blue-900/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 dark:bg-blue-400 transition-colors duration-200"
                style={{ width: `${Math.min(100, Math.round((membersData.length / Math.max(1, totalMembersCount)) * 100))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {(search || filterStatus !== 'all' || filterPackage !== 'all' || filterSalesId !== 'all' || filterCoachId !== 'all') && (
        <div className="bg-white dark:bg-gray-800 ring-1 ring-amber-200 dark:ring-amber-900/50 p-3 sm:p-4 rounded-xl mb-5 sm:mb-6 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 shadow-sm" dir={direction}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100 truncate">{t('members.filtersActive')}</p>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{t('members.showing', { count: filteredMembers.length.toString(), total: totalMembersCount.toString() })}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {filteredMembers.some(m => m.phone) && (
              <button
                onClick={() => { setBulkWASent(0); setShowBulkWA(true) }}
                type="button"
                className="flex-1 sm:flex-initial min-h-[44px] bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors duration-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2"
              >
                <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
                <span className="truncate">{locale === 'ar' ? 'واتساب' : 'WhatsApp'} ({filteredMembers.filter(m => m.phone).length})</span>
              </button>
            )}
            <button
              onClick={clearAllFilters}
              type="button"
              className="flex-1 sm:flex-initial min-h-[44px] bg-amber-600 hover:bg-amber-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors duration-200 font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5"
            >
              <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              <span className="truncate">{t('members.clearAllFilters')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Subscription Date Range Modal */}
      {showDateRangeModal && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
          dir={direction}
          role="dialog"
          aria-modal="true"
          aria-labelledby="daterange-title"
          onClick={() => setShowDateRangeModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 rounded-t-2xl flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
              <h3 id="daterange-title" className="font-bold text-lg text-gray-900 dark:text-gray-100">
                {locale === 'ar' ? 'تاريخ الاشتراك' : 'Subscription Date'}
              </h3>
              <button
                type="button"
                onClick={() => setShowDateRangeModal(false)}
                aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {locale === 'ar' ? 'من' : 'From'}
                </label>
                <input
                  type="date"
                  value={tempSubFrom}
                  max={tempSubTo || undefined}
                  onChange={(e) => setTempSubFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {locale === 'ar' ? 'إلى' : 'To'}
                </label>
                <input
                  type="date"
                  value={tempSubTo}
                  min={tempSubFrom || undefined}
                  onChange={(e) => setTempSubTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={clearDateRange}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                {locale === 'ar' ? 'مسح' : 'Clear'}
              </button>
              <button
                type="button"
                onClick={saveDateRange}
                className="flex-1 px-4 py-2 rounded-lg bg-primary-600 text-white font-bold hover:bg-primary-700 transition-colors duration-200"
              >
                {locale === 'ar' ? 'حفظ' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Bulk Modal */}
      {showBulkWA && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in" dir={direction} role="dialog" aria-modal="true" aria-labelledby="bulkwa-title">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in">
            <div className="px-6 py-4 rounded-t-2xl flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
              <h3 id="bulkwa-title" className="font-bold text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5 text-green-600 dark:text-green-400" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
                <span>WhatsApp جماعي</span>
              </h3>
              <button onClick={() => setShowBulkWA(false)} type="button" aria-label="إغلاق" className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg w-8 h-8 flex items-center justify-center transition-colors duration-200">
                <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                سيتم إرسال رسالة لـ <strong className="text-green-600 dark:text-green-400">{filteredMembers.filter(m => m.phone).length}</strong> عضو.
                استخدم <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">{'{name}'}</code> لاسم العضو.
              </p>
              <textarea
                value={bulkWAMessage}
                onChange={e => setBulkWAMessage(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors duration-200 text-sm resize-none mb-4"
                dir="rtl"
              />
              {bulkWASent > 0 && (
                <div className="mb-4 bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 rounded-lg p-3 text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                  <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span>تم إرسال {bulkWASent} من {filteredMembers.filter(m => m.phone).length}...</span>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={sendBulkWhatsApp}
                  type="button"
                  disabled={!bulkWAMessage.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                  </svg>
                  <span>بدء الإرسال</span>
                </button>
                <button
                  onClick={() => setShowBulkWA(false)}
                  type="button"
                  className="px-5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-bold transition-colors duration-200"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingScreen message={t('common.loading')} />
      ) : filterStatus === 'banned' ? (
        /* ===== قسم المحظورين ===== */
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-6" dir={direction}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6">
            <h2 className="text-lg sm:text-2xl font-bold text-red-700 dark:text-red-400 flex items-center gap-2 min-w-0">
              <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span className="truncate">{locale === 'ar' ? 'قائمة المحظورين' : 'Banned Members List'}</span>
            </h2>
            <button
              onClick={() => { setBanError(''); setShowAddBanModal(true) }}
              className="min-h-[44px] bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
            >
              <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>{locale === 'ar' ? 'إضافة محظور' : 'Add Ban'}</span>
            </button>
          </div>

          {bannedLoading ? (
            <LoadingScreen message={t('common.loading')} />
          ) : bannedMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-3" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <p className="text-base sm:text-lg font-bold text-gray-700 dark:text-gray-300">{locale === 'ar' ? 'لا يوجد محظورون' : 'No banned members'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{locale === 'ar' ? 'قائمة المحظورين فاضية' : 'The ban list is empty'}</p>
            </div>
          ) : (
            <>
              {/* Mobile cards (< md) */}
              <div className="md:hidden space-y-3">
                {bannedMembers.map((ban, idx) => (
                  <div key={ban.id} className="ring-1 ring-red-200 dark:ring-red-900/50 bg-red-50/50 dark:bg-red-900/10 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded">#{idx + 1}</span>
                          <p className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">{ban.name || (locale === 'ar' ? 'بدون اسم' : 'No name')}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveBan(ban.id)}
                        aria-label={locale === 'ar' ? 'إزالة' : 'Remove'}
                        className="min-h-[36px] bg-white dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 font-bold px-3 py-1.5 rounded-lg text-xs ring-1 ring-red-200 dark:ring-red-900/50 transition-colors duration-200 shrink-0"
                      >
                        {locale === 'ar' ? 'إزالة' : 'Remove'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      {ban.phone && (
                        <div className="col-span-2 sm:col-span-1">
                          <span className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'الهاتف:' : 'Phone:'}</span>
                          <span className="ms-1 font-mono text-gray-700 dark:text-gray-200">{ban.phone}</span>
                        </div>
                      )}
                      {ban.nationalId && (
                        <div className="col-span-2 sm:col-span-1">
                          <span className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'الرقم القومي:' : 'National ID:'}</span>
                          <span className="ms-1 font-mono text-gray-700 dark:text-gray-200">{ban.nationalId}</span>
                        </div>
                      )}
                      <div className="col-span-2">
                        <span className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'السبب:' : 'Reason:'}</span>
                        <span className="ms-1 text-gray-700 dark:text-gray-200">{ban.reason || '-'}</span>
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 text-[11px]">
                        {ban.bannedBy && <>{locale === 'ar' ? 'بواسطة' : 'By'}: <span className="text-gray-600 dark:text-gray-300">{ban.bannedBy}</span></>}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 text-[11px] text-end">
                        {new Date(ban.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table (≥ md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm" dir={direction}>
                  <thead className="bg-red-50 dark:bg-red-900/20">
                    <tr>
                      <th className="px-4 py-3 text-start text-red-700 dark:text-red-400 font-bold">#</th>
                      <th className="px-4 py-3 text-start text-red-700 dark:text-red-400 font-bold">{locale === 'ar' ? 'الاسم' : 'Name'}</th>
                      <th className="px-4 py-3 text-start text-red-700 dark:text-red-400 font-bold">{locale === 'ar' ? 'رقم الهاتف' : 'Phone'}</th>
                      <th className="px-4 py-3 text-start text-red-700 dark:text-red-400 font-bold">{locale === 'ar' ? 'الرقم القومي' : 'National ID'}</th>
                      <th className="px-4 py-3 text-start text-red-700 dark:text-red-400 font-bold">{locale === 'ar' ? 'السبب' : 'Reason'}</th>
                      <th className="px-4 py-3 text-start text-red-700 dark:text-red-400 font-bold">{locale === 'ar' ? 'بواسطة' : 'By'}</th>
                      <th className="px-4 py-3 text-start text-red-700 dark:text-red-400 font-bold">{locale === 'ar' ? 'التاريخ' : 'Date'}</th>
                      <th className="px-4 py-3 text-start text-red-700 dark:text-red-400 font-bold">{locale === 'ar' ? 'إجراء' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bannedMembers.map((ban, idx) => (
                      <tr key={ban.id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors duration-200">
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
                            className="bg-gray-100 hover:bg-red-100 dark:bg-gray-700 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors duration-200"
                          >
                            {locale === 'ar' ? 'إزالة' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Modal إضافة محظور */}
          {showAddBanModal && (
            <div className="fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-backdrop-in" dir={direction} role="dialog" aria-modal="true" aria-labelledby="addban-title">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 w-full max-w-lg max-h-[95vh] overflow-y-auto p-5 sm:p-6 animate-modal-in">
                <div className="flex items-center justify-between mb-5">
                  <h3 id="addban-title" className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 min-w-0">
                    <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <span className="truncate">{locale === 'ar' ? 'إضافة محظور جديد' : 'Add New Ban'}</span>
                  </h3>
                  <button onClick={() => setShowAddBanModal(false)} aria-label={locale === 'ar' ? 'إغلاق' : 'Close'} className="text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg w-9 h-9 flex items-center justify-center transition-colors duration-200 shrink-0">
                    <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {banError && (
                  <div className="bg-red-50 dark:bg-red-900/20 ring-1 ring-red-300 dark:ring-red-700 text-red-700 dark:text-red-300 p-3 rounded-lg mb-4 text-sm">
                    {banError}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'الاسم' : 'Name'}</label>
                    <input type="text" value={banForm.name} onChange={e => setBanForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-200 text-sm"
                      placeholder={locale === 'ar' ? 'اسم الشخص (اختياري)' : 'Name (optional)'} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'رقم الهاتف' : 'Phone'}</label>
                    <input type="text" value={banForm.phone} onChange={e => setBanForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-200 text-sm font-mono"
                      placeholder="01xxxxxxxxx" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'الرقم القومي' : 'National ID'}</label>
                    <input type="text" value={banForm.nationalId} onChange={e => setBanForm(f => ({ ...f, nationalId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-200 text-sm font-mono"
                      placeholder="xxxxxxxxxxxxxxx" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'سبب الحظر' : 'Reason'} <span className="text-red-500">*</span></label>
                    <input type="text" value={banForm.reason} onChange={e => setBanForm(f => ({ ...f, reason: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-200 text-sm"
                      placeholder={locale === 'ar' ? 'سبب الحظر' : 'Ban reason'} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                    <textarea value={banForm.notes} onChange={e => setBanForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-200 text-sm resize-none"
                      rows={2} placeholder={locale === 'ar' ? 'ملاحظات إضافية...' : 'Additional notes...'} />
                  </div>
                </div>

                <div className="flex gap-2 sm:gap-3 mt-5 flex-row-reverse">
                  <button
                    onClick={handleAddBan}
                    disabled={banSubmitting}
                    autoFocus
                    className="flex-1 min-h-[44px] bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg transition-colors duration-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                  >
                    {banSubmitting ? (locale === 'ar' ? 'جارٍ...' : 'Saving...') : (locale === 'ar' ? 'إضافة للقائمة' : 'Add to List')}
                  </button>
                  <button
                    onClick={() => setShowAddBanModal(false)}
                    className="flex-1 min-h-[44px] bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-bold transition-colors duration-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                  >
                    {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : filterStatus === 'has-remaining' ? (() => {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const withRemaining = membersData.filter(m => m.remainingAmount > 0)
        const totalRemaining = withRemaining.reduce((s, m) => s + m.remainingAmount, 0)

        const overdue = withRemaining.filter(m => {
          if (!m.remainingDueDate) return false
          const d = new Date(m.remainingDueDate); d.setHours(0, 0, 0, 0)
          return d < today
        })
        const dueToday = withRemaining.filter(m => {
          if (!m.remainingDueDate) return false
          const d = new Date(m.remainingDueDate); d.setHours(0, 0, 0, 0)
          return d.getTime() === today.getTime()
        })
        const upcoming = withRemaining.filter(m => {
          if (!m.remainingDueDate) return false
          const d = new Date(m.remainingDueDate); d.setHours(0, 0, 0, 0)
          return d > today
        })
        const noDate = withRemaining.filter(m => !m.remainingDueDate)

        const renderSection = (title: string, icon: string, members: Member[], rowClass: string) => {
          if (members.length === 0) return null
          const sectionTotal = members.reduce((s, m) => s + m.remainingAmount, 0)
          return (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-xl">{icon}</span>
                <h3 className="text-lg font-bold dark:text-white">{title}</h3>
                <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-bold px-2 py-0.5 rounded-full">{members.length}</span>
                <span className="text-sm font-bold text-orange-600 dark:text-orange-400 mr-auto">{sectionTotal.toLocaleString()} ج.م</span>
              </div>
              <div className="space-y-2">
                {members.map(m => (
                  <div key={m.id}
                    className={`flex items-center gap-3 p-3 rounded-xl ring-1 cursor-pointer hover:shadow-md transition-shadow ${rowClass}`}
                    onClick={() => router.push(`/members/${m.id}`)}
                  >
                    <div className="text-gray-400 dark:text-gray-500 text-sm font-mono min-w-[40px]">#{m.memberNumber ?? '—'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 dark:text-gray-100 truncate">{m.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 font-mono" dir="ltr">{m.phone}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-orange-600 dark:text-orange-400">{m.remainingAmount.toLocaleString()} ج.م</div>
                      {m.remainingDueDate
                        ? <div className="text-xs text-gray-500 dark:text-gray-400">{formatDateYMD(m.remainingDueDate)}</div>
                        : <div className="text-xs text-gray-400">بدون موعد</div>
                      }
                    </div>
                    <a href={`tel:${m.phone}`} onClick={e => e.stopPropagation()}
                      className="text-2xl transition-colors duration-200 transition-transform shrink-0" title="اتصال"></a>
                  </div>
                ))}
              </div>
            </div>
          )
        }

        return (
          <div dir={direction}>
            {/* ملخص */}
            <div className="bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-300 dark:ring-orange-700 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-3 mb-3">
                
                <div>
                  <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">إجمالي البواقي</div>
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{totalRemaining.toLocaleString()} ج.م</div>
                </div>
                <div className="mr-auto text-right text-sm text-gray-500 dark:text-gray-400">{withRemaining.length} عضو</div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                {overdue.length > 0 && <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-3 py-1 rounded-lg font-bold"> {overdue.length} متأخر</span>}
                {dueToday.length > 0 && <span className="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 px-3 py-1 rounded-lg font-bold"> {dueToday.length} اليوم</span>}
                {upcoming.length > 0 && <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-3 py-1 rounded-lg font-bold"> {upcoming.length} قادم</span>}
                {noDate.length > 0 && <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-lg font-bold"> {noDate.length} بدون موعد</span>}
              </div>
            </div>

            {renderSection('فات موعدهم — متأخرون', '', overdue, 'border-red-400 bg-red-50 dark:bg-red-900/20')}
            {renderSection('موعدهم اليوم', '', dueToday, 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20')}
            {renderSection('موعدهم قادم', '', upcoming, 'border-green-400 bg-green-50 dark:bg-green-900/20')}
            {renderSection('بدون موعد محدد', '', noDate, 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800')}
          </div>
        )
      })() : filterStatus === 'analytics' ? (
        <MembersAnalytics members={membersData} />
      ) : (
        <>
          {/* Desktop Cards - Hidden on mobile/tablet */}
          <div className="hidden lg:block" dir={direction}>
            <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {Array.isArray(currentMembers) && currentMembers.map((member) => {
                const isActiveNow = isMemberActiveNow(member)
                const daysRemaining = calculateRemainingDays(member.expiryDate)
                const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7 && isActiveNow
                const startDate = normalizeDate(member.startDate)
                const todayCheck = new Date(); todayCheck.setHours(0, 0, 0, 0)
                const isNotStartedYet = !!(member.isActive && startDate && startDate > todayCheck)
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
                    className={`bg-white dark:bg-gray-800 rounded-xl shadow-md ring-1 ${borderColor} hover:shadow-xl transition-colors duration-200 cursor-pointer ${isBanned ? 'opacity-75' : ''}`}
                  >
                    {/* Header: صورة + اسم + رقم */}
                    <div className="p-4 flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full overflow-hidden ring-1 ring-gray-200 dark:ring-gray-600 bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                        <LazyAvatar
                          src={member.profileImage}
                          alt={member.name}
                          fallback={
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 dark:text-white truncate">{member.name}</h3>
                          {isBanned && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-red-600 text-white shadow-sm ring-1 ring-red-700 shrink-0">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                              {locale === 'ar' ? 'محظور' : 'Banned'}
                            </span>
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
                          member.isFrozen
                              ? 'bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                              : isNotStartedYet
                                ? 'bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                                : isExpiringSoon
                                  ? 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border border-orange-300'
                                  : isActiveNow
                                    ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-300'
                                    : 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border border-red-300'
                        }`}>
                          {member.isFrozen
                              ? <><span></span> {locale === 'ar' ? 'مجمد' : 'Frozen'}{member.freezeUntil ? <span className="text-[10px] font-normal ms-1">{locale === 'ar' ? 'لحد' : 'until'} {new Date(member.freezeUntil).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })}</span> : null}</>
                              : isNotStartedYet
                                ? <><span></span> {locale === 'ar' ? `يبدأ بعد ${daysUntilStart} يوم` : `Starts in ${daysUntilStart}d`}</>
                                : isExpiringSoon
                                  ? <><span></span> {locale === 'ar' ? 'ينتهي قريباً' : 'Expiring Soon'}</>
                                  : isActiveNow
                                    ? <><span></span> {t('members.active')}</>
                                    : <><span></span> {t('members.expired')}</>
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

                      {/* سيلز / ‍ كوتش tags — تظهر فقط لو في تخصيص */}
                      {(member.salesStaff?.name || member.coach?.name) && (
                        <div className="flex flex-wrap gap-1.5">
                          {member.salesStaff?.name && (
                            <span className="inline-flex items-center gap-1 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700 rounded-full px-2 py-0.5 text-[11px] font-medium">
                               {member.salesStaff.name}
                            </span>
                          )}
                          {member.coach?.name && (
                            <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 rounded-full px-2 py-0.5 text-[11px] font-medium">
                              ‍ {member.coach.name}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Remaining days info */}
                      {member.expiryDate && !isNotStartedYet && daysRemaining !== null && daysRemaining > 0 && (
                        <p className={`text-xs text-center ${isExpiringSoon ? 'text-orange-600 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                          {isExpiringSoon && ' '}{t('members.daysRemaining', { days: daysRemaining.toString() })}
                        </p>
                      )}
                      {member.expiryDate && !isNotStartedYet && !isActiveNow && daysRemaining !== null && (
                        <p className="text-xs text-center text-red-600 font-bold">
                           {t('members.expiredSince', { days: Math.abs(daysRemaining).toString() })}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Mobile/Tablet Cards - Hidden on desktop (Virtualized) */}
          <div className="lg:hidden">
            <VirtualMemberList
              members={currentMembers}
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

      {/* Pagination Controls */}
      {!loading && filteredMembers.length > 0 && totalPages > 1 && (() => {
        const isRtl = direction === 'rtl'
        // Mobile: 3 page buttons; Desktop: 5
        const mobilePageCount = Math.min(totalPages, 3)
        const desktopPageCount = Math.min(totalPages, 5)
        const buildPages = (count: number) => Array.from({ length: count }, (_, i) => {
          if (totalPages <= count) return i + 1
          const half = Math.floor(count / 2)
          if (currentPage <= half + 1) return i + 1
          if (currentPage >= totalPages - half) return totalPages - count + 1 + i
          return currentPage - half + i
        })
        const mobilePages = buildPages(mobilePageCount)
        const desktopPages = buildPages(desktopPageCount)

        const navBtn = "min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-sm font-bold bg-white dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 transition-colors duration-200"
        const pageBtn = (active: boolean) => `min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-sm font-bold transition-colors duration-200 ${
          active
            ? 'bg-primary-500 text-primary-contrast ring-1 ring-primary-500'
            : 'bg-white dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
        }`

        const ChevronLeft = (
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        )
        const ChevronRight = (
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        )
        const ChevronDoubleLeft = (
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5 11.25 12l7.5-7.5m-6 15L5.25 12l7.5-7.5" />
          </svg>
        )
        const ChevronDoubleRight = (
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5" />
          </svg>
        )

        const prevLabel = locale === 'ar' ? 'السابقة' : 'Previous'
        const nextLabel = locale === 'ar' ? 'التالية' : 'Next'
        const firstLabel = locale === 'ar' ? 'الأولى' : 'First'
        const lastLabel = locale === 'ar' ? 'الأخيرة' : 'Last'

        return (
          <div className="mt-6" dir={direction}>
            {/* Mobile (< sm): compact 3-row layout */}
            <div className="sm:hidden bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 rounded-xl p-3 space-y-3">
              {/* Row 1: showing text */}
              <p className="text-xs text-center text-gray-600 dark:text-gray-400">
                {locale === 'ar'
                  ? `${startIndex + 1} - ${Math.min(endIndex, filteredMembers.length)} من ${filteredMembers.length}`
                  : `${startIndex + 1} - ${Math.min(endIndex, filteredMembers.length)} of ${filteredMembers.length}`}
              </p>

              {/* Row 2: prev | pages | next */}
              <div className="flex items-center justify-center gap-1.5">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label={prevLabel}
                  className={navBtn}
                >
                  {isRtl ? ChevronRight : ChevronLeft}
                </button>
                {mobilePages.map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    aria-current={currentPage === pageNum ? 'page' : undefined}
                    className={pageBtn(currentPage === pageNum)}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  aria-label={nextLabel}
                  className={navBtn}
                >
                  {isRtl ? ChevronLeft : ChevronRight}
                </button>
              </div>

              {/* Row 3: per-page selector */}
              <div className="flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <label htmlFor="items-per-page-mobile">{locale === 'ar' ? 'لكل صفحة:' : 'Per page:'}</label>
                <select
                  id="items-per-page-mobile"
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="min-h-[36px] px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Desktop (≥ sm): horizontal layout */}
            <div className="hidden sm:flex items-center justify-between gap-4 px-4 py-3 bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 rounded-xl">
              <div className="text-sm text-gray-600 dark:text-gray-300 shrink-0">
                {locale === 'ar'
                  ? `عرض ${startIndex + 1} - ${Math.min(endIndex, filteredMembers.length)} من ${filteredMembers.length} عضو`
                  : `Showing ${startIndex + 1} - ${Math.min(endIndex, filteredMembers.length)} of ${filteredMembers.length} members`}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  aria-label={firstLabel}
                  title={firstLabel}
                  className={navBtn}
                >
                  {isRtl ? ChevronDoubleRight : ChevronDoubleLeft}
                </button>
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label={prevLabel}
                  className={navBtn}
                >
                  {isRtl ? ChevronRight : ChevronLeft}
                </button>
                {desktopPages.map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    aria-current={currentPage === pageNum ? 'page' : undefined}
                    className={pageBtn(currentPage === pageNum)}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  aria-label={nextLabel}
                  className={navBtn}
                >
                  {isRtl ? ChevronLeft : ChevronRight}
                </button>
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  aria-label={lastLabel}
                  title={lastLabel}
                  className={navBtn}
                >
                  {isRtl ? ChevronDoubleLeft : ChevronDoubleRight}
                </button>
              </div>

              <div className="flex items-center gap-2 text-sm shrink-0">
                <label htmlFor="items-per-page" className="text-gray-600 dark:text-gray-300">
                  {locale === 'ar' ? 'لكل صفحة:' : 'Per page:'}
                </label>
                <select
                  id="items-per-page"
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="min-h-[40px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>
        )
      })()}

      {filteredMembers.length === 0 && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center text-gray-500 dark:text-gray-400" dir={direction}>
          {(search || filterStatus !== 'all' || filterPackage !== 'all' || filterSalesId !== 'all' || filterCoachId !== 'all') ? (
            <>
              
              <p className="text-xl">{t('members.noMatchingResults')}</p>
              <button
                onClick={clearAllFilters}
                className="mt-4 bg-primary-600 text-primary-contrast px-6 py-2 rounded-lg hover:bg-primary-700"
              >
                {t('members.clearAllFilters')}
              </button>
            </>
          ) : (
            <>
              
              <p className="text-xl">{t('members.noMembers')}</p>
            </>
          )}
        </div>
      )}

      {/* Modal سجل الحضور */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden" dir={direction}>
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                
                <h2 className="text-2xl font-bold">{t('members.memberAttendanceLog')}</h2>
              </div>
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="text-white hover:bg-white dark:bg-gray-800 hover:text-green-600 rounded-full w-10 h-10 flex items-center justify-center transition"
              >
                
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
                    className="w-full px-4 py-2 ring-1 ring-gray-300 dark:ring-gray-600 dark:border-gray-600 rounded-lg focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    dir={direction}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">{t('members.toDate')}</label>
                  <input
                    type="date"
                    value={attendanceEndDate}
                    onChange={(e) => setAttendanceEndDate(e.target.value)}
                    className="w-full px-4 py-2 ring-1 ring-gray-300 dark:ring-gray-600 dark:border-gray-600 rounded-lg focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                  
                  <p className="text-gray-600 dark:text-gray-300">{t('members.loadingData')}</p>
                </div>
              ) : attendanceSummary.length === 0 ? (
                <div className="text-center py-12">
                  
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
                                {index === 0 && ''}
                                {index === 1 && ''}
                                {index === 2 && ''}
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" dir={direction}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" dir={direction}>
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600 to-yellow-600 text-white p-6 rounded-t-lg">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span></span>
                <span>{locale === 'ar' ? 'سجل الإيصالات' : 'Receipts History'}</span>
              </h2>
              <p className="text-orange-100 mt-1">
                {selectedMemberId && membersData.find(m => m.id === selectedMemberId)?.name}
              </p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {receiptsLoading ? (
                <LoadingScreen />
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
                        className="bg-gradient-to-r from-gray-50 to-white ring-1 ring-gray-200 dark:ring-gray-600 rounded-lg p-4 hover:shadow-md transition dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                                  ? (locale === 'ar' ? ' ملغي' : ' Cancelled')
                                  : (locale === 'ar' ? ' نشط' : ' Active')
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
                                  {receipt.paymentMethod === 'cash' ? (locale === 'ar' ? 'كاش ' : 'Cash ')
                                    : receipt.paymentMethod === 'visa' ? (locale === 'ar' ? 'فيزا ' : 'Visa ')
                                    : receipt.paymentMethod === 'instapay' ? (locale === 'ar' ? 'إنستاباي ' : 'Instapay ')
                                    : (locale === 'ar' ? 'محفظة ' : 'Wallet ')
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

      <ConfirmDialog
        isOpen={confirmState.open}
        title={confirmState.title || t('common.confirm')}
        message={confirmState.message}
        type="danger"
        onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
        onConfirm={() => { confirmState.onConfirm(); setConfirmState(s => ({ ...s, open: false })) }}
      />
    </div>
  )
}

export default function MembersPage() {
  return (
    <Suspense fallback={null}>
      <MembersPageContent />
    </Suspense>
  )
}
