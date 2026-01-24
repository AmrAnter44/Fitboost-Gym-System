'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../contexts/ToastContext'
import { fetchVisitors, fetchFollowUps } from '../../lib/api/visitors'
import { fetchMembers } from '../../lib/api/members'

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

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')

  // Fetch visitors with filters
  const {
    data: visitorsData,
    isLoading: loading,
    error: visitorsError,
    refetch: refetchVisitors
  } = useQuery({
    queryKey: ['visitors', searchTerm, statusFilter, sourceFilter],
    queryFn: () => fetchVisitors({ searchTerm, statusFilter, sourceFilter }),
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

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [visitorToDelete, setVisitorToDelete] = useState<Visitor | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    notes: '',
    source: 'walk-in',
    interestedIn: '',
  })

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
  }, [searchTerm, statusFilter, sourceFilter, monthFilter])

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
        setFormData({ name: '', phone: '', notes: '', source: 'walk-in', interestedIn: '' })
        toast.success(t('visitors.messages.addSuccess'))
        refetchVisitors()
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

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await fetch('/api/visitors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      })
      refetchVisitors()
      toast.success(t('visitors.messages.statusUpdateSuccess'))
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error(t('visitors.messages.statusUpdateError'))
    }
  }

  const handleDelete = (visitor: Visitor) => {
    setVisitorToDelete(visitor)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!visitorToDelete) return

    setDeleteLoading(true)
    try {
      await fetch(`/api/visitors?id=${visitorToDelete.id}`, { method: 'DELETE' })
      refetchVisitors()
      toast.success(t('visitors.messages.deleteSuccess'))
      setShowDeleteModal(false)
      setVisitorToDelete(null)
    } catch (error) {
      console.error('Error deleting visitor:', error)
      toast.error(t('visitors.messages.deleteError'))
    } finally {
      setDeleteLoading(false)
    }
  }

  const openHistoryModal = (visitor: Visitor) => {
    setSelectedVisitorForHistory(visitor)
    setShowHistoryModal(true)
  }

  const openQuickFollowUp = (visitor: Visitor) => {
    // الانتقال لصفحة المتابعات مع تمرير بيانات الزائر
    router.push(`/followups?visitorId=${visitor.id}`)
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
      subscribed: 'bg-blue-100 text-blue-800',
    }
    const labels: Record<string, string> = {
      interested: t('visitors.results.interested'),
      'not-interested': t('visitors.results.notInterested'),
      postponed: t('visitors.results.postponed'),
      subscribed: t('visitors.results.subscribed'),
    }
    if (!result) return <span className="text-gray-400">-</span>
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[result as keyof typeof badges] || 'bg-gray-100 text-gray-800'}`}>
        {labels[result] || result}
      </span>
    )
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      contacted: 'bg-blue-100 text-blue-800',
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
      <span className={`px-2 py-1 rounded-full text-xs ${badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    )
  }

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      'walk-in': t('visitors.sources.walkIn'),
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
      {/* Header with Stats */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{t('visitors.title')}</h1>
            <p className="text-gray-600 mt-2 text-sm sm:text-base">{t('visitors.subtitle')}</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full sm:w-auto bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700"
          >
            {showForm ? t('visitors.hideForm') : `➕ ${t('visitors.addVisitor')}`}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-4 sm:p-5 shadow-lg">
            <div className="text-xs sm:text-sm opacity-90 mb-1">
              {monthFilter !== 'all' ? `${t('visitors.stats.visitorsOf')} ${getMonthLabel(monthFilter)}` : t('visitors.status.totalVisitors')}
            </div>
            <div className="text-2xl sm:text-4xl font-bold">{filteredVisitors.length}</div>
            {monthFilter !== 'all' && (
              <div className="text-xs opacity-75 mt-1">{t('visitors.stats.outOf', { total: visitors.length.toString() })}</div>
            )}
          </div>
          {stats.map((stat) => (
            <div key={stat.status} className="bg-white p-4 sm:p-5 rounded-xl shadow-lg border-2">
              <div className="text-gray-500 text-xs sm:text-sm font-medium mb-1">
                {stat.status === 'pending' && `⏳ ${t('visitors.status.pending')}`}
                {stat.status === 'contacted' && `📞 ${t('visitors.status.contacted')}`}
                {stat.status === 'subscribed' && `✅ ${t('visitors.status.subscribed')}`}
                {stat.status === 'rejected' && `❌ ${t('visitors.status.rejected')}`}
              </div>
              <div className="text-2xl sm:text-3xl font-bold">{stat._count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Visitor Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">{t('visitors.form.title')}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('visitors.form.name')} *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder={t('visitors.form.namePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('visitors.form.phone')} *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder={t('visitors.form.phonePlaceholder')}
                  pattern="^(010|011|012|015)[0-9]{8}$"
                  title={t('visitors.form.phonePattern')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('visitors.form.source')}</label>
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="walk-in">{t('visitors.sources.walkIn')}</option>
                  <option value="facebook">{t('visitors.sources.facebook')}</option>
                  <option value="instagram">{t('visitors.sources.instagram')}</option>
                  <option value="friend">{t('visitors.sources.friend')}</option>
                  <option value="other">{t('visitors.sources.other')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('visitors.form.interestedIn')}</label>
                <input
                  type="text"
                  value={formData.interestedIn}
                  onChange={(e) => setFormData({ ...formData, interestedIn: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder={t('visitors.form.interestedInPlaceholder')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('visitors.form.notes')}</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                rows={3}
                placeholder={t('visitors.form.notesPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? t('visitors.form.saving') : t('visitors.form.submit')}
            </button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">🔍 {t('visitors.filters.search')}</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder={t('visitors.filters.searchPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">📅 {t('visitors.filters.month')}</label>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">{t('visitors.filters.allMonths', { count: visitors.length.toString() })}</option>
              {availableMonths.map(month => {
                const count = visitors.filter(v => {
                  const date = new Date(v.createdAt)
                  const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                  return yearMonth === month
                }).length
                return (
                  <option key={month} value={month}>
                    {getMonthLabel(month)} ({count})
                  </option>
                )
              })}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">📂 {t('visitors.filters.source')}</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">{t('visitors.filters.all')}</option>
              <option value="walk-in">{t('visitors.sources.walkIn')}</option>
              <option value="facebook">{t('visitors.sources.facebook')}</option>
              <option value="instagram">{t('visitors.sources.instagram')}</option>
              <option value="friend">{t('visitors.sources.friend')}</option>
              <option value="other">{t('visitors.sources.other')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">📊 {t('visitors.filters.status')}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">{t('visitors.filters.all')}</option>
              <option value="pending">{t('visitors.status.pending')}</option>
              <option value="contacted">{t('visitors.status.contacted')}</option>
              <option value="subscribed">{t('visitors.status.subscribed')}</option>
              <option value="rejected">{t('visitors.status.rejected')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Visitors Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-xl">{t('visitors.loading')}</p>
        </div>
      ) : (
        <>
          {/* Cards للموبايل */}
          <div className="lg:hidden space-y-4">
            {currentVisitors.map((visitor) => (
              <div
                key={visitor.id}
                className="bg-white rounded-lg shadow-md border-r-4 border-green-500 overflow-hidden"
              >
                {/* Actions في الأعلى */}
                <div className="bg-gray-50 px-4 py-2 flex justify-between items-center border-b">
                  <div className="flex gap-2 flex-wrap">
                    {visitor.status === 'subscribed' ? (
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded text-xs font-bold">
                        ✅ مشترك
                      </span>
                    ) : (
                      <button
                        onClick={() => openQuickFollowUp(visitor)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 rounded bg-blue-50"
                      >
                        ➕ {t('visitors.actions.followUp')}
                      </button>
                    )}
                    <button
                      onClick={() => openHistoryModal(visitor)}
                      className="text-purple-600 hover:text-purple-800 text-xs font-medium px-2 py-1 rounded bg-purple-50"
                    >
                      📋 {t('visitors.actions.history')}
                    </button>
                  </div>
                  <button
                    onClick={() => handleDelete(visitor)}
                    className="text-red-600 hover:text-red-800 text-xs font-bold px-2 py-1 rounded bg-red-50"
                  >
                    🗑️ {t('visitors.actions.delete')}
                  </button>
                </div>

                {/* محتوى الكارت */}
                <div className="p-4 space-y-3">
                  {/* الاسم */}
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-800">{visitor.name}</h3>
                  </div>

                  {/* رقم الهاتف */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">📱</span>
                    <a
                      href={`https://wa.me/2${visitor.phone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 rounded-lg font-medium text-xs sm:text-sm bg-green-500 hover:bg-green-600 text-white transition-colors"
                    >
                      <span>💬</span>
                      <span className="font-mono">{visitor.phone}</span>
                    </a>
                  </div>

                  {/* المصدر */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">📂</span>
                    <span className="text-gray-700 text-sm">{getSourceLabel(visitor.source)}</span>
                  </div>

                  {/* مهتم بـ */}
                  {visitor.interestedIn && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm">💡</span>
                      <span className="text-gray-700 text-sm">{visitor.interestedIn}</span>
                    </div>
                  )}

                  {/* الحالة */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">📊</span>
                    <select
                      value={visitor.status}
                      onChange={(e) => handleUpdateStatus(visitor.id, e.target.value)}
                      className="text-xs px-2 py-1 rounded border flex-1"
                    >
                      <option value="pending">{t('visitors.status.pending')}</option>
                      <option value="contacted">{t('visitors.status.contacted')}</option>
                      <option value="subscribed">{t('visitors.status.subscribed')}</option>
                      <option value="rejected">{t('visitors.status.rejected')}</option>
                    </select>
                  </div>

                  {/* تاريخ الزيارة */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">📅</span>
                    <span className="text-gray-700 text-sm">
                      {new Date(visitor.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                    </span>
                  </div>

                  {/* الملاحظات */}
                  {visitor.notes && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">📝 {t('visitors.table.notes')}:</span> {visitor.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Pagination للموبايل */}
            {filteredVisitors.length > 0 && totalPages > 1 && (
              <div className="bg-white rounded-lg shadow-md p-4 space-y-3">
                <div className="text-sm text-gray-600 text-center">
                  {t('visitors.pagination.showing', {
                    start: (startIndex + 1).toString(),
                    end: Math.min(endIndex, filteredVisitors.length).toString(),
                    total: filteredVisitors.length.toString()
                  })}
                </div>

                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-gray-100 hover:bg-gray-200"
                  >
                    {t('visitors.pagination.previous')}
                  </button>

                  <span className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-medium">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-gray-100 hover:bg-gray-200"
                  >
                    {t('visitors.pagination.next')}
                  </button>
                </div>

                <div className="flex items-center justify-center gap-2 text-sm">
                  <label className="text-gray-600">{t('visitors.pagination.itemsPerPage')}:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="border border-gray-300 rounded-lg px-3 py-1"
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
              <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow-md">
                <div className="text-5xl mb-3">🚶</div>
                {monthFilter !== 'all' ? (
                  <>
                    <p>{t('visitors.noVisitors.inMonth', { month: getMonthLabel(monthFilter) })}</p>
                    <button
                      onClick={() => setMonthFilter('all')}
                      className="mt-3 text-orange-600 hover:text-orange-700 font-medium"
                    >
                      {t('visitors.noVisitors.showAll')}
                    </button>
                  </>
                ) : (
                  <p>{t('visitors.noVisitors.current')}</p>
                )}
              </div>
            )}
          </div>

          {/* الجدول للشاشات الكبيرة */}
          <div className="hidden lg:block bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('visitors.table.name')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('visitors.table.phone')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('visitors.table.source')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('visitors.table.interestedIn')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('visitors.table.status')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('visitors.table.visitDate')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('visitors.table.notes')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('visitors.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {currentVisitors.map((visitor) => (
                  <tr key={visitor.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{visitor.name}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`https://wa.me/2${visitor.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg font-medium text-sm bg-green-500 hover:bg-green-600 text-white transition-colors"
                      >
                        <span>💬</span>
                        <span className="font-mono">{visitor.phone}</span>
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {getSourceLabel(visitor.source)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {visitor.interestedIn || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={visitor.status}
                        onChange={(e) => handleUpdateStatus(visitor.id, e.target.value)}
                        className="text-xs px-2 py-1 rounded border"
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
                        <p className="text-gray-600 max-w-xs truncate" title={visitor.notes}>
                          {visitor.notes}
                        </p>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {visitor.status === 'subscribed' ? (
                          <span className="bg-green-100 text-green-800 px-3 py-1 rounded text-sm font-bold">
                            ✅ مشترك
                          </span>
                        ) : (
                          <button
                            onClick={() => openQuickFollowUp(visitor)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium px-3 py-1 rounded bg-blue-50 hover:bg-blue-100"
                            title={t('visitors.actions.followUpTitle')}
                          >
                            ➕ {t('visitors.actions.followUp')}
                          </button>
                        )}
                        <button
                          onClick={() => openHistoryModal(visitor)}
                          className="text-purple-600 hover:text-purple-800 text-sm font-medium px-3 py-1 rounded bg-purple-50 hover:bg-purple-100"
                          title={t('visitors.actions.historyTitle')}
                        >
                          📋 {t('visitors.actions.history')}
                        </button>
                        <button
                          onClick={() => handleDelete(visitor)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 rounded bg-red-50 hover:bg-red-100"
                        >
                          🗑️ {t('visitors.actions.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {filteredVisitors.length > 0 && totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-4 py-3 bg-gray-50 rounded-lg">
                {/* معلومات الصفحة */}
                <div className="text-sm text-gray-600">
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
                    className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
                    title={t('visitors.pagination.firstPage')}
                  >
                    {t('visitors.pagination.first')}
                  </button>

                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
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
                              ? 'bg-blue-600 text-white'
                              : 'hover:bg-gray-200'
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
                    className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
                    title={t('visitors.pagination.nextPage')}
                  >
                    {t('visitors.pagination.next')}
                  </button>

                  <button
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
                    title={t('visitors.pagination.lastPage')}
                  >
                    {t('visitors.pagination.last')}
                  </button>
                </div>

                {/* اختيار عدد العناصر في الصفحة */}
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-gray-600">{t('visitors.pagination.itemsPerPage')}:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <div className="text-center py-12 text-gray-500">
                <div className="text-5xl mb-3">🚶</div>
                {monthFilter !== 'all' ? (
                  <>
                    <p>{t('visitors.noVisitors.inMonth', { month: getMonthLabel(monthFilter) })}</p>
                    <button
                      onClick={() => setMonthFilter('all')}
                      className="mt-3 text-orange-600 hover:text-orange-700 font-medium"
                    >
                      {t('visitors.noVisitors.showAll')}
                    </button>
                  </>
                ) : (
                  <p>{t('visitors.noVisitors.current')}</p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* History Modal - سجل المتابعات */}
      {showHistoryModal && selectedVisitorForHistory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowHistoryModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir={direction}>
            <div className="sticky top-0 bg-purple-600 text-white p-4 rounded-t-lg flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span>📋</span>
                  <span>{t('visitors.historyModal.title')}</span>
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
                  <p className="text-sm">{t('visitors.historyModal.noFollowUps')}</p>
                  <button
                    onClick={() => {
                      setShowHistoryModal(false)
                      openQuickFollowUp(selectedVisitorForHistory)
                    }}
                    className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                  >
                    ➕ {t('visitors.historyModal.addFirst')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                    <p className="text-sm font-bold text-purple-900">
                      {t('visitors.historyModal.total')}: <span className="text-2xl">{visitorHistory.length}</span>
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
                              {new Date(fu.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                            </span>
                            {fu.contacted ? (
                              <span className="text-green-700 font-bold text-xs">✅ {t('visitors.historyModal.completed')}</span>
                            ) : (
                              <span className="text-orange-600 font-bold text-xs">⏳ {t('visitors.historyModal.notCompleted')}</span>
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
                          📅 {t('visitors.historyModal.nextFollowUp')}: <span className="font-bold">{new Date(fu.nextFollowUpDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}</span>
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
        loading={deleteLoading}
      />
    </div>
  )
}
