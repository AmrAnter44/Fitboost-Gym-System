'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'
import MemberForm from '../../components/MemberForm'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../contexts/ToastContext'
import { fetchVisitors, fetchFollowUps } from '../../lib/api/visitors'
import { fetchMembers } from '../../lib/api/members'
import { useDebounce } from '../../hooks/useDebounce'
import { usePermissions } from '../../hooks/usePermissions'
import { useServiceSettings } from '../../contexts/ServiceSettingsContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const VirtualVisitorList = dynamic(() => import('../../components/VirtualVisitorList'), {
  ssr: false,
  loading: () => <div className="skeleton-shimmer h-64 rounded-lg" />,
})

interface Visitor {
  id: string
  name: string
  phone: string
  notes?: string
  source: string
  interestedIn?: string
  status: string
  createdAt: string
}

interface Stats {
  status: string
  _count: number
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

export default function VisitorsPage() {
  const router = useRouter()
  const { t, direction } = useLanguage()
  const toast = useToast()
  const { user } = usePermissions()
  const { settings } = useServiceSettings()
  const queryClient = useQueryClient()

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')

  // Debounced search - تأخير البحث لتقليل API requests
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Fetch visitors with filters
  const {
    data: visitorsData,
    isLoading: loading,
    error: visitorsError,
    refetch: refetchVisitors
  } = useQuery({
    queryKey: ['visitors', debouncedSearchTerm, statusFilter, sourceFilter],
    queryFn: () => fetchVisitors({ searchTerm: debouncedSearchTerm, statusFilter, sourceFilter }),
    retry: 1,
    staleTime: 2 * 60 * 1000,
  })

  // Fetch members for filtering
  const {
    data: membersData = [],
  } = useQuery({
    queryKey: ['members'],
    queryFn: fetchMembers,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })

  // Fetch follow-ups
  const {
    data: followUps = [],
  } = useQuery({
    queryKey: ['followups'],
    queryFn: fetchFollowUps,
    retry: 1,
    staleTime: 2 * 60 * 1000,
  })

  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedVisitorForHistory, setSelectedVisitorForHistory] = useState<Visitor | null>(null)

  // اشتراك سريع - تحويل الزائر إلى عضو
  const [showQuickSubscribeModal, setShowQuickSubscribeModal] = useState(false)
  const [selectedVisitorForSubscribe, setSelectedVisitorForSubscribe] = useState<Visitor | null>(null)

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [visitorToDelete, setVisitorToDelete] = useState<Visitor | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Visitor | null>(null)
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Optimistic Delete - حذف الزائر فوراً من الـ UI
  const deleteVisitorMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/visitors?id=${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Delete failed')
    },
    onMutate: async (id: string) => {
      const queryKey = ['visitors', debouncedSearchTerm, statusFilter, sourceFilter]
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old
        return { ...old, visitors: old.visitors.filter((v: Visitor) => v.id !== id) }
      })
      return { previousData, queryKey }
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData)
      }
      toast.error(t('visitors.messages.deleteError'))
    },
    onSuccess: () => {
      toast.success(t('visitors.messages.deleteSuccess'))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] })
      queryClient.invalidateQueries({ queryKey: ['followups'] })
      queryClient.invalidateQueries({ queryKey: ['visitors-followups'] })
    }
  })

  // Optimistic Status Update - تحديث الحالة فوراً
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch('/api/visitors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!response.ok) throw new Error('Update failed')
    },
    onMutate: async ({ id, status }) => {
      const queryKey = ['visitors', debouncedSearchTerm, statusFilter, sourceFilter]
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old
        return { ...old, visitors: old.visitors.map((v: Visitor) => v.id === id ? { ...v, status } : v) }
      })
      return { previousData, queryKey }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData)
      }
      toast.error(t('visitors.messages.statusUpdateError'))
    },
    onSuccess: () => {
      toast.success(t('visitors.messages.statusUpdateSuccess'))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] })
    }
  })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    notes: '',
    source: 'walk-in',
    interestedIn: '',
    salesStaffId: '',
    referrerMemberNumber: '', // 👥 رقم العضو اللي جاب الزائر (اختياري)
  })

  // جلب موظفي السيلز واقتراح الأقل تحميلاً
  const [salesStaff, setSalesStaff] = useState<{ id: string; name: string; staffCode: string; count: number }[]>([])

  const fetchSalesStaff = () => {
    fetch('/api/followups/sales')
      .then(res => res.json())
      .then(data => {
        const rawStaff = data?.staff ?? data ?? []
        const sales = (rawStaff as any[])
          .filter(s => s.position?.split(',').map((p: string) => p.trim()).includes('sales'))
          .map(s => ({
            id: s.staffId,
            name: s.name,
            staffCode: s.staffCode,
            count: (s.membersCount || 0) + (s.leadsCount || 0)
          }))
          .sort((a, b) => a.count - b.count)
        setSalesStaff(sales)
        // اقتراح الأقل تحميلاً تلقائياً
        if (sales.length > 0) {
          setFormData(prev => ({ ...prev, salesStaffId: sales[0].id }))
        }
      })
      .catch(() => {})
  }

  useEffect(() => { fetchSalesStaff() }, [])

  // Helper function to normalize phone numbers
  const normalizePhone = (phone: string) => {
    if (!phone) return ''
    let normalized = phone.replace(/[\s\-\(\)\+]/g, '').trim()
    if (normalized.startsWith('2')) normalized = normalized.substring(1)
    if (normalized.startsWith('0')) normalized = normalized.substring(1)
    return normalized
  }

  // Process visitors data: filter out invitations and members
  const visitors = useMemo(() => {
    if (!visitorsData) return []

    // Filter out invitations
    const nonInvitationVisitors = (visitorsData.visitors || []).filter(
      (v: Visitor) => v.source !== 'invitation' && v.source !== 'member-invitation'
    )

    // Get member phone numbers
    const memberPhones = new Set(
      (Array.isArray(membersData) ? membersData : []).map((m: any) => normalizePhone(m.phone))
    )

    // Filter out visitors who are already members
    return nonInvitationVisitors.filter((v: Visitor) => {
      const visitorPhone = normalizePhone(v.phone)
      return !memberPhones.has(visitorPhone)
    })
  }, [visitorsData, membersData])

  const stats = visitorsData?.stats || []

  // Error handling
  useEffect(() => {
    if (visitorsError) {
      const errorMessage = (visitorsError as Error).message
      if (errorMessage === 'UNAUTHORIZED') {
        toast.error('يجب تسجيل الدخول أولاً')
        setTimeout(() => router.push('/login'), 2000)
      } else if (errorMessage === 'FORBIDDEN') {
        toast.error('ليس لديك صلاحية عرض الزوار')
      } else {
        toast.error(errorMessage || 'حدث خطأ أثناء جلب بيانات الزوار')
      }
    }
  }, [visitorsError, toast, router])


  // قائمة الأشهر المتاحة من بيانات الزوار
  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    visitors.forEach(visitor => {
      const date = new Date(visitor.createdAt)
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      months.add(yearMonth)
    })
    return Array.from(months).sort().reverse() // الأحدث أولاً
  }, [visitors])

  // فلترة الزوار حسب الشهر على الـ client-side
  const filteredVisitors = useMemo(() => {
    if (monthFilter === 'all') return visitors

    const [year, month] = monthFilter.split('-').map(Number)
    return visitors.filter(visitor => {
      const visitDate = new Date(visitor.createdAt)
      return visitDate.getFullYear() === year && visitDate.getMonth() + 1 === month
    })
  }, [visitors, monthFilter])

  // إعادة تعيين الصفحة عند تغيير الفلاتر
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, statusFilter, sourceFilter, monthFilter])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        const leastLoadedId = salesStaff.length > 0 ? salesStaff[0].id : ''
        setFormData({ name: '', phone: '', notes: '', source: 'walk-in', interestedIn: '', salesStaffId: leastLoadedId, referrerMemberNumber: '' })
        toast.success(t('visitors.messages.addSuccess'))

        // تحديث جميع الصفحات المرتبطة بالزوار والمتابعات
        refetchVisitors()
        await queryClient.invalidateQueries({ queryKey: ['followups'] })
        await queryClient.invalidateQueries({ queryKey: ['visitors-followups'] })

        setShowForm(false)
      } else {
        toast.error(data.error || t('visitors.messages.addError'))
      }
    } catch (error) {
      console.error(error)
      toast.error(t('visitors.messages.error'))
    } finally {
      setSubmitting(false)
    }
  }

  // تصدير CSV للزوار
  const exportVisitorsCSV = () => {
    const headers = ['الاسم', 'الهاتف', 'المصدر', 'الاهتمام', 'الحالة', 'الملاحظات', 'تاريخ الإضافة']
    const rows = filteredVisitors.map(v => [
      v.name,
      v.phone,
      v.source,
      v.interestedIn || '',
      v.status,
      v.notes || '',
      new Date(v.createdAt).toLocaleDateString('ar-EG'),
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `visitors_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleUpdateStatus = (id: string, newStatus: string) => {
    updateStatusMutation.mutate({ id, status: newStatus })
  }

  const handleDelete = (visitor: Visitor) => {
    // Clear any existing pending delete
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    if (undoCountdownRef.current) clearInterval(undoCountdownRef.current)

    // Optimistically remove from UI
    const queryKey = ['visitors', debouncedSearchTerm, statusFilter, sourceFilter]
    const previousData = queryClient.getQueryData(queryKey)
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old
      return { ...old, visitors: old.visitors.filter((v: Visitor) => v.id !== visitor.id) }
    })

    // Show undo banner
    setPendingDelete(visitor)
    setUndoSecondsLeft(5)

    // Countdown
    undoCountdownRef.current = setInterval(() => {
      setUndoSecondsLeft(s => {
        if (s <= 1) {
          if (undoCountdownRef.current) clearInterval(undoCountdownRef.current)
          return 0
        }
        return s - 1
      })
    }, 1000)

    // Schedule actual delete after 5s
    deleteTimerRef.current = setTimeout(async () => {
      setPendingDelete(null)
      try {
        const response = await fetch(`/api/visitors?id=${visitor.id}`, { method: 'DELETE' })
        if (!response.ok) {
          // Restore on failure
          queryClient.setQueryData(queryKey, previousData)
          toast.error(t('visitors.messages.deleteError'))
        } else {
          queryClient.invalidateQueries({ queryKey: ['visitors'] })
          queryClient.invalidateQueries({ queryKey: ['followups'] })
          queryClient.invalidateQueries({ queryKey: ['visitors-followups'] })
        }
      } catch {
        queryClient.setQueryData(queryKey, previousData)
        toast.error(t('visitors.messages.deleteError'))
      }
    }, 5000)
  }

  const handleUndoDelete = () => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    if (undoCountdownRef.current) clearInterval(undoCountdownRef.current)
    // Restore the visitor by re-fetching
    queryClient.invalidateQueries({ queryKey: ['visitors'] })
    setPendingDelete(null)
    setUndoSecondsLeft(0)
  }

  const confirmDelete = () => {
    if (!visitorToDelete) return
    deleteVisitorMutation.mutate(visitorToDelete.id)
    setShowDeleteModal(false)
    setVisitorToDelete(null)
  }

  const openHistoryModal = (visitor: Visitor) => {
    setSelectedVisitorForHistory(visitor)
    setShowHistoryModal(true)
  }

  const openQuickFollowUp = (visitor: Visitor) => {
    // الانتقال لصفحة المتابعات مع تمرير بيانات الزائر
    router.push(`/followups?visitorId=${visitor.id}`)
  }

  // فتح نموذج الاشتراك السريع
  const openQuickSubscribe = (visitor: Visitor) => {
    setSelectedVisitorForSubscribe(visitor)
    setShowQuickSubscribeModal(true)
  }

  // Memoize history to avoid recalculation on every render
  const visitorHistory = useMemo(() => {
    if (!selectedVisitorForHistory) return []
    const normalizedPhone = normalizePhone(selectedVisitorForHistory.phone)
    return followUps.filter(fu => {
      const fuPhone = normalizePhone(fu.visitor.phone)
      return fuPhone === normalizedPhone
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [selectedVisitorForHistory, followUps])

  const getResultBadge = (result?: string) => {
    const badges = {
      interested: 'bg-green-100 text-green-800',
      'not-interested': 'bg-red-100 text-red-800',
      postponed: 'bg-yellow-100 text-yellow-800',
      subscribed: 'bg-primary-100 text-primary-800',
    }
    const labels: Record<string, string> = {
      interested: t('visitors.results.interested'),
      'not-interested': t('visitors.results.notInterested'),
      postponed: t('visitors.results.postponed'),
      subscribed: t('visitors.results.subscribed'),
    }
    if (!result) return <span className="text-gray-400 dark:text-gray-500">-</span>
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[result as keyof typeof badges] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100'}`}>
        {labels[result] || result}
      </span>
    )
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      contacted: 'bg-primary-100 text-primary-800',
      subscribed: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }
    const labels: Record<string, string> = {
      pending: t('visitors.status.pending'),
      contacted: t('visitors.status.contacted'),
      subscribed: t('visitors.status.subscribed'),
      rejected: t('visitors.status.rejected'),
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${badges[status as keyof typeof badges] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100'}`}>
        {labels[status] || status}
      </span>
    )
  }

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      'walk-in': t('visitors.sources.walkIn'),
      'call-in': t('visitors.sources.callIn'),
      'facebook': t('visitors.sources.facebook'),
      'instagram': t('visitors.sources.instagram'),
      'friend': t('visitors.sources.friend'),
      'other': t('visitors.sources.other'),
    }
    return labels[source] || source
  }

  const getMonthLabel = (yearMonth: string) => {
    const [year, month] = yearMonth.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, 1)
    const monthName = date.toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { month: 'long' })
    return `${monthName} ${year}`
  }

  // Pagination calculations
  const totalPages = Math.ceil(filteredVisitors.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentVisitors = filteredVisitors.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="container mx-auto px-4 py-6 md:px-6" dir={direction}>
      {/* Undo Delete Banner */}
      {pendingDelete && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 dark:bg-gray-800 text-white px-5 py-3 rounded-xl shadow-lg ring-1 ring-gray-700 animate-fade-in">
          <svg className="w-4 h-4 text-red-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          <span className="text-sm">{direction === 'rtl' ? 'تم حذف' : 'Deleted'} <strong>{pendingDelete.name}</strong></span>
          <button
            onClick={handleUndoDelete}
            className="bg-primary-500 hover:bg-primary-600 text-primary-contrast text-xs font-bold px-3 py-1.5 rounded-lg transition-colors duration-200 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
            {direction === 'rtl' ? `تراجع (${undoSecondsLeft}s)` : `Undo (${undoSecondsLeft}s)`}
          </button>
        </div>
      )}

      {/* Header with Stats */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('visitors.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('visitors.subtitle')}</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {user?.role === 'OWNER' && (
            <button
              onClick={exportVisitorsCSV}
              title={direction === 'rtl' ? 'تصدير CSV' : 'Export CSV'}
              aria-label={direction === 'rtl' ? 'تصدير CSV' : 'Export CSV'}
              className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg transition-colors duration-200 text-sm font-bold flex-shrink-0"
            >
              <svg className="w-4 h-4" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CSV
            </button>
            )}
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-6 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
            >
              {showForm ? (
                <>
                  <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  <span>{t('visitors.hideForm')}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                  <span>{t('visitors.addVisitor')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {monthFilter !== 'all' ? `${t('visitors.stats.visitorsOf')} ${getMonthLabel(monthFilter)}` : t('visitors.status.totalVisitors')}
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{filteredVisitors.length}</div>
            {monthFilter !== 'all' && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('visitors.stats.outOf', { total: visitors.length.toString() })}</div>
            )}
          </div>
          {stats.map((stat) => {
            const statIcon =
              stat.status === 'pending' ? (
                <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              ) : stat.status === 'contacted' ? (
                <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
              ) : stat.status === 'subscribed' ? (
                <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              ) : (
                <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              )
            return (
              <div key={stat.status} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">{statIcon}</span>
                  {stat.status === 'pending' && t('visitors.status.pending')}
                  {stat.status === 'contacted' && t('visitors.status.contacted')}
                  {stat.status === 'subscribed' && t('visitors.status.subscribed')}
                  {stat.status === 'rejected' && t('visitors.status.rejected')}
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{stat._count}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Add Visitor Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">{t('visitors.form.title')}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('visitors.form.name')} *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  placeholder={t('visitors.form.namePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('visitors.form.phone')} *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  placeholder={t('visitors.form.phonePlaceholder')}
                  pattern="^(010|011|012|015)[0-9]{8}$"
                  title={t('visitors.form.phonePattern')}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('visitors.form.source')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={formData.source}
                    onChange={(e) => {
                      const next = e.target.value
                      setFormData({
                        ...formData,
                        source: next,
                        ...(next !== 'friend_referral' ? { referrerMemberNumber: '' } : {}),
                      })
                    }}
                    className="w-full appearance-none ps-3 pe-10 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 text-gray-900 dark:text-gray-100 text-sm font-medium shadow-inner hover:bg-white dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:border-blue-400 dark:focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all duration-200 cursor-pointer"
                  >
                    <option value="">{t('members.form.selectSource')}</option>
                    <option value="walk-in">{t('visitors.sources.walkIn')}</option>
                    <option value="call-in">{t('visitors.sources.callIn')}</option>
                    <option value="suggestion">{t('visitors.sources.suggestion')}</option>
                    <option value="facebook">{t('visitors.sources.facebook')}</option>
                    <option value="instagram">{t('visitors.sources.instagram')}</option>
                    <option value="tiktok">{t('visitors.sources.tiktok')}</option>
                    <option value="chatgpt">{t('visitors.sources.chatgpt')}</option>
                    <option value="website">{t('visitors.sources.website')}</option>
                    <option value="friend_referral">{t('visitors.sources.friendReferral')}</option>
                    {formData.source && !['walk-in','call-in','suggestion','facebook','instagram','tiktok','chatgpt','website','friend_referral'].includes(formData.source) && (
                      <option value={formData.source}>{formData.source === 'friend' ? t('visitors.sources.friend') : formData.source === 'other' ? t('visitors.sources.other') : formData.source}</option>
                    )}
                  </select>
                  <div className="absolute end-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-white dark:bg-gray-600 shadow-sm flex items-center justify-center pointer-events-none">
                    <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4 text-gray-600 dark:text-gray-300">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </div>
                </div>

                {/* 👥 حقل ID اللي جاب الزائر — يظهر تحت لما friend_referral مختار */}
                {formData.source === 'friend_referral' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={formData.referrerMemberNumber}
                      onChange={(e) => setFormData({ ...formData, referrerMemberNumber: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 font-mono"
                      placeholder={`👥 ${t('members.referralMemberNumberPlaceholder')}`}
                      dir="ltr"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                      {t('members.form.referrerIdHelp')}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('visitors.form.interestedIn')}</label>
                <input
                  type="text"
                  value={formData.interestedIn}
                  onChange={(e) => setFormData({ ...formData, interestedIn: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  placeholder={t('visitors.form.interestedInPlaceholder')}
                />
              </div>

              {salesStaff.length > 0 && (
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                    {direction === 'rtl' ? 'موظف السيلز المسؤول' : 'Sales staff in charge'}
                    {salesStaff.length > 0 && formData.salesStaffId && (
                      <span className="ms-2 text-xs text-green-600 dark:text-green-400 font-normal">
                        {salesStaff.find(s => s.id === formData.salesStaffId)?.count === Math.min(...salesStaff.map(s => s.count)) ? (direction === 'rtl' ? 'الأقل تحميلاً' : 'least loaded') : ''}
                      </span>
                    )}
                  </label>
                  <select
                    value={formData.salesStaffId}
                    onChange={(e) => setFormData({ ...formData, salesStaffId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  >
                    <option value="">{direction === 'rtl' ? '— بدون موظف سيلز —' : '— No sales staff —'}</option>
                    {salesStaff.map(s => {
                      const minCount = Math.min(...salesStaff.map(x => x.count))
                      return (
                        <option key={s.id} value={s.id}>
                          {s.name} — #{s.staffCode} ({s.count} {direction === 'rtl' ? 'متابعة' : 'leads'}){s.count === minCount ? (direction === 'rtl' ? ' (الأقل)' : ' (least)') : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('visitors.form.notes')}</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                rows={3}
                placeholder={t('visitors.form.notesPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? t('visitors.form.saving') : t('visitors.form.submit')}
            </button>
          </form>
        </div>
      )}

      {/* Visitors Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-primary-200 dark:ring-primary-900/40 p-6 sm:p-8 text-center">
        <div className="flex justify-center mb-4 text-primary-600 dark:text-primary-400">
          <svg className="w-14 h-14" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          {t('visitors.info.title')}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-2xl mx-auto">
          {t('visitors.info.description')}
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={() => router.push('/followups')}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-6 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
            <span>{t('visitors.info.goToFollowUps')}</span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold px-6 py-2.5 rounded-lg transition-colors duration-200"
          >
            <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            <span>{t('visitors.info.quickAdd')}</span>
          </button>
        </div>
      </div>

      {/* Quick Add (Hidden List) */}
      {false && loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-center" aria-busy="true" aria-live="polite">
          <svg className="animate-spin w-10 h-10 text-gray-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">{t('visitors.loading')}</p>
        </div>
      ) : (
        <>
          {/* Cards للموبايل (Virtualized) - مخفي */}
          <div className="lg:hidden hidden">
            <VirtualVisitorList
              visitors={filteredVisitors}
              onFollowUp={openQuickFollowUp}
              onHistory={openHistoryModal}
              onDelete={handleDelete}
              onUpdateStatus={handleUpdateStatus}
              t={t}
              direction={direction}
            />
            {filteredVisitors.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
                <svg className="w-12 h-12 text-gray-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                {monthFilter !== 'all' ? (
                  <>
                    <p className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('visitors.noVisitors.inMonth', { month: getMonthLabel(monthFilter) })}</p>
                    <button
                      onClick={() => setMonthFilter('all')}
                      className="mt-3 text-primary-600 hover:text-primary-700 dark:text-primary-400 font-bold transition-colors duration-200"
                    >
                      {t('visitors.noVisitors.showAll')}
                    </button>
                  </>
                ) : (
                  <p className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('visitors.noVisitors.current')}</p>
                )}
              </div>
            )}
          </div>

          {/* الجدول للشاشات الكبيرة - مخفي */}
          <div className="hidden bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800">
                <tr>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'} dark:text-gray-100`}>{t('visitors.table.name')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'} dark:text-gray-100`}>{t('visitors.table.phone')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'} dark:text-gray-100`}>{t('visitors.table.source')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'} dark:text-gray-100`}>{t('visitors.table.interestedIn')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'} dark:text-gray-100`}>{t('visitors.table.status')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'} dark:text-gray-100`}>{t('visitors.table.visitDate')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'} dark:text-gray-100`}>{t('visitors.table.notes')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'} dark:text-gray-100`}>{t('visitors.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {currentVisitors.map((visitor) => (
                  <tr key={visitor.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 font-medium">{visitor.name}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`https://wa.me/20${visitor.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-sm bg-green-500 hover:bg-green-600 text-white transition-colors duration-200"
                      >
                        <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3 20l1.5-4.5A8 8 0 1112 20H7l-4 0z"/></svg>
                        <span className="font-mono">{visitor.phone}</span>
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {getSourceLabel(visitor.source)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {visitor.interestedIn || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={visitor.status}
                        onChange={(e) => handleUpdateStatus(visitor.id, e.target.value)}
                        className="text-xs px-2 py-1 rounded border dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="pending">{t('visitors.status.pending')}</option>
                        <option value="contacted">{t('visitors.status.contacted')}</option>
                        <option value="subscribed">{t('visitors.status.subscribed')}</option>
                        <option value="rejected">{t('visitors.status.rejected')}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(visitor.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {visitor.notes ? (
                        <p className="text-gray-600 dark:text-gray-300 max-w-xs truncate" title={visitor.notes}>
                          {visitor.notes}
                        </p>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {visitor.status === 'subscribed' ? (
                          <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2.5 py-0.5 rounded-full text-xs font-bold">
                            <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                            {direction === 'rtl' ? 'مشترك' : 'Subscribed'}
                          </span>
                        ) : (
                          <button
                            onClick={() => openQuickFollowUp(visitor)}
                            className="inline-flex items-center gap-1 text-primary-700 dark:text-primary-300 text-sm font-bold px-3 py-1 rounded-lg bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors duration-200"
                            title={t('visitors.actions.followUpTitle')}
                          >
                            <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                            {t('visitors.actions.followUp')}
                          </button>
                        )}
                        <button
                          onClick={() => openHistoryModal(visitor)}
                          className="inline-flex items-center gap-1 text-primary-700 dark:text-primary-300 text-sm font-bold px-3 py-1 rounded-lg bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors duration-200"
                          title={t('visitors.actions.historyTitle')}
                        >
                          <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                          {t('visitors.actions.history')}
                        </button>
                        <button
                          onClick={() => openQuickSubscribe(visitor)}
                          className="inline-flex items-center gap-1 text-green-700 dark:text-green-300 text-sm font-bold px-3 py-1 rounded-lg bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors duration-200"
                          title={direction === 'rtl' ? 'تحويل الزائر إلى عضو' : 'Convert visitor to member'}
                        >
                          <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                          {direction === 'rtl' ? 'اشتراك سريع' : 'Quick subscribe'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {filteredVisitors.length > 0 && totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                {/* معلومات الصفحة */}
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {t('visitors.pagination.showing', {
                    start: (startIndex + 1).toString(),
                    end: Math.min(endIndex, filteredVisitors.length).toString(),
                    total: filteredVisitors.length.toString()
                  })}
                </div>

                {/* أزرار التنقل */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                    title={t('visitors.pagination.firstPage')}
                  >
                    {t('visitors.pagination.first')}
                  </button>

                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                    title={t('visitors.pagination.previousPage')}
                  >
                    {t('visitors.pagination.previous')}
                  </button>

                  {/* أرقام الصفحات */}
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum
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
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-primary-600 text-primary-contrast'
                              : 'hover:bg-gray-200 dark:hover:bg-gray-600'
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
                    className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                    title={t('visitors.pagination.nextPage')}
                  >
                    {t('visitors.pagination.next')}
                  </button>

                  <button
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                    title={t('visitors.pagination.lastPage')}
                  >
                    {t('visitors.pagination.last')}
                  </button>
                </div>

                {/* اختيار عدد العناصر في الصفحة */}
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-gray-600 dark:text-gray-300">{t('visitors.pagination.itemsPerPage')}:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            )}

            {filteredVisitors.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 text-gray-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                {monthFilter !== 'all' ? (
                  <>
                    <p className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('visitors.noVisitors.inMonth', { month: getMonthLabel(monthFilter) })}</p>
                    <button
                      onClick={() => setMonthFilter('all')}
                      className="mt-3 text-primary-600 dark:text-primary-400 hover:text-primary-700 font-bold transition-colors duration-200"
                    >
                      {t('visitors.noVisitors.showAll')}
                    </button>
                  </>
                ) : (
                  <p className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('visitors.noVisitors.current')}</p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* History Modal - سجل المتابعات */}
      {showHistoryModal && selectedVisitorForHistory && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
          onClick={() => setShowHistoryModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-modal-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in" onClick={(e) => e.stopPropagation()} dir={direction}>
            <div className="sticky top-0 bg-primary-500 text-primary-contrast p-4 rounded-t-2xl flex justify-between items-center">
              <div>
                <h2 id="history-modal-title" className="text-lg font-bold flex items-center gap-2">
                  <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                  <span>{t('visitors.historyModal.title')}</span>
                </h2>
                <p className="text-xs opacity-80 mt-0.5">
                  {selectedVisitorForHistory.name} - {selectedVisitorForHistory.phone}
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                aria-label={direction === 'rtl' ? 'إغلاق' : 'Close'}
                className="text-gray-900 hover:bg-gray-900/10 rounded-full w-8 h-8 flex items-center justify-center transition-colors duration-200"
              >
                <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-4">
              {visitorHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500 dark:text-gray-400">
                  <svg className="w-12 h-12 text-gray-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  <p className="text-sm text-gray-600 dark:text-gray-300 font-bold mt-3">{t('visitors.historyModal.noFollowUps')}</p>
                  <button
                    onClick={() => {
                      setShowHistoryModal(false)
                      openQuickFollowUp(selectedVisitorForHistory)
                    }}
                    className="mt-4 inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-6 py-2.5 rounded-lg transition-colors duration-200"
                  >
                    <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                    {t('visitors.historyModal.addFirst')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-primary-50 dark:bg-primary-900/20 p-3 rounded-lg ring-1 ring-primary-200 dark:ring-primary-900/50">
                    <p className="text-sm font-bold text-primary-900 dark:text-primary-300">
                      {t('visitors.historyModal.total')}: <span className="text-2xl">{visitorHistory.length}</span>
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
                              <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 font-bold text-xs">
                                <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                {t('visitors.historyModal.completed')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 font-bold text-xs">
                                <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                {t('visitors.historyModal.notCompleted')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {fu.result && getResultBadge(fu.result)}
                          {fu.salesName && (
                            <span className="bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full text-xs">
                              {fu.salesName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600 mb-2">
                        <p className="text-sm text-gray-800 dark:text-gray-100">{fu.notes}</p>
                      </div>

                      {fu.nextFollowUpDate && (
                        <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                          {t('visitors.historyModal.nextFollowUp')}: <span className="font-bold">{new Date(fu.nextFollowUpDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}</span>
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

      {/* نموذج الاشتراك السريع */}
      {showQuickSubscribeModal && selectedVisitorForSubscribe && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-subscribe-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-modal-in">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between z-10">
              <h2 id="quick-subscribe-title" className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <svg className="w-6 h-6 text-primary-500" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                <span>{direction === 'rtl' ? 'اشتراك سريع' : 'Quick Subscribe'} - {selectedVisitorForSubscribe.name}</span>
              </h2>
              <button
                onClick={() => {
                  setShowQuickSubscribeModal(false)
                  setSelectedVisitorForSubscribe(null)
                }}
                aria-label={direction === 'rtl' ? 'إغلاق' : 'Close'}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200 rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6">
              <MemberForm
                onSuccess={async () => {
                  setShowQuickSubscribeModal(false)
                  setSelectedVisitorForSubscribe(null)
                  refetchVisitors()

                  // تحديث صفحة المتابعات لإزالة الزائر الذي أصبح عضواً
                  await queryClient.invalidateQueries({ queryKey: ['followups'] })
                  await queryClient.invalidateQueries({ queryKey: ['visitors-followups'] })
                  await queryClient.invalidateQueries({ queryKey: ['members-followups'] })

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

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setVisitorToDelete(null)
        }}
        onConfirm={confirmDelete}
        title={t('visitors.deleteModal.title')}
        message={t('visitors.deleteModal.message')}
        itemName={visitorToDelete ? `${visitorToDelete.name} (${visitorToDelete.phone})` : ''}
        loading={deleteVisitorMutation.isPending}
      />
    </div>
  )
}
