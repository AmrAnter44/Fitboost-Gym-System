'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import nextDynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionDenied from '../../components/PermissionDenied'
import type { MessageTemplate } from './MessageTemplateManager'

// ✅ Dynamic imports - تحميل عند الحاجة فقط
const FollowUpForm = nextDynamic(() => import('./FollowUpForm'), { ssr: false })
const SalesDashboard = nextDynamic(() => import('./SalesDashboard'), {
  ssr: false,
  loading: () => <div className="animate-pulse h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
})
const MessageTemplateManager = nextDynamic(() => import('./MessageTemplateManager'), { ssr: false })
const MemberForm = nextDynamic(() => import('../../components/MemberForm'), { ssr: false })
const CollectionDashboard = nextDynamic(() => import('../../components/CollectionDashboard'), {
  ssr: false,
  loading: () => <div className="animate-pulse h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
})
const SalesMgmtPanel = nextDynamic(() => import('../../components/SalesMgmtPanel'), {
  ssr: false,
  loading: () => <div className="animate-pulse h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
})
const FollowUpCalendar = nextDynamic(() => import('../../components/FollowUpCalendar'), {
  ssr: false,
  loading: () => <div className="animate-pulse h-96 bg-gray-200 dark:bg-gray-700 rounded-xl" />
})
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../contexts/ToastContext'
import { useRouter } from 'next/navigation'
import {
  fetchFollowUpsData,
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

interface Visitor {
  id: string
  name: string
  phone: string
  source: string
  status: string
  createdAt?: string
  interestedIn?: string
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
  birthDate?: string
}

export default function FollowUpsPage() {
  const { hasPermission, loading: permissionsLoading, user } = usePermissions()
  const canManageSales = hasPermission('canEditStaff')
  const { t, direction, locale } = useLanguage()
  const toast = useToast()
  const router = useRouter()
  const queryClient = useQueryClient()

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

  // ✏️ تعديل زائر/دعوة
  const [showEditModal, setShowEditModal] = useState(false)
  const [editTarget, setEditTarget] = useState<{id: string, name: string, phone: string, type: 'visitor' | 'invitation', originalId: string} | null>(null)

  // ✅ اشتراك سريع - تحويل الزائر إلى عضو
  const [showQuickSubscribeModal, setShowQuickSubscribeModal] = useState(false)
  const [selectedVisitorForSubscribe, setSelectedVisitorForSubscribe] = useState<Visitor | null>(null)
  const [selectedFollowUpSalesStaffId, setSelectedFollowUpSalesStaffId] = useState<string | null>(null)

  // View mode state
  const [viewMode, setViewMode] = useState<'list' | 'analytics' | 'collection' | 'sales-mgmt' | 'calendar'>('list')

  // ✅ Bulk sending states
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentName: '' })
  const bulkSendAbortedRef = useRef(false)

  // ✅ Smart Bulk Script states
  const [showBulkScriptModal, setShowBulkScriptModal] = useState(false)
  const [bulkScriptMessages, setBulkScriptMessages] = useState<string[]>([''])
  const [bulkScriptContactFilter, setBulkScriptContactFilter] = useState<'all' | 'contacted' | 'not-contacted'>('not-contacted')
  const [bulkScriptDelayMin, setBulkScriptDelayMin] = useState(15)
  const [bulkScriptDelayMax, setBulkScriptDelayMax] = useState(30)
  const [bulkScriptSkipDays, setBulkScriptSkipDays] = useState(7)
  const [bulkScriptTestPhone, setBulkScriptTestPhone] = useState('')
  const [bulkScriptRunning, setBulkScriptRunning] = useState(false)
  const [bulkScriptPaused, setBulkScriptPaused] = useState(false)
  const bulkScriptPausedRef = useRef(false)
  const bulkScriptAbortedRef = useRef(false)
  const [bulkScriptProgress, setBulkScriptProgress] = useState({ current: 0, total: 0, currentName: '', currentMsgIndex: 0, successCount: 0, failCount: 0, countdown: 0 })
  const [bulkScriptReport, setBulkScriptReport] = useState<{ success: {name: string, phone: string}[], failed: {name: string, phone: string, error: string}[] } | null>(null)
  const [bulkScriptPresetName, setBulkScriptPresetName] = useState('')
  // ✅ نقرأ القيم المحفوظة من localStorage عند initial mount
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

  // ✅ Persist bulk script settings whenever they change
  useEffect(() => { localStorage.setItem('wa-bulk-dailyLimit', String(bulkScriptDailyLimit)) }, [bulkScriptDailyLimit])
  useEffect(() => { localStorage.setItem('wa-bulk-batchSize', String(bulkScriptBatchSize)) }, [bulkScriptBatchSize])
  useEffect(() => { localStorage.setItem('wa-bulk-batchBreakMin', String(bulkScriptBatchBreakMin)) }, [bulkScriptBatchBreakMin])
  useEffect(() => { localStorage.setItem('wa-bulk-batchBreakMax', String(bulkScriptBatchBreakMax)) }, [bulkScriptBatchBreakMax])
  useEffect(() => { localStorage.setItem('wa-bulk-sessionIndex', String(bulkScriptSessionIndex)) }, [bulkScriptSessionIndex])
  const [availableWaSessions, setAvailableWaSessions] = useState<{sessionIndex: number, phoneNumber?: string, isReady: boolean}[]>([])

  // ✅ ثبات الـ stale/refetch لكل المتابعات (تقليل الـ network traffic)
  // refetchInterval شيلناه لأن staleTime + refetchOnWindowFocus كافيين للـ real-time
  const COMMON_QUERY_OPTS = {
    retry: 1,
    staleTime: 60 * 1000, // البيانات تعتبر طازجة لمدة دقيقة
    refetchOnWindowFocus: true, // إعادة جلب عند الرجوع للنافذة فقط
  } as const

  // Fetch all data using TanStack Query
  const {
    data: followUps = [],
    isLoading: loadingFollowUps,
    error: followUpsError,
    refetch: refetchFollowUps
  } = useQuery({
    queryKey: ['followups'],
    queryFn: fetchFollowUpsData,
    ...COMMON_QUERY_OPTS,
  })

  const {
    data: visitorsData = [],
    error: visitorsError
  } = useQuery({
    queryKey: ['visitors-followups'],
    queryFn: fetchVisitorsData,
    ...COMMON_QUERY_OPTS,
    enabled: hasPermission('canViewVisitors'), // ✅ صلاحية عرض الزوار
  })

  const {
    data: allMembersData = [],
    error: membersError
  } = useQuery({
    queryKey: ['members-followups'],
    queryFn: fetchMembersData,
    ...COMMON_QUERY_OPTS,
    // ✅ السماح للسيلز بقراءة أعضاءه (الـ API بيفلتر تلقائياً) حتى لو الصلاحية غير صريحة
    enabled: hasPermission('canViewMembers') || user?.isSales === true,
  })

  const {
    data: dayUseRecords = [],
    error: dayUseError
  } = useQuery({
    queryKey: ['dayuse-followups'],
    queryFn: fetchDayUseData,
    ...COMMON_QUERY_OPTS,
    enabled: hasPermission('canViewDayUse'), // ✅ فقط إذا كان لديه صلاحية
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

  // ✅ جلب الموظفين النشطين
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
    enabled: hasPermission('canViewStaff'), // ✅ فقط إذا كان لديه صلاحية
  })

  // Extract visitors and members from queries
  // ✅ ترتيب الزوار حسب تاريخ الإنشاء (الأحدث أولاً) — copy first to avoid mutating React Query cache
  const visitors = useMemo(() =>
    [...(visitorsData || [])].sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    [visitorsData]
  )

  // ✅ ترتيب الدعوات حسب تاريخ الإنشاء (الأحدث أولاً) — copy first to avoid mutating React Query cache
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

  // ✅ Delete mutation مع Optimistic Update
  const deleteMutation = useMutation({
    mutationFn: deleteFollowUp,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['followups'] })
      const previousData = queryClient.getQueryData<any[]>(['followups'])
      queryClient.setQueryData<any[]>(['followups'], (old) =>
        old ? old.filter(fu => fu.id !== id) : old
      )
      return { previousData }
    },
    onSuccess: () => {
      toast.success(t('followups.messages.deleteSuccess'))
      // ✅ Invalidate جميع الـ queries لتجنب التكرار
      queryClient.invalidateQueries({ queryKey: ['followups'] })
      queryClient.invalidateQueries({ queryKey: ['visitors-followups'] })
      queryClient.invalidateQueries({ queryKey: ['members-followups'] })
      queryClient.invalidateQueries({ queryKey: ['dayuse-followups'] })
      queryClient.invalidateQueries({ queryKey: ['invitations-followups'] })
    },
    onError: (error: Error, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['followups'], context.previousData)
      }
      toast.error(error.message || t('followups.messages.deleteError'))
    }
  })

  // 🗑️ حذف زائر نهائياً (مع كل متابعاته)
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
  const [sourceFilter, setSourceFilter] = useState('all') // ✅ فلتر المصدر
  const [salesFilter, setSalesFilter] = useState('all') // ✅ فلتر السيلز (all, my-followups, my-overdue, today)
  const [assignedStaffFilter, setAssignedStaffFilter] = useState('all') // ✅ فلتر بموظف سيلز محدد

  // ✅ لو المستخدم سيلز → يشوف متابعاته بس تلقائياً (مرة واحدة بس)
  const salesFilterInitRef = useRef(false)
  useEffect(() => {
    if (user?.isSales && !salesFilterInitRef.current) {
      salesFilterInitRef.current = true
      setSalesFilter('my-followups')
    }
  }, [user?.isSales])
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

  // ✅ حساب الأعضاء المنتهيين
  const expiredMembers = useMemo(() => {
    if (permissionsLoading) return []
    const today = new Date()
    today.setHours(0, 0, 0, 0) // مقارنة بالتاريخ فقط بدون الوقت
    return allMembersData
      .filter(m => {
        if (!m.expiryDate) return false
        const expiryDate = new Date(m.expiryDate)
        expiryDate.setHours(0, 0, 0, 0)
        // ✅ منتهي = تاريخ الانتهاء فات (سواء اتعطل يدوي أو لا)
        if (!(expiryDate < today)) return false
        // 🔒 لو سيلز → بيشوف أعضاءه اللي assigned ليه بس
        if (user?.isSales) {
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
  }, [allMembersData, user, permissionsLoading])

  // ✅ حساب الأعضاء اللي اشتراكهم قرب ينتهي (حسب عدد الأيام المحدد)
  const expiringMembers = useMemo(() => {
    if (permissionsLoading) return []
    const today = new Date()
    today.setHours(0, 0, 0, 0) // مقارنة بالتاريخ فقط
    const futureDate = new Date(today)
    futureDate.setDate(futureDate.getDate() + expiringDays)

    return allMembersData
      .filter(m => {
        if (!m.expiryDate || !m.isActive) return false
        const expiryDate = new Date(m.expiryDate)
        expiryDate.setHours(0, 0, 0, 0)
        // الأعضاء النشطين اللي اشتراكهم هينتهي في خلال الأيام المحددة
        if (!(expiryDate >= today && expiryDate <= futureDate)) return false
        // 🔒 لو سيلز → بيشوف أعضاءه اللي assigned ليه بس
        if (user?.isSales) {
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
  }, [allMembersData, expiringDays, user, permissionsLoading])

  // ✅ تحسين الأداء: تنظيف رقم التليفون (memoized)
  const normalizePhone = useCallback((phone: string) => {
    if (!phone) return ''
    let normalized = phone.replace(/[\s\-\(\)\+]/g, '').trim()
    if (normalized.startsWith('2')) normalized = normalized.substring(1)
    if (normalized.startsWith('0')) normalized = normalized.substring(1)
    return normalized
  }, [])

  // ✅ دمج المتابعات الحقيقية مع الأعضاء المنتهيين + الأعضاء القريبين من الانتهاء + Day Use + Invitations
  // ملاحظة: فلترة السيلز تتم في النهاية على الـ merged list (real + ephemeral) بشكل موحّد
  const allFollowUps = useMemo(() => {
    // ✅ Set من أرقام الأعضاء (نشطين + منتهيين) — لإزالة الزوار الذين أصبحوا أعضاء
    const memberPhones = new Set<string>()
    allMembersData.forEach((m: Member) => {
      if (m.phone) memberPhones.add(normalizePhone(m.phone))
    })

    // ✅ فلترة المتابعات الحقيقية - إزالة متابعات الزوار الذين أصبحوا أعضاء
    // + عرض أحدث متابعة فقط لكل زائر (الباقي موجود في الداتابيز ويظهر في السجل)
    const latestByVisitor = new Map<string, any>()
    followUps.forEach(fu => {
      // ✅ متابعات "مشترك" (subscribed) تظهر دايمًا — حتى لو مؤرشفة أو صاحبها أصبح عضو
      if (fu.archived && fu.result !== 'subscribed') return
      // ✅ متابعات الأعضاء المنتهيين/القريبين من الانتهاء تظهر دايمًا — لأنها نُشئت للعضو مباشرة
      const isMemberDirectFollow = ['expiring-member', 'expired-member'].includes(fu.visitor?.source || '')
      if (fu.visitor?.phone && memberPhones.has(normalizePhone(fu.visitor.phone)) && fu.result !== 'subscribed' && !isMemberDirectFollow) return
      const phone = fu.visitor?.phone ? normalizePhone(fu.visitor.phone) : fu.id
      const existing = latestByVisitor.get(phone)
      if (!existing || new Date(fu.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        latestByVisitor.set(phone, fu)
      }
    })
    const visibleFollowUps = Array.from(latestByVisitor.values())

    // ✅ إنشاء Set من أرقام المتابعات الحقيقية النشطة لتجنب التكرار
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
          source: 'invitation', // 🎁 استخدام يوم
          status: 'pending'
        },
        // ✅ تمرير salesStaffId من سجل الـ DayUseInBody إن وُجد
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
          source: 'member-invitation', // 👥 دعوة من عضو
          status: 'pending'
        },
        // ✅ ورّث salesStaffId من العضو الداعي إن أُرسل من الـ API
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

    // 🔒 لو سيلز → فلترة موحّدة (real + ephemeral) — staffId only
    // الاستثناء الوحيد: الدعوات غير المسنَّدة (member-invitation بدون assignedTo) تظهر للجميع
    if (!permissionsLoading && user?.isSales && user?.staffId) {
      return merged.filter(fu => {
        if (fu.assignedTo === user.staffId) return true
        if (fu.visitor?.source === 'member-invitation' && !fu.assignedTo) return true
        return false
      })
    }

    return merged
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUps, expiredMembers, expiringMembers, dayUseRecords, sortedInvitations, visitors, normalizePhone, user, permissionsLoading])

  // ✅ أرشفة تلقائية للمتابعات بتاعت الزوار اللي اشتركوا كأعضاء
  const cleanupSignatureRef = useRef<string>('')
  useEffect(() => {
    if (loadingFollowUps || !allMembersData?.length) return

    const memberPhones = new Set<string>()
    allMembersData.forEach((m: Member) => {
      if (m.phone) memberPhones.add(normalizePhone(m.phone))
    })

    // لقي متابعات نشطة لزوار أصبحوا أعضاء — مع الإبقاء على:
    // - متابعات "مشترك" (تاريخ التحويل)
    // - متابعات الأعضاء المنتهيين/القريبين من الانتهاء (نُشئت للعضو مباشرة)
    const idsToArchive = followUps
      .filter(fu => {
        if (fu.archived) return false
        if (fu.result === 'subscribed') return false
        if (['expiring-member', 'expired-member'].includes(fu.visitor?.source || '')) return false
        return fu.visitor?.phone && memberPhones.has(normalizePhone(fu.visitor.phone))
      })
      .map(fu => fu.id)

    if (idsToArchive.length === 0) return

    const signature = idsToArchive.sort().join(',')
    if (cleanupSignatureRef.current === signature) return

    fetch('/api/followups/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followUpIds: idsToArchive, action: 'archive', data: { archivedReason: 'converted' } })
    })
      .then(r => r.json())
      .then(() => {
        cleanupSignatureRef.current = signature
        queryClient.invalidateQueries({ queryKey: ['followups'] })
      })
      .catch(() => {})
  }, [followUps, allMembersData, loadingFollowUps, normalizePhone, queryClient])

  // ✅ إعادة فتح المتابعات المأرشفة لما عضو يقرب ينتهي أو ينتهي
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

    // ✅ تجنب إرسال نفس الـ request لو الأرقام لم تتغير
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
      // ✅ البحث عن بيانات الزائر/العضو للإرسال إلى الـ API
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
        // ✅ Invalidate جميع الـ queries لتجنب التكرار
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

  // ✅ تحسين أداء كبير: إنشاء Set من أرقام الأعضاء النشطين مرة واحدة
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

  // 💬 فتح modal القوالب
  const openTemplateModal = useCallback((visitor: Visitor) => {
    setSelectedVisitorForTemplate(visitor)
    setShowTemplateModal(true)
  }, [])

  // 📤 إرسال رسالة من قالب
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
          toast.success(locale === 'ar' ? '✅ تم إرسال الرسالة بنجاح على الواتساب' : '✅ Message sent successfully via WhatsApp')
          setShowTemplateModal(false)

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
              toast.success(locale === 'ar' ? '✅ تم تحديث حالة المتابعة تلقائياً' : '✅ Follow-up status updated automatically')
            }
          } catch (error) {
            console.error('Error updating follow-up:', error)
          }
        } else {
          toast.error(`❌ ${locale === 'ar' ? 'فشل إرسال الرسالة' : 'Failed to send message'}: ${sendResult.error}`)
        }
        return
      }

      // Fallback: الواتساب غير متصل
      toast.warning(locale === 'ar' ? '⚠️ الواتساب غير متصل. جاري فتح واتساب ويب...' : '⚠️ WhatsApp not connected. Opening WhatsApp Web...')
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

  // 🗑️ حذف دعوة
  const handleDeleteInvitation = useCallback((invitationId: string, name: string) => {
    const originalId = invitationId.replace('invitation-', '')
    setDeleteTarget({ id: originalId, name, type: 'invitation' })
    setShowDeleteConfirm(true)
  }, [])

  // 🗑️ حذف متابعة
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

  // 🗑️ حذف زائر نهائياً
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

  // ✏️ تعديل زائر أو دعوة
  const handleEditFollowUp = useCallback((followUp: any) => {
    const isInvitation = followUp.id.startsWith('invitation-')
    const originalId = isInvitation ? followUp.id.replace('invitation-', '') : followUp.visitor.id
    setEditTarget({
      id: followUp.id,
      name: followUp.visitor.name,
      phone: followUp.visitor.phone,
      type: isInvitation ? 'invitation' : 'visitor',
      originalId
    })
    setShowEditModal(true)
  }, [])

  const confirmEdit = useCallback(async () => {
    if (!editTarget) return
    const trimmedName = editTarget.name.trim()
    const trimmedPhone = editTarget.phone.trim()
    if (!trimmedName) {
      toast.error(locale === 'ar' ? 'الاسم مطلوب' : 'Name is required')
      return
    }
    // ✅ تحقق من رقم الهاتف: أرقام فقط، 10-15 رقم
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
        const res = await fetch('/api/visitors', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editTarget.originalId, name: trimmedName, phone: trimmedPhone })
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

  // ✅ فتح نموذج الاشتراك السريع
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

  // ✅ خريطة آخر كومنت لكل زائر (للعرض في الصفحة الرئيسية)
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

  // ✅ تحسين أداء: استخدام Set lookup بدلاً من find - O(1) بدلاً من O(n)
  const isVisitorAMember = useCallback((phone: string) => {
    const normalizedVisitorPhone = normalizePhone(phone)
    return activeMemberPhones.has(normalizedVisitorPhone)
  }, [activeMemberPhones, normalizePhone])

  // ✅ تحسين الأداء: حساب أولوية المتابعة (memoized)
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

  // ✅ هل المتابعة دي بتاعة اليوزر الحالي؟
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

        // 🔒 ملاحظة: فلترة السيلز للـ "متابعاتي بس" تتم في allFollowUps الآن (مرة واحدة)

        // ✅ فلتر السيلز (متابعاتي، المتأخرة بتاعتي، النهاردة)
        let matchesSales = true
        if (salesFilter === 'my-followups') {
          matchesSales = isMyFollowUp(fu)
        } else if (salesFilter === 'my-overdue') {
          matchesSales = isMyFollowUp(fu) && priority === 'overdue'
        } else if (salesFilter === 'today') {
          matchesSales = priority === 'today'
        }

        // ✅ فلترة حسب المصدر
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
          } else if (sourceFilter === 'visitors') {
            // زوار عاديين (walk-in, social-media, etc.)
            matchesSource = !['expired-member', 'expiring-member', 'member-invitation', 'invitation'].includes(fu.visitor.source)
          }
        }

        // ✅ فلتر موظف السيلز المحدد
        const matchesAssignedStaff = assignedStaffFilter === 'all'
          || (assignedStaffFilter === '__unassigned__' ? !fu.assignedTo : fu.assignedTo === assignedStaffFilter)

        return matchesSearch && matchesResult && matchesContacted && matchesPriority && matchesSource && matchesSales && matchesAssignedStaff
      })
      .sort((a, b) => {
        if (sortByPriority) {
          // ✅ ترتيب حسب الأولوية ثم الأحدث أولاً
          const aPriority = getFollowUpPriority(a)
          const bPriority = getFollowUpPriority(b)

          // ترتيب: overdue > today > upcoming > none
          const priorityOrder: {[key: string]: number} = { overdue: 0, today: 1, upcoming: 2, none: 3 }
          const priorityDiff = priorityOrder[aPriority] - priorityOrder[bPriority]
          if (priorityDiff !== 0) return priorityDiff
        }

        // ✅ ترتيب حسب تاريخ الإضافة: الأحدث أولاً
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [allFollowUps, debouncedSearchTerm, resultFilter, contactedFilter, priorityFilter, sourceFilter, salesFilter, assignedStaffFilter, sortByPriority, getFollowUpPriority, user, isMyFollowUp])

  // إعادة تعيين الصفحة للأولى عند تغيير الفلاتر
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, resultFilter, contactedFilter, priorityFilter, sourceFilter, salesFilter, assignedStaffFilter, sortByPriority])

  // حساب الصفحات
  const totalPages = Math.ceil(filteredFollowUps.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentFollowUps = filteredFollowUps.slice(startIndex, endIndex)

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // 📤 إرسال جماعي لجميع الأعضاء المفلترين
  const handleBulkSend = useCallback(async (template: MessageTemplate) => {
    // الحصول على القائمة المفلترة الحالية
    const targetVisitors = filteredFollowUps.map(fu => fu.visitor)

    const noTargetsMsg = locale === 'ar' ? 'لا يوجد أعضاء للإرسال إليهم' : 'No members to send to'
    const waNotConnectedMsg = locale === 'ar'
      ? '❌ الواتساب غير متصل. افتح الإعدادات → واتساب لمسح QR code'
      : '❌ WhatsApp is not connected. Open Settings → WhatsApp to scan the QR code'

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
          try {
            await fetch('/api/visitors/followups', {
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
          } catch (error) {
            console.error('Error updating follow-up:', error)
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
          ? `✅ تم إرسال ${successCount} رسالة بنجاح${failCount > 0 ? ` (فشل ${failCount})` : ''}`
          : `✅ Successfully sent ${successCount} messages${failCount > 0 ? ` (${failCount} failed)` : ''}`
      )
    } else {
      toast.error(locale === 'ar' ? '❌ فشل الإرسال لجميع الأرقام' : '❌ Failed to send to all numbers')
    }
  }, [filteredFollowUps, user, toast, queryClient, locale, t])

  // ✅ Smart Bulk Script - Daily counter & Last session
  const getDailyCount = useCallback((): number => {
    try {
      const data = JSON.parse(localStorage.getItem('wa-bulk-daily') || '{}')
      const today = new Date().toISOString().split('T')[0]
      return data.date === today ? (data.count || 0) : 0
    } catch { return 0 }
  }, [])

  const incrementDailyCount = useCallback((amount: number) => {
    const today = new Date().toISOString().split('T')[0]
    const current = getDailyCount()
    localStorage.setItem('wa-bulk-daily', JSON.stringify({ date: today, count: current + amount }))
  }, [getDailyCount])

  const getLastSession = useCallback((): { date: string, sent: number, filter: string } | null => {
    try {
      return JSON.parse(localStorage.getItem('wa-bulk-last-session') || 'null')
    } catch { return null }
  }, [])

  const saveLastSession = useCallback((sent: number, filter: string) => {
    localStorage.setItem('wa-bulk-last-session', JSON.stringify({
      // ✅ احفظ ISO عشان نقدر نعرضه بالـ locale الحالي وقت العرض
      date: new Date().toISOString(),
      sent,
      filter
    }))
  }, [])

  // ✅ Smart Bulk Script - Text variation (anti-ban)
  const addTextVariation = useCallback((text: string): string => {
    const variations = [
      () => text + ' ',
      () => text + '\u200B', // zero-width space
      () => text + '\u200C', // zero-width non-joiner
      () => text.replace(/\./g, (m, i) => Math.random() > 0.5 ? '.' : '..'),
      () => text + (Math.random() > 0.5 ? ' .' : ''),
      () => text.replace(/!/, () => Math.random() > 0.5 ? '!' : '!!'),
      () => text + '\n',
    ]
    const variation = variations[Math.floor(Math.random() * variations.length)]
    return variation()
  }, [])

  // ✅ Smart Bulk Script - Presets
  const getBulkPresets = useCallback((): { name: string, messages: string[] }[] => {
    try {
      return JSON.parse(localStorage.getItem('wa-bulk-presets') || '[]')
    } catch { return [] }
  }, [])

  const saveBulkPreset = useCallback((name: string, messages: string[]) => {
    const presets = getBulkPresets()
    const existing = presets.findIndex(p => p.name === name)
    if (existing >= 0) presets[existing].messages = messages
    else presets.push({ name, messages })
    localStorage.setItem('wa-bulk-presets', JSON.stringify(presets))
  }, [getBulkPresets])

  const deleteBulkPreset = useCallback((name: string) => {
    const presets = getBulkPresets().filter(p => p.name !== name)
    localStorage.setItem('wa-bulk-presets', JSON.stringify(presets))
  }, [getBulkPresets])

  // ✅ Smart Bulk Script - Get filtered targets
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

  // ✅ Fetch available WhatsApp sessions when modal opens
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

  // ✅ Smart Bulk Script - Test message
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
      if (result.success) toast.success(`✅ ${result.sessionUsed !== undefined ? t('followups.bulkScript.toast.testSuccessSession').replace('{n}', String(result.sessionUsed + 1)) : t('followups.bulkScript.toast.testSuccess')}`)
      else toast.error(`❌ ${t('followups.bulkScript.toast.testFail')} ${result.error || t('followups.bulkScript.unknownError')}`)
    } catch {
      toast.error(`❌ ${t('followups.bulkScript.toast.connectionFail')}`)
    }
  }, [bulkScriptTestPhone, bulkScriptMessages, user, toast, bulkScriptSessionIndex, t])

  // ✅ Smart Bulk Script - Main send function
  const handleBulkScriptStart = useCallback(async (retryTargets?: { visitor: any }[]) => {
    const validMessages = bulkScriptMessages.filter(m => m.trim())
    if (validMessages.length === 0) {
      toast.error(t('followups.bulkScript.toast.writeMessage'))
      return
    }

    // Daily limit check
    const dailySent = getDailyCount()
    const remaining = bulkScriptDailyLimit - dailySent
    if (remaining <= 0) {
      toast.error(`⚠️ ${t('followups.bulkScript.toast.dailyLimitReached').replace('{limit}', String(bulkScriptDailyLimit))}`)
      return
    }

    let targets = retryTargets || getBulkScriptTargets().map(t => ({ visitor: t.visitor }))
    if (targets.length === 0) {
      toast.error(t('followups.bulkScript.toast.noTargets'))
      return
    }

    // Limit targets to daily remaining
    if (targets.length > remaining) {
      targets = targets.slice(0, remaining)
      toast.warning(`⚠️ ${t('followups.bulkScript.toast.limitedSend').replace('{count}', String(remaining))}`)
    }

    // Check WhatsApp & get connected sessions for round-robin
    let connectedSessionIndices: number[] = []
    try {
      const sessionsRes = await fetch('/api/whatsapp/sessions')
      if (sessionsRes.ok) {
        const sessions = await sessionsRes.json() as { sessionIndex: number; isReady: boolean }[]
        connectedSessionIndices = sessions.filter((s: any) => s.isReady).map((s: any) => s.sessionIndex)
      }
      if (connectedSessionIndices.length === 0) {
        toast.error(`❌ ${t('followups.bulkScript.toast.whatsappNotConnected')}`)
        return
      }
    } catch {
      toast.error(`❌ ${t('followups.bulkScript.toast.whatsappNotConnected')}`)
      return
    }

    // Fisher-Yates shuffle
    const shuffled = [...targets]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    setShowBulkScriptModal(false)
    setBulkScriptRunning(true)
    setBulkScriptPaused(false)
    bulkScriptPausedRef.current = false
    bulkScriptAbortedRef.current = false
    setBulkScriptReport(null)
    setBulkScriptProgress({ current: 0, total: shuffled.length, currentName: '', currentMsgIndex: 0, successCount: 0, failCount: 0, countdown: 0 })

    const successList: { name: string, phone: string }[] = []
    const failedList: { name: string, phone: string, error: string }[] = []

    for (let i = 0; i < shuffled.length; i++) {
      // Check abort
      if (bulkScriptAbortedRef.current) break

      // Check pause
      while (bulkScriptPausedRef.current && !bulkScriptAbortedRef.current) {
        await new Promise(r => setTimeout(r, 500))
      }
      if (bulkScriptAbortedRef.current) break

      // ✅ Batch break - every N messages, take a longer break
      if (i > 0 && i % bulkScriptBatchSize === 0 && !bulkScriptAbortedRef.current) {
        const batchBreak = Math.floor(Math.random() * (bulkScriptBatchBreakMax - bulkScriptBatchBreakMin + 1)) + bulkScriptBatchBreakMin
        setBulkScriptProgress(prev => ({ ...prev, currentName: `⏸️ ${t('followups.bulkScript.batchBreakMsg').replace('{minutes}', String(Math.ceil(batchBreak / 60)))}`, countdown: batchBreak }))
        for (let s = batchBreak; s > 0; s--) {
          if (bulkScriptAbortedRef.current) break
          while (bulkScriptPausedRef.current && !bulkScriptAbortedRef.current) {
            await new Promise(r => setTimeout(r, 500))
          }
          if (bulkScriptAbortedRef.current) break
          setBulkScriptProgress(prev => ({ ...prev, countdown: s }))
          await new Promise(r => setTimeout(r, 1000))
        }
      }

      if (bulkScriptAbortedRef.current) break

      const visitor = shuffled[i].visitor
      const msgIndex = Math.floor(Math.random() * validMessages.length)

      setBulkScriptProgress(prev => ({ ...prev, current: i + 1, currentName: visitor.name, currentMsgIndex: msgIndex + 1, successCount: successList.length, failCount: failedList.length, countdown: 0 }))

      try {
        // ✅ Apply text variation for anti-ban
        let message = validMessages[msgIndex]
          .replace(/\{name\}/g, visitor.name)
          .replace(/\{salesName\}/g, user?.name || t('followups.bulkScript.defaultSalesName'))
          .replace(/\{phone\}/g, visitor.phone)
          .replace(/\{date\}/g, new Date().toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US'))
          .replace(/\{time\}/g, new Date().toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }))
        message = addTextVariation(message)

        const sendBody: any = { phone: visitor.phone, message }
        if (bulkScriptSessionIndex !== 'auto') {
          sendBody.sessionIndex = bulkScriptSessionIndex
        } else if (connectedSessionIndices.length > 0) {
          // Round-robin: distribute messages across connected sessions
          sendBody.sessionIndex = connectedSessionIndices[i % connectedSessionIndices.length]
        }
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sendBody)
        })
        const result = await res.json()

        if (result.success) {
          successList.push({ name: visitor.name, phone: visitor.phone })
          incrementDailyCount(1)
          // Update followup
          try {
            await fetch('/api/visitors/followups', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                visitorId: visitor.id,
                notes: t('followups.bulkScript.scriptFollowupNote'),
                contacted: true,
                salesName: user?.name,
                visitorData: { name: visitor.name, phone: visitor.phone, source: visitor.source }
              }),
            })
          } catch {}
        } else {
          failedList.push({ name: visitor.name, phone: visitor.phone, error: result.error || t('followups.bulkScript.unknownError') })
        }
      } catch (error: any) {
        failedList.push({ name: visitor.name, phone: visitor.phone, error: error.message || t('followups.bulkScript.connectionError') })
      }

      // Random delay (except last)
      if (i < shuffled.length - 1 && !bulkScriptAbortedRef.current) {
        const delay = Math.floor(Math.random() * (bulkScriptDelayMax - bulkScriptDelayMin + 1)) + bulkScriptDelayMin
        for (let s = delay; s > 0; s--) {
          if (bulkScriptAbortedRef.current) break
          while (bulkScriptPausedRef.current && !bulkScriptAbortedRef.current) {
            await new Promise(r => setTimeout(r, 500))
          }
          if (bulkScriptAbortedRef.current) break
          setBulkScriptProgress(prev => ({ ...prev, countdown: s, successCount: successList.length, failCount: failedList.length }))
          await new Promise(r => setTimeout(r, 1000))
        }
      }
    }

    // Done - Save session info
    saveLastSession(successList.length, sourceFilter)
    setBulkScriptRunning(false)
    setBulkScriptProgress(prev => ({ ...prev, countdown: 0, successCount: successList.length, failCount: failedList.length }))
    setBulkScriptReport({ success: successList, failed: failedList })
    await queryClient.invalidateQueries({ queryKey: ['followups'] })
    await queryClient.invalidateQueries({ queryKey: ['visitors-followups'] })
  }, [bulkScriptMessages, getBulkScriptTargets, bulkScriptDelayMin, bulkScriptDelayMax, bulkScriptDailyLimit, bulkScriptBatchSize, bulkScriptBatchBreakMin, bulkScriptBatchBreakMax, user, toast, queryClient, getDailyCount, incrementDailyCount, addTextVariation, saveLastSession, sourceFilter, t, bulkScriptSessionIndex])

  const getResultBadge = useCallback((result?: string) => {
    const badges = {
      interested: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'not-interested': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      postponed: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      subscribed: 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200',
    }
    const labels: Record<string, string> = {
      interested: t('followups.results.interested'),
      'not-interested': t('followups.results.notInterested'),
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
      'invitation': t('followups.sources.invitation'),
      'member-invitation': t('followups.sources.memberInvitation'),
      'expired-member': t('followups.sources.expiredMember'),
      'expiring-member': t('followups.sources.expiringMember'),
      'facebook': t('followups.sources.facebook'),
      'instagram': t('followups.sources.instagram'),
      'friend': t('followups.sources.friend'),
      'other': t('followups.sources.other'),
    }
    return labels[source] || source
  }, [t])

  const getPriorityBadge = useCallback((followUp: FollowUp) => {
    const priority = getFollowUpPriority(followUp)

    if (priority === 'overdue') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          🔥 {t('followups.priority.overdue')}
        </span>
      )
    }
    if (priority === 'today') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
          ⚡ {t('followups.priority.today')}
        </span>
      )
    }
    if (priority === 'upcoming') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
          📅 {t('followups.priority.upcoming')}
        </span>
      )
    }
    return null
  }, [getFollowUpPriority, t])

  // ✅ counters للـ quick filter buttons — تتحدّث ديناميكياً مع باقي الفلاتر
  //    (source, priority, search, result, assignedStaff) — لكن مش بتفلتر بـ contacted نفسه
  //    عشان لما المستخدم يختار "اعضاء منتهين" يشوف عددهم في "تم التواصل" / "لم يتم التواصل"
  const quickFilterCounts = useMemo(() => {
    let myFollowUps = 0
    let todayCount = 0
    let notContacted = 0
    let contacted = 0
    const isSales = !!user?.isSales

    // فلتر مرة على كل المتابعات لتطبيق الفلاتر الأخرى (ما عدا contacted)
    const searchNormalized = normalizeArabic(debouncedSearchTerm)

    for (const fu of allFollowUps) {
      const mine = isMyFollowUp(fu)
      if (mine) myFollowUps++

      const visibleForUser = !isSales || mine
      if (!visibleForUser) continue

      // 🔍 search
      if (debouncedSearchTerm) {
        const ok =
          normalizeArabic(fu.visitor.name).includes(searchNormalized) ||
          fu.visitor.phone.includes(debouncedSearchTerm) ||
          normalizeArabic(fu.notes).includes(searchNormalized) ||
          (fu.salesName && normalizeArabic(fu.salesName).includes(searchNormalized))
        if (!ok) continue
      }

      // 📊 result
      if (resultFilter !== 'all' && fu.result !== resultFilter) continue

      // 🎯 priority
      const priority = getFollowUpPriority(fu)
      if (priorityFilter !== 'all' && priority !== priorityFilter) continue

      // 🧑‍💼 sales filter
      if (salesFilter === 'my-followups' && !isMyFollowUp(fu)) continue
      if (salesFilter === 'my-overdue' && (!isMyFollowUp(fu) || priority !== 'overdue')) continue
      if (salesFilter === 'today' && priority !== 'today') continue

      // 👤 assigned staff
      if (assignedStaffFilter !== 'all') {
        if (assignedStaffFilter === '__unassigned__') {
          if (fu.assignedTo) continue
        } else if (fu.assignedTo !== assignedStaffFilter) {
          continue
        }
      }

      // 🏷️ source
      if (sourceFilter !== 'all') {
        const src = fu.visitor.source
        if (sourceFilter === 'expired-member' && src !== 'expired-member') continue
        else if (sourceFilter === 'expiring-member' && src !== 'expiring-member') continue
        else if (sourceFilter === 'member-invitation' && src !== 'member-invitation') continue
        else if (sourceFilter === 'dayuse' && src !== 'invitation') continue
        else if (sourceFilter === 'visitors' && ['expired-member', 'expiring-member', 'member-invitation', 'invitation'].includes(src)) continue
      }

      if (priority === 'today') todayCount++
      if (fu.contacted) contacted++
      else notContacted++
    }
    return { myFollowUps, todayCount, notContacted, contacted }
  }, [allFollowUps, isMyFollowUp, getFollowUpPriority, user?.isSales, debouncedSearchTerm, resultFilter, priorityFilter, salesFilter, assignedStaffFilter, sourceFilter])

  // ✅ قائمة مفلترة بكل الفلاتر **ما عدا** فلتر المصدر (Source) — تُستخدم لحساب أرقام أزرار المصدر
  // عشان لما المستخدم يختار priority/contacted/search، الأرقام في أزرار المصدر تتحدّث برضو
  const followUpsFilteredExceptSource = useMemo(() => {
    return allFollowUps.filter(fu => {
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

      return matchesSearch && matchesResult && matchesContacted && matchesPriority && matchesSales && matchesAssignedStaff
    })
  }, [allFollowUps, debouncedSearchTerm, resultFilter, contactedFilter, priorityFilter, salesFilter, assignedStaffFilter, getFollowUpPriority, isMyFollowUp])

  // Stats - memoized لتجنب إعادة الحساب في كل render
  // الأرقام تتحدّث ديناميكياً مع باقي الفلاتر
  const stats = useMemo(() => {
    const todayStr = new Date().toDateString()
    const base = followUpsFilteredExceptSource
    return {
      total: base.length,
      today: base.filter(fu => getFollowUpPriority(fu) === 'today').length,
      overdue: base.filter(fu => getFollowUpPriority(fu) === 'overdue').length,
      contactedToday: followUps.filter(fu =>
        fu.contacted && new Date(fu.updatedAt || fu.createdAt).toDateString() === todayStr
      ).length,
      // ✅ counts تحترم الفلاتر الأخرى (priority, contacted, search, إلخ)
      expiredMembers: base.filter(fu => fu.visitor.source === 'expired-member').length,
      expiringMembers: base.filter(fu => fu.visitor.source === 'expiring-member').length,
      dayUse: base.filter(fu => fu.visitor.source === 'invitation').length,
      invitations: base.filter(fu => fu.visitor.source === 'member-invitation').length,
      visitors: base.filter(fu => !['expired-member', 'expiring-member', 'member-invitation', 'invitation'].includes(fu.visitor.source)).length,
      convertedToMembers: followUps.filter(fu => isVisitorAMember(fu.visitor.phone)).length,
    }
  }, [followUpsFilteredExceptSource, followUps, isVisitorAMember, getFollowUpPriority])

  // 🎂 أعضاء عيد ميلادهم اليوم — للنشطين فقط
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

  // ✅ قائمة المتحولين لأعضاء - مبسط ومحسّن: أي شخص رقمه موجود في الأعضاء النشطين
  // يشمل: زوار، دعوات، أعضاء منتهيين، أعضاء قريبين من الانتهاء - كلهم بنفس المنطق
  // ✅ dedupe بالـ normalized phone عشان منكررش نفس الشخص
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

  // 📊 إحصائيات فردية لكل سيلز
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
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">{t('followups.loading')}</div>
      </div>
    )
  }

  if (!hasPermission('canViewFollowUps')) {
    return <PermissionDenied message={t('followups.permissionDenied')} />
  }

  return (
    <div className="container mx-auto px-4 py-6 md:px-6" dir={direction}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <span>📝</span>
              <span>{t('followups.title')}</span>
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm sm:text-base">{t('followups.subtitle')}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {stats.expiringMembers > 0 && (
              <button
                onClick={() => setShowExpiringPopup(true)}
                className="w-full sm:w-auto bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-3 rounded-lg font-semibold shadow-lg flex items-center justify-center gap-2"
              >
                ⏰ {locale === 'ar' ? `قرب ينتهي (${stats.expiringMembers})` : `Expiring (${stats.expiringMembers})`}
              </button>
            )}
          </div>
        </div>

        {/* Expiring Days Popup */}
        {showExpiringPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowExpiringPopup(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm border-2 border-yellow-300 dark:border-yellow-600"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setShowExpiringPopup(false)}
                className="absolute top-3 end-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
              >✕</button>
              <h3 className="font-bold text-lg text-yellow-800 dark:text-yellow-200 mb-4 flex items-center gap-2">
                ⏰ {locale === 'ar' ? 'عرض الأعضاء اللي اشتراكهم هينتهي خلال:' : 'Show members expiring within:'}
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
                  className="px-4 py-2 border-2 border-yellow-400 dark:border-yellow-600 dark:bg-gray-700 dark:text-white rounded-lg font-bold text-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 w-24"
                />
                <span className="font-bold text-yellow-900 dark:text-yellow-100">{t('followups.days')}</span>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-xl p-4 text-center">
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-1">{t('followups.stats.membersCount')}</p>
                <p className="text-5xl font-bold text-yellow-900 dark:text-yellow-100">{stats.expiringMembers}</p>
              </div>
            </div>
          </div>
        )}

        {/* View Mode Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200'
            }`}
          >
            📋 {t('followups.viewModes.list')}
          </button>
          {!user?.isSales && (
          <button
            onClick={() => setViewMode('analytics')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'analytics'
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200'
            }`}
          >
            📈 {t('followups.viewModes.analytics')}
          </button>
          )}
          <button
            onClick={() => setViewMode('collection')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'collection'
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200'
            }`}
          >
            💰 {locale === 'ar' ? (user?.isSales ? 'عمولتي' : 'التحصيل') : (user?.isSales ? 'My Commission' : 'Collection')}
          </button>

          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'calendar'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200'
            }`}
          >
            📅 {locale === 'ar' ? 'الكاليندر' : 'Calendar'}
          </button>

          {/* إدارة السيلز — للأدمن والأونر أو من له صلاحية إدارة الموظفين */}
          {canManageSales && (
            <button
              onClick={() => setViewMode('sales-mgmt')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'sales-mgmt'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200'
              }`}
            >
              ⚙️ {locale === 'ar' ? 'إدارة السيلز' : 'Sales Mgmt'}
            </button>
          )}
        </div>

        {/* 🎂 أعضاء عيد ميلادهم اليوم */}
        {birthdayMembers.length > 0 && (
          <div className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 border-2 border-pink-300 dark:border-pink-600 rounded-xl p-3 sm:p-4 mb-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
            <h3 className="font-bold text-pink-900 dark:text-pink-100 mb-3 flex items-center gap-2 text-sm sm:text-base">
              <span className="text-xl">🎂</span>
              <span>{direction === 'rtl' ? 'أعياد ميلاد اليوم' : "Today's Birthdays"}</span>
              <span className="bg-pink-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">{birthdayMembers.length}</span>
            </h3>
            <div className="flex flex-wrap gap-3">
              {birthdayMembers.map(m => (
                <a
                  key={m.id}
                  href={createWhatsAppUrl(m.phone, `🎂 كل سنة وانت طيب ${m.name}! 🎉`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white dark:bg-gray-800 border-2 border-pink-300 dark:border-pink-600 rounded-xl px-3 py-2 hover:shadow-md transition-all hover:scale-105"
                >
                  <div className="w-9 h-9 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {m.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">{m.name}</p>
                    <p className="text-xs text-pink-600 dark:text-pink-400 font-semibold">
                      🎉 {direction === 'rtl' ? `${m.age} سنة` : `${m.age} years old`}
                    </p>
                  </div>
                  <span className="text-green-500 text-base mr-1">💬</span>
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4 animate-pulse">📤</div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                {t('followups.bulkScript.bulkSending')}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {bulkProgress.current} / {bulkProgress.total}
              </p>
              {bulkProgress.currentName && (
                <p className="text-sm text-primary-600 dark:text-primary-400 mt-2">
                  📱 {t('followups.bulkScript.sendingToLabel')} <span className="font-bold">{bulkProgress.currentName}</span>
                </p>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500 ease-out flex items-center justify-center text-xs font-bold text-white"
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                >
                  {Math.round((bulkProgress.current / bulkProgress.total) * 100)}%
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800 dark:text-blue-300 text-center">
                ⏰ {t('followups.bulkScript.waitBetween')}
              </p>
            </div>

            {/* Abort Button */}
            <button
              onClick={() => {
                bulkSendAbortedRef.current = true
              }}
              className="w-full bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-bold"
            >
              🛑 {t('followups.bulkScript.stopSending')}
            </button>
          </div>
        </div>
      )}

      {/* ✅ Smart Bulk Script - Setup Modal */}
      {showBulkScriptModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowBulkScriptModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-5 rounded-t-2xl">
              <h2 className="text-xl font-bold flex items-center gap-2">🤖 {t('followups.bulkScript.title')}</h2>
              <p className="text-sm opacity-90 mt-1">{t('followups.bulkScript.subtitle')}</p>
            </div>

            <div className="p-5 space-y-5">
              {/* Last Session Banner */}
              {(() => {
                const lastSession = getLastSession()
                const dailySent = getDailyCount()
                if (!lastSession && dailySent === 0) return null
                return (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-1">
                    {lastSession && (
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        📋 {t('followups.bulkScript.lastSend')} <span className="font-bold">{(() => {
                          // ✅ ندعم القيم القديمة (string format) والجديدة (ISO)
                          const d = new Date(lastSession.date)
                          return isNaN(d.getTime())
                            ? lastSession.date
                            : d.toLocaleString(direction === 'rtl' ? 'ar-EG' : 'en-US')
                        })()}</span> — {t('followups.bulkScript.sentCount')} <span className="font-bold">{lastSession.sent}</span> {t('followups.bulkScript.message')}
                      </p>
                    )}
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      📊 {t('followups.bulkScript.sentToday')} <span className="font-bold">{dailySent}</span> / <span className="font-bold">{bulkScriptDailyLimit}</span> — {t('followups.bulkScript.remaining')} <span className="font-bold text-green-600 dark:text-green-400">{Math.max(0, bulkScriptDailyLimit - dailySent)}</span> {t('followups.bulkScript.message')}
                    </p>
                  </div>
                )
              })()}

              {/* WhatsApp Session Picker */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">📱 {t('followups.bulkScript.sendFrom')}</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setBulkScriptSessionIndex('auto')}
                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-all border-2 ${
                      bulkScriptSessionIndex === 'auto'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-400'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    🔄 {t('followups.bulkScript.auto')}
                  </button>
                  {availableWaSessions.map((sess) => (
                    <button
                      key={sess.sessionIndex}
                      onClick={() => setBulkScriptSessionIndex(sess.sessionIndex)}
                      disabled={!sess.isReady}
                      className={`px-3 py-2 rounded-lg text-sm font-bold transition-all border-2 ${
                        bulkScriptSessionIndex === sess.sessionIndex
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-400'
                          : sess.isReady
                            ? 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-green-300'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {sess.isReady ? '✅' : '⭕'} {t('followups.bulkScript.numberLabel')} {sess.sessionIndex + 1}
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
                    { value: 'not-contacted' as const, label: t('followups.bulkScript.notContacted'), icon: '🆕' },
                    { value: 'contacted' as const, label: t('followups.bulkScript.contacted'), icon: '📞' },
                    { value: 'all' as const, label: t('followups.bulkScript.everyone'), icon: '👥' },
                  ] as const).map(opt => {
                    const count = opt.value === 'all' ? filteredFollowUps.length
                      : opt.value === 'contacted' ? filteredFollowUps.filter(f => f.contacted).length
                      : filteredFollowUps.filter(f => !f.contacted).length
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setBulkScriptContactFilter(opt.value)}
                        className={`p-3 rounded-lg text-center transition-all text-sm font-medium border-2 ${
                          bulkScriptContactFilter === opt.value
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                            : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                        }`}
                      >
                        <div className="text-lg">{opt.icon}</div>
                        <div className="mt-1">{opt.label}</div>
                        <div className="text-xs font-bold text-purple-600 dark:text-purple-400 mt-1">{count}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* C. Skip Days */}
              {bulkScriptContactFilter !== 'not-contacted' && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-yellow-800 dark:text-yellow-300">
                    ⏭️ {t('followups.bulkScript.skipRecentLabel')}
                    <input
                      type="number"
                      min={0}
                      value={bulkScriptSkipDays}
                      onChange={e => setBulkScriptSkipDays(parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-1 rounded border border-yellow-300 dark:border-yellow-700 bg-white dark:bg-gray-700 text-center font-bold"
                    />
                    {t('followups.bulkScript.day')}
                  </label>
                </div>
              )}

              {/* D. Messages */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('followups.bulkScript.messages')} ({bulkScriptMessages.length})</label>
                  {bulkScriptMessages.length < 10 && (
                    <button
                      onClick={() => setBulkScriptMessages([...bulkScriptMessages, ''])}
                      className="text-xs px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg font-bold hover:bg-purple-200"
                    >
                      + {t('followups.bulkScript.addMessage')}
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
                            className="text-xs text-red-500 hover:text-red-700 font-bold"
                          >
                            ✕ {t('followups.bulkScript.deleteMessage')}
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
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder={t('followups.bulkScript.messagePlaceholder').replace('{n}', String(idx + 1))}
                        dir={direction}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  💡 {t('followups.bulkScript.availableVariables')} <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{name}'}</code> <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{salesName}'}</code> <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{date}'}</code> <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{time}'}</code> <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{phone}'}</code>
                </p>
              </div>

              {/* E. Presets */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={bulkScriptPresetName}
                    onChange={e => setBulkScriptPresetName(e.target.value)}
                    placeholder={t('followups.bulkScript.presetNamePlaceholder')}
                    className="flex-1 min-w-[120px] px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  />
                  <button
                    onClick={() => {
                      if (!bulkScriptPresetName.trim()) { toast.error(t('followups.bulkScript.toast.presetNameRequired')); return }
                      saveBulkPreset(bulkScriptPresetName.trim(), bulkScriptMessages)
                      toast.success(`✅ ${t('followups.bulkScript.toast.presetSaved')}`)
                      setBulkScriptPresetName('')
                    }}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700"
                  >
                    💾 {t('followups.bulkScript.savePreset')}
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
                      className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                      defaultValue=""
                    >
                      <option value="" disabled>📂 {t('followups.bulkScript.loadPreset')}</option>
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
                      className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-600 bg-white dark:bg-gray-700 text-sm text-red-600"
                      defaultValue=""
                    >
                      <option value="" disabled>🗑️ {t('followups.bulkScript.deletePreset')}</option>
                      {getBulkPresets().map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* F. Delay */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">⏰ {t('followups.bulkScript.randomDelay')}</label>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">{t('followups.bulkScript.from')}</span>
                  <input
                    type="number"
                    min={5}
                    value={bulkScriptDelayMin}
                    onChange={e => setBulkScriptDelayMin(Math.max(5, parseInt(e.target.value) || 5))}
                    className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-center font-bold"
                  />
                  <span className="text-sm text-gray-500">{t('followups.bulkScript.to')}</span>
                  <input
                    type="number"
                    min={bulkScriptDelayMin}
                    value={bulkScriptDelayMax}
                    onChange={e => setBulkScriptDelayMax(Math.max(bulkScriptDelayMin, parseInt(e.target.value) || bulkScriptDelayMin))}
                    className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-center font-bold"
                  />
                  <span className="text-sm text-gray-500">{t('followups.bulkScript.seconds')}</span>
                </div>
              </div>

              {/* F2. Batch Break */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">☕ {t('followups.bulkScript.batchBreak')}</label>
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="text-gray-500">{t('followups.bulkScript.every')}</span>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={bulkScriptBatchSize}
                    onChange={e => setBulkScriptBatchSize(Math.max(5, parseInt(e.target.value) || 12))}
                    className="w-16 px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-center font-bold"
                  />
                  <span className="text-gray-500">{t('followups.bulkScript.messagesBreak')}</span>
                  <input
                    type="number"
                    min={1}
                    value={Math.round(bulkScriptBatchBreakMin / 60)}
                    onChange={e => setBulkScriptBatchBreakMin(Math.max(60, (parseInt(e.target.value) || 2) * 60))}
                    className="w-14 px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-center font-bold"
                  />
                  <span className="text-gray-500">{t('followups.bulkScript.to')}</span>
                  <input
                    type="number"
                    min={Math.round(bulkScriptBatchBreakMin / 60)}
                    value={Math.round(bulkScriptBatchBreakMax / 60)}
                    onChange={e => setBulkScriptBatchBreakMax(Math.max(bulkScriptBatchBreakMin, (parseInt(e.target.value) || 5) * 60))}
                    className="w-14 px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-center font-bold"
                  />
                  <span className="text-gray-500">{t('followups.bulkScript.minutes')}</span>
                </div>
              </div>

              {/* F3. Daily Limit */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">🛡️ {t('followups.bulkScript.dailyLimit')}</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">{t('followups.bulkScript.max')}</span>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={bulkScriptDailyLimit}
                    onChange={e => setBulkScriptDailyLimit(Math.max(10, parseInt(e.target.value) || 80))}
                    className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-center font-bold"
                  />
                  <span className="text-sm text-gray-500">{t('followups.bulkScript.messagesPerDay')}</span>
                  <span className="text-xs text-gray-400 ms-2">({t('followups.bulkScript.sentToday')} {getDailyCount()})</span>
                </div>
              </div>

              {/* G. Test Message */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <label className="block text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">🧪 {t('followups.bulkScript.testMessage')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={bulkScriptTestPhone}
                    onChange={e => setBulkScriptTestPhone(e.target.value)}
                    placeholder={t('followups.bulkScript.testPhonePlaceholder')}
                    className="flex-1 px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-sm"
                  />
                  <button
                    onClick={handleBulkScriptTest}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 whitespace-nowrap"
                  >
                    📤 {t('followups.bulkScript.sendTest')}
                  </button>
                </div>
              </div>

              {/* H. Summary */}
              <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-300 dark:border-purple-700 rounded-lg p-4">
                <p className="text-sm font-bold text-purple-800 dark:text-purple-300 text-center">
                  📊 {t('followups.bulkScript.summaryWillSend')} <span className="text-lg">{getBulkScriptTargets().length}</span> {t('followups.bulkScript.summaryPeople')} <span className="text-lg">{bulkScriptMessages.filter(m => m.trim()).length}</span> {t('followups.bulkScript.summaryMessages')} <span className="text-lg">{bulkScriptDelayMin}-{bulkScriptDelayMax}</span> {t('followups.bulkScript.summarySeconds')}
                </p>
              </div>

              {/* I. Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleBulkScriptStart()}
                  disabled={bulkScriptMessages.every(m => !m.trim()) || getBulkScriptTargets().length === 0}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-bold text-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  🚀 {t('followups.bulkScript.startSending')}
                </button>
                <button
                  onClick={() => setShowBulkScriptModal(false)}
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-500"
                >
                  {t('followups.bulkScript.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Smart Bulk Script - Progress Modal */}
      {bulkScriptRunning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">{bulkScriptPaused ? '⏸️' : '🤖'}</div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                {bulkScriptPaused ? t('followups.bulkScript.paused') : t('followups.bulkScript.smartSending')}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {bulkScriptProgress.current} / {bulkScriptProgress.total}
              </p>
            </div>

            {/* Main Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{t('followups.bulkScript.overallProgress')}</span>
                <span>{Math.round((bulkScriptProgress.current / Math.max(bulkScriptProgress.total, 1)) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500 ease-out"
                  style={{ width: `${(bulkScriptProgress.current / Math.max(bulkScriptProgress.total, 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Countdown Bar */}
            {bulkScriptProgress.countdown > 0 && !bulkScriptPaused && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{bulkScriptProgress.countdown > bulkScriptDelayMax ? `☕ ${t('followups.bulkScript.batchBreakLabel')}` : `⏰ ${t('followups.bulkScript.nextMessageIn')}`}</span>
                  <span>{bulkScriptProgress.countdown > 60 ? `${Math.ceil(bulkScriptProgress.countdown / 60)} ${t('followups.bulkScript.minutes')}` : `${bulkScriptProgress.countdown} ${t('followups.bulkScript.seconds')}`}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ease-linear ${bulkScriptProgress.countdown > bulkScriptDelayMax ? 'bg-gradient-to-r from-blue-400 to-purple-400' : 'bg-gradient-to-r from-yellow-400 to-orange-400'}`}
                    style={{ width: `${(bulkScriptProgress.countdown / (bulkScriptProgress.countdown > bulkScriptDelayMax ? bulkScriptBatchBreakMax : bulkScriptDelayMax)) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Current Info */}
            {bulkScriptProgress.currentName && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4 space-y-1 text-sm">
                <p className="text-primary-600 dark:text-primary-400">
                  📱 {t('followups.bulkScript.sendingTo')} <span className="font-bold">{bulkScriptProgress.currentName}</span>
                </p>
                <p className="text-purple-600 dark:text-purple-400">
                  ✉️ {t('followups.bulkScript.messageTextOf').replace('{current}', String(bulkScriptProgress.currentMsgIndex)).replace('{total}', String(bulkScriptMessages.filter(m => m.trim()).length))}
                </p>
              </div>
            )}

            {/* Success/Fail Counters */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">✅ {bulkScriptProgress.successCount}</p>
                <p className="text-xs text-green-700 dark:text-green-400">{t('followups.bulkScript.success')}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-600">❌ {bulkScriptProgress.failCount}</p>
                <p className="text-xs text-red-700 dark:text-red-400">{t('followups.bulkScript.fail')}</p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  bulkScriptPausedRef.current = !bulkScriptPausedRef.current
                  setBulkScriptPaused(bulkScriptPausedRef.current)
                }}
                className={`flex-1 px-4 py-3 rounded-lg font-bold transition-all ${
                  bulkScriptPaused
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-yellow-500 text-white hover:bg-yellow-600'
                }`}
              >
                {bulkScriptPaused ? `▶️ ${t('followups.bulkScript.resume')}` : `⏸️ ${t('followups.bulkScript.pause')}`}
              </button>
              <button
                onClick={() => {
                  bulkScriptAbortedRef.current = true
                  bulkScriptPausedRef.current = false
                  setBulkScriptPaused(false)
                }}
                className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-bold"
              >
                🛑 {t('followups.bulkScript.stopPermanent')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Smart Bulk Script - Report Modal */}
      {bulkScriptReport && !bulkScriptRunning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setBulkScriptReport(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={`p-5 rounded-t-2xl ${bulkScriptReport.failed.length === 0 ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-purple-600 to-indigo-600'} text-white`}>
              <h2 className="text-xl font-bold">📊 {t('followups.bulkScript.reportTitle')}</h2>
              <p className="text-sm opacity-90 mt-1">{t('followups.bulkScript.reportSubtitle')}</p>
            </div>

            <div className="p-5 space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">✅ {bulkScriptReport.success.length}</p>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">{t('followups.bulkScript.sentSuccessfully')}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-red-600">❌ {bulkScriptReport.failed.length}</p>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">{t('followups.bulkScript.sendFailed')}</p>
                </div>
              </div>

              {/* Failed List */}
              {bulkScriptReport.failed.length > 0 && (
                <div>
                  <h3 className="font-bold text-red-600 dark:text-red-400 mb-2 text-sm">{t('followups.bulkScript.failedNumbers')}</h3>
                  <div className="bg-red-50 dark:bg-red-900/10 rounded-lg divide-y divide-red-100 dark:divide-red-800 max-h-48 overflow-y-auto">
                    {bulkScriptReport.failed.map((item, idx) => (
                      <div key={idx} className="px-3 py-2 text-sm flex justify-between items-center">
                        <div>
                          <span className="font-bold text-gray-800 dark:text-gray-200">{item.name}</span>
                          <span className="text-gray-500 dark:text-gray-400 ms-2">{item.phone}</span>
                        </div>
                        <span className="text-xs text-red-500">{item.error}</span>
                      </div>
                    ))}
                  </div>

                  {/* Retry Button */}
                  <button
                    onClick={() => {
                      const retryTargets = bulkScriptReport!.failed.map(f => ({
                        visitor: { id: `retry-${f.phone}`, name: f.name, phone: f.phone, source: 'retry', status: 'pending' }
                      }))
                      setBulkScriptReport(null)
                      handleBulkScriptStart(retryTargets)
                    }}
                    className="w-full mt-3 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-bold hover:from-orange-600 hover:to-red-600 transition-all"
                  >
                    🔄 {t('followups.bulkScript.retryFailed')} ({bulkScriptReport.failed.length})
                  </button>
                </div>
              )}

              {/* Close */}
              <button
                onClick={() => setBulkScriptReport(null)}
                className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-500"
              >
                {t('followups.bulkScript.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal - سجل المتابعات (Lightweight) */}
      {showHistoryModal && selectedVisitorForHistory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowHistoryModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-primary-600 text-white p-4 rounded-t-lg flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span>📋</span>
                  <span>{t('followups.history.title')}</span>
                </h2>
                <p className="text-xs opacity-90 mt-0.5">
                  {selectedVisitorForHistory.name} - {selectedVisitorForHistory.phone}
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-white hover:bg-white dark:bg-gray-800/20 rounded-full w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              {visitorHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">📭</div>
                  <p className="text-sm">{t('followups.history.noHistory')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-primary-50 dark:bg-primary-900/30 p-3 rounded-lg border border-primary-200 dark:border-primary-600">
                    <p className="text-sm font-bold text-primary-900 dark:text-primary-100">
                      {t('followups.history.total')}: <span className="text-2xl">{visitorHistory.length}</span>
                    </p>
                  </div>

                  {visitorHistory.map((fu, index) => (
                    <div
                      key={fu.id}
                      className={`border rounded-lg p-3 ${
                        fu.contacted ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl font-bold text-gray-400 dark:text-gray-500">#{visitorHistory.length - index}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(fu.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                            </span>
                            {fu.contacted ? (
                              <span className="text-green-700 dark:text-green-300 font-bold text-xs">✅ {t('followups.history.contacted')}</span>
                            ) : (
                              <span className="text-orange-600 dark:text-orange-300 font-bold text-xs">⏳ {t('followups.history.notContacted')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {fu.result && getResultBadge(fu.result)}
                          {fu.salesName && (
                            <span className="bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 px-2 py-0.5 rounded-full text-xs">
                              {fu.salesName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600 mb-2">
                        <p className="text-sm text-gray-800 dark:text-gray-100">{fu.notes}</p>
                      </div>

                      {fu.nextFollowUpDate && (
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          📅 {t('followups.history.nextFollowUp')}: <span className="font-bold">{new Date(fu.nextFollowUpDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}</span>
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md mb-6 overflow-hidden">

        {/* Row 1: Personal quick filters + sort toggle */}
        {user?.name && (
          <div className="px-3 sm:px-4 pt-3 pb-2 flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap gap-1.5 items-center">
              {!user?.isSales && (
                <button
                  onClick={() => setSalesFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                    salesFilter === 'all'
                      ? 'bg-primary-600 text-white shadow'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  📋 {t('followups.quickFilters.all')} ({allFollowUps.length})
                </button>
              )}
              <button
                onClick={() => setSalesFilter('my-followups')}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                  salesFilter === 'my-followups'
                    ? 'bg-primary-600 text-white shadow'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                👤 {t('followups.quickFilters.myFollowups')} ({quickFilterCounts.myFollowUps})
              </button>
              <button
                onClick={() => setSalesFilter('today')}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                  salesFilter === 'today'
                    ? 'bg-orange-500 text-white shadow'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                ⚡ {t('followups.quickFilters.today')} ({quickFilterCounts.todayCount})
              </button>

              {/* 📞 Contacted status filter */}
              <div className="mx-1 h-6 w-px bg-gray-300 dark:bg-gray-600" />
              <button
                onClick={() => setContactedFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                  contactedFilter === 'all'
                    ? 'bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-800 shadow'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                📞 {t('followups.contactStatus.all')}
              </button>
              <button
                onClick={() => setContactedFilter('not-contacted')}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                  contactedFilter === 'not-contacted'
                    ? 'bg-amber-500 text-white shadow'
                    : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                }`}
              >
                ⏳ {t('followups.contactStatus.notContacted')} ({quickFilterCounts.notContacted})
              </button>
              <button
                onClick={() => setContactedFilter('contacted')}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                  contactedFilter === 'contacted'
                    ? 'bg-green-600 text-white shadow'
                    : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50'
                }`}
              >
                ✅ {t('followups.contactStatus.contacted')} ({quickFilterCounts.contacted})
              </button>
            </div>
            <button
              onClick={() => { const v = !sortByPriority; setSortByPriority(v); localStorage.setItem('followups-sortByPriority', String(v)) }}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs sm:text-sm transition-all flex items-center gap-1 ${
                sortByPriority ? 'bg-orange-500 text-white shadow' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {sortByPriority ? '🔥' : '📅'} {direction === 'rtl'
                ? (sortByPriority ? 'ترتيب: أولوية' : 'ترتيب: الأحدث')
                : (sortByPriority ? 'Sort: Priority' : 'Sort: Newest')}
            </button>
          </div>
        )}

        {/* Row 2: Source filter pills */}
        <div className={`px-3 sm:px-4 py-2 flex flex-wrap gap-1.5 ${user?.name ? 'border-t border-gray-100 dark:border-gray-700' : 'pt-3'}`}>
          <button onClick={() => setSourceFilter('all')} className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${sourceFilter === 'all' ? 'bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-800' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
            {t('followups.filters.all')} ({stats.total})
          </button>
          <button onClick={() => setSourceFilter('expired-member')} className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${sourceFilter === 'expired-member' ? 'bg-red-600 text-white' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50'}`}>
            ❌ {t('followups.sources.expiredMembers')} ({stats.expiredMembers})
          </button>
          <button onClick={() => setSourceFilter('expiring-member')} className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${sourceFilter === 'expiring-member' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/50'}`}>
            ⏰ {t('followups.sources.expiringMembers')} ({stats.expiringMembers})
          </button>
          <button onClick={() => setSourceFilter('member-invitation')} className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${sourceFilter === 'member-invitation' ? 'bg-cyan-600 text-white' : 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50'}`}>
            👥 {t('followups.sources.memberInvitations')} ({stats.invitations})
          </button>
          <button onClick={() => setSourceFilter('dayuse')} className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${sourceFilter === 'dayuse' ? 'bg-pink-600 text-white' : 'bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-900/50'}`}>
            🎁 {t('followups.sources.dayUse')} ({stats.dayUse})
          </button>
          <button onClick={() => setSourceFilter('visitors')} className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${sourceFilter === 'visitors' ? 'bg-primary-600 text-white' : 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50'}`}>
            👤 {t('followups.sources.visitors')} ({stats.visitors})
          </button>
        </div>

        {/* Row 3: Search + dropdowns + smart script */}
        <div className="px-3 sm:px-4 pb-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">🔍 {t('followups.filters.search')}</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              placeholder={t('followups.filters.searchPlaceholder')}
            />
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">📊 {t('followups.filters.priority')}</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="all">{t('followups.filters.all')}</option>
              <option value="today">⚡ {t('followups.priority.today')}</option>
              <option value="upcoming">📅 {t('followups.priority.upcoming')}</option>
            </select>
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">📈 {t('followups.filters.result')}</label>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="all">{t('followups.filters.all')}</option>
              <option value="interested">✅ {t('followups.results.interested')}</option>
              <option value="not-interested">❌ {t('followups.results.notInterested')}</option>
              <option value="postponed">⏸️ {t('followups.results.postponed')}</option>
              <option value="subscribed">🎉 {t('followups.results.subscribed')}</option>
            </select>
          </div>
          {!user?.isSales && staffList.filter((s: any) => s.position?.split(',').map((p: string) => p.trim()).includes('sales')).length > 0 && (
            <div className="min-w-[140px]">
              <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">💼 {t('followups.table.salesStaff')}</label>
              <select
                value={assignedStaffFilter}
                onChange={(e) => setAssignedStaffFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
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
          {filteredFollowUps.length > 0 && (
            <button
              onClick={() => { setShowBulkScriptModal(true); fetchWaSessions() }}
              className="px-4 py-2 rounded-lg font-bold text-sm bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow hover:from-purple-700 hover:to-indigo-700 flex items-center gap-2 whitespace-nowrap"
            >
              🤖 {t('followups.bulkScript.buttonLabel')} ({filteredFollowUps.length})
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

      {/* Follow-Ups Table/List View */}
      {viewMode === 'list' && (loading ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-xl">{t('followups.loading')}</p>
        </div>
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
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-5 border-2 ${
                    isExpired
                      ? 'border-red-400 bg-gradient-to-br from-red-50/50 to-white dark:from-red-900/10 dark:to-gray-800'
                      : isExpiring
                      ? 'border-yellow-400 bg-gradient-to-br from-yellow-50/50 to-white dark:from-yellow-900/10 dark:to-gray-800'
                      : 'border-primary-400 bg-gradient-to-br from-primary-50/30 to-white dark:from-primary-900/10 dark:to-gray-800'
                  } hover:shadow-2xl transition-shadow transition-transform duration-300 hover:scale-[1.02]`}
                >
                  {/* Action Buttons at Top */}
                  <div className="flex justify-between items-start gap-2 mb-2 sm:mb-3">
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(followUp)}
                    </div>
                    <div className="flex gap-1.5 sm:gap-2">
                      {/* زر تجديد سريع */}
                      {(isExpired || isExpiring) && (
                        <Link
                          href={`/members?search=${encodeURIComponent(followUp.visitor.phone)}`}
                          className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50"
                        >
                          🔄
                        </Link>
                      )}
                      {isExpired && (
                        <button
                          onClick={() => openQuickFollowUp(followUp.visitor)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50"
                        >
                          ➕
                        </button>
                      )}
                      {!isExpired && (
                        <button
                          onClick={() => openQuickFollowUp(followUp.visitor)}
                          className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50"
                        >
                          ➕
                        </button>
                      )}
                      <button
                        onClick={() => openHistoryModal(followUp.visitor)}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50"
                      >
                        📋
                      </button>
                      {/* زر الاشتراك السريع - مخفي للأعضاء القريبين من الانتهاء */}
                      {!isExpiring && (
                        <button
                          onClick={() => openQuickSubscribe(followUp.visitor, followUp.assignedTo || undefined)}
                          className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50"
                          title="تحويل الزائر إلى عضو"
                        >
                          ⚡
                        </button>
                      )}
                      {/* زر تعديل - للزوار والدعوات */}
                      {!isExpired && !isExpiring && !followUp.id.startsWith('dayuse-') && (
                        <button
                          onClick={() => handleEditFollowUp(followUp)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                          title="تعديل"
                        >
                          ✏️
                        </button>
                      )}
                      {/* زر حذف - للزوار والدعوات */}
                      {!isExpired && !isExpiring && !followUp.id.startsWith('dayuse-') && (
                        <button
                          onClick={() => handleDeleteFollowUp(followUp.id, followUp.visitor.name)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50"
                          title="حذف"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Follow-up Info */}
                  <div className="space-y-2 sm:space-y-2.5">
                    {/* اسم الزائر ورقم الهاتف - بروز أكبر */}
                    <div className="bg-gradient-to-r from-primary-50 via-white to-primary-50 dark:from-primary-900/20 dark:via-gray-800 dark:to-primary-900/20 p-3 sm:p-4 rounded-xl border-2 border-primary-200 dark:border-primary-700 shadow-sm">
                      <div className="flex flex-col gap-2.5">
                        {/* الاسم */}
                        <div className="flex items-center gap-2">
                          <div className="bg-primary-500 p-1.5 rounded-lg">
                            <span className="text-white text-base">👤</span>
                          </div>
                          <div className="flex-1">
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{locale === 'ar' ? 'الاسم' : 'Name'}</div>
                            <span className={`font-bold text-base sm:text-lg ${
                              isExpired ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-gray-100'
                            }`}>
                              {followUp.visitor.name}
                            </span>
                          </div>
                        </div>

                        {/* رقم الهاتف */}
                        <div className="flex items-center gap-2">
                          <div className="bg-green-500 p-1.5 rounded-lg">
                            <span className="text-white text-base">📱</span>
                          </div>
                          <div className="flex-1">
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{t('followups.table.phoneNumber')}</div>
                            <div className="flex gap-2 items-center">
                              <span className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200" dir="ltr">
                                {followUp.visitor.phone}
                              </span>
                              <button
                                onClick={() => openTemplateModal(followUp.visitor)}
                                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all"
                                title={t('followups.table.readyMessages')}
                              >
                                💬 {t('followups.table.whatsappButton')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* المصدر ومهتم بإيه - معلومات مهمة */}
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-500 dark:text-gray-400 text-xs font-semibold">📂</span>
                        <span className={`${
                          followUp.visitor.source === 'invitation'
                            ? 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200 px-3 py-1 rounded-full text-xs font-semibold'
                            : followUp.visitor.source === 'member-invitation'
                            ? 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200 px-3 py-1 rounded-full text-xs font-semibold'
                            : followUp.visitor.source === 'expired-member'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-3 py-1 rounded-full text-xs font-bold shadow-sm'
                            : followUp.visitor.source === 'expiring-member'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-3 py-1 rounded-full text-xs font-bold shadow-sm'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 px-3 py-1 rounded-full text-xs font-medium'
                        }`}>
                          {getSourceLabel(followUp.visitor.source)}
                        </span>

                        {/* مهتم بإيه - بروز أكبر */}
                        {followUp.visitor.interestedIn && (
                          <>
                            <span className="text-gray-400">•</span>
                            <div className="flex items-center gap-1.5 bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 px-3 py-1 rounded-full border border-blue-300 dark:border-blue-700 shadow-sm">
                              <span className="text-sm">🎯</span>
                              <span className="text-blue-900 dark:text-blue-200 text-xs font-bold">
                                {followUp.visitor.interestedIn}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* موظف المبيعات */}
                    {followUp.salesName && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-semibold">🧑‍💼</span>
                        <span className="text-orange-600 font-semibold text-xs sm:text-sm">{followUp.salesName}</span>
                      </div>
                    )}

                    {/* آخر تعليق أو الملاحظات */}
                    {(() => {
                      const lastComment = getLastComment(followUp.visitor.phone)
                      return lastComment ? (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-lg border-l-4 border-blue-500">
                          <div className="flex items-start gap-2 mb-1">
                            <span className="text-blue-600 dark:text-blue-400 text-xs font-semibold">💬 {t('followups.table.lastCommentLabel')}</span>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 mb-1">{lastComment.notes}</p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            {lastComment.salesName && <span className="text-orange-500 font-medium">{lastComment.salesName} • </span>}
                            {new Date(lastComment.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                          </p>
                        </div>
                      ) : followUp.notes ? (
                        <div className="bg-gray-50 dark:bg-gray-700/30 p-2.5 rounded-lg border-l-4 border-gray-400">
                          <div className="flex items-start gap-2 mb-1">
                            <span className="text-gray-600 dark:text-gray-300 text-xs font-semibold">📝 {t('followups.table.notesLabel')}</span>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200">{followUp.notes}</p>
                        </div>
                      ) : null
                    })()}

                    {/* النتيجة وحالة التواصل والتواريخ */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">{t('followups.table.resultLabel')}</span>
                        {getResultBadge(followUp.result)}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">{t('followups.table.contactStatusLabel')}</span>
                        {followUp.contacted ? (
                          <span className="text-green-600 text-xs font-medium">✅ {t('followups.table.contactDone')}</span>
                        ) : (
                          <span className="text-orange-600 text-xs font-medium">⏳ {t('followups.table.contactPending')}</span>
                        )}
                      </div>
                      {followUp.nextFollowUpDate && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">المتابعة القادمة</span>
                          <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                            {new Date(followUp.nextFollowUpDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">آخر تحديث</span>
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
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                {searchTerm || resultFilter !== 'all' || contactedFilter !== 'all' || priorityFilter !== 'all' ? (
                  <>
                    <div className="text-5xl mb-3">🔍</div>
                    <p>{t('followups.messages.noResults')}</p>
                  </>
                ) : (
                  <>
                    <div className="text-5xl mb-3">📝</div>
                    <p>{t('followups.messages.noFollowups')}</p>
                    <button
                      onClick={() => setShowForm(true)}
                      className="mt-4 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
                    >
                      ➕ {t('followups.messages.addFirst')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {filteredFollowUps.length > 0 && (
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
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
                      {t('followups.pagination.first')}
                    </button>
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
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
                      {t('followups.pagination.next')}
                    </button>
                    <button
                      onClick={() => goToPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
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
        <div className="mt-6 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-2 border-emerald-300 dark:border-emerald-600 rounded-xl p-4 sm:p-6 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
          <h3 className="font-bold text-emerald-900 dark:text-emerald-100 mb-4 flex items-center gap-2 text-lg sm:text-xl">
            <span>🎉</span>
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
                    className="bg-white dark:bg-gray-700 border-2 border-emerald-200 dark:border-emerald-600 rounded-lg p-3 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base">{fu.visitor.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{fu.visitor.phone}</p>
                        {isRenewal && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-[10px] font-bold rounded-full">
                            🔄 تجديد
                          </span>
                        )}
                        {!isRenewal && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-[10px] font-bold rounded-full">
                            ⭐ عضو جديد
                          </span>
                        )}
                      </div>
                      <span className="text-2xl">✅</span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                      <p className="flex items-center gap-1">
                        <span>📂</span>
                        <span>{getSourceLabel(fu.visitor.source)}</span>
                      </p>
                      {fu.salesName && (
                        <p className="flex items-center gap-1 mt-1">
                          <span>🧑‍💼</span>
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
              وأكثر من {convertedMembers.length - 6} شخص آخر تحول لعضو / جدد 🎊
            </p>
          )}
        </div>
      )}


      {/* Quick Tips */}
      <div className="mt-4 bg-gradient-to-r from-primary-50 to-primary-50 border-r-4 border-primary-500 p-5 rounded-lg">
        <h3 className="font-bold text-primary-900 mb-2 flex items-center gap-2">
          <span>💡</span>
          <span>{t('followups.tips.title')}</span>
        </h3>
        <ul className="text-sm text-primary-800 space-y-1">
          <li>• 🔥 <strong>{t('followups.tips.overdue.title')}:</strong> {t('followups.tips.overdue.text')}</li>
          <li>• ⚡ <strong>{t('followups.tips.today.title')}:</strong> {t('followups.tips.today.text')}</li>
          <li>• 💬 <strong>{t('followups.tips.whatsapp.title')}:</strong> {t('followups.tips.whatsapp.text')}</li>
          <li>• ⏰ <strong>{t('followups.tips.yellow.title')}:</strong> {t('followups.tips.yellow.text')}</li>
          <li>• ❌ <strong>{t('followups.tips.red.title')}:</strong> {t('followups.tips.red.text')}</li>
          <li>• ✅ <strong>{t('followups.tips.green.title')}:</strong> {t('followups.tips.green.text')}</li>
        </ul>
      </div>

      {/* Delete Confirmation Popup */}
      {showDeleteConfirm && deleteTarget && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={cancelDelete}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6 transform transition-all"
            onClick={(e) => e.stopPropagation()}
            dir={direction}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl">⚠️</div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {t('followups.deleteConfirm.title')}
                </h3>
              </div>
            </div>

            {/* Content */}
            <div className="mb-6 space-y-3">
              <p className="text-gray-700 dark:text-gray-200 text-base">
                {t('followups.deleteConfirm.message')} <strong className="text-red-600 dark:text-red-400">{deleteTarget.name}</strong>؟
              </p>
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
                  <span className="text-lg">⚠️</span>
                  <span>{t('followups.deleteConfirm.warning')}</span>
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {deleteMutation.isPending ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>{t('followups.deleteConfirm.deleting')}</span>
                  </>
                ) : (
                  <>
                    <span>🗑️</span>
                    <span>{t('followups.deleteConfirm.confirmButton')}</span>
                  </>
                )}
              </button>
              <button
                onClick={cancelDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-bold py-3 px-4 rounded-lg transition-colors"
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
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={cancelDeleteVisitor}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6 transform transition-all"
            onClick={(e) => e.stopPropagation()}
            dir={direction}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl">🚨</div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {t('followups.deleteVisitorConfirm.title')}
                </h3>
              </div>
            </div>

            <div className="mb-6 space-y-3">
              <p className="text-gray-700 dark:text-gray-200 text-base">
                {t('followups.deleteVisitorConfirm.message')} <strong className="text-red-600 dark:text-red-400">{deleteVisitorTarget.name}</strong>?
              </p>
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
                  <span className="text-lg">⚠️</span>
                  <span>{t('followups.deleteVisitorConfirm.warning')}</span>
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmDeleteVisitor}
                disabled={deleteVisitorMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {deleteVisitorMutation.isPending ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>{t('followups.deleteConfirm.deleting')}</span>
                  </>
                ) : (
                  <>
                    <span>❌</span>
                    <span>{t('followups.deleteVisitorConfirm.confirmButton')}</span>
                  </>
                )}
              </button>
              <button
                onClick={cancelDeleteVisitor}
                disabled={deleteVisitorMutation.isPending}
                className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-bold py-3 px-4 rounded-lg transition-colors"
              >
                {t('followups.deleteConfirm.cancelButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ مودال تعديل الزائر/الدعوة */}
      {showEditModal && editTarget && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowEditModal(false); setEditTarget(null) }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
            dir={direction}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="text-3xl">✏️</div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editTarget.type === 'invitation' ? t('followups.editModal.editInvitation') : t('followups.editModal.editVisitor')}
              </h3>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('followups.editModal.name')}</label>
                <input
                  type="text"
                  value={editTarget.name}
                  onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('followups.editModal.phone')}</label>
                <input
                  type="tel"
                  value={editTarget.phone}
                  onChange={(e) => setEditTarget({ ...editTarget, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmEdit}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors"
              >
                {t('followups.editModal.save')}
              </button>
              <button
                onClick={() => { setShowEditModal(false); setEditTarget(null) }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-bold py-2.5 px-4 rounded-lg transition-colors"
              >
                {t('followups.editModal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚡ نموذج الاشتراك السريع */}
      {showQuickSubscribeModal && selectedVisitorForSubscribe && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {t('followups.quickSubscribe')} - {selectedVisitorForSubscribe.name}
              </h2>
              <button
                onClick={() => {
                  setShowQuickSubscribeModal(false)
                  setSelectedVisitorForSubscribe(null)
                  setSelectedFollowUpSalesStaffId(null)
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <MemberForm
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
