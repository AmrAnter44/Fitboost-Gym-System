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
  const { t, direction } = useLanguage()
  const toast = useToast()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedVisitorForHistory, setSelectedVisitorForHistory] = useState<Visitor | null>(null)
  const [selectedVisitorId, setSelectedVisitorId] = useState<string>('')
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

  // View mode state
  const [viewMode, setViewMode] = useState<'list' | 'analytics'>('list')

  // ✅ Bulk sending states
  const [showBulkSendModal, setShowBulkSendModal] = useState(false)
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
  const [bulkScriptDailyLimit, setBulkScriptDailyLimit] = useState(80)
  const [bulkScriptBatchSize, setBulkScriptBatchSize] = useState(12)
  const [bulkScriptBatchBreakMin, setBulkScriptBatchBreakMin] = useState(120) // 2 min
  const [bulkScriptBatchBreakMax, setBulkScriptBatchBreakMax] = useState(300) // 5 min
  const [bulkScriptSessionIndex, setBulkScriptSessionIndex] = useState<number | 'auto'>('auto')
  const [availableWaSessions, setAvailableWaSessions] = useState<{sessionIndex: number, phoneNumber?: string, isReady: boolean}[]>([])

  // Fetch all data using TanStack Query
  const {
    data: followUps = [],
    isLoading: loadingFollowUps,
    error: followUpsError,
    refetch: refetchFollowUps
  } = useQuery({
    queryKey: ['followups'],
    queryFn: fetchFollowUpsData,
    retry: 1,
    staleTime: 2 * 60 * 1000,
  })

  const {
    data: visitorsData = [],
    error: visitorsError
  } = useQuery({
    queryKey: ['visitors-followups'],
    queryFn: fetchVisitorsData,
    retry: 1,
    staleTime: 2 * 60 * 1000,
  })

  const {
    data: allMembersData = [],
    error: membersError
  } = useQuery({
    queryKey: ['members-followups'],
    queryFn: fetchMembersData,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    enabled: hasPermission('canViewMembers'), // ✅ فقط إذا كان لديه صلاحية
  })

  const {
    data: dayUseRecords = [],
    error: dayUseError
  } = useQuery({
    queryKey: ['dayuse-followups'],
    queryFn: fetchDayUseData,
    retry: 1,
    staleTime: 2 * 60 * 1000,
    enabled: hasPermission('canViewDayUse'), // ✅ فقط إذا كان لديه صلاحية
  })

  const {
    data: invitations = [],
    error: invitationsError
  } = useQuery({
    queryKey: ['invitations-followups'],
    queryFn: fetchInvitationsData,
    retry: 1,
    staleTime: 2 * 60 * 1000,
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
  // ✅ ترتيب الزوار حسب تاريخ الإنشاء (الأحدث أولاً)
  const visitors = useMemo(() =>
    (visitorsData || []).sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    [visitorsData]
  )

  // ✅ ترتيب الدعوات حسب تاريخ الإنشاء (الأحدث أولاً)
  const sortedInvitations = useMemo(() =>
    (invitations || []).sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    [invitations]
  )

  const allMembers = allMembersData
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
        toast.error('يجب تسجيل الدخول أولاً')
        setTimeout(() => router.push('/login'), 2000)
      } else if (errorMessage === 'FORBIDDEN') {
        toast.error('ليس لديك صلاحية عرض المتابعات')
      } else {
        toast.error(errorMessage || 'حدث خطأ أثناء جلب البيانات')
      }
    }
  }, [followUpsError, visitorsError, membersError, dayUseError, invitationsError, staffError, toast, router])

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [resultFilter, setResultFilter] = useState('all')
  const [contactedFilter, setContactedFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all') // ✅ فلتر المصدر
  const [salesFilter, setSalesFilter] = useState('all') // ✅ فلتر السيلز (all, my-followups, my-overdue, today)
  const [sortByPriority, setSortByPriority] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('followups-sortByPriority')
      return saved !== null ? saved === 'true' : true
    }
    return true
  })
  const [expiringDays, setExpiringDays] = useState(30) // عدد الأيام للأعضاء اللي قرب اشتراكهم ينتهي

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // ✅ حساب الأعضاء المنتهيين
  const expiredMembers = useMemo(() => {
    const today = new Date()
    return allMembers
      .filter(m => {
        if (!m.expiryDate) return false
        const expiryDate = new Date(m.expiryDate)
        return expiryDate < today && m.isActive === false
      })
      .map(m => ({
        id: `expired-${m.id}`,
        name: `${m.name} (عضو منتهي)`,
        phone: m.phone,
        source: 'expired-member',
        status: 'expired'
      }))
  }, [allMembers])

  // ✅ حساب الأعضاء اللي اشتراكهم قرب ينتهي (حسب عدد الأيام المحدد)
  const expiringMembers = useMemo(() => {
    const today = new Date()
    const futureDate = new Date()
    futureDate.setDate(today.getDate() + expiringDays)

    return allMembers
      .filter(m => {
        if (!m.expiryDate || !m.isActive) return false
        const expiryDate = new Date(m.expiryDate)
        // الأعضاء النشطين اللي اشتراكهم هينتهي في خلال الأيام المحددة
        return expiryDate > today && expiryDate <= futureDate
      })
      .map(m => {
        const expiryDate = new Date(m.expiryDate!)
        const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return {
          id: `expiring-${m.id}`,
          name: `${m.name} (باقي ${daysLeft} يوم)`,
          phone: m.phone,
          source: 'expiring-member',
          status: 'expiring',
          daysLeft
        }
      })
  }, [allMembers, expiringDays])

  // ✅ تحسين الأداء: تنظيف رقم التليفون (memoized)
  const normalizePhone = useCallback((phone: string) => {
    if (!phone) return ''
    let normalized = phone.replace(/[\s\-\(\)\+]/g, '').trim()
    if (normalized.startsWith('2')) normalized = normalized.substring(1)
    if (normalized.startsWith('0')) normalized = normalized.substring(1)
    return normalized
  }, [])

  // ✅ دمج المتابعات الحقيقية مع الأعضاء المنتهيين + الأعضاء القريبين من الانتهاء + Day Use + Invitations
  const allFollowUps = useMemo(() => {
    // ✅ إنشاء Set من أرقام المتابعات الحقيقية لتجنب التكرار
    const realFollowUpPhones = new Set<string>()

    followUps.forEach(fu => {
      if (fu.visitor?.phone) {
        realFollowUpPhones.add(normalizePhone(fu.visitor.phone))
      }
    })

    // 1. الأعضاء المنتهيين (فقط اللي مش عندهم متابعة حقيقية)
    const expiredFollowUps: FollowUp[] = expiredMembers
      .filter(member => !realFollowUpPhones.has(normalizePhone(member.phone)))
      .map(member => ({
        id: member.id,
        notes: 'عضو منتهي - يحتاج تجديد اشتراك',
        contacted: false,
        nextFollowUpDate: new Date().toISOString(),
        result: undefined,
        salesName: 'نظام',
        createdAt: new Date().toISOString(),
        visitor: member,
        assignedTo: undefined,
        assignedStaff: undefined,
        priority: 'high'
      }))

    // 2. الأعضاء اللي اشتراكهم قرب ينتهي (فقط اللي مش عندهم متابعة حقيقية)
    const expiringFollowUps: FollowUp[] = expiringMembers
      .filter((member: any) => !realFollowUpPhones.has(normalizePhone(member.phone)))
      .map((member: any) => ({
        id: member.id,
        notes: `اشتراك قرب ينتهي - باقي ${member.daysLeft} يوم فقط`,
        contacted: false,
        nextFollowUpDate: new Date().toISOString(),
        result: undefined,
        salesName: 'نظام',
        createdAt: new Date().toISOString(),
        visitor: member,
        assignedTo: undefined,
        assignedStaff: undefined,
        priority: 'medium'
      }))

    // 3. Day Use (استخدام InBody يوم واحد) - فقط اللي مش عندهم متابعة حقيقية
    const dayUseFollowUps: FollowUp[] = dayUseRecords
      .filter(record => !realFollowUpPhones.has(normalizePhone(record.phone)))
      .map(record => ({
        id: `dayuse-${record.id}`,
        notes: `استخدام ${record.serviceType} - فرصة للاشتراك`,
        contacted: false,
        nextFollowUpDate: new Date().toISOString(),
        result: undefined,
        salesName: record.staffName || 'نظام',
        createdAt: record.createdAt,
        visitor: {
          id: `dayuse-${record.id}`,
          name: record.name,
          phone: record.phone,
          source: 'invitation', // 🎁 استخدام يوم
          status: 'pending'
        },
        assignedTo: undefined,
        assignedStaff: undefined,
        priority: 'medium'
      }))

    // 4. Invitations (دعوات من أعضاء) - فقط اللي مش عندهم متابعة حقيقية
    const invitationFollowUps: FollowUp[] = sortedInvitations
      .filter(inv => !realFollowUpPhones.has(normalizePhone(inv.guestPhone)))
      .map(inv => ({
        id: `invitation-${inv.id}`,
        notes: `دعوة من عضو - ${inv.member?.name || 'عضو'}`,
        contacted: false,
        nextFollowUpDate: new Date().toISOString(),
        result: undefined,
        salesName: 'نظام',
        createdAt: inv.createdAt,
        visitor: {
          id: `invitation-${inv.id}`,
          name: inv.guestName,
          phone: inv.guestPhone,
          source: 'member-invitation', // 👥 دعوة من عضو
          status: 'pending'
        },
        assignedTo: undefined,
        assignedStaff: undefined,
        priority: 'medium'
      }))

    // 5. الزوار العاديين (Visitors) - فقط اللي مش عندهم متابعة حقيقية
    const regularVisitorFollowUps: FollowUp[] = visitors
      .filter(visitor => !realFollowUpPhones.has(normalizePhone(visitor.phone)))
      .map(visitor => ({
        id: `visitor-${visitor.id}`,
        notes: `زائر جديد - ${visitor.source || 'walk-in'}`,
        contacted: false,
        nextFollowUpDate: new Date().toISOString(),
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
        assignedTo: undefined,
        assignedStaff: undefined,
        priority: 'medium'
      }))

    return [...followUps, ...expiredFollowUps, ...expiringFollowUps, ...dayUseFollowUps, ...invitationFollowUps, ...regularVisitorFollowUps]
  }, [followUps, expiredMembers, expiringMembers, dayUseRecords, sortedInvitations, visitors, normalizePhone])

  const handleSubmit = async (formData: {
    visitorId: string
    salesName: string
    notes: string
    result: string
    nextFollowUpDate: string
    contacted: boolean
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
        const cleanName = expMember.name.replace(' (عضو منتهي)', '').trim()
        visitorData = { name: cleanName, phone: expMember.phone, source: 'expired-member' }
      }

      // البحث في الأعضاء القريبين من الانتهاء
      const expiringMember = expiringMembers.find((m: any) => m.id === formData.visitorId)
      if (expiringMember) {
        const cleanName = expiringMember.name.replace(/\s*\(باقي \d+ يوم\)/, '').trim()
        visitorData = { name: cleanName, phone: expiringMember.phone, source: 'expiring-member' }
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
        toast.success('تم إضافة المتابعة بنجاح!')
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
        toast.error(data.error || 'فشل إضافة المتابعة')
      }
    } catch (error) {
      console.error(error)
      toast.error('حدث خطأ')
    } finally {
      setSubmitting(false)
    }
  }

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
      .replace(/\{salesName\}/g, user?.name || 'السيلز')
      .replace(/\{phone\}/g, selectedVisitorForTemplate.phone)
      .replace(/\{date\}/g, new Date().toLocaleDateString('ar-EG'))
      .replace(/\{time\}/g, new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }))

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
          toast.success('✅ تم إرسال الرسالة بنجاح على الواتساب')
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
              toast.success('✅ تم تحديث حالة المتابعة تلقائياً')
            }
          } catch (error) {
            console.error('Error updating follow-up:', error)
          }
        } else {
          toast.error(`❌ فشل إرسال الرسالة: ${sendResult.error}`)
        }
        return
      }

      // Fallback: الواتساب غير متصل
      toast.warning('⚠️ الواتساب غير متصل. جاري فتح واتساب ويب...')
      const encodedMessage = encodeURIComponent(message)
      const url = `https://wa.me/20${selectedVisitorForTemplate.phone}?text=${encodedMessage}`
      window.open(url, '_blank')
      setShowTemplateModal(false)
      setTimeout(() => { openQuickFollowUp(selectedVisitorForTemplate) }, 500)

    } catch (error) {
      console.error('Error sending WhatsApp message:', error)
      const encodedMessage = encodeURIComponent(message)
      const url = `https://wa.me/20${selectedVisitorForTemplate.phone}?text=${encodedMessage}`
      window.open(url, '_blank')
      setShowTemplateModal(false)
      setTimeout(() => { openQuickFollowUp(selectedVisitorForTemplate) }, 500)
    }
  }, [selectedVisitorForTemplate, openQuickFollowUp, user, toast, queryClient])

  // 🗑️ حذف دعوة
  const handleDeleteInvitation = useCallback((invitationId: string, name: string) => {
    const originalId = invitationId.replace('invitation-', '')
    setDeleteTarget({ id: originalId, name, type: 'invitation' })
    setShowDeleteConfirm(true)
  }, [])

  // 🗑️ حذف متابعة
  const handleDeleteFollowUp = useCallback((followUpId: string, visitorName: string) => {
    // لا نحذف المتابعات المولدة تلقائياً (الأعضاء المنتهيين والقريبين من الانتهاء)
    if (followUpId.startsWith('expired-') || followUpId.startsWith('expiring-') || followUpId.startsWith('dayuse-')) {
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
      toast.success('تم حذف الدعوة بنجاح')
      queryClient.invalidateQueries({ queryKey: ['followups'] })
      queryClient.invalidateQueries({ queryKey: ['invitations-followups'] })
    },
    onError: () => {
      toast.error('فشل حذف الدعوة')
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
    try {
      if (editTarget.type === 'invitation') {
        const res = await fetch('/api/invitations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editTarget.originalId, guestName: editTarget.name.trim(), guestPhone: editTarget.phone.trim() })
        })
        if (!res.ok) throw new Error('Failed to update invitation')
      } else {
        const res = await fetch('/api/visitors', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editTarget.originalId, name: editTarget.name.trim(), phone: editTarget.phone.trim() })
        })
        if (!res.ok) throw new Error('Failed to update visitor')
      }
      toast.success('تم التعديل بنجاح')
      queryClient.invalidateQueries({ queryKey: ['followups'] })
      queryClient.invalidateQueries({ queryKey: ['visitors-followups'] })
      queryClient.invalidateQueries({ queryKey: ['invitations-followups'] })
      setShowEditModal(false)
      setEditTarget(null)
    } catch (error) {
      toast.error('فشل التعديل')
    }
  }, [editTarget, toast, queryClient])

  // ✅ فتح نموذج الاشتراك السريع
  const openQuickSubscribe = useCallback((visitor: Visitor) => {
    setSelectedVisitorForSubscribe(visitor)
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
  const lastCommentByPhone = useMemo(() => {
    const commentMap = new Map<string, { notes: string; createdAt: string; salesName?: string }>()

    // ترتيب من الأقدم للأحدث عشان الأحدث يكتب فوق الأقدم
    const sortedFollowUps = [...followUps].sort((a, b) =>
      new Date(a.updatedAt || a.createdAt).getTime() - new Date(b.updatedAt || b.createdAt).getTime()
    )

    sortedFollowUps.forEach(fu => {
      const normalizedPhone = normalizePhone(fu.visitor.phone)
      if (normalizedPhone && fu.notes && fu.notes.trim()) {
        commentMap.set(normalizedPhone, {
          notes: fu.notes,
          createdAt: fu.updatedAt || fu.createdAt,
          salesName: fu.salesName
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
  const getFollowUpPriority = useCallback((followUp: FollowUp) => {
    if (!followUp.nextFollowUpDate) return 'none'

    const nextDate = new Date(followUp.nextFollowUpDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    nextDate.setHours(0, 0, 0, 0)

    if (nextDate < today) return 'overdue'
    if (nextDate.getTime() === today.getTime()) return 'today'
    return 'upcoming'
  }, [])

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

        // ✅ فلتر السيلز (متابعاتي، المتأخرة بتاعتي، النهاردة)
        let matchesSales = true
        if (salesFilter === 'my-followups' && user?.name) {
          matchesSales = fu.salesName === user.name
        } else if (salesFilter === 'my-overdue' && user?.name) {
          matchesSales = fu.salesName === user.name && priority === 'overdue'
        } else if (salesFilter === 'today') {
          matchesSales = priority === 'today' || priority === 'overdue'
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

        // ✅ فلتر مبسط: إخفاء أي شخص رقمه موجود في الأعضاء النشطين
        // المبدأ: رقم التليفون هو الفلتر الوحيد - لا يهم المصدر (visitor, expired, expiring, invitation)
        // ⚠️ استثناء: لا نخفي الأعضاء القريبين من الانتهاء (expiring-member) - محتاجين متابعة للتجديد!
        const isExpiring = fu.visitor.source === 'expiring-member'
        if (isVisitorAMember(fu.visitor.phone) && !isExpiring) {
          return false
        }

        return matchesSearch && matchesResult && matchesContacted && matchesPriority && matchesSource && matchesSales
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
  }, [allFollowUps, debouncedSearchTerm, resultFilter, contactedFilter, priorityFilter, sourceFilter, salesFilter, sortByPriority, isVisitorAMember, getFollowUpPriority, user])

  // إعادة تعيين الصفحة للأولى عند تغيير الفلاتر
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, resultFilter, contactedFilter, priorityFilter, sourceFilter, salesFilter, sortByPriority])

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

    if (targetVisitors.length === 0) {
      toast.error('لا يوجد أعضاء للإرسال إليهم')
      return
    }

    // التحقق من حالة الواتساب
    try {
      const statusResponse = await fetch('/api/whatsapp/status')
      if (statusResponse.ok) {
        const status = await statusResponse.json()
        if (!status.isReady) {
          toast.error('❌ الواتساب غير متصل. افتح الإعدادات → واتساب لمسح QR code')
          return
        }
      } else {
        toast.error('❌ الواتساب غير متصل. افتح الإعدادات → واتساب لمسح QR code')
        return
      }
    } catch (error) {
      console.error('Error checking WhatsApp status:', error)
      toast.error('❌ الواتساب غير متصل. افتح الإعدادات → واتساب لمسح QR code')
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
        toast.warning(`تم إيقاف الإرسال. تم الإرسال لـ ${successCount} من ${targetVisitors.length}`)
        break
      }

      const visitor = targetVisitors[i]
      setBulkProgress({ current: i + 1, total: targetVisitors.length, currentName: visitor.name })

      try {
        // تحضير الرسالة
        const message = template.message
          .replace(/\{name\}/g, visitor.name)
          .replace(/\{salesName\}/g, user?.name || 'السيلز')
          .replace(/\{phone\}/g, visitor.phone)
          .replace(/\{date\}/g, new Date().toLocaleDateString('ar-EG'))
          .replace(/\{time\}/g, new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }))

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
      toast.success(`✅ تم إرسال ${successCount} رسالة بنجاح${failCount > 0 ? ` (فشل ${failCount})` : ''}`)
    } else {
      toast.error('❌ فشل الإرسال لجميع الأرقام')
    }
  }, [filteredFollowUps, user, toast, queryClient])

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
      date: new Date().toLocaleString('ar-EG'),
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
      toast.error('أدخل رقم التجربة واكتب رسالة واحدة على الأقل')
      return
    }
    try {
      const msg = bulkScriptMessages.find(m => m.trim()) || ''
      const message = msg
        .replace(/\{name\}/g, 'تجربة')
        .replace(/\{salesName\}/g, user?.name || 'السيلز')
        .replace(/\{phone\}/g, bulkScriptTestPhone)
        .replace(/\{date\}/g, new Date().toLocaleDateString('ar-EG'))
        .replace(/\{time\}/g, new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }))

      const sendBody: any = { phone: bulkScriptTestPhone, message }
      if (bulkScriptSessionIndex !== 'auto') sendBody.sessionIndex = bulkScriptSessionIndex
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sendBody)
      })
      const result = await res.json()
      if (result.success) toast.success(`✅ تم إرسال رسالة التجربة بنجاح${result.sessionUsed !== undefined ? ` (رقم ${result.sessionUsed + 1})` : ''}`)
      else toast.error(`❌ فشل: ${result.error || 'خطأ غير معروف'}`)
    } catch {
      toast.error('❌ فشل الاتصال بالواتساب')
    }
  }, [bulkScriptTestPhone, bulkScriptMessages, user, toast, bulkScriptSessionIndex])

  // ✅ Smart Bulk Script - Main send function
  const handleBulkScriptStart = useCallback(async (retryTargets?: { visitor: any }[]) => {
    const validMessages = bulkScriptMessages.filter(m => m.trim())
    if (validMessages.length === 0) {
      toast.error('اكتب رسالة واحدة على الأقل')
      return
    }

    // Daily limit check
    const dailySent = getDailyCount()
    const remaining = bulkScriptDailyLimit - dailySent
    if (remaining <= 0) {
      toast.error(`⚠️ وصلت الحد اليومي (${bulkScriptDailyLimit} رسالة). كمّل بكرة!`)
      return
    }

    let targets = retryTargets || getBulkScriptTargets().map(t => ({ visitor: t.visitor }))
    if (targets.length === 0) {
      toast.error('لا يوجد أشخاص للإرسال إليهم')
      return
    }

    // Limit targets to daily remaining
    if (targets.length > remaining) {
      targets = targets.slice(0, remaining)
      toast.warning(`⚠️ سيتم الإرسال لـ ${remaining} فقط (الحد اليومي)`)
    }

    // Check WhatsApp
    try {
      const statusRes = await fetch('/api/whatsapp/status')
      if (statusRes.ok) {
        const status = await statusRes.json()
        if (!status.isReady) {
          toast.error('❌ الواتساب غير متصل')
          return
        }
      } else {
        toast.error('❌ الواتساب غير متصل')
        return
      }
    } catch {
      toast.error('❌ الواتساب غير متصل')
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
        setBulkScriptProgress(prev => ({ ...prev, currentName: `⏸️ استراحة مجموعة (${Math.ceil(batchBreak / 60)} دقيقة)...`, countdown: batchBreak }))
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
          .replace(/\{salesName\}/g, user?.name || 'السيلز')
          .replace(/\{phone\}/g, visitor.phone)
          .replace(/\{date\}/g, new Date().toLocaleDateString('ar-EG'))
          .replace(/\{time\}/g, new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }))
        message = addTextVariation(message)

        const sendBody: any = { phone: visitor.phone, message }
        if (bulkScriptSessionIndex !== 'auto') sendBody.sessionIndex = bulkScriptSessionIndex
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
                notes: `تم إرسال رسالة عبر السكريبت الذكي (إرسال جماعي)`,
                contacted: true,
                salesName: user?.name,
                visitorData: { name: visitor.name, phone: visitor.phone, source: visitor.source }
              }),
            })
          } catch {}
        } else {
          failedList.push({ name: visitor.name, phone: visitor.phone, error: result.error || 'خطأ غير معروف' })
        }
      } catch (error: any) {
        failedList.push({ name: visitor.name, phone: visitor.phone, error: error.message || 'خطأ في الاتصال' })
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
  }, [bulkScriptMessages, getBulkScriptTargets, bulkScriptDelayMin, bulkScriptDelayMax, bulkScriptDailyLimit, bulkScriptBatchSize, bulkScriptBatchBreakMin, bulkScriptBatchBreakMax, user, toast, queryClient, getDailyCount, incrementDailyCount, addTextVariation, saveLastSession, sourceFilter])

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

  // Stats
  const stats = {
    total: allFollowUps.length,
    today: allFollowUps.filter(fu => getFollowUpPriority(fu) === 'today').length,
    overdue: allFollowUps.filter(fu => getFollowUpPriority(fu) === 'overdue').length,
    contactedToday: followUps.filter(fu => {
      const today = new Date().toDateString()
      return fu.contacted && new Date(fu.updatedAt || fu.createdAt).toDateString() === today
    }).length,
    expiredMembers: expiredMembers.length,
    expiringMembers: expiringMembers.length,
    dayUse: dayUseRecords.length,
    invitations: sortedInvitations.length,
    visitors: visitors.length,
    convertedToMembers: followUps.filter(fu => isVisitorAMember(fu.visitor.phone)).length,

    // ✅ إحصائية مبسطة: عدد المتابعات المخفية (اللي اشتركوا)
    // بسيط: أي شخص رقمه موجود في الأعضاء النشطين
    subscribedAndHidden: allFollowUps.filter(fu => isVisitorAMember(fu.visitor.phone)).length
  }

  // 🎂 أعضاء عيد ميلادهم اليوم
  const birthdayMembers = useMemo(() => {
    const today = new Date()
    const todayDay = today.getDate()
    const todayMonth = today.getMonth() + 1
    return (allMembersData as Member[])
      .filter(m => {
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
  const convertedMembers = useMemo(() => {
    return allFollowUps.filter(fu => isVisitorAMember(fu.visitor.phone))
  }, [allFollowUps, isVisitorAMember])

  // 📊 إحصائيات فردية لكل سيلز
  const salesStats = useMemo(() => {
    const statsMap = new Map<string, {
      name: string
      totalFollowUps: number
      conversions: number
      conversionRate: number
      overdueCount: number
      todayCount: number
      contactedToday: number
    }>()

    // جمع كل أسماء السيلز
    const salesNames = new Set<string>()
    followUps.forEach(fu => {
      if (fu.salesName) salesNames.add(fu.salesName)
    })

    // حساب إحصائيات كل سيلز
    salesNames.forEach(salesName => {
      const salesFollowUps = allFollowUps.filter(fu => fu.salesName === salesName)
      const conversions = salesFollowUps.filter(fu => isVisitorAMember(fu.visitor.phone)).length
      const totalFollowUps = salesFollowUps.length
      const conversionRate = totalFollowUps > 0 ? (conversions / totalFollowUps) * 100 : 0
      const overdueCount = salesFollowUps.filter(fu => getFollowUpPriority(fu) === 'overdue').length
      const todayCount = salesFollowUps.filter(fu => getFollowUpPriority(fu) === 'today').length

      const today = new Date().toDateString()
      const contactedToday = followUps.filter(fu =>
        fu.salesName === salesName &&
        fu.contacted &&
        new Date(fu.updatedAt || fu.createdAt).toDateString() === today
      ).length

      statsMap.set(salesName, {
        name: salesName,
        totalFollowUps,
        conversions,
        conversionRate,
        overdueCount,
        todayCount,
        contactedToday
      })
    })

    // ترتيب حسب نسبة التحويل (الأعلى أولاً)
    return Array.from(statsMap.values()).sort((a, b) => b.conversionRate - a.conversionRate)
  }, [allFollowUps, followUps, isVisitorAMember, getFollowUpPriority])

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
          <button
            onClick={() => {
              setShowForm(!showForm)
              setSelectedVisitorId('')
            }}
            className="w-full sm:w-auto bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 font-semibold shadow-lg"
          >
            {showForm ? `❌ ${t('followups.close')}` : `➕ ${t('followups.addNew')}`}
          </button>
        </div>

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
                  href={`https://wa.me/20${m.phone.startsWith('0') ? m.phone.substring(1) : m.phone}?text=${encodeURIComponent(`🎂 كل سنة وانت طيب ${m.name}! 🎉`)}`}
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

        {/* Filter for Expiring Days */}
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-300 dark:border-yellow-600 rounded-xl p-3 sm:p-4 mb-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 w-full sm:w-auto">
              <label className="block text-xs sm:text-sm font-bold text-yellow-900 dark:text-yellow-100 mb-2">
                ⏰ {t('followups.filters.expiringDays')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={expiringDays}
                  onChange={(e) => setExpiringDays(Number(e.target.value))}
                  className="px-3 sm:px-4 py-2 border-2 border-yellow-400 dark:border-yellow-600 dark:bg-gray-700 dark:text-white rounded-lg font-bold text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 w-20 sm:w-24"
                />
                <span className="text-base sm:text-lg font-bold text-yellow-900 dark:text-yellow-100">{t('followups.days')}</span>
              </div>
            </div>
            <div className="text-center w-full sm:w-auto">
              <p className="text-[10px] sm:text-xs text-yellow-800 mb-1">{t('followups.stats.membersCount')}</p>
              <p className="text-3xl sm:text-4xl font-bold text-yellow-900">{stats.expiringMembers}</p>
            </div>
          </div>
        </div>

        {/* 🎯 Quick Personal Filters */}
        {user?.name && (
          <div className="bg-gradient-to-r from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20 border-2 border-primary-300 dark:border-primary-600 rounded-xl p-3 sm:p-4 mb-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
            <h3 className="font-bold text-primary-900 dark:text-primary-100 mb-3 flex items-center gap-2 text-sm sm:text-base">
              <span>🎯</span>
              <span>{t('followups.quickFilters.title')} - {user.name}</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSalesFilter('all')}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                  salesFilter === 'all'
                    ? 'bg-primary-600 text-white shadow-lg'
                    : 'bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 border border-primary-300 dark:border-primary-600'
                }`}
              >
                📋 {t('followups.quickFilters.all')} ({allFollowUps.length})
              </button>
              <button
                onClick={() => setSalesFilter('my-followups')}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                  salesFilter === 'my-followups'
                    ? 'bg-primary-600 text-white shadow-lg'
                    : 'bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 border border-primary-300 dark:border-primary-600'
                }`}
              >
                👤 {t('followups.quickFilters.myFollowups')} ({allFollowUps.filter(fu => fu.salesName === user.name).length})
              </button>
              <button
                onClick={() => setSalesFilter('my-overdue')}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                  salesFilter === 'my-overdue'
                    ? 'bg-red-600 text-white shadow-lg'
                    : 'bg-white dark:bg-gray-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-300 dark:border-red-600'
                }`}
              >
                🔥 {t('followups.quickFilters.myOverdue')} ({allFollowUps.filter(fu => fu.salesName === user.name && getFollowUpPriority(fu) === 'overdue').length})
              </button>
              <button
                onClick={() => setSalesFilter('today')}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                  salesFilter === 'today'
                    ? 'bg-orange-600 text-white shadow-lg'
                    : 'bg-white dark:bg-gray-700 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 border border-orange-300 dark:border-orange-600'
                }`}
              >
                ⚡ {t('followups.quickFilters.today')} ({allFollowUps.filter(fu => {
                  const p = getFollowUpPriority(fu)
                  return p === 'today' || p === 'overdue'
                }).length})
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10 gap-2 sm:gap-3 mb-6">
          <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">{t('followups.stats.total')}</p>
            <p className="text-2xl sm:text-3xl font-bold dark:text-white">{stats.total}</p>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">🔥 {t('followups.stats.overdue')}</p>
            <p className="text-2xl sm:text-3xl font-bold dark:text-white">{stats.overdue}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">⚡ {t('followups.stats.today')}</p>
            <p className="text-2xl sm:text-3xl font-bold dark:text-white">{stats.today}</p>
          </div>
          <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">❌ {t('followups.stats.expiredMembers')}</p>
            <p className="text-2xl sm:text-3xl font-bold dark:text-white">{stats.expiredMembers}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">⏰ {t('followups.stats.expiringMembers')}</p>
            <p className="text-2xl sm:text-3xl font-bold dark:text-white">{stats.expiringMembers}</p>
          </div>
          <div className="bg-gradient-to-br from-pink-500 to-pink-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">🎁 {t('followups.stats.dayUse')}</p>
            <p className="text-2xl sm:text-3xl font-bold dark:text-white">{stats.dayUse}</p>
          </div>
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">👥 {t('followups.stats.invitations')}</p>
            <p className="text-2xl sm:text-3xl font-bold dark:text-white">{stats.invitations}</p>
          </div>
          <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">👤 {t('followups.stats.visitors')}</p>
            <p className="text-2xl sm:text-3xl font-bold dark:text-white">{stats.visitors}</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">✅ {t('followups.stats.contactedToday')}</p>
            <p className="text-2xl sm:text-3xl font-bold dark:text-white">{stats.contactedToday}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">🎉 {t('followups.stats.subscribedAndHidden')}</p>
            <p className="text-2xl sm:text-3xl font-bold dark:text-white">{stats.subscribedAndHidden}</p>
          </div>
        </div>

        {/* 🏆 Sales Leaderboard */}
        {salesStats.length > 0 && (
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-2 border-amber-300 dark:border-amber-600 rounded-xl p-4 sm:p-6 mb-6 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
            <h3 className="font-bold text-amber-900 dark:text-amber-100 mb-4 flex items-center gap-2 text-lg sm:text-xl">
              <span>🏆</span>
              <span>{t('followups.analytics.leaderboard.title')}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {salesStats.map((stat, index) => {
                const isCurrentUser = user?.name === stat.name
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`

                return (
                  <div
                    key={stat.name}
                    className={`bg-white dark:bg-gray-700 rounded-lg p-4 shadow-md border-2 transition-all hover:shadow-lg ${
                      isCurrentUser
                        ? 'border-primary-500 dark:border-primary-400 ring-2 ring-primary-300 dark:ring-primary-600'
                        : index < 3
                        ? 'border-amber-400 dark:border-amber-500'
                        : 'border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{medal}</span>
                        <div>
                          <h4 className={`font-bold text-sm sm:text-base ${
                            isCurrentUser ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-gray-100'
                          }`}>
                            {stat.name}
                            {isCurrentUser && <span className="text-xs text-primary-600 dark:text-primary-400 ml-1">({t('followups.analytics.leaderboard.you')})</span>}
                          </h4>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('followups.analytics.leaderboard.successRate')}</p>
                        <p className={`text-2xl font-bold ${
                          stat.conversionRate >= 30 ? 'text-green-600' :
                          stat.conversionRate >= 15 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {stat.conversionRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-primary-50 dark:bg-primary-900/30 rounded p-2">
                        <p className="text-[10px] text-primary-700 dark:text-primary-300 font-medium">{t('followups.analytics.leaderboard.followupsShort')}</p>
                        <p className="text-lg font-bold text-primary-900 dark:text-primary-200">{stat.totalFollowUps}</p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/30 rounded p-2">
                        <p className="text-[10px] text-green-700 dark:text-green-300 font-medium">{t('followups.analytics.leaderboard.conversionsShort')}</p>
                        <p className="text-lg font-bold text-green-900 dark:text-green-200">{stat.conversions}</p>
                      </div>
                      <div className="bg-primary-50 dark:bg-primary-900/30 rounded p-2">
                        <p className="text-[10px] text-primary-700 dark:text-primary-300 font-medium">{t('followups.analytics.leaderboard.todayShort')}</p>
                        <p className="text-lg font-bold text-primary-900 dark:text-primary-200">{stat.contactedToday}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2 text-xs">
                      {stat.overdueCount > 0 && (
                        <div className="flex-1 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded flex items-center justify-center gap-1">
                          <span>🔥</span>
                          <span className="font-bold">{stat.overdueCount}</span>
                          <span>{t('followups.analytics.leaderboard.overdueShort')}</span>
                        </div>
                      )}
                      {stat.todayCount > 0 && (
                        <div className="flex-1 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded flex items-center justify-center gap-1">
                          <span>⚡</span>
                          <span className="font-bold">{stat.todayCount}</span>
                          <span>{t('followups.analytics.leaderboard.todayShort')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
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
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false)
            setSelectedVisitorId('')
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
                جاري الإرسال الجماعي
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {bulkProgress.current} / {bulkProgress.total}
              </p>
              {bulkProgress.currentName && (
                <p className="text-sm text-primary-600 dark:text-primary-400 mt-2">
                  📱 جاري الإرسال إلى: <span className="font-bold">{bulkProgress.currentName}</span>
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
                ⏰ الانتظار 15 ثانية بين كل رسالة
              </p>
            </div>

            {/* Abort Button */}
            <button
              onClick={() => {
                bulkSendAbortedRef.current = true
              }}
              className="w-full bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-bold"
            >
              🛑 إيقاف الإرسال
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
              <h2 className="text-xl font-bold flex items-center gap-2">🤖 سكريبت إرسال ذكي</h2>
              <p className="text-sm opacity-90 mt-1">إرسال رسائل متعددة بتبديل عشوائي وتأخير ذكي</p>
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
                        📋 آخر إرسال: <span className="font-bold">{lastSession.date}</span> — تم إرسال <span className="font-bold">{lastSession.sent}</span> رسالة
                      </p>
                    )}
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      📊 اتبعت النهارده: <span className="font-bold">{dailySent}</span> / <span className="font-bold">{bulkScriptDailyLimit}</span> — متبقي <span className="font-bold text-green-600 dark:text-green-400">{Math.max(0, bulkScriptDailyLimit - dailySent)}</span> رسالة
                    </p>
                  </div>
                )
              })()}

              {/* WhatsApp Session Picker */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">📱 ابعت من رقم</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setBulkScriptSessionIndex('auto')}
                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-all border-2 ${
                      bulkScriptSessionIndex === 'auto'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-400'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    🔄 تلقائي
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
                      {sess.isReady ? '✅' : '⭕'} رقم {sess.sessionIndex + 1}
                      {sess.phoneNumber && <span className="text-xs font-mono ms-1" dir="ltr">{sess.phoneNumber}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* B. Contact Filter */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">فلتر التواصل</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'not-contacted' as const, label: 'محدش تواصل معاهم', icon: '🆕' },
                    { value: 'contacted' as const, label: 'تم التواصل', icon: '📞' },
                    { value: 'all' as const, label: 'الجميع', icon: '👥' },
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
                    ⏭️ تخطي اللي اتواصل معاهم في آخر
                    <input
                      type="number"
                      min={0}
                      value={bulkScriptSkipDays}
                      onChange={e => setBulkScriptSkipDays(parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-1 rounded border border-yellow-300 dark:border-yellow-700 bg-white dark:bg-gray-700 text-center font-bold"
                    />
                    يوم
                  </label>
                </div>
              )}

              {/* D. Messages */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">الرسائل ({bulkScriptMessages.length})</label>
                  {bulkScriptMessages.length < 10 && (
                    <button
                      onClick={() => setBulkScriptMessages([...bulkScriptMessages, ''])}
                      className="text-xs px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg font-bold hover:bg-purple-200"
                    >
                      + إضافة رسالة
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {bulkScriptMessages.map((msg, idx) => (
                    <div key={idx} className="relative">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400">رسالة {idx + 1}</span>
                        {bulkScriptMessages.length > 1 && (
                          <button
                            onClick={() => setBulkScriptMessages(bulkScriptMessages.filter((_, i) => i !== idx))}
                            className="text-xs text-red-500 hover:text-red-700 font-bold"
                          >
                            ✕ حذف
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
                        placeholder={`اكتب الرسالة ${idx + 1} هنا...`}
                        dir="rtl"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  💡 المتغيرات المتاحة: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{name}'}</code> <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{salesName}'}</code> <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{date}'}</code> <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{time}'}</code> <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{phone}'}</code>
                </p>
              </div>

              {/* E. Presets */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={bulkScriptPresetName}
                    onChange={e => setBulkScriptPresetName(e.target.value)}
                    placeholder="اسم المجموعة..."
                    className="flex-1 min-w-[120px] px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  />
                  <button
                    onClick={() => {
                      if (!bulkScriptPresetName.trim()) { toast.error('اكتب اسم للمجموعة'); return }
                      saveBulkPreset(bulkScriptPresetName.trim(), bulkScriptMessages)
                      toast.success('✅ تم حفظ المجموعة')
                      setBulkScriptPresetName('')
                    }}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700"
                  >
                    💾 حفظ
                  </button>
                  {getBulkPresets().length > 0 && (
                    <select
                      onChange={e => {
                        const preset = getBulkPresets().find(p => p.name === e.target.value)
                        if (preset) {
                          setBulkScriptMessages([...preset.messages])
                          toast.success(`تم تحميل "${preset.name}"`)
                        }
                        e.target.value = ''
                      }}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                      defaultValue=""
                    >
                      <option value="" disabled>📂 تحميل مجموعة...</option>
                      {getBulkPresets().map(p => (
                        <option key={p.name} value={p.name}>{p.name} ({p.messages.length} رسالة)</option>
                      ))}
                    </select>
                  )}
                  {getBulkPresets().length > 0 && (
                    <select
                      onChange={e => {
                        if (e.target.value) {
                          deleteBulkPreset(e.target.value)
                          toast.success('تم حذف المجموعة')
                        }
                        e.target.value = ''
                      }}
                      className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-600 bg-white dark:bg-gray-700 text-sm text-red-600"
                      defaultValue=""
                    >
                      <option value="" disabled>🗑️ حذف مجموعة...</option>
                      {getBulkPresets().map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* F. Delay */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">⏰ التأخير العشوائي (ثواني)</label>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">من</span>
                  <input
                    type="number"
                    min={5}
                    value={bulkScriptDelayMin}
                    onChange={e => setBulkScriptDelayMin(Math.max(5, parseInt(e.target.value) || 5))}
                    className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-center font-bold"
                  />
                  <span className="text-sm text-gray-500">إلى</span>
                  <input
                    type="number"
                    min={bulkScriptDelayMin}
                    value={bulkScriptDelayMax}
                    onChange={e => setBulkScriptDelayMax(Math.max(bulkScriptDelayMin, parseInt(e.target.value) || bulkScriptDelayMin))}
                    className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-center font-bold"
                  />
                  <span className="text-sm text-gray-500">ثانية</span>
                </div>
              </div>

              {/* F2. Batch Break */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">☕ استراحة مجموعة</label>
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="text-gray-500">كل</span>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={bulkScriptBatchSize}
                    onChange={e => setBulkScriptBatchSize(Math.max(5, parseInt(e.target.value) || 12))}
                    className="w-16 px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-center font-bold"
                  />
                  <span className="text-gray-500">رسالة، استراحة</span>
                  <input
                    type="number"
                    min={1}
                    value={Math.round(bulkScriptBatchBreakMin / 60)}
                    onChange={e => setBulkScriptBatchBreakMin(Math.max(60, (parseInt(e.target.value) || 2) * 60))}
                    className="w-14 px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-center font-bold"
                  />
                  <span className="text-gray-500">إلى</span>
                  <input
                    type="number"
                    min={Math.round(bulkScriptBatchBreakMin / 60)}
                    value={Math.round(bulkScriptBatchBreakMax / 60)}
                    onChange={e => setBulkScriptBatchBreakMax(Math.max(bulkScriptBatchBreakMin, (parseInt(e.target.value) || 5) * 60))}
                    className="w-14 px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-center font-bold"
                  />
                  <span className="text-gray-500">دقيقة</span>
                </div>
              </div>

              {/* F3. Daily Limit */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">🛡️ الحد اليومي</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">أقصى</span>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={bulkScriptDailyLimit}
                    onChange={e => setBulkScriptDailyLimit(Math.max(10, parseInt(e.target.value) || 80))}
                    className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-center font-bold"
                  />
                  <span className="text-sm text-gray-500">رسالة في اليوم</span>
                  <span className="text-xs text-gray-400 ms-2">(اتبعت النهارده: {getDailyCount()})</span>
                </div>
              </div>

              {/* G. Test Message */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <label className="block text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">🧪 رسالة تجربة</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={bulkScriptTestPhone}
                    onChange={e => setBulkScriptTestPhone(e.target.value)}
                    placeholder="رقم التجربة (مثل 01012345678)"
                    className="flex-1 px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-sm"
                  />
                  <button
                    onClick={handleBulkScriptTest}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 whitespace-nowrap"
                  >
                    📤 ابعت تجربة
                  </button>
                </div>
              </div>

              {/* H. Summary */}
              <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-300 dark:border-purple-700 rounded-lg p-4">
                <p className="text-sm font-bold text-purple-800 dark:text-purple-300 text-center">
                  📊 سيتم إرسال لـ <span className="text-lg">{getBulkScriptTargets().length}</span> شخص، تبديل عشوائي بين <span className="text-lg">{bulkScriptMessages.filter(m => m.trim()).length}</span> رسالة، بفاصل <span className="text-lg">{bulkScriptDelayMin}-{bulkScriptDelayMax}</span> ثانية
                </p>
              </div>

              {/* I. Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleBulkScriptStart()}
                  disabled={bulkScriptMessages.every(m => !m.trim()) || getBulkScriptTargets().length === 0}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-bold text-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  🚀 ابدأ الإرسال
                </button>
                <button
                  onClick={() => setShowBulkScriptModal(false)}
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-500"
                >
                  إلغاء
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
                {bulkScriptPaused ? 'تم الإيقاف المؤقت' : 'جاري الإرسال الذكي'}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {bulkScriptProgress.current} / {bulkScriptProgress.total}
              </p>
            </div>

            {/* Main Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>التقدم الكلي</span>
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
                  <span>{bulkScriptProgress.countdown > bulkScriptDelayMax ? '☕ استراحة مجموعة' : '⏰ الرسالة الجاية بعد'}</span>
                  <span>{bulkScriptProgress.countdown > 60 ? `${Math.ceil(bulkScriptProgress.countdown / 60)} دقيقة` : `${bulkScriptProgress.countdown} ثانية`}</span>
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
                  📱 جاري الإرسال إلى: <span className="font-bold">{bulkScriptProgress.currentName}</span>
                </p>
                <p className="text-purple-600 dark:text-purple-400">
                  ✉️ نص رسالة {bulkScriptProgress.currentMsgIndex} من {bulkScriptMessages.filter(m => m.trim()).length}
                </p>
              </div>
            )}

            {/* Success/Fail Counters */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">✅ {bulkScriptProgress.successCount}</p>
                <p className="text-xs text-green-700 dark:text-green-400">نجاح</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-600">❌ {bulkScriptProgress.failCount}</p>
                <p className="text-xs text-red-700 dark:text-red-400">فشل</p>
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
                {bulkScriptPaused ? '▶️ استكمال' : '⏸️ إيقاف مؤقت'}
              </button>
              <button
                onClick={() => {
                  bulkScriptAbortedRef.current = true
                  bulkScriptPausedRef.current = false
                  setBulkScriptPaused(false)
                }}
                className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-bold"
              >
                🛑 إيقاف نهائي
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
              <h2 className="text-xl font-bold">📊 تقرير الإرسال</h2>
              <p className="text-sm opacity-90 mt-1">اكتمل الإرسال الذكي</p>
            </div>

            <div className="p-5 space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">✅ {bulkScriptReport.success.length}</p>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">تم الإرسال بنجاح</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-red-600">❌ {bulkScriptReport.failed.length}</p>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">فشل الإرسال</p>
                </div>
              </div>

              {/* Failed List */}
              {bulkScriptReport.failed.length > 0 && (
                <div>
                  <h3 className="font-bold text-red-600 dark:text-red-400 mb-2 text-sm">الأرقام الفاشلة:</h3>
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
                        visitor: { id: '', name: f.name, phone: f.phone, source: '', status: '' }
                      }))
                      setBulkScriptReport(null)
                      handleBulkScriptStart(retryTargets)
                    }}
                    className="w-full mt-3 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-bold hover:from-orange-600 hover:to-red-600 transition-all"
                  >
                    🔄 إعادة الإرسال للفاشلين ({bulkScriptReport.failed.length})
                  </button>
                </div>
              )}

              {/* Close */}
              <button
                onClick={() => setBulkScriptReport(null)}
                className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-500"
              >
                إغلاق
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
                              {new Date(fu.createdAt).toLocaleDateString('ar-EG')}
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

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-xs sm:text-sm font-medium mb-1 dark:text-gray-200">🔍 {t('followups.filters.search')}</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              placeholder={t('followups.filters.searchPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1 dark:text-gray-200">📊 {t('followups.filters.priority')}</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="all">{t('followups.filters.all')}</option>
              <option value="overdue">🔥 {t('followups.priority.overdue')}</option>
              <option value="today">⚡ {t('followups.priority.today')}</option>
              <option value="upcoming">📅 {t('followups.priority.upcoming')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1 dark:text-gray-200">📈 {t('followups.filters.result')}</label>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="all">{t('followups.filters.all')}</option>
              <option value="interested">✅ {t('followups.results.interested')}</option>
              <option value="not-interested">❌ {t('followups.results.notInterested')}</option>
              <option value="postponed">⏸️ {t('followups.results.postponed')}</option>
              <option value="subscribed">🎉 {t('followups.results.subscribed')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1 dark:text-gray-200">📞 {t('followups.filters.contacted')}</label>
            <select
              value={contactedFilter}
              onChange={(e) => setContactedFilter(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="all">{t('followups.filters.all')}</option>
              <option value="contacted">✅ {t('followups.filters.contactedYes')}</option>
              <option value="not-contacted">❌ {t('followups.filters.contactedNo')}</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Buttons */}
        <div className="mt-3 sm:mt-4 flex flex-wrap gap-1.5 sm:gap-2">
          <button
            onClick={() => setSourceFilter('all')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
              sourceFilter === 'all'
                ? 'bg-primary-600 text-white shadow-lg'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {t('followups.filters.all')} ({allFollowUps.length})
          </button>
          <button
            onClick={() => setSourceFilter('expired-member')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
              sourceFilter === 'expired-member'
                ? 'bg-red-600 text-white shadow-lg'
                : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50'
            }`}
          >
            ❌ {t('followups.sources.expiredMembers')} ({stats.expiredMembers})
          </button>
          <button
            onClick={() => setSourceFilter('expiring-member')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
              sourceFilter === 'expiring-member'
                ? 'bg-yellow-600 text-white shadow-lg'
                : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/50'
            }`}
          >
            ⏰ {t('followups.sources.expiringMembers')} ({stats.expiringMembers})
          </button>
          <button
            onClick={() => setSourceFilter('member-invitation')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
              sourceFilter === 'member-invitation'
                ? 'bg-cyan-600 text-white shadow-lg'
                : 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50'
            }`}
          >
            👥 {t('followups.sources.memberInvitations')} ({stats.invitations})
          </button>
          <button
            onClick={() => setSourceFilter('dayuse')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
              sourceFilter === 'dayuse'
                ? 'bg-pink-600 text-white shadow-lg'
                : 'bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-900/50'
            }`}
          >
            🎁 {t('followups.sources.dayUse')} ({stats.dayUse})
          </button>
          <button
            onClick={() => setSourceFilter('visitors')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
              sourceFilter === 'visitors'
                ? 'bg-primary-600 text-white shadow-lg'
                : 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50'
            }`}
          >
            👤 {t('followups.sources.visitors')} ({stats.visitors})
          </button>

          {/* زر سكريبت الإرسال الذكي */}
          {filteredFollowUps.length > 0 && (
            <button
              onClick={() => { setShowBulkScriptModal(true); fetchWaSessions() }}
              className="px-4 py-2 rounded-lg font-bold text-sm transition-all bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:from-purple-700 hover:to-indigo-700 flex items-center gap-2"
            >
              🤖 سكريبت إرسال ذكي ({filteredFollowUps.length})
            </button>
          )}

          {/* زر تبديل الترتيب */}
          <button
            onClick={() => { const v = !sortByPriority; setSortByPriority(v); localStorage.setItem('followups-sortByPriority', String(v)) }}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all flex items-center gap-1.5 ${
              sortByPriority
                ? 'bg-orange-600 text-white shadow-lg'
                : 'bg-primary-600 text-white shadow-lg'
            }`}
          >
            {sortByPriority ? '🔥' : '📅'} {direction === 'rtl'
              ? (sortByPriority ? 'ترتيب: أولوية' : 'ترتيب: الأحدث')
              : (sortByPriority ? 'Sort: Priority' : 'Sort: Newest')}
          </button>
        </div>
      </div>

      {/* Analytics View */}
      {viewMode === 'analytics' && <SalesDashboard />}

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
                  } hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]`}
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
                          onClick={() => openQuickSubscribe(followUp.visitor)}
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
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">الاسم</div>
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
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">رقم الهاتف</div>
                            <div className="flex gap-2 items-center">
                              <span className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200" dir="ltr">
                                {followUp.visitor.phone}
                              </span>
                              <button
                                onClick={() => openTemplateModal(followUp.visitor)}
                                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all"
                                title="رسائل جاهزة"
                              >
                                💬 واتساب
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
                            <span className="text-blue-600 dark:text-blue-400 text-xs font-semibold">💬 آخر تعليق:</span>
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
                            <span className="text-gray-600 dark:text-gray-300 text-xs font-semibold">📝 ملاحظات:</span>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200">{followUp.notes}</p>
                        </div>
                      ) : null
                    })()}

                    {/* النتيجة وحالة التواصل والتواريخ */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">النتيجة</span>
                        {getResultBadge(followUp.result)}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">حالة التواصل</span>
                        {followUp.contacted ? (
                          <span className="text-green-600 text-xs font-medium">✅ تم</span>
                        ) : (
                          <span className="text-orange-600 text-xs font-medium">⏳ لم يتم</span>
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
            <span>تحولوا لأعضاء / جددوا الاشتراك</span>
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
                {editTarget.type === 'invitation' ? 'تعديل الدعوة' : 'تعديل الزائر'}
              </h3>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">الاسم</label>
                <input
                  type="text"
                  value={editTarget.name}
                  onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">رقم الموبايل</label>
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
                حفظ التعديل
              </button>
              <button
                onClick={() => { setShowEditModal(false); setEditTarget(null) }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-bold py-2.5 px-4 rounded-lg transition-colors"
              >
                إلغاء
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
                  refetchFollowUps()
                  toast.success(`تم تحويل ${selectedVisitorForSubscribe.name} إلى عضو بنجاح!`)
                }}
                prefillData={{
                  name: selectedVisitorForSubscribe.name,
                  phone: selectedVisitorForSubscribe.phone
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
