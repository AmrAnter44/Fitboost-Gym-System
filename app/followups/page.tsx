'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionDenied from '../../components/PermissionDenied'
import FollowUpForm from './FollowUpForm'
import SalesDashboard from './SalesDashboard'
import MessageTemplateManager, { MessageTemplate } from './MessageTemplateManager'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../contexts/ToastContext'
import { useRouter } from 'next/navigation'
import {
  fetchFollowUpsData,
  fetchVisitorsData,
  fetchMembersData,
  fetchDayUseData,
  fetchInvitationsData,
  deleteFollowUp
} from '@/lib/api/followups'

interface Visitor {
  id: string
  name: string
  phone: string
  source: string
  status: string
}

interface FollowUp {
  id: string
  notes: string
  contacted: boolean
  nextFollowUpDate?: string
  result?: string
  salesName?: string
  createdAt: string
  visitor: Visitor
}

interface Member {
  id: string
  phone: string
  name: string
  expiryDate?: string
  isActive: boolean
}

export default function FollowUpsPage() {
  const { hasPermission, loading: permissionsLoading, user } = usePermissions()
  const { t, direction } = useLanguage()
  const toast = useToast()
  const router = useRouter()

  const [showForm, setShowForm] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedVisitorForHistory, setSelectedVisitorForHistory] = useState<Visitor | null>(null)
  const [selectedVisitorId, setSelectedVisitorId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [selectedVisitorForTemplate, setSelectedVisitorForTemplate] = useState<Visitor | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{id: string, name: string} | null>(null)

  // View mode state
  const [viewMode, setViewMode] = useState<'list' | 'analytics'>('list')

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
  })

  const {
    data: dayUseRecords = [],
    error: dayUseError
  } = useQuery({
    queryKey: ['dayuse-followups'],
    queryFn: fetchDayUseData,
    retry: 1,
    staleTime: 2 * 60 * 1000,
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

  // Extract visitors and members from queries
  const visitors = visitorsData
  const allMembers = allMembersData
  const members = useMemo(() =>
    (allMembersData || []).filter((m: Member) => m.isActive === true),
    [allMembersData]
  )

  const loading = loadingFollowUps

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteFollowUp,
    onSuccess: () => {
      toast.success(t('followups.messages.deleteSuccess'))
      refetchFollowUps()
    },
    onError: (error: Error) => {
      toast.error(error.message || t('followups.messages.deleteError'))
    }
  })

  // Error handling for all queries
  useEffect(() => {
    const errors = [followUpsError, visitorsError, membersError, dayUseError, invitationsError]
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
  }, [followUpsError, visitorsError, membersError, dayUseError, invitationsError, toast, router])

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [resultFilter, setResultFilter] = useState('all')
  const [contactedFilter, setContactedFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all') // ✅ فلتر المصدر
  const [salesFilter, setSalesFilter] = useState('all') // ✅ فلتر السيلز (all, my-followups, my-overdue, today)
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

  // ✅ دمج المتابعات الحقيقية مع الأعضاء المنتهيين + الأعضاء القريبين من الانتهاء + Day Use + Invitations
  const allFollowUps = useMemo(() => {
    // 1. الأعضاء المنتهيين
    const expiredFollowUps: FollowUp[] = expiredMembers.map(member => ({
      id: member.id,
      notes: 'عضو منتهي - يحتاج تجديد اشتراك',
      contacted: false,
      nextFollowUpDate: new Date().toISOString(),
      result: undefined,
      salesName: 'نظام',
      createdAt: new Date().toISOString(),
      visitor: member
    }))

    // 2. الأعضاء اللي اشتراكهم قرب ينتهي
    const expiringFollowUps: FollowUp[] = expiringMembers.map((member: any) => ({
      id: member.id,
      notes: `اشتراك قرب ينتهي - باقي ${member.daysLeft} يوم فقط`,
      contacted: false,
      nextFollowUpDate: new Date().toISOString(),
      result: undefined,
      salesName: 'نظام',
      createdAt: new Date().toISOString(),
      visitor: member
    }))

    // 3. Day Use (استخدام InBody يوم واحد)
    const dayUseFollowUps: FollowUp[] = dayUseRecords.map(record => ({
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
      }
    }))

    // 4. Invitations (دعوات من أعضاء)
    const invitationFollowUps: FollowUp[] = invitations.map(inv => ({
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
      }
    }))

    return [...followUps, ...expiredFollowUps, ...expiringFollowUps, ...dayUseFollowUps, ...invitationFollowUps]
  }, [followUps, expiredMembers, expiringMembers, dayUseRecords, invitations])

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
      const invitation = invitations.find(inv => `invitation-${inv.id}` === formData.visitorId)
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
        await refetchFollowUps()
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

  // ✅ تحسين الأداء: تنظيف رقم التليفون (memoized)
  const normalizePhone = useCallback((phone: string) => {
    if (!phone) return ''
    let normalized = phone.replace(/[\s\-\(\)\+]/g, '').trim()
    if (normalized.startsWith('2')) normalized = normalized.substring(1)
    if (normalized.startsWith('0')) normalized = normalized.substring(1)
    return normalized
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
  const sendWhatsAppTemplate = useCallback((template: MessageTemplate) => {
    if (!selectedVisitorForTemplate) return

    // استبدال المتغيرات في الرسالة
    const message = template.message
      .replace(/\{name\}/g, selectedVisitorForTemplate.name)
      .replace(/\{salesName\}/g, user?.name || 'السيلز')
      .replace(/\{phone\}/g, selectedVisitorForTemplate.phone)
      .replace(/\{date\}/g, new Date().toLocaleDateString('ar-EG'))
      .replace(/\{time\}/g, new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }))

    const encodedMessage = encodeURIComponent(message)
    const url = `https://wa.me/2${selectedVisitorForTemplate.phone}?text=${encodedMessage}`

    window.open(url, '_blank')
    setShowTemplateModal(false)

    // فتح فورم المتابعة
    setTimeout(() => {
      openQuickFollowUp(selectedVisitorForTemplate)
    }, 500)
  }, [selectedVisitorForTemplate, openQuickFollowUp, user])

  // 🗑️ حذف متابعة
  const handleDeleteFollowUp = useCallback((followUpId: string, visitorName: string) => {
    // لا نحذف المتابعات المولدة تلقائياً (الأعضاء المنتهيين والقريبين من الانتهاء)
    if (followUpId.startsWith('expired-') || followUpId.startsWith('expiring-') || followUpId.startsWith('dayuse-') || followUpId.startsWith('invitation-')) {
      toast.error(t('followups.messages.cannotDeleteAuto'))
      return
    }

    setDeleteTarget({ id: followUpId, name: visitorName })
    setShowDeleteConfirm(true)
  }, [toast, t])

  // تأكيد الحذف
  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id)
      setShowDeleteConfirm(false)
      setDeleteTarget(null)
    }
  }, [deleteTarget, deleteMutation])

  // إلغاء الحذف
  const cancelDelete = useCallback(() => {
    setShowDeleteConfirm(false)
    setDeleteTarget(null)
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
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    sortedFollowUps.forEach(fu => {
      const normalizedPhone = normalizePhone(fu.visitor.phone)
      if (normalizedPhone && fu.notes && fu.notes.trim()) {
        commentMap.set(normalizedPhone, {
          notes: fu.notes,
          createdAt: fu.createdAt,
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
        const matchesSearch =
          fu.visitor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          fu.visitor.phone.includes(searchTerm) ||
          fu.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (fu.salesName && fu.salesName.toLowerCase().includes(searchTerm.toLowerCase()))

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
        // ✅ ترتيب جديد حسب الأولوية
        const aPriority = getFollowUpPriority(a)
        const bPriority = getFollowUpPriority(b)

        // ترتيب: overdue > today > upcoming > none
        const priorityOrder: {[key: string]: number} = { overdue: 0, today: 1, upcoming: 2, none: 3 }
        return priorityOrder[aPriority] - priorityOrder[bPriority]
      })
  }, [allFollowUps, searchTerm, resultFilter, contactedFilter, priorityFilter, sourceFilter, salesFilter, isVisitorAMember, getFollowUpPriority, user])

  // إعادة تعيين الصفحة للأولى عند تغيير الفلاتر
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, resultFilter, contactedFilter, priorityFilter, sourceFilter, salesFilter])

  // حساب الصفحات
  const totalPages = Math.ceil(filteredFollowUps.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentFollowUps = filteredFollowUps.slice(startIndex, endIndex)

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const getResultBadge = useCallback((result?: string) => {
    const badges = {
      interested: 'bg-green-100 text-green-800',
      'not-interested': 'bg-red-100 text-red-800',
      postponed: 'bg-yellow-100 text-yellow-800',
      subscribed: 'bg-blue-100 text-blue-800',
    }
    const labels: Record<string, string> = {
      interested: t('followups.results.interested'),
      'not-interested': t('followups.results.notInterested'),
      postponed: t('followups.results.postponed'),
      subscribed: t('followups.results.subscribed'),
    }
    if (!result) return <span className="text-gray-400">-</span>
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[result as keyof typeof badges] || 'bg-gray-100 text-gray-800'}`}>
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
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
          🔥 {t('followups.priority.overdue')}
        </span>
      )
    }
    if (priority === 'today') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800">
          ⚡ {t('followups.priority.today')}
        </span>
      )
    }
    if (priority === 'upcoming') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
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
      return fu.contacted && new Date(fu.createdAt).toDateString() === today
    }).length,
    expiredMembers: expiredMembers.length,
    expiringMembers: expiringMembers.length,
    dayUse: dayUseRecords.length,
    invitations: invitations.length,
    visitors: visitors.length,
    convertedToMembers: followUps.filter(fu => isVisitorAMember(fu.visitor.phone)).length,

    // ✅ إحصائية مبسطة: عدد المتابعات المخفية (اللي اشتركوا)
    // بسيط: أي شخص رقمه موجود في الأعضاء النشطين
    subscribedAndHidden: allFollowUps.filter(fu => isVisitorAMember(fu.visitor.phone)).length
  }

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
        new Date(fu.createdAt).toDateString() === today
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
            <p className="text-gray-600 mt-2 text-sm sm:text-base">{t('followups.subtitle')}</p>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm)
              setSelectedVisitorId('')
            }}
            className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold shadow-lg"
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
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📋 {t('followups.viewModes.list')}
          </button>
          <button
            onClick={() => setViewMode('analytics')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'analytics'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📈 {t('followups.viewModes.analytics')}
          </button>
        </div>

        {/* Filter for Expiring Days */}
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl p-3 sm:p-4 mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 w-full sm:w-auto">
              <label className="block text-xs sm:text-sm font-bold text-yellow-900 mb-2">
                ⏰ {t('followups.filters.expiringDays')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={expiringDays}
                  onChange={(e) => setExpiringDays(Number(e.target.value))}
                  className="px-3 sm:px-4 py-2 border-2 border-yellow-400 rounded-lg font-bold text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 w-20 sm:w-24"
                />
                <span className="text-base sm:text-lg font-bold text-yellow-900">{t('followups.days')}</span>
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
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-xl p-3 sm:p-4 mb-4">
            <h3 className="font-bold text-purple-900 mb-3 flex items-center gap-2 text-sm sm:text-base">
              <span>🎯</span>
              <span>{t('followups.quickFilters.title')} - {user.name}</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSalesFilter('all')}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                  salesFilter === 'all'
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-white text-purple-700 hover:bg-purple-100 border border-purple-300'
                }`}
              >
                📋 {t('followups.quickFilters.all')} ({allFollowUps.length})
              </button>
              <button
                onClick={() => setSalesFilter('my-followups')}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                  salesFilter === 'my-followups'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-blue-700 hover:bg-blue-100 border border-blue-300'
                }`}
              >
                👤 {t('followups.quickFilters.myFollowups')} ({allFollowUps.filter(fu => fu.salesName === user.name).length})
              </button>
              <button
                onClick={() => setSalesFilter('my-overdue')}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                  salesFilter === 'my-overdue'
                    ? 'bg-red-600 text-white shadow-lg'
                    : 'bg-white text-red-700 hover:bg-red-100 border border-red-300'
                }`}
              >
                🔥 {t('followups.quickFilters.myOverdue')} ({allFollowUps.filter(fu => fu.salesName === user.name && getFollowUpPriority(fu) === 'overdue').length})
              </button>
              <button
                onClick={() => setSalesFilter('today')}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                  salesFilter === 'today'
                    ? 'bg-orange-600 text-white shadow-lg'
                    : 'bg-white text-orange-700 hover:bg-orange-100 border border-orange-300'
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
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">{t('followups.stats.total')}</p>
            <p className="text-2xl sm:text-3xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">🔥 {t('followups.stats.overdue')}</p>
            <p className="text-2xl sm:text-3xl font-bold">{stats.overdue}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">⚡ {t('followups.stats.today')}</p>
            <p className="text-2xl sm:text-3xl font-bold">{stats.today}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">❌ {t('followups.stats.expiredMembers')}</p>
            <p className="text-2xl sm:text-3xl font-bold">{stats.expiredMembers}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">⏰ {t('followups.stats.expiringMembers')}</p>
            <p className="text-2xl sm:text-3xl font-bold">{stats.expiringMembers}</p>
          </div>
          <div className="bg-gradient-to-br from-pink-500 to-pink-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">🎁 {t('followups.stats.dayUse')}</p>
            <p className="text-2xl sm:text-3xl font-bold">{stats.dayUse}</p>
          </div>
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">👥 {t('followups.stats.invitations')}</p>
            <p className="text-2xl sm:text-3xl font-bold">{stats.invitations}</p>
          </div>
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">👤 {t('followups.stats.visitors')}</p>
            <p className="text-2xl sm:text-3xl font-bold">{stats.visitors}</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">✅ {t('followups.stats.contactedToday')}</p>
            <p className="text-2xl sm:text-3xl font-bold">{stats.contactedToday}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-xl p-3 sm:p-4 shadow-lg">
            <p className="text-[10px] sm:text-xs opacity-90 mb-1">🎉 {t('followups.stats.subscribedAndHidden')}</p>
            <p className="text-2xl sm:text-3xl font-bold">{stats.subscribedAndHidden}</p>
          </div>
        </div>

        {/* 🏆 Sales Leaderboard */}
        {salesStats.length > 0 && (
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-xl p-4 sm:p-6 mb-6">
            <h3 className="font-bold text-amber-900 mb-4 flex items-center gap-2 text-lg sm:text-xl">
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
                    className={`bg-white rounded-lg p-4 shadow-md border-2 transition-all hover:shadow-lg ${
                      isCurrentUser
                        ? 'border-blue-500 ring-2 ring-blue-300'
                        : index < 3
                        ? 'border-amber-400'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{medal}</span>
                        <div>
                          <h4 className={`font-bold text-sm sm:text-base ${
                            isCurrentUser ? 'text-blue-700' : 'text-gray-900'
                          }`}>
                            {stat.name}
                            {isCurrentUser && <span className="text-xs text-blue-600 ml-1">({t('followups.analytics.leaderboard.you')})</span>}
                          </h4>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">{t('followups.analytics.leaderboard.successRate')}</p>
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
                      <div className="bg-blue-50 rounded p-2">
                        <p className="text-[10px] text-blue-700 font-medium">{t('followups.analytics.leaderboard.followupsShort')}</p>
                        <p className="text-lg font-bold text-blue-900">{stat.totalFollowUps}</p>
                      </div>
                      <div className="bg-green-50 rounded p-2">
                        <p className="text-[10px] text-green-700 font-medium">{t('followups.analytics.leaderboard.conversionsShort')}</p>
                        <p className="text-lg font-bold text-green-900">{stat.conversions}</p>
                      </div>
                      <div className="bg-purple-50 rounded p-2">
                        <p className="text-[10px] text-purple-700 font-medium">{t('followups.analytics.leaderboard.todayShort')}</p>
                        <p className="text-lg font-bold text-purple-900">{stat.contactedToday}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2 text-xs">
                      {stat.overdueCount > 0 && (
                        <div className="flex-1 bg-red-50 text-red-700 px-2 py-1 rounded flex items-center justify-center gap-1">
                          <span>🔥</span>
                          <span className="font-bold">{stat.overdueCount}</span>
                          <span>{t('followups.analytics.leaderboard.overdueShort')}</span>
                        </div>
                      )}
                      {stat.todayCount > 0 && (
                        <div className="flex-1 bg-orange-50 text-orange-700 px-2 py-1 rounded flex items-center justify-center gap-1">
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
          invitations={invitations}
          initialVisitorId={selectedVisitorId}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false)
            setSelectedVisitorId('')
          }}
        />
      )}

      {/* WhatsApp Template Modal */}
      {showTemplateModal && selectedVisitorForTemplate && (
        <MessageTemplateManager
          onClose={() => setShowTemplateModal(false)}
          onSelect={sendWhatsAppTemplate}
          visitorName={selectedVisitorForTemplate.name}
          salesName={user?.name}
          visitorPhone={selectedVisitorForTemplate.phone}
        />
      )}

      {/* History Modal - سجل المتابعات (Lightweight) */}
      {showHistoryModal && selectedVisitorForHistory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowHistoryModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-purple-600 text-white p-4 rounded-t-lg flex justify-between items-center">
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
                className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              {visitorHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📭</div>
                  <p className="text-sm">{t('followups.history.noHistory')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                    <p className="text-sm font-bold text-purple-900">
                      {t('followups.history.total')}: <span className="text-2xl">{visitorHistory.length}</span>
                    </p>
                  </div>

                  {visitorHistory.map((fu, index) => (
                    <div
                      key={fu.id}
                      className={`border rounded-lg p-3 ${
                        fu.contacted ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl font-bold text-gray-400">#{visitorHistory.length - index}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(fu.createdAt).toLocaleDateString('ar-EG')}
                            </span>
                            {fu.contacted ? (
                              <span className="text-green-700 font-bold text-xs">✅ {t('followups.history.contacted')}</span>
                            ) : (
                              <span className="text-orange-600 font-bold text-xs">⏳ {t('followups.history.notContacted')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {fu.result && getResultBadge(fu.result)}
                          {fu.salesName && (
                            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs">
                              {fu.salesName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bg-white p-2 rounded border border-gray-200 mb-2">
                        <p className="text-sm text-gray-800">{fu.notes}</p>
                      </div>

                      {fu.nextFollowUpDate && (
                        <div className="text-xs text-gray-600">
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
      <div className="bg-white p-3 sm:p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-xs sm:text-sm font-medium mb-1">🔍 {t('followups.filters.search')}</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder={t('followups.filters.searchPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1">📂 {t('followups.filters.source')}</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">{t('followups.filters.all')}</option>
              <option value="expired-member">❌ {t('followups.sources.expiredMembers')}</option>
              <option value="expiring-member">⏰ {t('followups.sources.expiringMembers')}</option>
              <option value="member-invitation">👥 {t('followups.sources.memberInvitations')}</option>
              <option value="dayuse">🎁 {t('followups.sources.dayUse')}</option>
              <option value="visitors">👤 {t('followups.sources.visitors')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1">📊 {t('followups.filters.priority')}</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">{t('followups.filters.all')}</option>
              <option value="overdue">🔥 {t('followups.priority.overdue')}</option>
              <option value="today">⚡ {t('followups.priority.today')}</option>
              <option value="upcoming">📅 {t('followups.priority.upcoming')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1">📈 {t('followups.filters.result')}</label>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">{t('followups.filters.all')}</option>
              <option value="interested">✅ {t('followups.results.interested')}</option>
              <option value="not-interested">❌ {t('followups.results.notInterested')}</option>
              <option value="postponed">⏸️ {t('followups.results.postponed')}</option>
              <option value="subscribed">🎉 {t('followups.results.subscribed')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1">📞 {t('followups.filters.contacted')}</label>
            <select
              value={contactedFilter}
              onChange={(e) => setContactedFilter(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('followups.filters.all')} ({allFollowUps.length})
          </button>
          <button
            onClick={() => setSourceFilter('expired-member')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
              sourceFilter === 'expired-member'
                ? 'bg-red-600 text-white shadow-lg'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            ❌ {t('followups.sources.expiredMembers')} ({stats.expiredMembers})
          </button>
          <button
            onClick={() => setSourceFilter('expiring-member')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
              sourceFilter === 'expiring-member'
                ? 'bg-yellow-600 text-white shadow-lg'
                : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
            }`}
          >
            ⏰ {t('followups.sources.expiringMembers')} ({stats.expiringMembers})
          </button>
          <button
            onClick={() => setSourceFilter('member-invitation')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
              sourceFilter === 'member-invitation'
                ? 'bg-cyan-600 text-white shadow-lg'
                : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
            }`}
          >
            👥 {t('followups.sources.memberInvitations')} ({stats.invitations})
          </button>
          <button
            onClick={() => setSourceFilter('dayuse')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
              sourceFilter === 'dayuse'
                ? 'bg-pink-600 text-white shadow-lg'
                : 'bg-pink-50 text-pink-700 hover:bg-pink-100'
            }`}
          >
            🎁 {t('followups.sources.dayUse')} ({stats.dayUse})
          </button>
          <button
            onClick={() => setSourceFilter('visitors')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
              sourceFilter === 'visitors'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            👤 {t('followups.sources.visitors')} ({stats.visitors})
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
          {/* Mobile Cards View */}
          <div className="lg:hidden space-y-3 sm:space-y-4 mb-6">
            {currentFollowUps.map((followUp) => {
              const isExpired = followUp.visitor.source === 'expired-member'
              const isExpiring = followUp.visitor.source === 'expiring-member'

              return (
                <div
                  key={followUp.id}
                  className={`bg-white rounded-lg shadow-md p-3 sm:p-4 ${
                    isExpired
                      ? 'border-r-4 border-red-500'
                      : isExpiring
                      ? 'border-r-4 border-yellow-500'
                      : 'border-r-4 border-blue-500'
                  }`}
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
                          className="text-green-600 hover:text-green-800 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded bg-green-50 hover:bg-green-100"
                        >
                          🔄
                        </Link>
                      )}
                      {isExpired && (
                        <button
                          onClick={() => openQuickFollowUp(followUp.visitor)}
                          className="text-red-600 hover:text-red-800 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded bg-red-50 hover:bg-red-100"
                        >
                          ➕
                        </button>
                      )}
                      {!isExpired && (
                        <button
                          onClick={() => openQuickFollowUp(followUp.visitor)}
                          className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded bg-blue-50 hover:bg-blue-100"
                        >
                          ➕
                        </button>
                      )}
                      <button
                        onClick={() => openHistoryModal(followUp.visitor)}
                        className="text-purple-600 hover:text-purple-800 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded bg-purple-50 hover:bg-purple-100"
                      >
                        📋
                      </button>
                      {!followUp.id.startsWith('expired-') && !followUp.id.startsWith('expiring-') && !followUp.id.startsWith('dayuse-') && !followUp.id.startsWith('invitation-') && (
                        <button
                          onClick={() => handleDeleteFollowUp(followUp.id, followUp.visitor.name)}
                          className="text-red-600 hover:text-red-800 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded bg-red-50 hover:bg-red-100"
                          disabled={deleteMutation.isPending}
                          title={t('followups.actions.deleteFollowup')}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Follow-up Info */}
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-xs sm:text-sm min-w-[60px] sm:min-w-[70px]">👤 {t('followups.table.name')}:</span>
                      <span className={`font-bold text-sm sm:text-base ${
                        isExpired ? 'text-red-700' : 'text-gray-900'
                      }`}>
                        {followUp.visitor.name}
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-xs sm:text-sm min-w-[60px] sm:min-w-[70px]">📱 {t('followups.table.phone')}:</span>
                      <div className="flex gap-1">
                        <a
                          href={`https://wa.me/2${followUp.visitor.phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 px-2 sm:px-3 py-1 rounded-lg font-medium text-xs sm:text-sm ${
                            isExpired
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-green-500 hover:bg-green-600 text-white'
                          }`}
                        >
                          <span>💬</span>
                          <span>{followUp.visitor.phone}</span>
                        </a>
                        <button
                          onClick={() => openTemplateModal(followUp.visitor)}
                          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium"
                          title="رسائل جاهزة"
                        >
                          📝
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-xs sm:text-sm min-w-[60px] sm:min-w-[70px]">📂 {t('followups.table.source')}:</span>
                      <span className={`${
                        followUp.visitor.source === 'invitation'
                          ? 'bg-purple-100 text-purple-800 px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium'
                          : followUp.visitor.source === 'member-invitation'
                          ? 'bg-blue-100 text-blue-800 px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium'
                          : followUp.visitor.source === 'expired-member'
                          ? 'bg-red-100 text-red-800 px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold'
                          : followUp.visitor.source === 'expiring-member'
                          ? 'bg-yellow-100 text-yellow-800 px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold'
                          : 'text-gray-600 text-xs sm:text-sm'
                      }`}>
                        {getSourceLabel(followUp.visitor.source)}
                      </span>
                    </div>

                    {followUp.salesName && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500 text-xs sm:text-sm min-w-[60px] sm:min-w-[70px]">🧑‍💼 {t('followups.table.sales')}:</span>
                        <span className="text-orange-600 font-semibold text-xs sm:text-sm">{followUp.salesName}</span>
                      </div>
                    )}

                    {(() => {
                      const lastComment = getLastComment(followUp.visitor.phone)
                      return lastComment ? (
                        <div className="flex items-start gap-2">
                          <span className="text-gray-500 text-xs sm:text-sm min-w-[60px] sm:min-w-[70px]">💬 {t('followups.table.lastComment')}:</span>
                          <div className="flex-1">
                            <p className="text-xs sm:text-sm text-gray-700">{lastComment.notes}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {lastComment.salesName && <span className="text-orange-500">{lastComment.salesName} • </span>}
                              {new Date(lastComment.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <span className="text-gray-500 text-xs sm:text-sm min-w-[60px] sm:min-w-[70px]">📝 {t('followups.table.notes')}:</span>
                          <p className="text-xs sm:text-sm text-gray-700 flex-1">{followUp.notes}</p>
                        </div>
                      )
                    })()}

                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-xs sm:text-sm min-w-[60px] sm:min-w-[70px]">📊 {t('followups.table.result')}:</span>
                      {getResultBadge(followUp.result)}
                    </div>

                    {followUp.nextFollowUpDate && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500 text-xs sm:text-sm min-w-[60px] sm:min-w-[70px]">📅 {t('followups.table.nextFollowUp')}:</span>
                        <span className="text-xs sm:text-sm font-medium">
                          {new Date(followUp.nextFollowUpDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                        </span>
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-xs sm:text-sm min-w-[60px] sm:min-w-[70px]">📅 {t('followups.table.date')}:</span>
                      <span className="text-[10px] sm:text-xs text-gray-500">
                        {new Date(followUp.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-xs sm:text-sm min-w-[60px] sm:min-w-[70px]">📞 {t('followups.table.contacted')}:</span>
                      {followUp.contacted ? (
                        <span className="text-green-600 text-xs sm:text-sm">✅ {t('followups.labels.contactedYes')}</span>
                      ) : (
                        <span className="text-orange-600 text-xs sm:text-sm">⏳ {t('followups.labels.contactedNo')}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {filteredFollowUps.length === 0 && (
              <div className="text-center py-12 text-gray-500">
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
                      className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                    >
                      ➕ {t('followups.messages.addFirst')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <tr>
                  <th className={`px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('followups.table.priority')}</th>
                  <th className={`px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('followups.table.visitor')}</th>
                  <th className={`px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('followups.table.phone')}</th>
                  <th className={`px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('followups.table.source')}</th>
                  <th className={`px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('followups.table.sales')}</th>
                  <th className={`px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('followups.table.notes')}</th>
                  <th className={`px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('followups.table.result')}</th>
                  <th className={`px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('followups.table.nextFollowUp')}</th>
                  <th className={`px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('followups.table.actionsColumn')}</th>
                </tr>
              </thead>
              <tbody>
                {currentFollowUps.map((followUp) => {
                  const isExpired = followUp.visitor.source === 'expired-member'
                  const isExpiring = followUp.visitor.source === 'expiring-member'

                  return (
                  <tr
                    key={followUp.id}
                    className={`border-t transition-colors ${
                      isExpired
                        ? 'bg-red-50 hover:bg-red-100'
                        : isExpiring
                        ? 'bg-yellow-50 hover:bg-yellow-100'
                        : 'hover:bg-blue-50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      {getPriorityBadge(followUp)}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className={`font-semibold ${
                          isExpired ? 'text-red-700' : 'text-gray-900'
                        }`}>
                          {followUp.visitor.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {followUp.contacted ? (
                            <span className="text-green-600">✅ {t('followups.labels.contactedYes')}</span>
                          ) : (
                            <span className="text-orange-600">⏳ {t('followups.labels.contactedNo')}</span>
                          )}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <a
                          href={`https://wa.me/2${followUp.visitor.phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg font-medium text-sm transition-colors ${
                            isExpired
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-green-500 hover:bg-green-600 text-white'
                          }`}
                        >
                          <span>💬</span>
                          <span>{followUp.visitor.phone}</span>
                        </a>
                        <button
                          onClick={() => openTemplateModal(followUp.visitor)}
                          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-3 py-1 rounded-lg text-sm font-medium"
                          title="رسائل جاهزة"
                        >
                          📝
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`${
                        followUp.visitor.source === 'invitation'
                          ? 'bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium'
                          : followUp.visitor.source === 'member-invitation'
                          ? 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium'
                          : followUp.visitor.source === 'expired-member'
                          ? 'bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-bold'
                          : followUp.visitor.source === 'expiring-member'
                          ? 'bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-bold'
                          : 'text-gray-600'
                      }`}>
                        {getSourceLabel(followUp.visitor.source)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {followUp.salesName ? (
                        <span className="text-orange-600 font-semibold flex items-center gap-1">
                          <span>👤</span>
                          <span>{followUp.salesName}</span>
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const lastComment = getLastComment(followUp.visitor.phone)
                        const displayNotes = lastComment?.notes || followUp.notes
                        return (
                          <div>
                            <p className="text-sm text-gray-700 max-w-xs" title={displayNotes}>
                              {displayNotes.length > 50 ? displayNotes.substring(0, 50) + '...' : displayNotes}
                            </p>
                            {lastComment && (
                              <p className="text-xs text-gray-400 mt-1">
                                {lastComment.salesName && <span className="text-orange-500">{lastComment.salesName} • </span>}
                                {new Date(lastComment.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                              </p>
                            )}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {getResultBadge(followUp.result)}
                    </td>
                    <td className="px-4 py-3">
                      {followUp.nextFollowUpDate ? (
                        <span className="text-sm font-medium">
                          {new Date(followUp.nextFollowUpDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {/* زر تجديد سريع للأعضاء المنتهيين أو القريبين من الانتهاء */}
                        {(isExpired || isExpiring) && (
                          <Link
                            href={`/members?search=${encodeURIComponent(followUp.visitor.phone)}`}
                            className="inline-flex items-center gap-1 text-green-600 hover:text-green-800 text-sm font-medium px-3 py-1 rounded bg-green-50 hover:bg-green-100"
                            title={t('followups.actions.quickRenew')}
                          >
                            🔄 {t('followups.actions.quickRenew')}
                          </Link>
                        )}

                        {isExpired && (
                          <button
                            onClick={() => openQuickFollowUp(followUp.visitor)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 rounded bg-red-50 hover:bg-red-100"
                            title={t('followups.actions.addFollowupRenewal')}
                          >
                            ➕ {t('followups.buttons.followup')}
                          </button>
                        )}
                        {!isExpired && (
                          <button
                            onClick={() => openQuickFollowUp(followUp.visitor)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium px-3 py-1 rounded bg-blue-50 hover:bg-blue-100"
                            title={t('followups.actions.addFollowupNew')}
                          >
                            ➕ {t('followups.buttons.followup')}
                          </button>
                        )}

                        {/* زر سجل المتابعات */}
                        <button
                          onClick={() => openHistoryModal(followUp.visitor)}
                          className="text-purple-600 hover:text-purple-800 text-sm font-medium px-3 py-1 rounded bg-purple-50 hover:bg-purple-100"
                          title={t('followups.actions.viewHistory')}
                        >
                          📋 {t('followups.buttons.history')}
                        </button>

                        {/* زر حذف */}
                        {!followUp.id.startsWith('expired-') && !followUp.id.startsWith('expiring-') && !followUp.id.startsWith('dayuse-') && !followUp.id.startsWith('invitation-') && (
                          <button
                            onClick={() => handleDeleteFollowUp(followUp.id, followUp.visitor.name)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 rounded bg-red-50 hover:bg-red-100"
                            title={t('followups.actions.deleteFollowup')}
                            disabled={deleteMutation.isPending}
                          >
                            🗑️ {t('followups.actions.delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                )}
              </tbody>
            </table>
          </div>

            {filteredFollowUps.length === 0 && (
              <div className="text-center py-12 text-gray-500">
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
                      className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
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
            <div className="mt-6 bg-white rounded-lg shadow-md p-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                {/* معلومات الصفحة */}
                <div className="text-sm text-gray-600">
                  {t('followups.pagination.showing')} {startIndex + 1} {t('followups.pagination.to')} {Math.min(endIndex, filteredFollowUps.length)} {t('followups.pagination.of')} {filteredFollowUps.length} {t('followups.pagination.followups')}
                </div>

                {/* عدد العناصر في الصفحة */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">{t('followups.pagination.itemsPerPage')}:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
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
                      className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {t('followups.pagination.first')}
                    </button>
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
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
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
                      className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {t('followups.pagination.next')}
                    </button>
                    <button
                      onClick={() => goToPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {t('followups.pagination.last')}
                    </button>
                  </div>
                )}
              </div>

              {/* معلومات إضافية */}
              <div className="mt-4 text-center text-sm text-gray-500">
                {t('followups.pagination.page')} {currentPage} {t('followups.pagination.of')} {totalPages}
              </div>
            </div>
          )}
        </>
      ))}

      {/* Recently Converted Section */}
      {convertedMembers.length > 0 && viewMode === 'list' && (
        <div className="mt-6 bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-300 rounded-xl p-4 sm:p-6">
          <h3 className="font-bold text-emerald-900 mb-4 flex items-center gap-2 text-lg sm:text-xl">
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
                    className="bg-white border-2 border-emerald-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 text-sm sm:text-base">{fu.visitor.name}</p>
                        <p className="text-xs text-gray-500">{fu.visitor.phone}</p>
                        {isRenewal && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">
                            🔄 تجديد
                          </span>
                        )}
                        {!isRenewal && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">
                            ⭐ عضو جديد
                          </span>
                        )}
                      </div>
                      <span className="text-2xl">✅</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-2">
                      <p className="flex items-center gap-1">
                        <span>📂</span>
                        <span>{getSourceLabel(fu.visitor.source)}</span>
                      </p>
                      {fu.salesName && (
                        <p className="flex items-center gap-1 mt-1">
                          <span>🧑‍💼</span>
                          <span className="font-semibold text-emerald-700">{fu.salesName}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
          {convertedMembers.length > 6 && (
            <p className="text-center text-sm text-emerald-700 mt-4 font-medium">
              وأكثر من {convertedMembers.length - 6} شخص آخر تحول لعضو / جدد 🎊
            </p>
          )}
        </div>
      )}

      {/* Success Rate */}
      <div className="mt-6 bg-gradient-to-br from-green-500 to-green-600 border-r-4 border-green-700 p-6 rounded-xl shadow-lg">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-xl">
          <span>🎯</span>
          <span>{t('followups.successRate.title')}</span>
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/90 backdrop-blur p-5 rounded-lg shadow-md">
            <p className="text-sm text-gray-600 font-medium mb-1">{t('followups.successRate.totalFollowups')}</p>
            <p className="text-4xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white/90 backdrop-blur p-5 rounded-lg shadow-md">
            <p className="text-sm text-gray-600 font-medium mb-1">{t('followups.successRate.convertedToMembers')}</p>
            <p className="text-4xl font-bold text-green-600">{stats.convertedToMembers}</p>
          </div>
          <div className="bg-white/90 backdrop-blur p-5 rounded-lg shadow-md">
            <p className="text-sm text-gray-600 font-medium mb-1">{t('followups.successRate.conversionRate')}</p>
            <p className="text-4xl font-bold text-blue-600">
              {stats.total > 0 ? ((stats.convertedToMembers / stats.total) * 100).toFixed(1) : '0'}%
            </p>
          </div>
        </div>
        <p className="text-sm text-white mt-4 bg-green-700/30 p-3 rounded-lg">
          💡 <strong>{t('followups.successRate.noteLabel')}:</strong> {t('followups.successRate.noteText')}
        </p>
      </div>

      {/* Quick Tips */}
      <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-r-4 border-blue-500 p-5 rounded-lg">
        <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
          <span>💡</span>
          <span>{t('followups.tips.title')}</span>
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
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
            className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 transform transition-all"
            onClick={(e) => e.stopPropagation()}
            dir={direction}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl">⚠️</div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {t('followups.deleteConfirm.title')}
                </h3>
              </div>
            </div>

            {/* Content */}
            <div className="mb-6 space-y-3">
              <p className="text-gray-700 text-base">
                {t('followups.deleteConfirm.message')} <strong className="text-red-600">{deleteTarget.name}</strong>؟
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800 flex items-start gap-2">
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
                className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 font-bold py-3 px-4 rounded-lg transition-colors"
              >
                {t('followups.deleteConfirm.cancelButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
