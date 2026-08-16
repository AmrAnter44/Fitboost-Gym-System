'use client'

import { Suspense, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import nextDynamic from 'next/dynamic'
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionDenied from '../../components/PermissionDenied'
import { LoadingScreen } from '../../components/Spinner'
import type { MessageTemplate } from './MessageTemplateManager'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

//  Dynamic imports - تحميل عند الحاجة فقط
const FollowUpForm = nextDynamic(() => import('./FollowUpForm'), { ssr: false })
const SalesDashboard = nextDynamic(() => import('./SalesDashboard'), {
  ssr: false,
  loading: () => <div className="skeleton-shimmer h-64 rounded-xl" />
})
const MessageTemplateManager = nextDynamic(() => import('./MessageTemplateManager'), { ssr: false })
const MemberForm = nextDynamic(() => import('../../components/MemberForm'), { ssr: false })
const CollectionDashboard = nextDynamic(() => import('../../components/CollectionDashboard'), {
  ssr: false,
  loading: () => <div className="skeleton-shimmer h-64 rounded-xl" />
})
const SalesMgmtPanel = nextDynamic(() => import('../../components/SalesMgmtPanel'), {
  ssr: false,
  loading: () => <div className="skeleton-shimmer h-64 rounded-xl" />
})
const FollowUpCalendar = nextDynamic(() => import('../../components/FollowUpCalendar'), {
  ssr: false,
  loading: () => <div className="skeleton-shimmer h-96 rounded-xl" />
})
//  صفحة الزوار — بتتعرض كتاب جوا المتابعات (اتشالت من السايد بار)
const VisitorsPanel = nextDynamic(() => import('../visitors/page'), {
  ssr: false,
  loading: () => <div className="skeleton-shimmer h-96 rounded-xl" />
})
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../contexts/ToastContext'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  fetchFollowUpsPage,
  fetchVisitorsData,
  fetchMembersData,
  fetchDayUseData,
  fetchInvitationsData,
  deleteFollowUp,
  deleteVisitor
} from '@/lib/api/followups'
import { useDebounce } from '../../hooks/useDebounce'
import { normalizeArabic } from '@/lib/arabicNormalization'
import { createWhatsAppUrl } from '@/lib/whatsappHelper'
import AssignSalesButton, { type AssignEntityType } from '../../components/AssignSalesButton'
import SocialMediaFilter from '../../components/SocialMediaFilter'
import { useBulkSender } from '../../contexts/BulkSenderContext'
import {
  getDailyCount,
  getLastSession,
  getBulkPresets,
  saveBulkPreset,
  deleteBulkPreset,
} from '../../lib/bulkSender/storage'

interface Visitor {
  id: string
  name: string
  phone: string
  source: string
  status: string
  createdAt?: string
  interestedIn?: string
  notes?: string
  referrerMemberNumber?: string
}

interface FollowUp {
  id: string
  notes: string
  contacted: boolean
  nextFollowUpDate?: string
  result?: string
  salesName?: string
  createdAt: string
  updatedAt?: string
  visitor: Visitor
  assignedTo?: string
  assignedStaff?: {
    id: string
    name: string
    position?: string
  }
  priority?: string
  stage?: string
  lastContactedAt?: string
  contactCount?: number
}

interface Member {
  id: string
  phone: string
  name: string
  expiryDate?: string
  isActive: boolean
  isBanned?: boolean
  birthDate?: string
}

function FollowUpsPageContent() {
  const { hasPermission, loading: permissionsLoading, user } = usePermissions()
  // 💼 صلاحية مسؤول السيلز — مخصصة لإدارة كل حاجة في تاب إدارة السيلز
  const canManageSales = hasPermission('canManageSales')
  const { t, direction, locale } = useLanguage()
  const toast = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const bulkSender = useBulkSender()

  const [showForm, setShowForm] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedVisitorForHistory, setSelectedVisitorForHistory] = useState<Visitor | null>(null)
  const [selectedVisitorId, setSelectedVisitorId] = useState<string>('')
  const [calendarInitialDate, setCalendarInitialDate] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [selectedVisitorForTemplate, setSelectedVisitorForTemplate] = useState<Visitor | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{id: string, name: string, type?: 'invitation'} | null>(null)
  const [showDeleteVisitorConfirm, setShowDeleteVisitorConfirm] = useState(false)
  const [deleteVisitorTarget, setDeleteVisitorTarget] = useState<{id: string, name: string} | null>(null)

  //  تعديل زائر/دعوة
  const [showEditModal, setShowEditModal] = useState(false)
  const [editTarget, setEditTarget] = useState<{id: string, name: string, phone: string, type: 'visitor' | 'invitation', originalId: string, source?: string, referrerMemberNumber?: string} | null>(null)

  //  اشتراك سريع - تحويل الزائر إلى عضو
  const [showQuickSubscribeModal, setShowQuickSubscribeModal] = useState(false)
  const [selectedVisitorForSubscribe, setSelectedVisitorForSubscribe] = useState<Visitor | null>(null)
  const [selectedFollowUpSalesStaffId, setSelectedFollowUpSalesStaffId] = useState<string | null>(null)

  // View mode state
  const [viewMode, setViewMode] = useState<'list' | 'analytics' | 'collection' | 'sales-mgmt' | 'calendar' | 'visitors'>('list')

  //  Bulk sending states
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentName: '' })
  const bulkSendAbortedRef = useRef(false)

  //  Smart Bulk Script states
  const [showBulkScriptModal, setShowBulkScriptModal] = useState(false)
  const [bulkScriptMessages, setBulkScriptMessages] = useState<string[]>([''])
  const [bulkScriptContactFilter, setBulkScriptContactFilter] = useState<'all' | 'contacted' | 'not-contacted'>('not-contacted')
  const [bulkScriptDelayMin, setBulkScriptDelayMin] = useState(15)
  const [bulkScriptDelayMax, setBulkScriptDelayMax] = useState(30)
  const [bulkScriptSkipDays, setBulkScriptSkipDays] = useState(7)
  //  ⏰ ريمايندر: بعد كام يوم أرجع أكلم الناس دول تاني (0 = بدون ريمايندر)
  const [bulkScriptReminderDays, setBulkScriptReminderDays] = useState(0)
  const [bulkScriptTestPhone, setBulkScriptTestPhone] = useState('')
  //  نظام التشغيل (running/paused/progress/report) اتنقل لـ BulkSenderContext على مستوى التطبيق
  //  عشان الإرسال يفضل شغّال والكرة/المودالات تفضل ظاهرة حتى بعد الخروج من الصفحة.
  const [bulkScriptPresetName, setBulkScriptPresetName] = useState('')
  //  نقرأ القيم المحفوظة من localStorage عند initial mount
  const [bulkScriptDailyLimit, setBulkScriptDailyLimit] = useState(() => {
    if (typeof window === 'undefined') return 80
    const v = Number(localStorage.getItem('wa-bulk-dailyLimit'))
    return Number.isFinite(v) && v > 0 ? v : 80
  })
  const [bulkScriptBatchSize, setBulkScriptBatchSize] = useState(() => {
    if (typeof window === 'undefined') return 12
    const v = Number(localStorage.getItem('wa-bulk-batchSize'))
    return Number.isFinite(v) && v > 0 ? v : 12
  })
  const [bulkScriptBatchBreakMin, setBulkScriptBatchBreakMin] = useState(() => {
    if (typeof window === 'undefined') return 120
    const v = Number(localStorage.getItem('wa-bulk-batchBreakMin'))
    return Number.isFinite(v) && v > 0 ? v : 120
  })
  const [bulkScriptBatchBreakMax, setBulkScriptBatchBreakMax] = useState(() => {
    if (typeof window === 'undefined') return 300
    const v = Number(localStorage.getItem('wa-bulk-batchBreakMax'))
    return Number.isFinite(v) && v > 0 ? v : 300
  })
  const [bulkScriptSessionIndex, setBulkScriptSessionIndex] = useState<number | 'auto'>(() => {
    if (typeof window === 'undefined') return 'auto'
    const v = localStorage.getItem('wa-bulk-sessionIndex')
    if (v === null || v === 'auto') return 'auto'
    const n = Number(v)
    return Number.isFinite(n) ? n : 'auto'
  })

  //  Persist bulk script settings whenever they change
  useEffect(() => { localStorage.setItem('wa-bulk-dailyLimit', String(bulkScriptDailyLimit)) }, [bulkScriptDailyLimit])
  useEffect(() => { localStorage.setItem('wa-bulk-batchSize', String(bulkScriptBatchSize)) }, [bulkScriptBatchSize])
  useEffect(() => { localStorage.setItem('wa-bulk-batchBreakMin', String(bulkScriptBatchBreakMin)) }, [bulkScriptBatchBreakMin])
  useEffect(() => { localStorage.setItem('wa-bulk-batchBreakMax', String(bulkScriptBatchBreakMax)) }, [bulkScriptBatchBreakMax])
  useEffect(() => { localStorage.setItem('wa-bulk-sessionIndex', String(bulkScriptSessionIndex)) }, [bulkScriptSessionIndex])
  const [availableWaSessions, setAvailableWaSessions] = useState<{sessionIndex: number, phoneNumber?: string, isReady: boolean}[]>([])

  //  ثبات الـ stale/refetch لكل المتابعات (تقليل الـ network traffic)
  // refetchInterval شيلناه لأن staleTime + refetchOnWindowFocus كافيين للـ real-time
  const COMMON_QUERY_OPTS = {
    retry: 1,
    staleTime: 60 * 1000, // البيانات تعتبر طازجة لمدة دقيقة
    refetchOnWindowFocus: true, // إعادة جلب عند الرجوع للنافذة فقط
  } as const

  //  Pagination + Streaming — تحميل المتابعات على دفعات
  //   - أول 300 متابعة بتظهر فوراً
  //   - الباقي بيتحمّل في الـ background
  const FOLLOWUPS_PAGE_SIZE = 300
  const {
    data: followUpsPages,
    isLoading: loadingFollowUps,
    isFetchingNextPage: followUpsFetchingNext,
    fetchNextPage: followUpsFetchNext,
    hasNextPage: followUpsHasNext,
    error: followUpsError,
    refetch: refetchFollowUps
  } = useInfiniteQuery({
    queryKey: ['followups', 'paged', FOLLOWUPS_PAGE_SIZE],
    queryFn: ({ pageParam }) => fetchFollowUpsPage(pageParam as number, FOLLOWUPS_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    ...COMMON_QUERY_OPTS,
  })

  // Auto-stream: لما أول صفحة تيجي، نكمّل تحميل الباقي
  useEffect(() => {
    if (!loadingFollowUps && followUpsHasNext && !followUpsFetchingNext) {
      followUpsFetchNext()
    }
  }, [loadingFollowUps, followUpsHasNext, followUpsFetchingNext, followUpsFetchNext])

  const followUps = useMemo<any[]>(
    () => followUpsPages?.pages?.flatMap((p: any) => p.followUps) ?? [],
    [followUpsPages]
  )
  const totalFollowUpsCount = followUpsPages?.pages?.[0]?.total ?? followUps.length

  const {
    data: visitorsData = [],
    error: visitorsError
  } = useQuery({
    queryKey: ['visitors-followups'],
    queryFn: fetchVisitorsData,
    ...COMMON_QUERY_OPTS,
    enabled: hasPermission('canViewVisitors'), //  صلاحية عرض الزوار
  })

  const {
    data: allMembersData = [],
    error: membersError
  } = useQuery({
    queryKey: ['members-followups'],
    queryFn: fetchMembersData,
    ...COMMON_QUERY_OPTS,
    //  السماح للسيلز بقراءة أعضاءه (الـ API بيفلتر تلقائياً) حتى لو الصلاحية غير صريحة
    enabled: hasPermission('canViewMembers') || user?.isSales === true,
  })

  const {
    data: dayUseRecords = [],
    error: dayUseError
  } = useQuery({
    queryKey: ['dayuse-followups'],
    queryFn: fetchDayUseData,
    ...COMMON_QUERY_OPTS,
    enabled: hasPermission('canViewDayUse'), //  فقط إذا كان لديه صلاحية
  })

  const {
    data: invitations = [],
    error: invitationsError
  } = useQuery({
    queryKey: ['invitations-followups'],
    queryFn: fetchInvitationsData,
    ...COMMON_QUERY_OPTS,
    enabled: hasPermission('canViewMembers') || user?.isSales === true, // الدعوات مرتبطة بالأعضاء
  })

  //  جلب الموظفين النشطين
  const {
    data: staffList = [],
    error: staffError
  } = useQuery({
    queryKey: ['staff-active'],
    queryFn: async () => {
      const res = await fetch('/api/staff')
      if (!res.ok) throw new Error('Failed to fetch staff')
      const data = await res.json()
      return data.filter((s: any) => s.isActive)
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
    enabled: hasPermission('canViewStaff'), //  فقط إذا كان لديه صلاحية
  })

  // Extract visitors and members from queries
  //  ترتيب الزوار حسب تاريخ الإنشاء (الأحدث أولاً) — copy first to avoid mutating React Query cache
  const visitors = useMemo(() =>
    [...(visitorsData || [])].sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    [visitorsData]
  )

  //  ترتيب الدعوات حسب تاريخ الإنشاء (الأحدث أولاً) — copy first to avoid mutating React Query cache
  const sortedInvitations = useMemo(() =>
    [...(invitations || [])].sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    [invitations]
  )

  const members = useMemo(() =>
    (allMembersData || []).filter((m: Member) => m.isActive === true),
    [allMembersData]
  )

  const loading = loadingFollowUps

  //  Delete mutation مع Optimistic Update (متوافق مع useInfiniteQuery)
  const followUpsQueryKey = ['followups', 'paged', FOLLOWUPS_PAGE_SIZE] as const
  const deleteMutation = useMutation({
    mutationFn: deleteFollowUp,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['followups'] })
      const previousData = queryClient.getQueryData<any>(followUpsQueryKey)
      // الـ InfiniteData شكلها { pages: [{ followUps: [...] }, ...], pageParams: [...] }
      queryClient.setQueryData<any>(followUpsQueryKey, (old: any) => {
        if (!old?.pages) return old
        return {
          ...old,
          pages: old.pages.map((p: any) => ({
            ...p,
            followUps: Array.isArray(p?.followUps) ? p.followUps.filter((fu: any) => fu.id !== id) : p.followUps,
            total: typeof p?.total === 'number' ? Math.max(0, p.total - 1) : p?.total,
          })),
        }
      })
      return { previousData }
    },
    onSuccess: () => {
      toast.success(t('followups.messages.deleteSuccess'))
      //  Invalidate جميع الـ queries لتجنب التكرار
      queryClient.invalidateQueries({ queryKey: ['followups'] })
      queryClient.invalidateQueries({ queryKey: ['visitors-followups'] })
      queryClient.invalidateQueries({ queryKey: ['members-followups'] })
      queryClient.invalidateQueries({ queryKey: ['dayuse-followups'] })
      queryClient.invalidateQueries({ queryKey: ['invitations-followups'] })
    },
    onError: (error: Error, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(followUpsQueryKey, context.previousData)
      }
      toast.error(error.message || t('followups.messages.deleteError'))
    }
  })

  //  حذف زائر نهائياً (مع كل متابعاته)
  const deleteVisitorMutation = useMutation({
    mutationFn: deleteVisitor,
    onSuccess: () => {
      toast.success(t('followups.messages.deleteVisitorSuccess'))
      queryClient.invalidateQueries({ queryKey: ['followups'] })
      queryClient.invalidateQueries({ queryKey: ['visitors-followups'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || t('followups.messages.deleteVisitorError'))
    }
  })

  //  Pull website leads from Supabase  create local Visitors with source=website
  // يتشغل مرة عند فتح الصفحة + كل 5 دقايق طول ما الصفحة مفتوحة
  const [websiteSyncing, setWebsiteSyncing] = useState(false)
  //  لو الـ Supabase راجع 502 (مثلاً quota exceeded)، نوقف auto-sync فوراً
  // عشان ما نهلكش الـ logs ولا نضرب طلبات في الفراغ كل دقيقة
  const websitePauseUntilRef = useRef<number>(0)
  const syncWebsiteLeads = useCallback(async (showToastWhenEmpty = false) => {
    // لو في فترة pause بسبب fail سابق، نتجاهل auto-sync
    if (!showToastWhenEmpty && Date.now() < websitePauseUntilRef.current) return

    setWebsiteSyncing(true)
    try {
      const res = await fetch('/api/visitors/sync-website-leads', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // 5xx  الـ Supabase نفسه فاشل (quota / network). نوقف الـ auto-sync ساعة
        if (res.status >= 500) {
          websitePauseUntilRef.current = Date.now() + 60 * 60 * 1000
        }
        //  مفيش toast نهائي عند الفشل — السكوت أفضل
        return
      }
      // success  نشيل الـ pause لو كان مفعل
      websitePauseUntilRef.current = 0
      if (data?.imported > 0) {
        queryClient.invalidateQueries({ queryKey: ['followups'] })
        queryClient.invalidateQueries({ queryKey: ['visitors-followups'] })
        toast.success(
          locale === 'ar'
            ? `وصل ${data.imported} زائر جديد من الموقع`
            : `${data.imported} new website lead${data.imported > 1 ? 's' : ''} imported`
        )
      }
      //  مفيش toast لو مفيش leads جديدة — حتى لما الـ user يدوس manual sync
    } catch {
      // network error  نوقف الـ auto-sync ساعة. مفيش toast.
      websitePauseUntilRef.current = Date.now() + 60 * 60 * 1000
    } finally {
      setWebsiteSyncing(false)
    }
  }, [queryClient, toast, locale])

  useEffect(() => {
    syncWebsiteLeads(false)
    const interval = setInterval(() => syncWebsiteLeads(false), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [syncWebsiteLeads])

  // Error handling for all queries
  useEffect(() => {
    const errors = [followUpsError, visitorsError, membersError, dayUseError, invitationsError, staffError]
    const firstError = errors.find(e => e !== null)

    if (firstError) {
      const errorMessage = (firstError as Error).message
      if (errorMessage === 'UNAUTHORIZED') {
        toast.error(locale === 'ar' ? 'يجب تسجيل الدخول أولاً' : 'You must log in first')
        setTimeout(() => router.push('/login'), 2000)
      } else if (errorMessage === 'FORBIDDEN') {
        toast.error(locale === 'ar' ? 'ليس لديك صلاحية عرض المتابعات' : 'You do not have permission to view follow-ups')
      } else {
        toast.error(errorMessage || (locale === 'ar' ? 'حدث خطأ أثناء جلب البيانات' : 'An error occurred while fetching data'))
      }
    }
  }, [followUpsError, visitorsError, membersError, dayUseError, invitationsError, staffError, toast, router, locale])

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [resultFilter, setResultFilter] = useState('all')
  const [contactedFilter, setContactedFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all') //  فلتر المصدر
  const [socialFilter, setSocialFilter] = useState<string[]>([]) //  فلتر السوشيال ميديا (بوب-أب)
  const [salesFilter, setSalesFilter] = useState('all') //  فلتر السيلز (all, my-followups, my-overdue, today)
  const [assignedStaffFilter, setAssignedStaffFilter] = useState('all') //  فلتر بموظف سيلز محدد
  const [dateFromFilter, setDateFromFilter] = useState('') //  فلتر تاريخ من (YYYY-MM-DD)
  const [dateToFilter, setDateToFilter] = useState('')   //  فلتر تاريخ إلى (YYYY-MM-DD)

  //  لو المستخدم سيلز  يشوف متابعاته بس تلقائياً (مرة واحدة بس)
  //  استثناء: مسؤول السيلز (canManageSales) يشوف الكل افتراضياً
  const salesFilterInitRef = useRef(false)
  useEffect(() => {
    if (user?.isSales && !canManageSales && !salesFilterInitRef.current) {
      salesFilterInitRef.current = true
      setSalesFilter('my-followups')
    }
  }, [user?.isSales, canManageSales])
  const [sortByPriority, setSortByPriority] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('followups-sortByPriority')
      return saved !== null ? saved === 'true' : true
    }
    return true
  })
  const [expiringDays, setExpiringDays] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('followups_expiringDays')
      return saved ? parseInt(saved) : 30
    }
    return 30
  })
  const [showExpiringPopup, setShowExpiringPopup] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  //  حساب الأعضاء المنتهيين
  const expiredMembers = useMemo(() => {
    if (permissionsLoading) return []
    const today = new Date()
    today.setHours(0, 0, 0, 0) // مقارنة بالتاريخ فقط بدون الوقت
    return allMembersData
      .filter(m => {
        if (!m.expiryDate) return false
        //  الأعضاء المحظورين مبيظهروش في المتابعات
        if (m.isBanned) return false
        const expiryDate = new Date(m.expiryDate)
        expiryDate.setHours(0, 0, 0, 0)
        //  منتهي = تاريخ الانتهاء فات (سواء اتعطل يدوي أو لا)
        if (!(expiryDate < today)) return false
        //  لو سيلز  بيشوف أعضاءه اللي assigned ليه بس
        //  استثناء: مسؤول السيلز (canManageSales) بيشوف الكل حتى لو هو نفسه isSales
        if (user?.isSales && !canManageSales) {
          return user.staffId ? (m as any).salesStaffId === user.staffId : false
        }
        return true
      })
      .map(m => ({
        id: `expired-${m.id}`,
        name: m.name,
        phone: m.phone,
        source: 'expired-member',
        status: 'expired',
        salesStaffId: (m as any).salesStaffId || undefined
      }))
  }, [allMembersData, user, permissionsLoading, canManageSales])

  //  حساب الأعضاء اللي اشتراكهم قرب ينتهي (حسب عدد الأيام المحدد)
  const expiringMembers = useMemo(() => {
    if (permissionsLoading) return []
    const today = new Date()
    today.setHours(0, 0, 0, 0) // مقارنة بالتاريخ فقط
    const futureDate = new Date(today)
    futureDate.setDate(futureDate.getDate() + expiringDays)

    return allMembersData
      .filter(m => {
        if (!m.expiryDate || !m.isActive) return false
        //  الأعضاء المحظورين مبيظهروش في المتابعات
        if (m.isBanned) return false
        const expiryDate = new Date(m.expiryDate)
        expiryDate.setHours(0, 0, 0, 0)
        // الأعضاء النشطين اللي اشتراكهم هينتهي في خلال الأيام المحددة
        if (!(expiryDate >= today && expiryDate <= futureDate)) return false
        //  لو سيلز  بيشوف أعضاءه اللي assigned ليه بس
        //  استثناء: مسؤول السيلز (canManageSales) بيشوف الكل
        if (user?.isSales && !canManageSales) {
          return user.staffId ? (m as any).salesStaffId === user.staffId : false
        }
        return true
      })
      .map(m => {
        const expiryDate = new Date(m.expiryDate!)
        const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return {
          id: `expiring-${m.id}`,
          name: m.name,
          phone: m.phone,
          source: 'expiring-member',
          status: 'expiring',
          daysLeft,
          salesStaffId: (m as any).salesStaffId || undefined
        }
      })
  }, [allMembersData, expiringDays, user, permissionsLoading, canManageSales])

  //  تحسين الأداء: تنظيف رقم التليفون (memoized)
  const normalizePhone = useCallback((phone: string) => {
    if (!phone) return ''
    let normalized = phone.replace(/[\s\-\(\)\+]/g, '').trim()
    if (normalized.startsWith('2')) normalized = normalized.substring(1)
    if (normalized.startsWith('0')) normalized = normalized.substring(1)
    return normalized
  }, [])

  //  دمج المتابعات الحقيقية مع الأعضاء المنتهيين + الأعضاء القريبين من الانتهاء + Day Use + Invitations
  // ملاحظة: فلترة السيلز تتم في النهاية على الـ merged list (real + ephemeral) بشكل موحّد
  const allFollowUps = useMemo(() => {
    //  Set من أرقام الأعضاء (نشطين + منتهيين) — لإزالة الزوار الذين أصبحوا أعضاء
    const memberPhones = new Set<string>()
    //  Set منفصل لـ الأعضاء النشطين فقط — يستخدم لإخفاء المتابعات بتاعت اللي بقوا أعضاء فعلاً
    const activeMemberPhones = new Set<string>()
    const today = new Date(); today.setHours(0, 0, 0, 0)
    allMembersData.forEach((m: Member) => {
      if (!m.phone) return
      const normalized = normalizePhone(m.phone)
      memberPhones.add(normalized)
      // عضو نشط = isActive + اشتراكه لسه ساري
      const expiry = m.expiryDate ? new Date(m.expiryDate) : null
      if (expiry) expiry.setHours(0, 0, 0, 0)
      const isCurrentlyActive = m.isActive === true && expiry !== null && expiry >= today
      if (isCurrentlyActive) activeMemberPhones.add(normalized)
    })

    // عرض أحدث متابعة لكل زائر (الباقي محفوظ في الـ DB ويظهر في الـ history)
    //  إخفاء المتابعات بتاعت الزوار اللي بقوا أعضاء نشطين الآن
    const latestByVisitor = new Map<string, any>()
    followUps.forEach(fu => {
      // المتابعات المأرشفة يدوياً تتخفى ما عدا 'subscribed' (سجل تاريخي مهم)
      if (fu.archived && fu.result !== 'subscribed') return
      //  لو الزائر بقى عضو نشط الآن، نخفي متابعاته (مش محتاج follow-up)
      if (fu.visitor?.phone && activeMemberPhones.has(normalizePhone(fu.visitor.phone))) return
      const phone = fu.visitor?.phone ? normalizePhone(fu.visitor.phone) : fu.id
      const existing = latestByVisitor.get(phone)
      if (!existing || new Date(fu.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        latestByVisitor.set(phone, fu)
      }
    })
    const visibleFollowUps = Array.from(latestByVisitor.values())

    //  إنشاء Set من أرقام المتابعات الحقيقية النشطة لتجنب التكرار
    // ملاحظة: متابعات "مشترك" لا تُضاف هنا — عشان نسمح بإنشاء entries منتهية/قريبة من الانتهاء للنفس الشخص
    const realFollowUpPhones = new Set<string>()

    visibleFollowUps.forEach(fu => {
      if (fu.visitor?.phone && fu.result !== 'subscribed') {
        realFollowUpPhones.add(normalizePhone(fu.visitor.phone))
      }
    })

    // 1. الأعضاء المنتهيين (فقط اللي مش عندهم متابعة حقيقية)
    const expiredFollowUps: FollowUp[] = expiredMembers
      .filter(member => !realFollowUpPhones.has(normalizePhone(member.phone)))
      .map(member => ({
        id: member.id,
        notes: t('followups.notes.expiredMember'),
        contacted: false,
        nextFollowUpDate: undefined, // لا يُحدد تلقائياً — السيلز يحدد اليوم يدوياً
        result: undefined,
        salesName: t('followups.notes.system'),
        createdAt: new Date().toISOString(),
        visitor: member,
        assignedTo: (member as any).salesStaffId || undefined,
        assignedStaff: undefined,
        priority: 'high'
      }))

    // 2. الأعضاء اللي اشتراكهم قرب ينتهي (فقط اللي مش عندهم متابعة حقيقية)
    const expiringFollowUps: FollowUp[] = expiringMembers
      .filter((member: any) => !realFollowUpPhones.has(normalizePhone(member.phone)))
      .map((member: any) => ({
        id: member.id,
        notes: t('followups.notes.expiringMember', { days: String(member.daysLeft) }),
        contacted: false,
        nextFollowUpDate: undefined, // لا يُحدد تلقائياً
        result: undefined,
        salesName: t('followups.notes.system'),
        createdAt: new Date().toISOString(),
        visitor: member,
        assignedTo: (member as any).salesStaffId || undefined,
        assignedStaff: undefined,
        priority: 'medium'
      }))

    // 3. Day Use (استخدام InBody يوم واحد) - فقط اللي مش عندهم متابعة حقيقية ومش أعضاء
    const dayUseFollowUps: FollowUp[] = dayUseRecords
      .filter(record => !realFollowUpPhones.has(normalizePhone(record.phone)) && !memberPhones.has(normalizePhone(record.phone)))
      .map(record => ({
        id: `dayuse-${record.id}`,
        notes: t('followups.notes.dayUse', { serviceType: record.serviceType }),
        contacted: false,
        nextFollowUpDate: undefined, // لا يُحدد تلقائياً
        result: undefined,
        salesName: record.staffName || t('followups.notes.system'),
        createdAt: record.createdAt,
        visitor: {
          id: `dayuse-${record.id}`,
          name: record.name,
          phone: record.phone,
          source: 'invitation', //  استخدام يوم
          status: 'pending'
        },
        //  تمرير salesStaffId من سجل الـ DayUseInBody إن وُجد
        assignedTo: (record as any).salesStaffId || undefined,
        assignedStaff: undefined,
        priority: 'medium'
      }))

    // 4. Invitations (دعوات من أعضاء) - فقط اللي مش عندهم متابعة حقيقية ومش أعضاء
    const invitationFollowUps: FollowUp[] = sortedInvitations
      .filter(inv => !realFollowUpPhones.has(normalizePhone(inv.guestPhone)) && !memberPhones.has(normalizePhone(inv.guestPhone)))
      .map(inv => ({
        id: `invitation-${inv.id}`,
        notes: t('followups.notes.invitation', { memberName: inv.member?.name || '' }),
        contacted: false,
        nextFollowUpDate: undefined, // لا يُحدد تلقائياً
        result: undefined,
        salesName: t('followups.notes.system'),
        createdAt: inv.createdAt,
        visitor: {
          id: `invitation-${inv.id}`,
          name: inv.guestName,
          phone: inv.guestPhone,
          source: 'member-invitation', //  دعوة من عضو
          status: 'pending'
        },
        //  ورّث salesStaffId من العضو الداعي إن أُرسل من الـ API
        assignedTo: (inv.member as any)?.salesStaffId || undefined,
        assignedStaff: undefined,
        priority: 'medium'
      }))

    // 5. الزوار العاديين (Visitors) - فقط اللي مش عندهم متابعة حقيقية ومش أعضاء
    const regularVisitorFollowUps: FollowUp[] = visitors
      .filter(visitor => !realFollowUpPhones.has(normalizePhone(visitor.phone)) && !memberPhones.has(normalizePhone(visitor.phone)))
      .map(visitor => ({
        id: `visitor-${visitor.id}`,
        notes: visitor.notes || (visitor.source || 'walk-in'),
        contacted: false,
        nextFollowUpDate: undefined, // لا يُحدد تلقائياً
        result: undefined,
        salesName: undefined,
        createdAt: visitor.createdAt || new Date().toISOString(),
        visitor: {
          id: visitor.id,
          name: visitor.name,
          phone: visitor.phone,
          source: visitor.source || 'walk-in',
          status: visitor.status || 'pending'
        },
        // ملاحظة: Visitor schema لا يحتوي حقل salesStaffId — التعيين فقط عبر FollowUp
        assignedTo: undefined,
        assignedStaff: undefined,
        priority: 'medium'
      }))

    const merged = [...visibleFollowUps, ...expiredFollowUps, ...expiringFollowUps, ...dayUseFollowUps, ...invitationFollowUps, ...regularVisitorFollowUps]

    //  لو سيلز  فلترة موحّدة (real + ephemeral) — staffId only
    // الاستثناء الوحيد: الدعوات غير المسنَّدة (member-invitation بدون assignedTo) تظهر للجميع
    //  استثناء كمان: مسؤول السيلز (canManageSales) بيشوف الكل عشان يقدر يدير الفريق
    if (!permissionsLoading && user?.isSales && user?.staffId && !canManageSales) {
      return merged.filter(fu => {
        if (fu.assignedTo === user.staffId) return true
        if (fu.visitor?.source === 'member-invitation' && !fu.assignedTo) return true
        return false
      })
    }

    return merged
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUps, expiredMembers, expiringMembers, dayUseRecords, sortedInvitations, visitors, normalizePhone, user, permissionsLoading, canManageSales])

  // الأرشفة التلقائية للمتابعات بعد تحويل الزائر لعضوية اتشالت — السجل بقى يفضل ظاهر
  // مع badge "✓ عضو الآن" بدل ما يتأرشف. لو فيه متابعات قديمة متأرشفة بـ reason='converted'
  // المستخدم يقدر يفك أرشفتها يدوياً من الـ UI لو حب.

  //  إعادة فتح المتابعات المأرشفة لما عضو يقرب ينتهي أو ينتهي
  // عشان السجل والتاريخ يفضل محفوظ ويظهر في القائمة بدل entry جديد فاضي
  // ملاحظة: نعتمد على signature الأرقام (string) بدل الكائنات نفسها لتجنب الـ requests المتكررة
  const reopenSignatureRef = useRef<string>('')
  useEffect(() => {
    if (loadingFollowUps) return

    const phones = [
      ...expiredMembers.map(m => m.phone),
      ...expiringMembers.map((m: any) => m.phone)
    ].filter(Boolean)

    if (phones.length === 0) return

    //  تجنب إرسال نفس الـ request لو الأرقام لم تتغير
    const signature = phones.slice().sort().join(',')
    if (reopenSignatureRef.current === signature) return

    fetch('/api/followups/reopen-expired', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phones })
    })
      .then(r => r.json())
      .then(({ reopened }) => {
        reopenSignatureRef.current = signature
        if (reopened > 0) {
          queryClient.invalidateQueries({ queryKey: ['followups'] })
        }
      })
      .catch(() => {})
  }, [expiredMembers, expiringMembers, loadingFollowUps, queryClient])

  const handleSubmit = useCallback(async (formData: {
    visitorId: string
    salesName: string
    notes: string
    result: string
    nextFollowUpDate: string
    contacted: boolean
    assignedTo?: string
    priority?: string
    stage?: string
  }) => {
    setSubmitting(true)
    try {
      //  البحث عن بيانات الزائر/العضو للإرسال إلى الـ API
      let visitorData = null

      // البحث في الزوار
      const visitor = visitors.find(v => v.id === formData.visitorId)
      if (visitor) {
        visitorData = { name: visitor.name, phone: visitor.phone, source: visitor.source }
      }

      // البحث في الأعضاء المنتهيين
      const expMember = expiredMembers.find((m: any) => m.id === formData.visitorId)
      if (expMember) {
        visitorData = { name: expMember.name, phone: expMember.phone, source: 'expired-member' }
      }

      // البحث في الأعضاء القريبين من الانتهاء
      const expiringMember = expiringMembers.find((m: any) => m.id === formData.visitorId)
      if (expiringMember) {
        visitorData = { name: expiringMember.name, phone: expiringMember.phone, source: 'expiring-member' }
      }

      // البحث في Day Use
      const dayUse = dayUseRecords.find(r => `dayuse-${r.id}` === formData.visitorId)
      if (dayUse) {
        visitorData = { name: dayUse.name, phone: dayUse.phone, source: 'invitation' }
      }

      // البحث في Invitations
      const invitation = sortedInvitations.find(inv => `invitation-${inv.id}` === formData.visitorId)
      if (invitation) {
        visitorData = { name: invitation.guestName, phone: invitation.guestPhone, source: 'member-invitation' }
      }

      const response = await fetch('/api/visitors/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, visitorData }),
      })

      if (response.ok) {
        toast.success(locale === 'ar' ? 'تم إضافة المتابعة بنجاح!' : 'Follow-up added successfully!')
        //  Invalidate جميع الـ queries لتجنب التكرار
        await queryClient.invalidateQueries({ queryKey: ['followups'] })
        await queryClient.invalidateQueries({ queryKey: ['visitors-followups'] })
        await queryClient.invalidateQueries({ queryKey: ['members-followups'] })
        await queryClient.invalidateQueries({ queryKey: ['dayuse-followups'] })
        await queryClient.invalidateQueries({ queryKey: ['invitations-followups'] })
        setShowForm(false)
        setSelectedVisitorId('')
      } else {
        const data = await response.json()
        toast.error(data.error || (locale === 'ar' ? 'فشل إضافة المتابعة' : 'Failed to add follow-up'))
      }
    } catch (error) {
      console.error(error)
      toast.error(locale === 'ar' ? 'حدث خطأ' : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }, [visitors, expiredMembers, expiringMembers, dayUseRecords, sortedInvitations, queryClient, toast, locale])

  const openQuickFollowUp = useCallback((visitor: Visitor) => {
    setSelectedVisitorId(visitor.id)
    setShowForm(true)
    // لا نحتاج scroll - هيظهر كـ modal
  }, [])

  //  تحسين أداء كبير: إنشاء Set من أرقام الأعضاء النشطين مرة واحدة
  // بدلاً من البحث في array في كل مرة - يحسن O(n) إلى O(1)
  const activeMemberPhones = useMemo(() => {
    const phoneSet = new Set<string>()
    members.forEach(member => {
      const normalized = normalizePhone(member.phone)
      if (normalized) {
        phoneSet.add(normalized)
      }
    })
    return phoneSet
  }, [members, normalizePhone])

  const openHistoryModal = useCallback((visitor: Visitor) => {
    setSelectedVisitorForHistory(visitor)
    setShowHistoryModal(true)
  }, [])

  //  فتح modal القوالب
  const openTemplateModal = useCallback((visitor: Visitor) => {
    setSelectedVisitorForTemplate(visitor)
    setShowTemplateModal(true)
  }, [])

  //  إرسال رسالة من قالب
  const sendWhatsAppTemplate = useCallback(async (template: MessageTemplate) => {
    if (!selectedVisitorForTemplate) return

    // استبدال المتغيرات في الرسالة
    const message = template.message
      .replace(/\{name\}/g, selectedVisitorForTemplate.name)
      .replace(/\{salesName\}/g, user?.name || t('followups.bulkScript.defaultSalesName'))
      .replace(/\{phone\}/g, selectedVisitorForTemplate.phone)
      .replace(/\{date\}/g, new Date().toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US'))
      .replace(/\{time\}/g, new Date().toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }))

    try {
      const statusResponse = await fetch('/api/whatsapp/status')
      const status = statusResponse.ok ? await statusResponse.json() : null

      if (status?.isReady) {
        const sendResponse = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: selectedVisitorForTemplate.phone, message })
        })

        const sendResult = await sendResponse.json()

        if (sendResult.success) {
          toast.success(locale === 'ar' ? 'تم إرسال الرسالة بنجاح على الواتساب' : 'Message sent successfully via WhatsApp')
          setShowTemplateModal(false)

          //  Optimistic update — نخلّي علامة "تم التواصل" تظهر فوراً في القايمة
          //   من غير ما نستنى الـ refetch (اللي مع useInfiniteQuery بياخد وقت)
          const visitorPhone = selectedVisitorForTemplate.phone
          const normalizedPhone = (visitorPhone || '').replace(/\D/g, '')
          const optimisticContactedAt = new Date().toISOString()
          queryClient.setQueryData<any>(['followups', 'paged', FOLLOWUPS_PAGE_SIZE], (old: any) => {
            if (!old?.pages) return old
            return {
              ...old,
              pages: old.pages.map((p: any, idx: number) => {
                if (idx !== 0) return p
                // ندوّر على متابعة موجودة لنفس التليفون نحدّثها، أو نضيف entry جديد في الأول
                let found = false
                const updated = (Array.isArray(p?.followUps) ? p.followUps : []).map((fu: any) => {
                  if (fu?.visitor?.phone && fu.visitor.phone.replace(/\D/g, '') === normalizedPhone) {
                    found = true
                    return { ...fu, contacted: true, lastContactedAt: optimisticContactedAt }
                  }
                  return fu
                })
                if (!found) {
                  // ضيف entry جديد في أول الصفحة (هيتم استبداله من السيرفر بعد الـ refetch)
                  updated.unshift({
                    id: `optimistic-${Date.now()}`,
                    visitorId: selectedVisitorForTemplate.id,
                    visitor: {
                      id: selectedVisitorForTemplate.id,
                      name: selectedVisitorForTemplate.name,
                      phone: selectedVisitorForTemplate.phone,
                      source: selectedVisitorForTemplate.source,
                    },
                    notes: `تم إرسال رسالة "${template.title}" عبر الواتساب`,
                    contacted: true,
                    lastContactedAt: optimisticContactedAt,
                    createdAt: optimisticContactedAt,
                    updatedAt: optimisticContactedAt,
                    salesName: user?.name,
                  })
                }
                return { ...p, followUps: updated }
              })
            }
          })

          try {
            const response = await fetch('/api/visitors/followups', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                visitorId: selectedVisitorForTemplate.id,
                notes: `تم إرسال رسالة "${template.title}" عبر الواتساب`,
                contacted: true,
                salesName: user?.name,
                visitorData: {
                  name: selectedVisitorForTemplate.name,
                  phone: selectedVisitorForTemplate.phone,
                  source: selectedVisitorForTemplate.source
                }
              }),
            })

            if (response.ok) {
              await queryClient.invalidateQueries({ queryKey: ['followups'] })
              await queryClient.invalidateQueries({ queryKey: ['visitors-followups'] })
              toast.success(locale === 'ar' ? 'تم تحديث حالة المتابعة تلقائياً' : 'Follow-up status updated automatically')
            } else {
              //  السيلز محتاج يعرف لو المتابعة ما اتسجلتش + السبب الحقيقي
              const errData = await response.json().catch(() => ({}))
              console.error('Follow-up save failed:', response.status, errData)
              const apiError = errData?.error || (response.status === 403
                ? (locale === 'ar' ? 'ليس لديك صلاحية إنشاء متابعات' : 'No permission to create follow-ups')
                : response.status === 401
                  ? (locale === 'ar' ? 'يجب تسجيل الدخول أولاً' : 'Please log in')
                  : '')
              toast.error(locale === 'ar'
                ? `الرسالة اتبعتت بس المتابعة ما اتسجلتش${apiError ? ` — ${apiError}` : ' — سجّلها يدوياً'}`
                : `Message sent but follow-up was NOT recorded${apiError ? ` — ${apiError}` : ' — log it manually'}`)
              // rollback الـ optimistic update عشان الـ UI يعكس الحقيقة
              queryClient.invalidateQueries({ queryKey: ['followups'] })
            }
          } catch (error) {
            console.error('Error updating follow-up:', error)
            toast.error(locale === 'ar'
              ? 'الرسالة اتبعتت بس المتابعة ما اتسجلتش — سجّلها يدوياً'
              : 'Message sent but follow-up was NOT recorded — log it manually')
            queryClient.invalidateQueries({ queryKey: ['followups'] })
          }
        } else {
          toast.error(`${locale === 'ar' ? 'فشل إرسال الرسالة' : 'Failed to send message'}: ${sendResult.error}`)
        }
        return
      }

      // Fallback: الواتساب غير متصل
      toast.warning(locale === 'ar' ? 'الواتساب غير متصل. جاري فتح واتساب ويب...' : 'WhatsApp not connected. Opening WhatsApp Web...')
      const url = createWhatsAppUrl(selectedVisitorForTemplate.phone, message)
      window.open(url, '_blank')
      setShowTemplateModal(false)
      setTimeout(() => { openQuickFollowUp(selectedVisitorForTemplate) }, 500)

    } catch (error) {
      console.error('Error sending WhatsApp message:', error)
      const url = createWhatsAppUrl(selectedVisitorForTemplate.phone, message)
      window.open(url, '_blank')
      setShowTemplateModal(false)
      setTimeout(() => { openQuickFollowUp(selectedVisitorForTemplate) }, 500)
    }
  }, [selectedVisitorForTemplate, openQuickFollowUp, user, toast, queryClient, locale])

  //  حذف دعوة
  const handleDeleteInvitation = useCallback((invitationId: string, name: string) => {
    const originalId = invitationId.replace('invitation-', '')
    setDeleteTarget({ id: originalId, name, type: 'invitation' })
    setShowDeleteConfirm(true)
  }, [])

  //  حذف متابعة
  const handleDeleteFollowUp = useCallback((followUpId: string, visitorName: string) => {
    // لا نحذف المتابعات المولدة تلقائياً (الأعضاء المنتهيين والقريبين من الانتهاء)
    if (followUpId.startsWith('expired-') || followUpId.startsWith('expiring-') || followUpId.startsWith('dayuse-') || followUpId.startsWith('visitor-')) {
      toast.error(t('followups.messages.cannotDeleteAuto'))
      return
    }

    // حذف الدعوة
    if (followUpId.startsWith('invitation-')) {
      handleDeleteInvitation(followUpId, visitorName)
      return
    }

    setDeleteTarget({ id: followUpId, name: visitorName })
    setShowDeleteConfirm(true)
  }, [toast, t, handleDeleteInvitation])

  const deleteInvitationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invitations?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete invitation')
      return res.json()
    },
    onSuccess: () => {
      toast.success(locale === 'ar' ? 'تم حذف الدعوة بنجاح' : 'Invitation deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['followups'] })
      queryClient.invalidateQueries({ queryKey: ['invitations-followups'] })
    },
    onError: () => {
      toast.error(locale === 'ar' ? 'فشل حذف الدعوة' : 'Failed to delete invitation')
    }
  })

  // تأكيد الحذف
  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      if (deleteTarget.type === 'invitation') {
        deleteInvitationMutation.mutate(deleteTarget.id)
      } else {
        deleteMutation.mutate(deleteTarget.id)
      }
      setShowDeleteConfirm(false)
      setDeleteTarget(null)
    }
  }, [deleteTarget, deleteMutation, deleteInvitationMutation])

  // إلغاء الحذف
  const cancelDelete = useCallback(() => {
    setShowDeleteConfirm(false)
    setDeleteTarget(null)
  }, [])

  //  حذف زائر نهائياً
  const handleDeleteVisitor = useCallback((visitorId: string, visitorName: string) => {
    setDeleteVisitorTarget({ id: visitorId, name: visitorName })
    setShowDeleteVisitorConfirm(true)
  }, [])

  const confirmDeleteVisitor = useCallback(() => {
    if (deleteVisitorTarget) {
      deleteVisitorMutation.mutate(deleteVisitorTarget.id)
      setShowDeleteVisitorConfirm(false)
      setDeleteVisitorTarget(null)
    }
  }, [deleteVisitorTarget, deleteVisitorMutation])

  const cancelDeleteVisitor = useCallback(() => {
    setShowDeleteVisitorConfirm(false)
    setDeleteVisitorTarget(null)
  }, [])

  //  تعديل زائر أو دعوة
  const handleEditFollowUp = useCallback((followUp: any) => {
    const isInvitation = followUp.id.startsWith('invitation-')
    const originalId = isInvitation ? followUp.id.replace('invitation-', '') : followUp.visitor.id
    setEditTarget({
      id: followUp.id,
      name: followUp.visitor.name,
      phone: followUp.visitor.phone,
      type: isInvitation ? 'invitation' : 'visitor',
      originalId,
      source: followUp.visitor?.source || '',
      referrerMemberNumber: followUp.visitor?.referrerMemberNumber || '',
    })
    setShowEditModal(true)
  }, [])

  //  لو جينا من زرار "اذهب للمتابعات" (?view=list) نرجّع لقائمة المتابعات
  //  (لأن الزوار بقت تاب جوا نفس الصفحة، فالتنقل لوحده مبيبدّلش التاب)
  useEffect(() => {
    if (searchParams.get('view') === 'list') {
      setViewMode('list')
      router.replace('/followups', { scroll: false })
    }
  }, [searchParams, router])

  //  Deep-link من الـ Dashboard smart search — يفتح modal الزائر فور التحميل
  const [hasOpenedFromUrl, setHasOpenedFromUrl] = useState(false)
  useEffect(() => {
    if (hasOpenedFromUrl) return
    const targetVisitorId = searchParams.get('visitor')
    if (!targetVisitorId) return
    if (!allFollowUps || allFollowUps.length === 0) return
    const match = allFollowUps.find(fu => fu.visitor?.id === targetVisitorId)
    if (match) {
      handleEditFollowUp(match)
      setHasOpenedFromUrl(true)
      router.replace('/followups', { scroll: false })
    }
  }, [searchParams, allFollowUps, hasOpenedFromUrl, handleEditFollowUp, router])

  const confirmEdit = useCallback(async () => {
    if (!editTarget) return
    const trimmedName = editTarget.name.trim()
    const trimmedPhone = editTarget.phone.trim()
    if (!trimmedName) {
      toast.error(locale === 'ar' ? 'الاسم مطلوب' : 'Name is required')
      return
    }
    //  تحقق من رقم الهاتف: أرقام فقط، 10-15 رقم
    const phoneDigits = trimmedPhone.replace(/\D/g, '')
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      toast.error(locale === 'ar' ? 'رقم الهاتف غير صحيح' : 'Invalid phone number')
      return
    }
    try {
      if (editTarget.type === 'invitation') {
        const res = await fetch('/api/invitations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editTarget.originalId, guestName: trimmedName, guestPhone: trimmedPhone })
        })
        if (!res.ok) throw new Error('Failed to update invitation')
      } else {
        const body: any = {
          id: editTarget.originalId,
          name: trimmedName,
          phone: trimmedPhone,
        }
        // 🆕 لو في source متبعّت، نبعته (والـ referrerMemberNumber لو friend_referral)
        if (editTarget.source !== undefined) {
          body.source = editTarget.source || null
          body.referrerMemberNumber = editTarget.source === 'friend_referral'
            ? (editTarget.referrerMemberNumber?.trim() || null)
            : null
        }
        const res = await fetch('/api/visitors', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        if (!res.ok) throw new Error('Failed to update visitor')
      }
      toast.success(locale === 'ar' ? 'تم التعديل بنجاح' : 'Updated successfully')
      queryClient.invalidateQueries({ queryKey: ['followups'] })
      queryClient.invalidateQueries({ queryKey: ['visitors-followups'] })
      queryClient.invalidateQueries({ queryKey: ['invitations-followups'] })
      setShowEditModal(false)
      setEditTarget(null)
    } catch (error) {
      toast.error(locale === 'ar' ? 'فشل التعديل' : 'Update failed')
    }
  }, [editTarget, toast, queryClient, locale])

  //  فتح نموذج الاشتراك السريع
  const openQuickSubscribe = useCallback((visitor: Visitor, salesStaffId?: string) => {
    setSelectedVisitorForSubscribe(visitor)
    setSelectedFollowUpSalesStaffId(salesStaffId || null)
    setShowQuickSubscribeModal(true)
  }, [])

  // Memoize history to avoid recalculation on every render
  const visitorHistory = useMemo(() => {
    if (!selectedVisitorForHistory) return []
    const normalizedPhone = normalizePhone(selectedVisitorForHistory.phone)
    return followUps.filter(fu => {
      const fuPhone = normalizePhone(fu.visitor.phone)
      return fuPhone === normalizedPhone
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [selectedVisitorForHistory, followUps, normalizePhone])

  //  خريطة آخر كومنت لكل زائر (للعرض في الصفحة الرئيسية)
  // محسّن: O(n) بدون sort - نقارن الـ timestamp ونحتفظ بالأحدث فقط
  const lastCommentByPhone = useMemo(() => {
    const commentMap = new Map<string, { notes: string; createdAt: string; salesName?: string; ts: number }>()

    followUps.forEach(fu => {
      if (!fu.notes || !fu.notes.trim()) return
      const normalizedPhone = normalizePhone(fu.visitor.phone)
      if (!normalizedPhone) return

      const ts = new Date(fu.updatedAt || fu.createdAt).getTime()
      const existing = commentMap.get(normalizedPhone)
      if (!existing || ts > existing.ts) {
        commentMap.set(normalizedPhone, {
          notes: fu.notes,
          createdAt: fu.updatedAt || fu.createdAt,
          salesName: fu.salesName,
          ts,
        })
      }
    })

    return commentMap
  }, [followUps, normalizePhone])

  // دالة للحصول على آخر كومنت لزائر معين
  const getLastComment = useCallback((phone: string) => {
    const normalizedPhone = normalizePhone(phone)
    return lastCommentByPhone.get(normalizedPhone)
  }, [lastCommentByPhone, normalizePhone])

  //  تحسين أداء: استخدام Set lookup بدلاً من find - O(1) بدلاً من O(n)
  const isVisitorAMember = useCallback((phone: string) => {
    const normalizedVisitorPhone = normalizePhone(phone)
    return activeMemberPhones.has(normalizedVisitorPhone)
  }, [activeMemberPhones, normalizePhone])

  //  مساعد للبحث عن memberId بالهاتف — يُستخدم في زر "تجديد سريع"
  const phoneToMemberId = useMemo(() => {
    const map = new Map<string, string>()
    allMembersData.forEach((m: Member) => {
      if (m.phone && m.id) {
        map.set(normalizePhone(m.phone), m.id)
      }
    })
    return map
  }, [allMembersData, normalizePhone])

  const getMemberIdByPhone = useCallback((phone: string): string | null => {
    return phoneToMemberId.get(normalizePhone(phone)) || null
  }, [phoneToMemberId, normalizePhone])

  //  تحسين الأداء: حساب أولوية المتابعة (memoized)
  // todayMidnight بيتحدث مع بيانات المتابعات (كل ما الداتا اتجابت من جديد)
  const todayMidnight = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUps])

  const getFollowUpPriority = useCallback((followUp: FollowUp): 'overdue' | 'today' | 'upcoming' | 'none' => {
    if (followUp.contacted) return 'none'
    if (!followUp.nextFollowUpDate) return 'none'

    const nextDate = new Date(followUp.nextFollowUpDate)
    nextDate.setHours(0, 0, 0, 0)
    const nextTime = nextDate.getTime()

    if (nextTime < todayMidnight) return 'overdue'
    if (nextTime === todayMidnight) return 'today'
    return 'upcoming'
  }, [todayMidnight])

  //  هل المتابعة دي بتاعة اليوزر الحالي؟
  // نعتمد على staffId فقط — أي fallback على salesName ضعيف ومش موثوق (في حالة تشابه أسماء)
  const isMyFollowUp = useCallback((fu: FollowUp): boolean => {
    if (!user?.staffId) return false
    return fu.assignedTo === user.staffId
  }, [user])

  // فلترة النتائج
  const filteredFollowUps = useMemo(() => {
    return allFollowUps
      .filter(fu => {
        const searchNormalized = normalizeArabic(debouncedSearchTerm)
        const matchesSearch =
          normalizeArabic(fu.visitor.name).includes(searchNormalized) ||
          fu.visitor.phone.includes(debouncedSearchTerm) ||
          normalizeArabic(fu.notes).includes(searchNormalized) ||
          (fu.salesName && normalizeArabic(fu.salesName).includes(searchNormalized))

        const matchesResult = resultFilter === 'all' || fu.result === resultFilter
        const matchesContacted = contactedFilter === 'all' ||
          (contactedFilter === 'contacted' && fu.contacted) ||
          (contactedFilter === 'not-contacted' && !fu.contacted)

        const priority = getFollowUpPriority(fu)
        const matchesPriority = priorityFilter === 'all' || priority === priorityFilter

        //  ملاحظة: فلترة السيلز للـ "متابعاتي بس" تتم في allFollowUps الآن (مرة واحدة)

        //  فلتر السيلز (متابعاتي، المتأخرة بتاعتي، النهاردة)
        let matchesSales = true
        if (salesFilter === 'my-followups') {
          matchesSales = isMyFollowUp(fu)
        } else if (salesFilter === 'my-overdue') {
          matchesSales = isMyFollowUp(fu) && priority === 'overdue'
        } else if (salesFilter === 'today') {
          matchesSales = priority === 'today'
        }

        //  فلترة حسب المصدر
        let matchesSource = true
        if (sourceFilter !== 'all') {
          if (sourceFilter === 'expired-member') {
            matchesSource = fu.visitor.source === 'expired-member'
          } else if (sourceFilter === 'expiring-member') {
            matchesSource = fu.visitor.source === 'expiring-member'
          } else if (sourceFilter === 'member-invitation') {
            matchesSource = fu.visitor.source === 'member-invitation'
          } else if (sourceFilter === 'dayuse') {
            matchesSource = fu.visitor.source === 'invitation'
          } else if (sourceFilter === 'website') {
            matchesSource = fu.visitor.source === 'website'
          } else if (sourceFilter === 'visitors') {
            // زوار عاديين (walk-in, social-media, etc.) — مش website ولا الفئات اللي ليها زرار مخصص
            matchesSource = !['expired-member', 'expiring-member', 'member-invitation', 'invitation', 'website'].includes(fu.visitor.source)
          }
        }

        //  فلتر السوشيال ميديا (بوب-أب) — لو فيه منصّات مختارة، اعرض بس اللي مصدرها منهم
        const matchesSocial = socialFilter.length === 0 || socialFilter.includes(fu.visitor.source)

        //  فلتر موظف السيلز المحدد
        const matchesAssignedStaff = assignedStaffFilter === 'all'
          || (assignedStaffFilter === '__unassigned__' ? !fu.assignedTo : fu.assignedTo === assignedStaffFilter)

        //  فلتر بنطاق التاريخ (createdAt الخاص بالمتابعة)
        let matchesDateRange = true
        if (dateFromFilter || dateToFilter) {
          const created = new Date(fu.createdAt).getTime()
          if (dateFromFilter) {
            const [y, m, d] = dateFromFilter.split('-').map(Number)
            const fromTs = new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
            if (created < fromTs) matchesDateRange = false
          }
          if (matchesDateRange && dateToFilter) {
            const [y, m, d] = dateToFilter.split('-').map(Number)
            const toTs = new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
            if (created > toTs) matchesDateRange = false
          }
        }

        return matchesSearch && matchesResult && matchesContacted && matchesPriority && matchesSource && matchesSocial && matchesSales && matchesAssignedStaff && matchesDateRange
      })
      .sort((a, b) => {
        if (sortByPriority) {
          //  ترتيب حسب الأولوية ثم الأحدث أولاً
          const aPriority = getFollowUpPriority(a)
          const bPriority = getFollowUpPriority(b)

          // ترتيب: overdue > today > upcoming > none
          const priorityOrder: {[key: string]: number} = { overdue: 0, today: 1, upcoming: 2, none: 3 }
          const priorityDiff = priorityOrder[aPriority] - priorityOrder[bPriority]
          if (priorityDiff !== 0) return priorityDiff
        }

        //  ترتيب حسب تاريخ الإضافة: الأحدث أولاً
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [allFollowUps, debouncedSearchTerm, resultFilter, contactedFilter, priorityFilter, sourceFilter, socialFilter, salesFilter, assignedStaffFilter, dateFromFilter, dateToFilter, sortByPriority, getFollowUpPriority, user, isMyFollowUp])

  // إعادة تعيين الصفحة للأولى عند تغيير الفلاتر
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, resultFilter, contactedFilter, priorityFilter, sourceFilter, socialFilter, salesFilter, assignedStaffFilter, dateFromFilter, dateToFilter, sortByPriority])

  // حساب الصفحات
  const totalPages = Math.ceil(filteredFollowUps.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentFollowUps = filteredFollowUps.slice(startIndex, endIndex)

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  //  إرسال جماعي لجميع الأعضاء المفلترين
  const handleBulkSend = useCallback(async (template: MessageTemplate) => {
    // الحصول على القائمة المفلترة الحالية
    const targetVisitors = filteredFollowUps.map(fu => fu.visitor)

    const noTargetsMsg = locale === 'ar' ? 'لا يوجد أعضاء للإرسال إليهم' : 'No members to send to'
    const waNotConnectedMsg = locale === 'ar'
      ? 'الواتساب غير متصل. افتح الإعدادات  واتساب لمسح QR code'
      : 'WhatsApp is not connected. Open Settings  WhatsApp to scan the QR code'

    if (targetVisitors.length === 0) {
      toast.error(noTargetsMsg)
      return
    }

    // التحقق من حالة الواتساب
    try {
      const statusResponse = await fetch('/api/whatsapp/status')
      if (statusResponse.ok) {
        const status = await statusResponse.json()
        if (!status.isReady) {
          toast.error(waNotConnectedMsg)
          return
        }
      } else {
        toast.error(waNotConnectedMsg)
        return
      }
    } catch (error) {
      console.error('Error checking WhatsApp status:', error)
      toast.error(waNotConnectedMsg)
      return
    }

    // إغلاق modal القوالب وفتح modal التقدم
    setShowTemplateModal(false)
    setBulkSending(true)
    bulkSendAbortedRef.current = false
    setBulkProgress({ current: 0, total: targetVisitors.length, currentName: '' })

    let successCount = 0
    let failCount = 0

    for (let i = 0; i < targetVisitors.length; i++) {
      // التحقق من الإيقاف
      if (bulkSendAbortedRef.current) {
        toast.warning(
          locale === 'ar'
            ? `تم إيقاف الإرسال. تم الإرسال لـ ${successCount} من ${targetVisitors.length}`
            : `Sending stopped. Sent to ${successCount} of ${targetVisitors.length}`
        )
        break
      }

      const visitor = targetVisitors[i]
      setBulkProgress({ current: i + 1, total: targetVisitors.length, currentName: visitor.name })

      try {
        // تحضير الرسالة
        const message = template.message
          .replace(/\{name\}/g, visitor.name)
          .replace(/\{salesName\}/g, user?.name || t('followups.bulkScript.defaultSalesName'))
          .replace(/\{phone\}/g, visitor.phone)
          .replace(/\{date\}/g, new Date().toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US'))
          .replace(/\{time\}/g, new Date().toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }))

        // إرسال الرسالة عبر API
        const sendResponse = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: visitor.phone, message })
        })
        const result: { success: boolean; error?: string } = await sendResponse.json()

        if (result.success) {
          successCount++

          // تحديث حالة المتابعة إلى "تم التواصل"
          //  ما نخفيش لو الـ followup فشل — نـ flag الـ visitor عشان السيلز يعرف
          try {
            const fuRes = await fetch('/api/visitors/followups', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                visitorId: visitor.id,
                notes: `تم إرسال رسالة "${template.title}" عبر الواتساب (إرسال جماعي)`,
                contacted: true,
                salesName: user?.name,
                visitorData: {
                  name: visitor.name,
                  phone: visitor.phone,
                  source: visitor.source
                }
              }),
            })
            if (!fuRes.ok) {
              const errData = await fuRes.json().catch(() => ({}))
              console.error(`Followup save failed for ${visitor.name}:`, errData)
              failCount++
              successCount--
            }
          } catch (error) {
            console.error('Error updating follow-up:', error)
            failCount++
            successCount--
          }
        } else {
          failCount++
          console.error(`Failed to send to ${visitor.name}:`, result.error)
        }

        // الانتظار 15 ثانية قبل الرسالة التالية (إلا إذا كانت آخر رسالة)
        if (i < targetVisitors.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 15000))
        }
      } catch (error) {
        failCount++
        console.error(`Error sending to ${visitor.name}:`, error)
      }
    }

    // انتهى الإرسال
    setBulkSending(false)
    await queryClient.invalidateQueries({ queryKey: ['followups'] })
    await queryClient.invalidateQueries({ queryKey: ['visitors-followups'] })

    if (successCount > 0) {
      toast.success(
        locale === 'ar'
          ? `تم إرسال ${successCount} رسالة بنجاح${failCount > 0 ? ` (فشل ${failCount})` : ''}`
          : `Successfully sent ${successCount} messages${failCount > 0 ? ` (${failCount} failed)` : ''}`
      )
    } else {
      toast.error(locale === 'ar' ? 'فشل الإرسال لجميع الأرقام' : 'Failed to send to all numbers')
    }
  }, [filteredFollowUps, user, toast, queryClient, locale, t])

  //  Smart Bulk Script - helpers اتنقلوا لـ lib/bulkSender/storage.ts (getDailyCount / getLastSession / presets)

  //  Smart Bulk Script - Get filtered targets
  const getBulkScriptTargets = useCallback(() => {
    let targets = filteredFollowUps.map(fu => ({
      visitor: fu.visitor,
      contacted: fu.contacted,
      lastContactedAt: fu.lastContactedAt || fu.createdAt
    }))

    // Apply contact filter
    if (bulkScriptContactFilter === 'contacted') {
      targets = targets.filter(t => t.contacted)
    } else if (bulkScriptContactFilter === 'not-contacted') {
      targets = targets.filter(t => !t.contacted)
    }

    // Apply skip days filter (for contacted & all)
    if (bulkScriptContactFilter !== 'not-contacted' && bulkScriptSkipDays > 0) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - bulkScriptSkipDays)
      targets = targets.filter(t => {
        if (!t.contacted) return true
        const lastContact = new Date(t.lastContactedAt)
        return lastContact < cutoff
      })
    }

    return targets
  }, [filteredFollowUps, bulkScriptContactFilter, bulkScriptSkipDays])

  //  Fetch available WhatsApp sessions when modal opens
  const fetchWaSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/status')
      if (res.ok) {
        const data = await res.json()
        if (data.sessions) {
          setAvailableWaSessions(data.sessions)
        }
      }
    } catch {}
  }, [])

  //  Smart Bulk Script - Test message
  const handleBulkScriptTest = useCallback(async () => {
    if (!bulkScriptTestPhone.trim() || bulkScriptMessages.every(m => !m.trim())) {
      toast.error(t('followups.bulkScript.toast.enterTestPhone'))
      return
    }
    try {
      const msg = bulkScriptMessages.find(m => m.trim()) || ''
      const message = msg
        .replace(/\{name\}/g, t('followups.bulkScript.testName'))
        .replace(/\{salesName\}/g, user?.name || t('followups.bulkScript.defaultSalesName'))
        .replace(/\{phone\}/g, bulkScriptTestPhone)
        .replace(/\{date\}/g, new Date().toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US'))
        .replace(/\{time\}/g, new Date().toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }))

      const sendBody: any = { phone: bulkScriptTestPhone, message }
      if (bulkScriptSessionIndex !== 'auto') sendBody.sessionIndex = bulkScriptSessionIndex
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sendBody)
      })
      const result = await res.json()
      if (result.success) toast.success(result.sessionUsed !== undefined ? t('followups.bulkScript.toast.testSuccessSession').replace('{n}', String(result.sessionUsed + 1)) : t('followups.bulkScript.toast.testSuccess'))
      else toast.error(`${t('followups.bulkScript.toast.testFail')} ${result.error || t('followups.bulkScript.unknownError')}`)
    } catch {
      toast.error(t('followups.bulkScript.toast.connectionFail'))
    }
  }, [bulkScriptTestPhone, bulkScriptMessages, user, toast, bulkScriptSessionIndex, t])

  //  Smart Bulk Script - Start — بيحسب المستهدفين والإعدادات وبيسلّمهم لـ BulkSenderContext
  //  التشغيل نفسه (الحلقة + الكرة + المودالات) بقى عام على مستوى التطبيق فيفضل شغّال بعد الخروج من الصفحة
  const startBulk = useCallback(async () => {
    const validMessages = bulkScriptMessages.filter(m => m.trim())
    if (validMessages.length === 0) {
      toast.error(t('followups.bulkScript.toast.writeMessage'))
      return
    }
    const targets = getBulkScriptTargets().map(tg => ({ visitor: tg.visitor }))
    //  ⏰ لو المستخدم حدّد ريمايندر، نحسب التاريخ مرة واحدة (النهاردة + عدد الأيام)
    const reminderDate = bulkScriptReminderDays > 0
      ? new Date(Date.now() + bulkScriptReminderDays * 86400000).toISOString().slice(0, 10)
      : undefined
    const ok = await bulkSender.start({
      targets,
      messages: validMessages,
      config: {
        delayMin: bulkScriptDelayMin,
        delayMax: bulkScriptDelayMax,
        batchSize: bulkScriptBatchSize,
        batchBreakMin: bulkScriptBatchBreakMin,
        batchBreakMax: bulkScriptBatchBreakMax,
        dailyLimit: bulkScriptDailyLimit,
        sessionIndex: bulkScriptSessionIndex,
      },
      meta: { userName: user?.name, sourceFilter, reminderDate },
    })
    if (ok) setShowBulkScriptModal(false)
  }, [bulkScriptMessages, getBulkScriptTargets, bulkScriptDelayMin, bulkScriptDelayMax, bulkScriptBatchSize, bulkScriptBatchBreakMin, bulkScriptBatchBreakMax, bulkScriptDailyLimit, bulkScriptSessionIndex, bulkScriptReminderDays, user, sourceFilter, bulkSender, toast, t])

  const getResultBadge = useCallback((result?: string) => {
    const badges = {
      interested: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'not-interested': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'no-answer': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
      postponed: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      subscribed: 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200',
    }
    const labels: Record<string, string> = {
      interested: t('followups.results.interested'),
      'not-interested': t('followups.results.notInterested'),
      'no-answer': locale === 'ar' ? 'لم يرد' : 'No answer',
      postponed: t('followups.results.postponed'),
      subscribed: t('followups.results.subscribed'),
    }
    if (!result) return <span className="text-gray-400 dark:text-gray-500">-</span>
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[result as keyof typeof badges] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100'}`}>
        {labels[result] || result}
      </span>
    )
  }, [t])

  const getSourceLabel = useCallback((source: string) => {
    const labels: Record<string, string> = {
      'walk-in': t('followups.sources.walkIn'),
      'call-in': t('followups.sources.callIn'),
      'invitation': t('followups.sources.invitation'),
      'member-invitation': t('followups.sources.memberInvitation'),
      'expired-member': t('followups.sources.expiredMember'),
      'expiring-member': t('followups.sources.expiringMember'),
      'facebook': t('followups.sources.facebook'),
      'instagram': t('followups.sources.instagram'),
      'friend': t('followups.sources.friend'),
      'other': t('followups.sources.other'),
      'website': locale === 'ar' ? 'موقع الويب' : 'Website',
    }
    return labels[source] || source
  }, [t, locale])

  const getPriorityBadge = useCallback((followUp: FollowUp) => {
    const priority = getFollowUpPriority(followUp)

    if (priority === 'overdue') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
          <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.24 17 7.092 18.246 9.61 18 11 18 12c0 1.105.395 2.16 1.103 2.93.711.769 1.066 1.756.554 2.727z"/></svg>
          {t('followups.priority.overdue')}
        </span>
      )
    }
    if (priority === 'today') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
          <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          {t('followups.priority.today')}
        </span>
      )
    }
    if (priority === 'upcoming') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
          <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          {t('followups.priority.upcoming')}
        </span>
      )
    }
    return null
  }, [getFollowUpPriority, t])

  //  counters للـ quick filter buttons — تتحدّث ديناميكياً مع باقي الفلاتر
  //    (source, priority, search, result, assignedStaff) — لكن مش بتفلتر بـ contacted نفسه
  //    عشان لما المستخدم يختار "اعضاء منتهين" يشوف عددهم في "تم التواصل" / "لم يتم التواصل"
  const quickFilterCounts = useMemo(() => {
    let myFollowUps = 0
    let todayCount = 0
    let notContacted = 0
    let contacted = 0
    //  مسؤول السيلز بيشوف الكل، مش بس بتاعه
    const isSales = !!user?.isSales && !canManageSales

    // فلتر مرة على كل المتابعات لتطبيق الفلاتر الأخرى (ما عدا contacted)
    const searchNormalized = normalizeArabic(debouncedSearchTerm)

    for (const fu of allFollowUps) {
      const mine = isMyFollowUp(fu)
      if (mine) myFollowUps++

      const visibleForUser = !isSales || mine
      if (!visibleForUser) continue

      //  search
      if (debouncedSearchTerm) {
        const ok =
          normalizeArabic(fu.visitor.name).includes(searchNormalized) ||
          fu.visitor.phone.includes(debouncedSearchTerm) ||
          normalizeArabic(fu.notes).includes(searchNormalized) ||
          (fu.salesName && normalizeArabic(fu.salesName).includes(searchNormalized))
        if (!ok) continue
      }

      //  result
      if (resultFilter !== 'all' && fu.result !== resultFilter) continue

      //  priority
      const priority = getFollowUpPriority(fu)
      if (priorityFilter !== 'all' && priority !== priorityFilter) continue

      //  sales filter
      if (salesFilter === 'my-followups' && !isMyFollowUp(fu)) continue
      if (salesFilter === 'my-overdue' && (!isMyFollowUp(fu) || priority !== 'overdue')) continue
      if (salesFilter === 'today' && priority !== 'today') continue

      //  assigned staff
      if (assignedStaffFilter !== 'all') {
        if (assignedStaffFilter === '__unassigned__') {
          if (fu.assignedTo) continue
        } else if (fu.assignedTo !== assignedStaffFilter) {
          continue
        }
      }

      //  source
      if (sourceFilter !== 'all') {
        const src = fu.visitor.source
        if (sourceFilter === 'expired-member' && src !== 'expired-member') continue
        else if (sourceFilter === 'expiring-member' && src !== 'expiring-member') continue
        else if (sourceFilter === 'member-invitation' && src !== 'member-invitation') continue
        else if (sourceFilter === 'dayuse' && src !== 'invitation') continue
        else if (sourceFilter === 'website' && src !== 'website') continue
        else if (sourceFilter === 'visitors' && ['expired-member', 'expiring-member', 'member-invitation', 'invitation', 'website'].includes(src)) continue
      }

      //  date range
      if (dateFromFilter || dateToFilter) {
        const created = new Date(fu.createdAt).getTime()
        if (dateFromFilter) {
          const [y, m, d] = dateFromFilter.split('-').map(Number)
          if (created < new Date(y, m - 1, d, 0, 0, 0, 0).getTime()) continue
        }
        if (dateToFilter) {
          const [y, m, d] = dateToFilter.split('-').map(Number)
          if (created > new Date(y, m - 1, d, 23, 59, 59, 999).getTime()) continue
        }
      }

      if (priority === 'today') todayCount++
      if (fu.contacted) contacted++
      else notContacted++
    }
    return { myFollowUps, todayCount, notContacted, contacted }
  }, [allFollowUps, isMyFollowUp, getFollowUpPriority, user?.isSales, canManageSales, debouncedSearchTerm, resultFilter, priorityFilter, salesFilter, assignedStaffFilter, sourceFilter, dateFromFilter, dateToFilter])

  //  قائمة مفلترة بكل الفلاتر **ما عدا** فلتر المصدر (Source) وفلتر «تم التواصل»
  //  — تُستخدم لحساب أرقام أزرار المصدر. بنتجاهل contacted هنا عشان عدّاد «أعضاء منتهين»
  //  يفضل شامل (متواصل + غير متواصل) فيبقى «منتهي بدون متابعة» دايمًا جزء منه مش أكبر منه.
  const followUpsFilteredExceptSource = useMemo(() => {
    return allFollowUps.filter(fu => {
      const searchNormalized = normalizeArabic(debouncedSearchTerm)
      const matchesSearch =
        normalizeArabic(fu.visitor.name).includes(searchNormalized) ||
        fu.visitor.phone.includes(debouncedSearchTerm) ||
        normalizeArabic(fu.notes).includes(searchNormalized) ||
        (fu.salesName && normalizeArabic(fu.salesName).includes(searchNormalized))

      const matchesResult = resultFilter === 'all' || fu.result === resultFilter
      //  ملاحظة: فلتر «تم التواصل» مش بيتطبّق هنا عن قصد (شوف الكومنت فوق)
      const matchesContacted = true ||
        (contactedFilter === 'contacted' && fu.contacted) ||
        (contactedFilter === 'not-contacted' && !fu.contacted)

      const priority = getFollowUpPriority(fu)
      const matchesPriority = priorityFilter === 'all' || priority === priorityFilter

      let matchesSales = true
      if (salesFilter === 'my-followups') {
        matchesSales = isMyFollowUp(fu)
      } else if (salesFilter === 'my-overdue') {
        matchesSales = isMyFollowUp(fu) && priority === 'overdue'
      } else if (salesFilter === 'today') {
        matchesSales = priority === 'today'
      }

      const matchesAssignedStaff = assignedStaffFilter === 'all'
        || (assignedStaffFilter === '__unassigned__' ? !fu.assignedTo : fu.assignedTo === assignedStaffFilter)

      let matchesDateRange = true
      if (dateFromFilter || dateToFilter) {
        const created = new Date(fu.createdAt).getTime()
        if (dateFromFilter) {
          const [y, m, d] = dateFromFilter.split('-').map(Number)
          if (created < new Date(y, m - 1, d, 0, 0, 0, 0).getTime()) matchesDateRange = false
        }
        if (matchesDateRange && dateToFilter) {
          const [y, m, d] = dateToFilter.split('-').map(Number)
          if (created > new Date(y, m - 1, d, 23, 59, 59, 999).getTime()) matchesDateRange = false
        }
      }

      return matchesSearch && matchesResult && matchesContacted && matchesPriority && matchesSales && matchesAssignedStaff && matchesDateRange
    })
  }, [allFollowUps, debouncedSearchTerm, resultFilter, contactedFilter, priorityFilter, salesFilter, assignedStaffFilter, dateFromFilter, dateToFilter, getFollowUpPriority, isMyFollowUp])

  // Stats - memoized لتجنب إعادة الحساب في كل render
  // الأرقام تتحدّث ديناميكياً مع باقي الفلاتر
  const stats = useMemo(() => {
    const todayStr = new Date().toDateString()
    const base = followUpsFilteredExceptSource
    //  total/today/overdue تحترم فلتر «تم التواصل»؛ أما عدّادات المصدر تحته فبتتجاهله
    const passesContacted = (fu: any) => contactedFilter === 'all' ||
      (contactedFilter === 'contacted' && fu.contacted) ||
      (contactedFilter === 'not-contacted' && !fu.contacted)
    const withContacted = base.filter(passesContacted)
    return {
      total: withContacted.length,
      today: withContacted.filter(fu => getFollowUpPriority(fu) === 'today').length,
      overdue: withContacted.filter(fu => getFollowUpPriority(fu) === 'overdue').length,
      contactedToday: followUps.filter(fu =>
        fu.contacted && new Date(fu.updatedAt || fu.createdAt).toDateString() === todayStr
      ).length,
      //  عدّادات المصدر بتتجاهل فلتر contacted عشان «بدون متابعة» يفضل جزء من «أعضاء منتهين»
      expiredMembers: base.filter(fu => fu.visitor.source === 'expired-member').length,
      expiringMembers: base.filter(fu => fu.visitor.source === 'expiring-member').length,
      dayUse: base.filter(fu => fu.visitor.source === 'invitation').length,
      invitations: base.filter(fu => fu.visitor.source === 'member-invitation').length,
      website: base.filter(fu => fu.visitor.source === 'website').length,
      visitors: base.filter(fu => !['expired-member', 'expiring-member', 'member-invitation', 'invitation', 'website'].includes(fu.visitor.source)).length,
      convertedToMembers: followUps.filter(fu => isVisitorAMember(fu.visitor.phone)).length,
    }
  }, [followUpsFilteredExceptSource, followUps, isVisitorAMember, getFollowUpPriority, contactedFilter])

  //  أعضاء عيد ميلادهم اليوم — للنشطين فقط
  const birthdayMembers = useMemo(() => {
    const today = new Date()
    const todayDay = today.getDate()
    const todayMonth = today.getMonth() + 1
    return (allMembersData as Member[])
      .filter(m => {
        if (m.isActive !== true) return false
        if (!m.birthDate) return false
        const bd = new Date(m.birthDate)
        return bd.getDate() === todayDay && (bd.getMonth() + 1) === todayMonth
      })
      .map(m => {
        const birthYear = new Date(m.birthDate!).getFullYear()
        const age = today.getFullYear() - birthYear
        return { ...m, age }
      })
  }, [allMembersData])

  //  قائمة المتحولين لأعضاء - مبسط ومحسّن: أي شخص رقمه موجود في الأعضاء النشطين
  // يشمل: زوار، دعوات، أعضاء منتهيين، أعضاء قريبين من الانتهاء - كلهم بنفس المنطق
  //  dedupe بالـ normalized phone عشان منكررش نفس الشخص
  const convertedMembers = useMemo(() => {
    const seen = new Set<string>()
    const out: typeof allFollowUps = []
    for (const fu of allFollowUps) {
      if (!isVisitorAMember(fu.visitor.phone)) continue
      const key = normalizePhone(fu.visitor.phone)
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(fu)
    }
    return out
  }, [allFollowUps, isVisitorAMember, normalizePhone])

  //  إحصائيات فردية لكل سيلز
  // محسّن: pass واحد على allFollowUps بدلاً من filter لكل سيلز
  // كل الإحصائيات بتعتمد على نفس المصدر (allFollowUps) للاتساق
  const salesStats = useMemo(() => {
    const todayStr = new Date().toDateString()
    type SalesEntry = {
      name: string
      totalFollowUps: number
      conversions: number
      conversionRate: number
      overdueCount: number
      todayCount: number
      contactedToday: number
    }
    const statsMap = new Map<string, SalesEntry>()

    allFollowUps.forEach(fu => {
      if (!fu.salesName) return
      let entry = statsMap.get(fu.salesName)
      if (!entry) {
        entry = {
          name: fu.salesName,
          totalFollowUps: 0,
          conversions: 0,
          conversionRate: 0,
          overdueCount: 0,
          todayCount: 0,
          contactedToday: 0,
        }
        statsMap.set(fu.salesName, entry)
      }

      entry.totalFollowUps++
      if (isVisitorAMember(fu.visitor.phone)) entry.conversions++

      const priority = getFollowUpPriority(fu)
      if (priority === 'overdue') entry.overdueCount++
      else if (priority === 'today') entry.todayCount++

      if (fu.contacted && new Date(fu.updatedAt || fu.createdAt).toDateString() === todayStr) {
        entry.contactedToday++
      }
    })

    // حساب نسبة التحويل النهائية
    statsMap.forEach(entry => {
      entry.conversionRate = entry.totalFollowUps > 0
        ? (entry.conversions / entry.totalFollowUps) * 100
        : 0
    })

    // ترتيب حسب نسبة التحويل (الأعلى أولاً)
    return Array.from(statsMap.values()).sort((a, b) => b.conversionRate - a.conversionRate)
  }, [allFollowUps, isVisitorAMember, getFollowUpPriority])

  // التحقق من الصلاحيات
  if (permissionsLoading) {
    return (
      <LoadingScreen fullScreen message={t('followups.loading')} />
    )
  }

  if (!hasPermission('canViewFollowUps')) {
    return <PermissionDenied message={t('followups.permissionDenied')} />
  }

  return (
    <div className="container mx-auto px-4 py-6 md:px-6" dir={direction}>
      {/* Streaming progress — يظهر بس وقت تحميل دفعات الـ background للمتابعات */}
      {(followUpsFetchingNext || followUpsHasNext) && totalFollowUpsCount > followUps.length && (
        <div className="bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 p-3 rounded-xl mb-4 flex items-center gap-3" dir={direction} aria-busy="true" aria-live="polite">
          <svg className="animate-spin h-4 w-4 text-blue-500 shrink-0" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06"/></svg>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-blue-800 dark:text-blue-300">
              {locale === 'ar'
                ? `جارٍ تحميل باقي المتابعات في الخلفية... ${followUps.length} / ${totalFollowUpsCount}`
                : `Loading remaining follow-ups in background... ${followUps.length} / ${totalFollowUpsCount}`}
            </div>
            <div className="mt-1 h-1.5 w-full bg-blue-100 dark:bg-blue-900/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 dark:bg-blue-400 transition-[width] duration-300"
                style={{ width: `${Math.min(100, Math.round((followUps.length / Math.max(1, totalFollowUpsCount)) * 100))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <svg className="w-7 h-7 text-primary-500" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
              <span>{t('followups.title')}</span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('followups.subtitle')}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {stats.expiringMembers > 0 && (
              <button
                onClick={() => setShowExpiringPopup(true)}
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors duration-200"
              >
                <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {locale === 'ar' ? `قرب ينتهي (${stats.expiringMembers})` : `Expiring (${stats.expiringMembers})`}
              </button>
            )}
          </div>
        </div>

        {/* Expiring Days Popup */}
        {showExpiringPopup && (
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
            onClick={() => setShowExpiringPopup(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="expiring-popup-title"
          >
            <div
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm ring-1 ring-amber-200 dark:ring-amber-900/50 animate-modal-in"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setShowExpiringPopup(false)}
                aria-label={direction === 'rtl' ? 'إغلاق' : 'Close'}
                className="absolute top-3 end-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors duration-200"
              >
                <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
              <h3 id="expiring-popup-title" className="font-bold text-lg text-amber-800 dark:text-amber-200 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {locale === 'ar' ? 'عرض الأعضاء اللي اشتراكهم هينتهي خلال:' : 'Show members expiring within:'}
              </h3>
              <div className="flex items-center gap-3 mb-5">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={expiringDays}
                  onChange={(e) => {
                    const raw = Number(e.target.value)
                    if (!Number.isFinite(raw)) return
                    const v = Math.max(1, Math.min(365, Math.floor(raw)))
                    setExpiringDays(v)
                    localStorage.setItem('followups_expiringDays', String(v))
                  }}
                  className="px-4 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-amber-500 w-24 transition-colors duration-200"
                />
                <span className="font-bold text-amber-900 dark:text-amber-100">{t('followups.days')}</span>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4 text-center ring-1 ring-amber-200 dark:ring-amber-900/50">
                <p className="text-xs text-amber-700 dark:text-amber-300 mb-1 font-bold uppercase tracking-wider">{t('followups.stats.membersCount')}</p>
                <p className="text-5xl font-bold text-amber-900 dark:text-amber-100">{stats.expiringMembers}</p>
              </div>
            </div>
          </div>
        )}

        {/* View Mode Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setViewMode('list')}
            aria-current={viewMode === 'list' ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold transition-colors duration-200 ${
              viewMode === 'list'
                ? 'bg-primary-500 text-primary-contrast'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
            {t('followups.viewModes.list')}
          </button>
          {hasPermission('canViewVisitors') && (
          <button
            onClick={() => setViewMode('visitors')}
            aria-current={viewMode === 'visitors' ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold transition-colors duration-200 ${
              viewMode === 'visitors'
                ? 'bg-primary-500 text-primary-contrast'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-2.83-4"/></svg>
            {t('nav.visitors')}
          </button>
          )}
          {!user?.isSales && (
          <button
            onClick={() => setViewMode('analytics')}
            aria-current={viewMode === 'analytics' ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold transition-colors duration-200 ${
              viewMode === 'analytics'
                ? 'bg-primary-500 text-primary-contrast'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6m0 13l-3-3m3 3l3-3m6 3V10m0 9l3-3m-3 3l-3-3"/></svg>
            {t('followups.viewModes.analytics')}
          </button>
          )}
          <button
            onClick={() => setViewMode('collection')}
            aria-current={viewMode === 'collection' ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold transition-colors duration-200 ${
              viewMode === 'collection'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            {locale === 'ar'
              ? ((user?.isSales && !canManageSales) ? 'عمولتي' : 'التحصيل')
              : ((user?.isSales && !canManageSales) ? 'My Commission' : 'Collection')}
          </button>

          <button
            onClick={() => setViewMode('calendar')}
            aria-current={viewMode === 'calendar' ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold transition-colors duration-200 ${
              viewMode === 'calendar'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            {locale === 'ar' ? 'الكاليندر' : 'Calendar'}
          </button>

          {/* إدارة السيلز — للأدمن والأونر أو من له صلاحية إدارة الموظفين */}
          {canManageSales && (
            <button
              onClick={() => setViewMode('sales-mgmt')}
              aria-current={viewMode === 'sales-mgmt' ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold transition-colors duration-200 ${
                viewMode === 'sales-mgmt'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              {locale === 'ar' ? 'إدارة السيلز' : 'Sales Mgmt'}
            </button>
          )}
        </div>

        {/* أعضاء عيد ميلادهم اليوم */}
        {birthdayMembers.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-pink-200 dark:ring-pink-900/50 p-3 sm:p-4 mb-4">
            <h3 className="font-bold text-pink-900 dark:text-pink-100 mb-3 flex items-center gap-2 text-sm sm:text-base">
              <svg className="w-5 h-5 text-pink-500" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-9m0 0l3 3m-3-3l-3 3m3-12c2 2 5 0 5 3a5 5 0 11-10 0c0-3 3-1 5-3z"/></svg>
              <span>{direction === 'rtl' ? 'أعياد ميلاد اليوم' : "Today's Birthdays"}</span>
              <span className="inline-flex items-center bg-pink-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">{birthdayMembers.length}</span>
            </h3>
            <div className="flex flex-wrap gap-3">
              {birthdayMembers.map(m => (
                <a
                  key={m.id}
                  href={createWhatsAppUrl(m.phone, direction === 'rtl' ? `كل سنة وانت طيب ${m.name}!` : `Happy Birthday ${m.name}!`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white dark:bg-gray-800 ring-1 ring-pink-200 dark:ring-pink-900/50 rounded-xl px-3 py-2 hover:shadow-md transition-shadow duration-200"
                >
                  <div className="w-9 h-9 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {m.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">{m.name}</p>
                    <p className="text-xs text-pink-600 dark:text-pink-400 font-bold">
                      {direction === 'rtl' ? `${m.age} سنة` : `${m.age} years old`}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-green-500 ms-1" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3 20l1.5-4.5A8 8 0 1112 20H7l-4 0z"/></svg>
                </a>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Add Follow-Up Form - Modal Popup (Lightweight) */}
      {showForm && (
        <FollowUpForm
          visitors={visitors}
          expiredMembers={expiredMembers}
          expiringMembers={expiringMembers}
          dayUseRecords={dayUseRecords}
          invitations={sortedInvitations}
          initialVisitorId={selectedVisitorId}
          initialDate={calendarInitialDate}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false)
            setSelectedVisitorId('')
            setCalendarInitialDate('')
          }}
        />
      )}

      {/* WhatsApp Template Modal */}
      {showTemplateModal && (
        <MessageTemplateManager
          onClose={() => setShowTemplateModal(false)}
          onSelect={selectedVisitorForTemplate ? sendWhatsAppTemplate : handleBulkSend}
          visitorName={selectedVisitorForTemplate?.name || 'الأعضاء المنتهيين'}
          salesName={user?.name}
          visitorPhone={selectedVisitorForTemplate?.phone || ''}
        />
      )}

      {/* Bulk Send Progress Modal */}
      {bulkSending && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-send-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 mx-auto mb-4 flex items-center justify-center animate-pulse">
                <svg className="w-8 h-8" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
              </div>
              <h2 id="bulk-send-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {t('followups.bulkScript.bulkSending')}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {bulkProgress.current} / {bulkProgress.total}
              </p>
              {bulkProgress.currentName && (
                <p className="text-sm text-primary-600 dark:text-primary-400 mt-2 inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.49a1 1 0 01-.5 1.21l-2.25 1.13a11.04 11.04 0 005.52 5.52l1.13-2.25a1 1 0 011.21-.5l4.49 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z"/></svg>
                  {t('followups.bulkScript.sendingToLabel')} <span className="font-bold">{bulkProgress.currentName}</span>
                </p>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-[width] duration-500 ease-out flex items-center justify-center text-xs font-bold text-white"
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                >
                  {Math.round((bulkProgress.current / bulkProgress.total) * 100)}%
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800 dark:text-blue-300 text-center inline-flex items-center gap-1.5 justify-center w-full">
                <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {t('followups.bulkScript.waitBetween')}
              </p>
            </div>

            {/* Abort Button */}
            <button
              onClick={() => {
                bulkSendAbortedRef.current = true
              }}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition-colors duration-200 inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
            >
              <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              {t('followups.bulkScript.stopSending')}
            </button>
          </div>
        </div>
      )}

      {/* Smart Bulk Script - Setup Modal */}
      {showBulkScriptModal && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
          onClick={() => setShowBulkScriptModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-script-setup-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-5 rounded-t-2xl">
              <h2 id="bulk-script-setup-title" className="text-xl font-bold flex items-center gap-2">
                <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                {t('followups.bulkScript.title')}
              </h2>
              <p className="text-sm opacity-90 mt-1">{t('followups.bulkScript.subtitle')}</p>
            </div>

            <div className="p-5 space-y-5">
              {/* Last Session Banner */}
              {(() => {
                const lastSession = getLastSession()
                const dailySent = getDailyCount()
                if (!lastSession && dailySent === 0) return null
                return (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 rounded-lg p-3 space-y-1">
                    {lastSession && (
                      <p className="text-sm text-blue-800 dark:text-blue-300 inline-flex items-center gap-1.5 flex-wrap">
                        <svg className="w-4 h-4 shrink-0" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                        <span>{t('followups.bulkScript.lastSend')} <span className="font-bold">{(() => {
                          const d = new Date(lastSession.date)
                          return isNaN(d.getTime())
                            ? lastSession.date
                            : d.toLocaleString(direction === 'rtl' ? 'ar-EG' : 'en-US')
                        })()}</span> — {t('followups.bulkScript.sentCount')} <span className="font-bold">{lastSession.sent}</span> {t('followups.bulkScript.message')}</span>
                      </p>
                    )}
                    <p className="text-sm text-blue-800 dark:text-blue-300 inline-flex items-center gap-1.5 flex-wrap">
                      <svg className="w-4 h-4 shrink-0" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6m0 13l-3-3m3 3l3-3m6 3V10m0 9l3-3m-3 3l-3-3"/></svg>
                      <span>{t('followups.bulkScript.sentToday')} <span className="font-bold">{dailySent}</span> / <span className="font-bold">{bulkScriptDailyLimit}</span> — {t('followups.bulkScript.remaining')} <span className="font-bold text-green-600 dark:text-green-400">{Math.max(0, bulkScriptDailyLimit - dailySent)}</span> {t('followups.bulkScript.message')}</span>
                    </p>
                  </div>
                )
              })()}

              {/* WhatsApp Session Picker */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                  {t('followups.bulkScript.sendFrom')}
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setBulkScriptSessionIndex('auto')}
                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors duration-200 ring-1 inline-flex items-center gap-1.5 ${
                      bulkScriptSessionIndex === 'auto'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 ring-purple-400 dark:ring-purple-700'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-600'
                    }`}
                  >
                    <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    {t('followups.bulkScript.auto')}
                  </button>
                  {availableWaSessions.map((sess) => (
                    <button
                      key={sess.sessionIndex}
                      onClick={() => setBulkScriptSessionIndex(sess.sessionIndex)}
                      disabled={!sess.isReady}
                      className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors duration-200 ring-1 inline-flex items-center gap-1.5 ${
                        bulkScriptSessionIndex === sess.sessionIndex
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 ring-green-400 dark:ring-green-700'
                          : sess.isReady
                            ? 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-600 hover:ring-green-300'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 ring-gray-200 dark:ring-gray-700 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {sess.isReady ? (
                        <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                      ) : (
                        <svg className="w-4 h-4" {...stroke}><circle cx="12" cy="12" r="9"/></svg>
                      )}
                      {t('followups.bulkScript.numberLabel')} {sess.sessionIndex + 1}
                      {sess.phoneNumber && <span className="text-xs font-mono ms-1" dir="ltr">{sess.phoneNumber}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* B. Contact Filter */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('followups.bulkScript.contactFilter')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'not-contacted' as const, label: t('followups.bulkScript.notContacted'), iconPath: 'M12 6v6m0 0v6m0-6h6m-6 0H6' },
                    { value: 'contacted' as const, label: t('followups.bulkScript.contacted'), iconPath: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.49a1 1 0 01-.5 1.21l-2.25 1.13a11.04 11.04 0 005.52 5.52l1.13-2.25a1 1 0 011.21-.5l4.49 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z' },
                    { value: 'all' as const, label: t('followups.bulkScript.everyone'), iconPath: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a4 4 0 11-8 0 4 4 0 018 0z' },
                  ] as const).map(opt => {
                    const count = opt.value === 'all' ? filteredFollowUps.length
                      : opt.value === 'contacted' ? filteredFollowUps.filter(f => f.contacted).length
                      : filteredFollowUps.filter(f => !f.contacted).length
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setBulkScriptContactFilter(opt.value)}
                        className={`p-3 rounded-lg text-center transition-colors duration-200 text-sm font-medium ring-1 ${
                          bulkScriptContactFilter === opt.value
                            ? 'ring-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                            : 'ring-gray-200 dark:ring-gray-600 hover:ring-purple-300 text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        <div className="flex justify-center">
                          <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d={opt.iconPath}/></svg>
                        </div>
                        <div className="mt-1">{opt.label}</div>
                        <div className="text-xs font-bold text-purple-600 dark:text-purple-400 mt-1">{count}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* C. Skip Days */}
              {bulkScriptContactFilter !== 'not-contacted' && (
                <div className="bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-lg p-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                    <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
                    {t('followups.bulkScript.skipRecentLabel')}
                    <input
                      type="number"
                      min={0}
                      value={bulkScriptSkipDays}
                      onChange={e => setBulkScriptSkipDays(parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-700 text-center font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors duration-200"
                    />
                    {t('followups.bulkScript.day')}
                  </label>
                </div>
              )}

              {/* C2. ⏰ ريمايندر — أرجع أكلمهم تاني بعد كام يوم */}
              <div className="bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 rounded-lg p-3">
                <label className="flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-300 flex-wrap">
                  <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  {locale === 'ar' ? 'ذكّرني أرجع أكلمهم تاني بعد' : 'Remind me to follow up again after'}
                  <input
                    type="number"
                    min={0}
                    value={bulkScriptReminderDays}
                    onChange={e => setBulkScriptReminderDays(parseInt(e.target.value) || 0)}
                    className="w-16 px-2 py-1 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-700 text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
                  />
                  {locale === 'ar' ? 'يوم' : 'days'}
                </label>
                {bulkScriptReminderDays > 0 && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">
                    {locale === 'ar'
                      ? `هيظهروا في متابعاتك تاني يوم ${new Date(Date.now() + bulkScriptReminderDays * 86400000).toLocaleDateString('ar-EG')}`
                      : `They'll reappear in your follow-ups on ${new Date(Date.now() + bulkScriptReminderDays * 86400000).toLocaleDateString('en-US')}`}
                  </p>
                )}
              </div>

              {/* D. Messages */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('followups.bulkScript.messages')} ({bulkScriptMessages.length})</label>
                  {bulkScriptMessages.length < 10 && (
                    <button
                      onClick={() => setBulkScriptMessages([...bulkScriptMessages, ''])}
                      className="text-xs px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg font-bold hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors duration-200 inline-flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                      {t('followups.bulkScript.addMessage')}
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {bulkScriptMessages.map((msg, idx) => (
                    <div key={idx} className="relative">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{t('followups.bulkScript.messageLabel')} {idx + 1}</span>
                        {bulkScriptMessages.length > 1 && (
                          <button
                            onClick={() => setBulkScriptMessages(bulkScriptMessages.filter((_, i) => i !== idx))}
                            className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-bold inline-flex items-center gap-1 transition-colors duration-200"
                          >
                            <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                            {t('followups.bulkScript.deleteMessage')}
                          </button>
                        )}
                      </div>
                      <textarea
                        value={msg}
                        onChange={e => {
                          const updated = [...bulkScriptMessages]
                          updated[idx] = e.target.value
                          setBulkScriptMessages(updated)
                        }}
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors duration-200"
                        placeholder={t('followups.bulkScript.messagePlaceholder').replace('{n}', String(idx + 1))}
                        dir={direction}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 inline-flex items-start gap-1.5 flex-wrap">
                  <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                  <span>{t('followups.bulkScript.availableVariables')} <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{name}'}</code> <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{salesName}'}</code> <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{date}'}</code> <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{time}'}</code> <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{phone}'}</code></span>
                </p>
              </div>

              {/* E. Presets */}
              <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={bulkScriptPresetName}
                    onChange={e => setBulkScriptPresetName(e.target.value)}
                    placeholder={t('followups.bulkScript.presetNamePlaceholder')}
                    className="flex-1 min-w-[120px] px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
                  />
                  <button
                    onClick={() => {
                      if (!bulkScriptPresetName.trim()) { toast.error(t('followups.bulkScript.toast.presetNameRequired')); return }
                      saveBulkPreset(bulkScriptPresetName.trim(), bulkScriptMessages)
                      toast.success(t('followups.bulkScript.toast.presetSaved'))
                      setBulkScriptPresetName('')
                    }}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold inline-flex items-center gap-1 transition-colors duration-200"
                  >
                    <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
                    {t('followups.bulkScript.savePreset')}
                  </button>
                  {getBulkPresets().length > 0 && (
                    <select
                      onChange={e => {
                        const preset = getBulkPresets().find(p => p.name === e.target.value)
                        if (preset) {
                          setBulkScriptMessages([...preset.messages])
                          toast.success(t('followups.bulkScript.toast.presetLoaded').replace('{name}', preset.name))
                        }
                        e.target.value = ''
                      }}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
                      defaultValue=""
                    >
                      <option value="" disabled>{t('followups.bulkScript.loadPreset')}</option>
                      {getBulkPresets().map(p => (
                        <option key={p.name} value={p.name}>{p.name} ({p.messages.length} {t('followups.bulkScript.message')})</option>
                      ))}
                    </select>
                  )}
                  {getBulkPresets().length > 0 && (
                    <select
                      onChange={e => {
                        if (e.target.value) {
                          deleteBulkPreset(e.target.value)
                          toast.success(t('followups.bulkScript.toast.presetDeleted'))
                        }
                        e.target.value = ''
                      }}
                      className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-600 bg-white dark:bg-gray-700 text-sm text-red-600 dark:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors duration-200"
                      defaultValue=""
                    >
                      <option value="" disabled>{t('followups.bulkScript.deletePreset')}</option>
                      {getBulkPresets().map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* F. Delay */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  {t('followups.bulkScript.randomDelay')}
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('followups.bulkScript.from')}</span>
                  <input
                    type="number"
                    min={5}
                    value={bulkScriptDelayMin}
                    onChange={e => setBulkScriptDelayMin(Math.max(5, parseInt(e.target.value) || 5))}
                    className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('followups.bulkScript.to')}</span>
                  <input
                    type="number"
                    min={bulkScriptDelayMin}
                    value={bulkScriptDelayMax}
                    onChange={e => setBulkScriptDelayMax(Math.max(bulkScriptDelayMin, parseInt(e.target.value) || bulkScriptDelayMin))}
                    className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('followups.bulkScript.seconds')}</span>
                </div>
              </div>

              {/* F2. Batch Break */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h14a4 4 0 010 8h-1M3 10v8a2 2 0 002 2h11a2 2 0 002-2M3 10V6a2 2 0 012-2h11a2 2 0 012 2v4M7 14h.01M7 2h.01M11 2h.01"/></svg>
                  {t('followups.bulkScript.batchBreak')}
                </label>
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{t('followups.bulkScript.every')}</span>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={bulkScriptBatchSize}
                    onChange={e => setBulkScriptBatchSize(Math.max(5, parseInt(e.target.value) || 12))}
                    className="w-16 px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
                  />
                  <span className="text-gray-500 dark:text-gray-400">{t('followups.bulkScript.messagesBreak')}</span>
                  <input
                    type="number"
                    min={1}
                    value={Math.round(bulkScriptBatchBreakMin / 60)}
                    onChange={e => setBulkScriptBatchBreakMin(Math.max(60, (parseInt(e.target.value) || 2) * 60))}
                    className="w-14 px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
                  />
                  <span className="text-gray-500 dark:text-gray-400">{t('followups.bulkScript.to')}</span>
                  <input
                    type="number"
                    min={Math.round(bulkScriptBatchBreakMin / 60)}
                    value={Math.round(bulkScriptBatchBreakMax / 60)}
                    onChange={e => setBulkScriptBatchBreakMax(Math.max(bulkScriptBatchBreakMin, (parseInt(e.target.value) || 5) * 60))}
                    className="w-14 px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
                  />
                  <span className="text-gray-500 dark:text-gray-400">{t('followups.bulkScript.minutes')}</span>
                </div>
              </div>

              {/* F3. Daily Limit */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  {t('followups.bulkScript.dailyLimit')}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('followups.bulkScript.max')}</span>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={bulkScriptDailyLimit}
                    onChange={e => setBulkScriptDailyLimit(Math.max(10, parseInt(e.target.value) || 80))}
                    className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('followups.bulkScript.messagesPerDay')}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ms-2">({t('followups.bulkScript.sentToday')} {getDailyCount()})</span>
                </div>
              </div>

              {/* G. Test Message */}
              <div className="bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 rounded-lg p-3">
                <label className="block text-sm font-bold text-blue-800 dark:text-blue-300 mb-2 inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
                  {t('followups.bulkScript.testMessage')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={bulkScriptTestPhone}
                    onChange={e => setBulkScriptTestPhone(e.target.value)}
                    placeholder={t('followups.bulkScript.testPhonePlaceholder')}
                    className="flex-1 px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
                  />
                  <button
                    onClick={handleBulkScriptTest}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold whitespace-nowrap inline-flex items-center gap-1 transition-colors duration-200"
                  >
                    <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                    {t('followups.bulkScript.sendTest')}
                  </button>
                </div>
              </div>

              {/* H. Summary */}
              <div className="bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-300 dark:ring-purple-900/50 rounded-lg p-4">
                <p className="text-sm font-bold text-purple-800 dark:text-purple-300 text-center inline-flex items-center gap-1.5 justify-center w-full flex-wrap">
                  <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6m0 13l-3-3m3 3l3-3m6 3V10m0 9l3-3m-3 3l-3-3"/></svg>
                  <span>{t('followups.bulkScript.summaryWillSend')} <span className="text-lg">{getBulkScriptTargets().length}</span> {t('followups.bulkScript.summaryPeople')} <span className="text-lg">{bulkScriptMessages.filter(m => m.trim()).length}</span> {t('followups.bulkScript.summaryMessages')} <span className="text-lg">{bulkScriptDelayMin}-{bulkScriptDelayMax}</span> {t('followups.bulkScript.summarySeconds')}</span>
                </p>
              </div>

              {/* I. Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => startBulk()}
                  disabled={bulkSender.running || bulkScriptMessages.every(m => !m.trim()) || getBulkScriptTargets().length === 0}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 inline-flex items-center justify-center gap-2"
                  autoFocus
                >
                  <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
                  {t('followups.bulkScript.startSending')}
                </button>
                <button
                  onClick={() => setShowBulkScriptModal(false)}
                  className="px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-bold transition-colors duration-200"
                >
                  {t('followups.bulkScript.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* History Modal - سجل المتابعات (Lightweight) */}
      {showHistoryModal && selectedVisitorForHistory && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
          onClick={() => setShowHistoryModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-modal-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-primary-600 text-primary-contrast p-4 rounded-t-2xl flex justify-between items-center">
              <div>
                <h2 id="history-modal-title" className="text-lg font-bold flex items-center gap-2">
                  <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9h6m-6 4h6"/></svg>
                  <span>{t('followups.history.title')}</span>
                </h2>
                <p className="text-xs opacity-90 mt-0.5">
                  {selectedVisitorForHistory.name} - {selectedVisitorForHistory.phone}
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                aria-label={direction === 'rtl' ? 'إغلاق' : 'Close'}
                className="text-gray-900 hover:bg-black/10 rounded-full w-8 h-8 flex items-center justify-center transition-colors duration-200"
              >
                <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-4">
              {visitorHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <svg className="w-12 h-12 text-gray-400 dark:text-gray-500" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
                  <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('followups.history.noHistory')}</h3>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-primary-50 dark:bg-primary-900/30 p-3 rounded-lg ring-1 ring-primary-200 dark:ring-primary-900/50">
                    <p className="text-sm font-bold text-primary-900 dark:text-primary-100">
                      {t('followups.history.total')}: <span className="text-2xl">{visitorHistory.length}</span>
                    </p>
                  </div>

                  {visitorHistory.map((fu, index) => (
                    <div
                      key={fu.id}
                      className={`rounded-lg p-3 ring-1 ${
                        fu.contacted ? 'bg-green-50 dark:bg-green-900/20 ring-green-200 dark:ring-green-900/50' : 'bg-orange-50 dark:bg-orange-900/20 ring-orange-200 dark:ring-orange-900/50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xl font-bold text-gray-400 dark:text-gray-500">#{visitorHistory.length - index}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(fu.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                            </span>
                            {fu.contacted ? (
                              <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-300 font-bold text-xs">
                                <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                {t('followups.history.contacted')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-300 font-bold text-xs">
                                <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                {t('followups.history.notContacted')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {fu.result && getResultBadge(fu.result)}
                          {fu.salesName && (
                            <span className="bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full text-xs font-bold">
                              {fu.salesName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bg-white dark:bg-gray-800 p-2 rounded ring-1 ring-gray-200 dark:ring-gray-700 mb-2">
                        <p className="text-sm text-gray-800 dark:text-gray-100">{fu.notes}</p>
                      </div>

                      {fu.nextFollowUpDate && (
                        <div className="text-xs text-gray-600 dark:text-gray-300 inline-flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                          <span>{t('followups.history.nextFollowUp')}: <span className="font-bold">{new Date(fu.nextFollowUpDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}</span></span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unified Filters Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 mb-6 overflow-hidden">

        {/* Row 1: Personal quick filters + sort toggle */}
        {user?.name && (
          <div className="px-3 sm:px-4 pt-3 pb-2 flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap gap-1.5 items-center">
              {!user?.isSales && (
                <button
                  onClick={() => setSalesFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium text-xs sm:text-sm transition-colors duration-200 inline-flex items-center gap-1.5 ${
                    salesFilter === 'all'
                      ? 'bg-primary-600 text-primary-contrast shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                  {t('followups.quickFilters.all')} ({allFollowUps.length})
                </button>
              )}
              <button
                onClick={() => setSalesFilter('my-followups')}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs sm:text-sm transition-colors duration-200 inline-flex items-center gap-1.5 ${
                  salesFilter === 'my-followups'
                    ? 'bg-primary-600 text-primary-contrast shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                {t('followups.quickFilters.myFollowups')} ({quickFilterCounts.myFollowUps})
              </button>
              <button
                onClick={() => setSalesFilter('today')}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs sm:text-sm transition-colors duration-200 inline-flex items-center gap-1.5 ${
                  salesFilter === 'today'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                {t('followups.quickFilters.today')} ({quickFilterCounts.todayCount})
              </button>

              {/* Contacted status filter */}
              <div className="mx-1 h-6 w-px bg-gray-300 dark:bg-gray-600" />
              <button
                onClick={() => setContactedFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs sm:text-sm transition-colors duration-200 inline-flex items-center gap-1.5 ${
                  contactedFilter === 'all'
                    ? 'bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-800 shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.49a1 1 0 01-.5 1.21l-2.25 1.13a11.04 11.04 0 005.52 5.52l1.13-2.25a1 1 0 011.21-.5l4.49 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z"/></svg>
                {t('followups.contactStatus.all')}
              </button>
              <button
                onClick={() => setContactedFilter('not-contacted')}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs sm:text-sm transition-colors duration-200 inline-flex items-center gap-1.5 ${
                  contactedFilter === 'not-contacted'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                }`}
              >
                <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {t('followups.contactStatus.notContacted')} ({quickFilterCounts.notContacted})
              </button>
              <button
                onClick={() => setContactedFilter('contacted')}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs sm:text-sm transition-colors duration-200 inline-flex items-center gap-1.5 ${
                  contactedFilter === 'contacted'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50'
                }`}
              >
                <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                {t('followups.contactStatus.contacted')} ({quickFilterCounts.contacted})
              </button>
            </div>
            <button
              onClick={() => { const v = !sortByPriority; setSortByPriority(v); localStorage.setItem('followups-sortByPriority', String(v)) }}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs sm:text-sm transition-colors duration-200 inline-flex items-center gap-1.5 ${
                sortByPriority ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {sortByPriority ? (
                <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.24 17 7.092 18.246 9.61 18 11 18 12c0 1.105.395 2.16 1.103 2.93.711.769 1.066 1.756.554 2.727z"/></svg>
              ) : (
                <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              )}
              {direction === 'rtl'
                ? (sortByPriority ? 'ترتيب: أولوية' : 'ترتيب: الأحدث')
                : (sortByPriority ? 'Sort: Priority' : 'Sort: Newest')}
            </button>
          </div>
        )}

        {/* Row 2: Source filter pills */}
        <div className={`px-3 sm:px-4 py-2 flex flex-wrap gap-1.5 ${user?.name ? 'border-t border-gray-100 dark:border-gray-700' : 'pt-3'}`}>
          <button onClick={() => setSourceFilter('all')} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-200 ${sourceFilter === 'all' ? 'bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-800' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
            {t('followups.filters.all')} ({stats.total})
          </button>
          <button onClick={() => setSourceFilter('expired-member')} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-200 inline-flex items-center gap-1 ${sourceFilter === 'expired-member' ? 'bg-red-600 text-white' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50'}`}>
            <svg className="w-3 h-3" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            {t('followups.sources.expiredMembers')} ({stats.expiredMembers})
          </button>
          <button onClick={() => setSourceFilter('expiring-member')} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-200 inline-flex items-center gap-1 ${sourceFilter === 'expiring-member' ? 'bg-amber-500 text-white' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'}`}>
            <svg className="w-3 h-3" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            {t('followups.sources.expiringMembers')} ({stats.expiringMembers})
          </button>
          <button onClick={() => setSourceFilter('member-invitation')} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-200 inline-flex items-center gap-1 ${sourceFilter === 'member-invitation' ? 'bg-cyan-600 text-white' : 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50'}`}>
            <svg className="w-3 h-3" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
            {t('followups.sources.memberInvitations')} ({stats.invitations})
          </button>
          <button onClick={() => setSourceFilter('dayuse')} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-200 inline-flex items-center gap-1 ${sourceFilter === 'dayuse' ? 'bg-pink-600 text-white' : 'bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-900/50'}`}>
            <svg className="w-3 h-3" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>
            {t('followups.sources.dayUse')} ({stats.dayUse})
          </button>
          <button onClick={() => setSourceFilter('visitors')} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-200 inline-flex items-center gap-1 ${sourceFilter === 'visitors' ? 'bg-primary-600 text-primary-contrast' : 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50'}`}>
            <svg className="w-3 h-3" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            {t('followups.sources.visitors')} ({stats.visitors})
          </button>
          <button onClick={() => setSourceFilter('website')} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-200 inline-flex items-center gap-1 ${sourceFilter === 'website' ? 'bg-cyan-600 text-white' : 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50'}`}>
            <svg className="w-3 h-3" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
            {locale === 'ar' ? 'موقع الويب' : 'Website'} ({stats.website})
          </button>
          <button
            onClick={() => syncWebsiteLeads(true)}
            disabled={websiteSyncing}
            title={locale === 'ar' ? 'جلب الـ leads من السيرفر دلوقتي' : 'Pull leads from server now'}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-200 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <svg className={`w-3 h-3 ${websiteSyncing ? 'animate-spin' : ''}`} {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            {locale === 'ar' ? 'جلب الـ leads' : 'Pull leads'}
          </button>
          {/*  فلتر السوشيال ميديا (بوب-أب يفتح ويقفل) */}
          <SocialMediaFilter selected={socialFilter} onChange={setSocialFilter} locale={locale} />
        </div>

        {/* Row 3: Search + dropdowns + smart script */}
        <div className="px-3 sm:px-4 pb-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-bold mb-1 text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              {t('followups.filters.search')}
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
              placeholder={t('followups.filters.searchPlaceholder')}
            />
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs font-bold mb-1 text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6m0 13l-3-3m3 3l3-3m6 3V10m0 9l3-3m-3 3l-3-3"/></svg>
              {t('followups.filters.priority')}
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
            >
              <option value="all">{t('followups.filters.all')}</option>
              <option value="today">{t('followups.priority.today')}</option>
              <option value="upcoming">{t('followups.priority.upcoming')}</option>
            </select>
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs font-bold mb-1 text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
              {t('followups.filters.result')}
            </label>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
            >
              <option value="all">{t('followups.filters.all')}</option>
              <option value="interested">{t('followups.results.interested')}</option>
              <option value="not-interested">{t('followups.results.notInterested')}</option>
              <option value="no-answer">{locale === 'ar' ? 'لم يرد' : 'No answer'}</option>
              <option value="postponed">{t('followups.results.postponed')}</option>
              <option value="subscribed">{t('followups.results.subscribed')}</option>
            </select>
          </div>
          {!user?.isSales && staffList.filter((s: any) => s.position?.split(',').map((p: string) => p.trim()).includes('sales')).length > 0 && (
            <div className="min-w-[140px]">
              <label className="block text-xs font-bold mb-1 text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                {t('followups.table.salesStaff')}
              </label>
              <select
                value={assignedStaffFilter}
                onChange={(e) => setAssignedStaffFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
              >
                <option value="all">{t('followups.table.allStaff')}</option>
                <option value="__unassigned__">{t('followups.table.noSalesStaff')}</option>
                {staffList
                  .filter((s: any) => s.position?.split(',').map((p: string) => p.trim()).includes('sales'))
                  .map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))
                }
              </select>
            </div>
          )}
          <div className="min-w-[140px]">
            <label className="block text-xs font-bold mb-1 text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              {locale === 'ar' ? 'من تاريخ' : 'From date'}
            </label>
            <input
              type="date"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              max={dateToFilter || undefined}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-bold mb-1 text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              {locale === 'ar' ? 'إلى تاريخ' : 'To date'}
            </label>
            <input
              type="date"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              min={dateFromFilter || undefined}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
            />
          </div>
          {(dateFromFilter || dateToFilter) && (
            <button
              onClick={() => { setDateFromFilter(''); setDateToFilter('') }}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 whitespace-nowrap inline-flex items-center gap-1 transition-colors duration-200"
              title={locale === 'ar' ? 'مسح فلتر التاريخ' : 'Clear date filter'}
            >
              <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              {locale === 'ar' ? 'مسح التاريخ' : 'Clear dates'}
            </button>
          )}
          {filteredFollowUps.length > 0 && (
            <button
              onClick={() => { setShowBulkScriptModal(true); fetchWaSessions() }}
              className="px-4 py-2 rounded-lg font-bold text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-sm flex items-center gap-2 whitespace-nowrap transition-colors duration-200"
            >
              <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              {t('followups.bulkScript.buttonLabel')} ({filteredFollowUps.length})
            </button>
          )}
        </div>
      </div>

      {/* Analytics View */}
      {viewMode === 'analytics' && <SalesDashboard />}

      {/* Collection View */}
      {viewMode === 'collection' && <CollectionDashboard />}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <FollowUpCalendar
          followUps={filteredFollowUps}
          onOpenFollowUp={(fu) => {
            setSelectedVisitorId(fu.visitor?.id || '')
            setShowForm(true)
          }}
          onAddFollowUp={(date) => {
            setCalendarInitialDate(date)
            setSelectedVisitorId('')
            setShowForm(true)
          }}
        />
      )}

      {/* Sales Management View — admin/owner only */}
      {viewMode === 'sales-mgmt' && canManageSales && <SalesMgmtPanel />}

      {/* Visitors View — صفحة الزوار جوا المتابعات */}
      {viewMode === 'visitors' && hasPermission('canViewVisitors') && <VisitorsPanel />}

      {/* Follow-Ups Table/List View */}
      {viewMode === 'list' && (loading ? (
        <LoadingScreen message={t('followups.loading')} />
      ) : (
        <>
          {/* Cards View - للجميع */}
          <div className="space-y-3 sm:space-y-4 mb-6">
            {currentFollowUps.map((followUp) => {
              const isExpired = followUp.visitor.source === 'expired-member'
              const isExpiring = followUp.visitor.source === 'expiring-member'

              return (
                <div
                  key={followUp.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-5 ring-1 ${
                    isExpired
                      ? 'ring-red-300 dark:ring-red-900/50 bg-gradient-to-br from-red-50/50 to-white dark:from-red-900/10 dark:to-gray-800'
                      : isExpiring
                      ? 'ring-amber-300 dark:ring-amber-900/50 bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-900/10 dark:to-gray-800'
                      : 'ring-primary-300 dark:ring-primary-900/50 bg-gradient-to-br from-primary-50/30 to-white dark:from-primary-900/10 dark:to-gray-800'
                  } hover:shadow-md transition-shadow duration-200`}
                >
                  {/* Action Buttons at Top */}
                  <div className="flex justify-between items-start gap-2 mb-2 sm:mb-3">
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(followUp)}
                    </div>
                    <div className="flex gap-1.5 sm:gap-2 flex-wrap justify-end">
                      {/* زر تعيين/تحويل سيلز - للأدمن فقط */}
                      {(() => {
                        const fid = followUp.id
                        let entityType: AssignEntityType | null = null
                        let entityId = ''
                        if (isExpired) {
                          entityType = 'member'
                          entityId = fid.replace(/^expired-/, '')
                        } else if (isExpiring) {
                          entityType = 'member'
                          entityId = fid.replace(/^expiring-/, '')
                        } else if (fid.startsWith('dayuse-')) {
                          entityType = 'dayuse'
                          entityId = fid.replace('dayuse-', '')
                        } else if (fid.startsWith('invitation-')) {
                          entityType = 'invitation'
                          entityId = fid.replace('invitation-', '')
                        } else if (fid.startsWith('visitor-')) {
                          entityType = 'visitor'
                          entityId = fid.replace('visitor-', '')
                        } else if (followUp.visitor?.id) {
                          entityType = 'visitor'
                          entityId = followUp.visitor.id
                        }
                        if (!entityType || !entityId) return null
                        const assignedStaff = followUp.assignedStaff
                          ? { id: followUp.assignedStaff.id, name: followUp.assignedStaff.name }
                          : (followUp.assignedTo
                              ? { id: followUp.assignedTo, name: (staffList as any[]).find((s: any) => s.id === followUp.assignedTo)?.name || '' }
                              : null)
                        return (
                          <AssignSalesButton
                            entityType={entityType}
                            entityId={entityId}
                            currentSalesStaff={assignedStaff}
                            size="xs"
                            onAssigned={() => {
                              queryClient.invalidateQueries({ queryKey: ['followups'] })
                              queryClient.invalidateQueries({ queryKey: ['visitors'] })
                              queryClient.invalidateQueries({ queryKey: ['visitors-followups'] })
                              queryClient.invalidateQueries({ queryKey: ['members'] })
                              queryClient.invalidateQueries({ queryKey: ['dayuse'] })
                              queryClient.invalidateQueries({ queryKey: ['invitations'] })
                            }}
                          />
                        )
                      })()}
                      {/* زر تجديد سريع — يفتح صفحة تفاصيل العضو مع modal التجديد */}
                      {(isExpired || isExpiring) && (() => {
                        //  استخراج الـ memberId مباشرة من الـ followUp.id (expired-XXX / expiring-XXX)
                        // ده الأدق — لأن الـ phone lookup ممكن يلخبط لو فيه عضوين بتليفونات متشابهة
                        const idFromPrefix =
                          followUp.id.startsWith('expired-') ? followUp.id.slice(8)
                          : followUp.id.startsWith('expiring-') ? followUp.id.slice(9)
                          : null
                        const mid = idFromPrefix || getMemberIdByPhone(followUp.visitor.phone)
                        const href = mid
                          ? `/members/${mid}?action=renew`
                          : `/members?search=${encodeURIComponent(followUp.visitor.phone)}`
                        return (
                          <Link
                            href={href}
                            className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 px-2 sm:px-3 py-1 rounded bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors duration-200 inline-flex items-center"
                            title={locale === 'ar' ? 'تجديد سريع' : 'Quick Renew'}
                            aria-label={locale === 'ar' ? 'تجديد سريع' : 'Quick Renew'}
                          >
                            <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                          </Link>
                        )
                      })()}
                      {isExpired && (
                        <button
                          onClick={() => openQuickFollowUp(followUp.visitor)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 px-2 sm:px-3 py-1 rounded bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors duration-200 inline-flex items-center"
                          aria-label={locale === 'ar' ? 'إضافة متابعة' : 'Add follow-up'}
                          title={locale === 'ar' ? 'إضافة متابعة' : 'Add follow-up'}
                        >
                          <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                        </button>
                      )}
                      {!isExpired && (
                        <button
                          onClick={() => openQuickFollowUp(followUp.visitor)}
                          className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 px-2 sm:px-3 py-1 rounded bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors duration-200 inline-flex items-center"
                          aria-label={locale === 'ar' ? 'إضافة متابعة' : 'Add follow-up'}
                          title={locale === 'ar' ? 'إضافة متابعة' : 'Add follow-up'}
                        >
                          <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                        </button>
                      )}
                      <button
                        onClick={() => openHistoryModal(followUp.visitor)}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 px-2 sm:px-3 py-1 rounded bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors duration-200 inline-flex items-center"
                        aria-label={t('followups.history.title')}
                        title={t('followups.history.title')}
                      >
                        <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9h6m-6 4h6"/></svg>
                      </button>
                      {/* زر الاشتراك السريع - مخفي للأعضاء القريبين من الانتهاء */}
                      {!isExpiring && (
                        <button
                          onClick={() => openQuickSubscribe(followUp.visitor, followUp.assignedTo || undefined)}
                          className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 px-2 sm:px-3 py-1 rounded bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors duration-200 inline-flex items-center"
                          aria-label={locale === 'ar' ? 'تحويل الزائر إلى عضو' : 'Convert visitor to member'}
                          title={locale === 'ar' ? 'تحويل الزائر إلى عضو' : 'Convert visitor to member'}
                        >
                          <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        </button>
                      )}
                      {/* زر تعديل - للزوار والدعوات */}
                      {!isExpired && !isExpiring && !followUp.id.startsWith('dayuse-') && (
                        <button
                          onClick={() => handleEditFollowUp(followUp)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 px-2 sm:px-3 py-1 rounded bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors duration-200 inline-flex items-center"
                          aria-label={locale === 'ar' ? 'تعديل' : 'Edit'}
                          title={locale === 'ar' ? 'تعديل' : 'Edit'}
                        >
                          <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                      )}
                      {/* زر حذف - للزوار والدعوات */}
                      {!isExpired && !isExpiring && !followUp.id.startsWith('dayuse-') && (
                        <button
                          onClick={() => handleDeleteFollowUp(followUp.id, followUp.visitor.name)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 px-2 sm:px-3 py-1 rounded bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors duration-200 inline-flex items-center"
                          aria-label={locale === 'ar' ? 'حذف' : 'Delete'}
                          title={locale === 'ar' ? 'حذف' : 'Delete'}
                        >
                          <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Follow-up Info */}
                  <div className="space-y-2 sm:space-y-2.5">
                    {/* اسم الزائر ورقم الهاتف - بروز أكبر */}
                    <div className="bg-gradient-to-r from-primary-50 via-white to-primary-50 dark:from-primary-900/20 dark:via-gray-800 dark:to-primary-900/20 p-3 sm:p-4 rounded-xl ring-1 ring-primary-200 dark:ring-primary-900/50 shadow-sm">
                      <div className="flex flex-col gap-2.5">
                        {/* الاسم */}
                        <div className="flex items-center gap-2">
                          <div className="bg-primary-500 p-1.5 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                          </div>
                          <div className="flex-1">
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">{locale === 'ar' ? 'الاسم' : 'Name'}</div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-bold text-base sm:text-lg ${
                                isExpired ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-gray-100'
                              }`}>
                                {followUp.visitor.name}
                              </span>
                              {isVisitorAMember(followUp.visitor.phone) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-300 dark:ring-emerald-800">
                                  <svg className="w-3 h-3" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                  {locale === 'ar' ? 'عضو الآن' : 'Now a Member'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* رقم الهاتف */}
                        <div className="flex items-center gap-2">
                          <div className="bg-green-500 p-1.5 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                          </div>
                          <div className="flex-1">
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">{t('followups.table.phoneNumber')}</div>
                            <div className="flex gap-2 items-center">
                              <span className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200" dir="ltr">
                                {followUp.visitor.phone}
                              </span>
                              <button
                                onClick={() => openTemplateModal(followUp.visitor)}
                                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm transition-colors duration-200 inline-flex items-center gap-1"
                                title={t('followups.table.readyMessages')}
                              >
                                <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                                {t('followups.table.whatsappButton')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* المصدر ومهتم بإيه - معلومات مهمة */}
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-500 dark:text-gray-400 inline-flex items-center">
                          <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                        </span>
                        <span className={`${
                          followUp.visitor.source === 'invitation'
                            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 px-3 py-1 rounded-full text-xs font-bold'
                            : followUp.visitor.source === 'member-invitation'
                            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 px-3 py-1 rounded-full text-xs font-bold'
                            : followUp.visitor.source === 'expired-member'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-3 py-1 rounded-full text-xs font-bold'
                            : followUp.visitor.source === 'expiring-member'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-3 py-1 rounded-full text-xs font-bold'
                            : followUp.visitor.source === 'website'
                            ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-cyan-300 dark:ring-cyan-700'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 px-3 py-1 rounded-full text-xs font-medium'
                        }`}>
                          {getSourceLabel(followUp.visitor.source)}
                        </span>

                        {/* مهتم بإيه - بروز أكبر */}
                        {followUp.visitor.interestedIn && (
                          <>
                            <span className="text-gray-400 dark:text-gray-500">•</span>
                            <div className="flex items-center gap-1.5 bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 px-3 py-1 rounded-full ring-1 ring-blue-300 dark:ring-blue-900/50">
                              <svg className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/></svg>
                              <span className="text-blue-900 dark:text-blue-200 text-xs font-bold">
                                {followUp.visitor.interestedIn}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* تفاصيل الزائر الإضافية: تاريخ أول تواصل، حالة الزائر، العضو المُحيل، الملاحظات */}
                    {(followUp.visitor.createdAt || followUp.visitor.status || followUp.visitor.referrerMemberNumber || followUp.visitor.notes) && (
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {followUp.visitor.createdAt && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                            <svg className="w-3 h-3" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                            <span>{locale === 'ar' ? 'أول تواصل:' : 'First contact:'} {new Date(followUp.visitor.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}</span>
                          </span>
                        )}
                        {followUp.visitor.status && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold ${
                            followUp.visitor.status === 'contacted' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                            : followUp.visitor.status === 'subscribed' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                            : followUp.visitor.status === 'rejected' || followUp.visitor.status === 'lost' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                          }`}>
                            {locale === 'ar'
                              ? (followUp.visitor.status === 'pending' ? 'في الانتظار' : followUp.visitor.status === 'contacted' ? 'تم التواصل' : followUp.visitor.status === 'subscribed' ? 'مشترك' : followUp.visitor.status === 'rejected' ? 'رفض' : followUp.visitor.status === 'lost' ? 'مفقود' : followUp.visitor.status)
                              : followUp.visitor.status}
                          </span>
                        )}
                        {followUp.visitor.referrerMemberNumber && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                            <svg className="w-3 h-3" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
                            <span>{locale === 'ar' ? 'جابه عضو:' : 'Referred by:'} #{followUp.visitor.referrerMemberNumber}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {followUp.visitor.notes && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/40 rounded-lg p-2.5 text-xs">
                        <div className="flex items-start gap-1.5">
                          <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-700 dark:text-amber-300" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>
                          <div>
                            <span className="font-bold text-amber-800 dark:text-amber-200 me-1">{locale === 'ar' ? 'ملاحظات الزائر:' : 'Visitor notes:'}</span>
                            <span className="text-amber-900 dark:text-amber-100 whitespace-pre-wrap">{followUp.visitor.notes}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* موظف المبيعات */}
                    {followUp.salesName && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400 inline-flex items-center">
                          <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                        </span>
                        <span className="text-orange-600 dark:text-orange-400 font-semibold text-xs sm:text-sm">{followUp.salesName}</span>
                      </div>
                    )}

                    {/* آخر تعليق أو الملاحظات */}
                    {(() => {
                      const lastComment = getLastComment(followUp.visitor.phone)
                      return lastComment ? (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-lg border-s-4 border-blue-500">
                          <div className="flex items-start gap-2 mb-1">
                            <span className="text-blue-600 dark:text-blue-400 text-xs font-semibold inline-flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                              {t('followups.table.lastCommentLabel')}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 mb-1">{lastComment.notes}</p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            {lastComment.salesName && <span className="text-orange-500 dark:text-orange-400 font-medium">{lastComment.salesName} • </span>}
                            {new Date(lastComment.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                          </p>
                        </div>
                      ) : followUp.notes ? (
                        <div className="bg-gray-50 dark:bg-gray-900/40 p-2.5 rounded-lg border-s-4 border-gray-400 dark:border-gray-500">
                          <div className="flex items-start gap-2 mb-1">
                            <span className="text-gray-600 dark:text-gray-300 text-xs font-semibold inline-flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                              {t('followups.table.notesLabel')}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200">{followUp.notes}</p>
                        </div>
                      ) : null
                    })()}

                    {/* النتيجة وحالة التواصل والتواريخ */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">{t('followups.table.resultLabel')}</span>
                        {getResultBadge(followUp.result)}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">{t('followups.table.contactStatusLabel')}</span>
                        {followUp.contacted ? (
                          <span className="text-green-600 dark:text-green-400 text-xs font-medium inline-flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                            {t('followups.table.contactDone')}
                          </span>
                        ) : (
                          <span className="text-orange-600 dark:text-orange-400 text-xs font-medium inline-flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            {t('followups.table.contactPending')}
                          </span>
                        )}
                      </div>
                      {followUp.nextFollowUpDate && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">{locale === 'ar' ? 'المتابعة القادمة' : 'Next follow-up'}</span>
                          <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                            {new Date(followUp.nextFollowUpDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">{locale === 'ar' ? 'آخر تحديث' : 'Last update'}</span>
                        <span className="text-[10px] text-gray-600 dark:text-gray-300">
                          {new Date(followUp.updatedAt || followUp.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {filteredFollowUps.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                {searchTerm || resultFilter !== 'all' || contactedFilter !== 'all' || priorityFilter !== 'all' ? (
                  <>
                    <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-3" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <h3 className="text-gray-600 dark:text-gray-300 font-bold">{t('followups.messages.noResults')}</h3>
                  </>
                ) : (
                  <>
                    <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-3" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    <h3 className="text-gray-600 dark:text-gray-300 font-bold">{t('followups.messages.noFollowups')}</h3>
                    <button
                      onClick={() => setShowForm(true)}
                      className="mt-4 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                    >
                      <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                      {t('followups.messages.addFirst')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {filteredFollowUps.length > 0 && (
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                {/* معلومات الصفحة */}
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {t('followups.pagination.showing')} {startIndex + 1} {t('followups.pagination.to')} {Math.min(endIndex, filteredFollowUps.length)} {t('followups.pagination.of')} {filteredFollowUps.length} {t('followups.pagination.followups')}
                </div>

                {/* عدد العناصر في الصفحة */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-300">{t('followups.pagination.itemsPerPage')}:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
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
                      className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      {t('followups.pagination.first')}
                    </button>
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      {t('followups.pagination.previous')}
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
                            aria-current={currentPage === pageNum ? 'page' : undefined}
                            className={`px-3 py-2 rounded-lg font-medium transition-colors duration-200 ${
                              currentPage === pageNum
                                ? 'bg-primary-500 text-primary-contrast'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                      className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      {t('followups.pagination.next')}
                    </button>
                    <button
                      onClick={() => goToPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      {t('followups.pagination.last')}
                    </button>
                  </div>
                )}
              </div>

              {/* معلومات إضافية */}
              <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                {t('followups.pagination.page')} {currentPage} {t('followups.pagination.of')} {totalPages}
              </div>
            </div>
          )}
        </>
      ))}

      {/* Recently Converted Section */}
      {convertedMembers.length > 0 && viewMode === 'list' && (
        <div className="mt-6 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 ring-1 ring-emerald-300 dark:ring-emerald-900/50 rounded-xl p-4 sm:p-6">
          <h3 className="font-bold text-emerald-900 dark:text-emerald-100 mb-4 flex items-center gap-2 text-lg sm:text-xl">
            <svg className="w-6 h-6" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            <span>{t('followups.convertedMembers')}</span>
            <span className="bg-emerald-600 text-white text-sm px-3 py-1 rounded-full">
              {convertedMembers.length}
            </span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {convertedMembers
              .slice(0, 6)
              .map((fu) => {
                const isExpired = fu.visitor.source === 'expired-member'
                const isExpiring = fu.visitor.source === 'expiring-member'
                const isRenewal = isExpired || isExpiring

                return (
                  <div
                    key={fu.id}
                    className="bg-white dark:bg-gray-800 ring-1 ring-emerald-200 dark:ring-emerald-900/50 rounded-lg p-3 hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base">{fu.visitor.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{fu.visitor.phone}</p>
                        {isRenewal && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-[10px] font-bold rounded-full">
                            <svg className="w-3 h-3" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                            {locale === 'ar' ? 'تجديد' : 'Renewal'}
                          </span>
                        )}
                        {!isRenewal && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-[10px] font-bold rounded-full">
                            <svg className="w-3 h-3" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
                            {locale === 'ar' ? 'عضو جديد' : 'New member'}
                          </span>
                        )}
                      </div>
                      <svg className="w-6 h-6 text-green-600 dark:text-green-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-2 space-y-1">
                      <p className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 shrink-0" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                        <span>{getSourceLabel(fu.visitor.source)}</span>
                      </p>
                      {fu.salesName && (
                        <p className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 shrink-0" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-300">{fu.salesName}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
          {convertedMembers.length > 6 && (
            <p className="text-center text-sm text-emerald-700 dark:text-emerald-300 mt-4 font-medium">
              {locale === 'ar'
                ? `وأكثر من ${convertedMembers.length - 6} شخص آخر تحول لعضو / جدد`
                : `And ${convertedMembers.length - 6} more people converted / renewed`}
            </p>
          )}
        </div>
      )}


      {/* Quick Tips */}
      <div className="mt-4 bg-gradient-to-r from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20 border-s-4 border-primary-500 p-5 rounded-lg">
        <h3 className="font-bold text-primary-900 dark:text-primary-100 mb-2 flex items-center gap-2">
          <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
          <span>{t('followups.tips.title')}</span>
        </h3>
        <ul className="text-sm text-primary-800 dark:text-primary-200 space-y-1">
          <li>• <strong>{t('followups.tips.overdue.title')}:</strong> {t('followups.tips.overdue.text')}</li>
          <li>• <strong>{t('followups.tips.today.title')}:</strong> {t('followups.tips.today.text')}</li>
          <li>• <strong>{t('followups.tips.whatsapp.title')}:</strong> {t('followups.tips.whatsapp.text')}</li>
          <li>• <strong>{t('followups.tips.yellow.title')}:</strong> {t('followups.tips.yellow.text')}</li>
          <li>• <strong>{t('followups.tips.red.title')}:</strong> {t('followups.tips.red.text')}</li>
          <li>• <strong>{t('followups.tips.green.title')}:</strong> {t('followups.tips.green.text')}</li>
        </ul>
      </div>

      {/* Delete Confirmation Popup */}
      {showDeleteConfirm && deleteTarget && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
          onClick={cancelDelete}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 ring-1 ring-red-200 dark:ring-red-900/50 animate-modal-in"
            onClick={(e) => e.stopPropagation()}
            dir={direction}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 flex items-center justify-center">
                <svg className="w-6 h-6" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
              <div>
                <h3 id="delete-confirm-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {t('followups.deleteConfirm.title')}
                </h3>
              </div>
            </div>

            {/* Content */}
            <div className="mb-6 space-y-3">
              <p className="text-gray-700 dark:text-gray-200 text-base">
                {t('followups.deleteConfirm.message')} <strong className="text-red-600 dark:text-red-400">{deleteTarget.name}</strong>؟
              </p>
              <div className="bg-red-50 dark:bg-red-900/30 ring-1 ring-red-200 dark:ring-red-900/50 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
                  <svg className="w-5 h-5 shrink-0" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  <span>{t('followups.deleteConfirm.warning')}</span>
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                autoFocus
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                {deleteMutation.isPending ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06"/></svg>
                    <span>{t('followups.deleteConfirm.deleting')}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    <span>{t('followups.deleteConfirm.confirmButton')}</span>
                  </>
                )}
              </button>
              <button
                onClick={cancelDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-lg transition-colors duration-200"
              >
                {t('followups.deleteConfirm.cancelButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Visitor Confirmation Popup */}
      {showDeleteVisitorConfirm && deleteVisitorTarget && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
          onClick={cancelDeleteVisitor}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-visitor-confirm-title"
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 ring-1 ring-red-200 dark:ring-red-900/50 animate-modal-in"
            onClick={(e) => e.stopPropagation()}
            dir={direction}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 flex items-center justify-center">
                <svg className="w-6 h-6" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
              <div>
                <h3 id="delete-visitor-confirm-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {t('followups.deleteVisitorConfirm.title')}
                </h3>
              </div>
            </div>

            <div className="mb-6 space-y-3">
              <p className="text-gray-700 dark:text-gray-200 text-base">
                {t('followups.deleteVisitorConfirm.message')} <strong className="text-red-600 dark:text-red-400">{deleteVisitorTarget.name}</strong>?
              </p>
              <div className="bg-red-50 dark:bg-red-900/30 ring-1 ring-red-200 dark:ring-red-900/50 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
                  <svg className="w-5 h-5 shrink-0" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  <span>{t('followups.deleteVisitorConfirm.warning')}</span>
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmDeleteVisitor}
                disabled={deleteVisitorMutation.isPending}
                autoFocus
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                {deleteVisitorMutation.isPending ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06"/></svg>
                    <span>{t('followups.deleteConfirm.deleting')}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    <span>{t('followups.deleteVisitorConfirm.confirmButton')}</span>
                  </>
                )}
              </button>
              <button
                onClick={cancelDeleteVisitor}
                disabled={deleteVisitorMutation.isPending}
                className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-lg transition-colors duration-200"
              >
                {t('followups.deleteConfirm.cancelButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال تعديل الزائر/الدعوة */}
      {showEditModal && editTarget && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
          onClick={() => { setShowEditModal(false); setEditTarget(null) }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-modal-title"
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in"
            onClick={(e) => e.stopPropagation()}
            dir={direction}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </div>
              <h3 id="edit-modal-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {editTarget.type === 'invitation' ? t('followups.editModal.editInvitation') : t('followups.editModal.editVisitor')}
              </h3>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-bold mb-1.5 text-gray-700 dark:text-gray-300">{t('followups.editModal.name')}</label>
                <input
                  type="text"
                  value={editTarget.name}
                  onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })}
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1.5 text-gray-700 dark:text-gray-300">{t('followups.editModal.phone')}</label>
                <input
                  type="tel"
                  value={editTarget.phone}
                  onChange={(e) => setEditTarget({ ...editTarget, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
                  dir="ltr"
                />
              </div>

              {/* 🆕 مصدر الزائر — للزوار فقط (مش الدعوات) */}
              {editTarget.type === 'visitor' && (
                <>
                  <div>
                    <label className="block text-sm font-bold mb-1.5 text-gray-700 dark:text-gray-300">
                      {locale === 'ar' ? 'المصدر' : 'Source'}
                    </label>
                    <div className="relative">
                      <select
                        value={editTarget.source || ''}
                        onChange={(e) => {
                          const next = e.target.value
                          setEditTarget({
                            ...editTarget,
                            source: next,
                            // لو غيّر لمصدر غير friend_referral، نمسح الـ ID
                            ...(next !== 'friend_referral' ? { referrerMemberNumber: '' } : {}),
                          })
                        }}
                        className="w-full appearance-none ps-3 pe-10 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 text-gray-900 dark:text-gray-100 text-sm font-medium shadow-inner hover:bg-white dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:border-blue-400 dark:focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all duration-200 cursor-pointer"
                      >
                        <option value="">— {locale === 'ar' ? 'اختر المصدر' : 'Select source'} —</option>
                        <option value="walk-in">{locale === 'ar' ? 'زيارة مباشرة / Walk In' : 'Walk In'}</option>
                        <option value="call-in">{locale === 'ar' ? 'اتصال / Call In' : 'Call In'}</option>
                        <option value="suggestion">{locale === 'ar' ? 'اقتراح / Suggestion' : 'Suggestion'}</option>
                        <option value="facebook">Facebook</option>
                        <option value="instagram">Instagram</option>
                        <option value="tiktok">TikTok</option>
                        <option value="chatgpt">{locale === 'ar' ? 'شات جي بي تي / ChatGPT' : 'ChatGPT'}</option>
                        <option value="website">{locale === 'ar' ? 'الموقع / Website' : 'Website'}</option>
                        <option value="friend_referral">{locale === 'ar' ? 'إحالة من صديق / Friend Referral' : 'Friend Referral'}</option>
                        {/* احتفاظ بالقيمة القديمة لو الزائر متسجّل بمصدر مش في القائمة */}
                        {editTarget.source && !['walk-in','call-in','suggestion','facebook','instagram','tiktok','website','friend_referral'].includes(editTarget.source) && (
                          <option value={editTarget.source}>{editTarget.source}</option>
                        )}
                      </select>
                      <div className="absolute end-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-white dark:bg-gray-600 shadow-sm flex items-center justify-center pointer-events-none">
                        <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" {...stroke}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* 👥 ID اللي جابه — يظهر لما المصدر = friend_referral */}
                  {editTarget.source === 'friend_referral' && (
                    <div>
                      <label className="flex items-center gap-1.5 text-sm font-bold mb-1.5 text-gray-700 dark:text-gray-300">
                        <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        {locale === 'ar' ? 'رقم العضو المُحيل' : 'Referrer Member #'}
                      </label>
                      <input
                        type="text"
                        value={editTarget.referrerMemberNumber || ''}
                        onChange={(e) => setEditTarget({ ...editTarget, referrerMemberNumber: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
                        placeholder={locale === 'ar' ? 'مثال: 1234' : 'e.g. 1234'}
                        dir="ltr"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmEdit}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                {t('followups.editModal.save')}
              </button>
              <button
                onClick={() => { setShowEditModal(false); setEditTarget(null) }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-2.5 px-4 rounded-lg transition-colors duration-200"
              >
                {t('followups.editModal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نموذج الاشتراك السريع */}
      {showQuickSubscribeModal && selectedVisitorForSubscribe && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-subscribe-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between z-10">
              <h2 id="quick-subscribe-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {t('followups.quickSubscribe')} - {selectedVisitorForSubscribe.name}
              </h2>
              <button
                onClick={() => {
                  setShowQuickSubscribeModal(false)
                  setSelectedVisitorForSubscribe(null)
                  setSelectedFollowUpSalesStaffId(null)
                }}
                aria-label={direction === 'rtl' ? 'إغلاق' : 'Close'}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200"
              >
                <svg className="w-6 h-6" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6">
              <MemberForm
                onCancel={() => {
                  setShowQuickSubscribeModal(false)
                  setSelectedVisitorForSubscribe(null)
                  setSelectedFollowUpSalesStaffId(null)
                }}
                onSuccess={() => {
                  setShowQuickSubscribeModal(false)
                  setSelectedVisitorForSubscribe(null)
                  setSelectedFollowUpSalesStaffId(null)
                  refetchFollowUps()
                  toast.success(
                    locale === 'ar'
                      ? `تم تحويل ${selectedVisitorForSubscribe.name} إلى عضو بنجاح!`
                      : `${selectedVisitorForSubscribe.name} converted to member successfully!`
                  )
                }}
                prefillData={{
                  name: selectedVisitorForSubscribe.name,
                  phone: selectedVisitorForSubscribe.phone,
                  salesStaffId: selectedFollowUpSalesStaffId || undefined
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function FollowUpsPage() {
  return (
    <Suspense fallback={null}>
      <FollowUpsPageContent />
    </Suspense>
  )
}
