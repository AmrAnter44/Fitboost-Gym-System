'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDateYMD } from '../../lib/dateFormatter'
import { useDebounce } from '../../hooks/useDebounce'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../contexts/ToastContext'
import { useRouter } from 'next/navigation'
import { fetchInvitations } from '@/lib/api/invitations'

interface Invitation {
  id: string
  guestName: string
  guestPhone: string
  notes?: string
  createdAt: string
  member: {
    memberNumber: number
    name: string
    phone: string
  }
}

export default function InvitationsPage() {
  const { t, direction } = useLanguage()
  const toast = useToast()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [invitationToDelete, setInvitationToDelete] = useState<Invitation | null>(null)

  // ✅ Optimistic Delete - حذف الدعوة فوراً من الـ UI
  const deleteInvitationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/invitations?id=${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Delete failed')
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['invitations'] })
      const previousData = queryClient.getQueryData<Invitation[]>(['invitations'])
      queryClient.setQueryData<Invitation[]>(['invitations'], (old) => {
        if (!old) return old
        return old.filter(inv => inv.id !== id)
      })
      return { previousData }
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['invitations'], context.previousData)
      }
      toast.error('حدث خطأ أثناء حذف الدعوة')
    },
    onSuccess: () => {
      toast.success('تم حذف الدعوة بنجاح')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] })
    }
  })

  // Fetch invitations using TanStack Query
  const {
    data: invitations = [],
    isLoading: loading,
    error: invitationsError,
  } = useQuery({
    queryKey: ['invitations'],
    queryFn: fetchInvitations,
    retry: 1,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  // Error handling
  useEffect(() => {
    if (invitationsError) {
      const errorMessage = (invitationsError as Error).message
      if (errorMessage === 'UNAUTHORIZED') {
        toast.error('يجب تسجيل الدخول أولاً')
        setTimeout(() => router.push('/login'), 2000)
      } else if (errorMessage === 'FORBIDDEN') {
        toast.error('ليس لديك صلاحية عرض الدعوات')
      } else {
        toast.error(errorMessage || 'حدث خطأ أثناء جلب بيانات الدعوات')
      }
    }
  }, [invitationsError, toast, router])

  // إعادة تعيين الصفحة عند تغيير الفلاتر
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, dateFilter])

  const handleDelete = (invitation: Invitation) => {
    setInvitationToDelete(invitation)
    setShowDeleteModal(true)
  }

  const confirmDelete = () => {
    if (!invitationToDelete) return
    deleteInvitationMutation.mutate(invitationToDelete.id)
    setShowDeleteModal(false)
    setInvitationToDelete(null)
  }

  // فلترة النتائج
  const filteredInvitations = invitations.filter(inv => {
    const matchesSearch =
      inv.guestName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      inv.guestPhone.includes(debouncedSearchTerm) ||
      inv.member.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      inv.member.memberNumber.toString().includes(debouncedSearchTerm)

    const matchesDate = dateFilter
      ? new Date(inv.createdAt).toISOString().split('T')[0] === dateFilter
      : true

    return matchesSearch && matchesDate
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredInvitations.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentInvitations = filteredInvitations.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // إحصائيات
  const stats = {
    total: invitations.length,
    today: invitations.filter(inv => 
      new Date(inv.createdAt).toDateString() === new Date().toDateString()
    ).length,
    thisWeek: invitations.filter(inv => {
      const invDate = new Date(inv.createdAt)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return invDate >= weekAgo
    }).length,
    thisMonth: invitations.filter(inv => {
      const invDate = new Date(inv.createdAt)
      return invDate.getMonth() === new Date().getMonth() &&
             invDate.getFullYear() === new Date().getFullYear()
    }).length
  }

  return (
    <div className="container mx-auto px-4 py-6 md:px-6" dir={direction}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <span>🎟️</span>
          <span>{t('invitations.title')}</span>
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">{t('invitations.subtitle')}</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-xl p-5 shadow-lg">
          <p className="text-sm opacity-90 mb-1">{t('invitations.totalInvitations')}</p>
          <p className="text-4xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-5 shadow-lg">
          <p className="text-sm opacity-90 mb-1">{t('invitations.today')}</p>
          <p className="text-4xl font-bold">{stats.today}</p>
        </div>
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-xl p-5 shadow-lg">
          <p className="text-sm opacity-90 mb-1">{t('invitations.thisWeek')}</p>
          <p className="text-4xl font-bold">{stats.thisWeek}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-5 shadow-lg">
          <p className="text-sm opacity-90 mb-1">{t('invitations.thisMonth')}</p>
          <p className="text-4xl font-bold">{stats.thisMonth}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">🔍 {t('invitations.search')}</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('invitations.searchPlaceholder')}
              className="w-full px-4 py-2 border-2 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">📅 {t('invitations.filterByDate')}</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-4 py-2 border-2 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
        {(searchTerm || dateFilter) && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                setSearchTerm('')
                setDateFilter('')
              }}
              className="text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 px-3 py-1 rounded-lg"
            >
              ✖️ {t('invitations.clearFilters')}
            </button>
            <p className="text-sm text-gray-600 dark:text-gray-300 py-1">
              {t('invitations.showing', {
                count: filteredInvitations.length.toString(),
                total: invitations.length.toString()
              })}
            </p>
          </div>
        )}
      </div>

      {/* List / Cards */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-xl">{t('invitations.loading')}</p>
        </div>
      ) : (
        <div>
          {/* Cards للموبايل */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {currentInvitations.map((invitation) => (
              <div key={invitation.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border-r-4 border-primary-500">
                {/* الهيدر */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">
                      {formatDateYMD(invitation.createdAt)} • {new Date(invitation.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <h3 className="font-bold text-lg text-primary-700">{invitation.guestName}</h3>
                  </div>
                  <button
                    onClick={() => handleDelete(invitation)}
                    className="text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded hover:bg-red-50 dark:bg-red-900/20 dark:text-red-200"
                  >
                    🗑️ {t('invitations.delete')}
                  </button>
                </div>

                {/* التفاصيل */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm">📱</span>
                    <span className="font-mono text-sm">{invitation.guestPhone}</span>
                  </div>

                  <div className="border-t pt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">{t('invitations.hostingMemberLabel')}</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{invitation.member.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{invitation.member.phone}</p>
                      </div>
                      <span className="bg-primary-100 text-primary-800 px-2 py-1 rounded font-bold text-xs">
                        #{invitation.member.memberNumber}
                      </span>
                    </div>
                  </div>

                  {invitation.notes && (
                    <div className="border-t pt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">{t('invitations.notesLabel')}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-200">{invitation.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Table for large screens */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 dark:bg-gray-700 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-right dark:text-gray-200">{t('invitations.date')}</th>
                    <th className="px-4 py-3 text-right dark:text-gray-200">{t('invitations.guestName')}</th>
                    <th className="px-4 py-3 text-right dark:text-gray-200">{t('invitations.guestPhone')}</th>
                    <th className="px-4 py-3 text-right dark:text-gray-200">{t('invitations.hostingMember')}</th>
                    <th className="px-4 py-3 text-right dark:text-gray-200">{t('invitations.membershipNumber')}</th>
                    <th className="px-4 py-3 text-right dark:text-gray-200">{t('invitations.notes')}</th>
                    <th className="px-4 py-3 text-right dark:text-gray-200">{t('invitations.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {currentInvitations.map((invitation) => (
                    <tr key={invitation.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-700">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-mono text-sm">
                            {formatDateYMD(invitation.createdAt)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                            {new Date(invitation.createdAt).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-primary-700">
                          {invitation.guestName}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono">{invitation.guestPhone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{invitation.member.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{invitation.member.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block bg-primary-100 text-primary-800 px-2 py-1 rounded font-bold text-sm">
                          #{invitation.member.memberNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {invitation.notes ? (
                          <p className="text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate" title={invitation.notes}>
                            {invitation.notes}
                          </p>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(invitation)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          {t('invitations.delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {filteredInvitations.length > 0 && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              {/* Page info */}
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {t('invitations.showingPagination', {
                  start: (startIndex + 1).toString(),
                  end: Math.min(endIndex, filteredInvitations.length).toString(),
                  total: filteredInvitations.length.toString()
                })}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:bg-gray-700 transition-colors"
                  title={t('invitations.firstPage')}
                >
                  {t('invitations.firstPage')}
                </button>

                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:bg-gray-700 transition-colors"
                  title={t('invitations.previousPage')}
                >
                  {t('invitations.previousPage')}
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
                            ? 'bg-primary-600 text-white'
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
                  className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:bg-gray-700 transition-colors"
                  title={t('invitations.nextPage')}
                >
                  {t('invitations.nextPage')}
                </button>

                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:bg-gray-700 transition-colors"
                  title={t('invitations.lastPage')}
                >
                  {t('invitations.lastPage')}
                </button>
              </div>

              {/* Items per page selector */}
              <div className="flex items-center gap-2 text-sm">
                <label className="text-gray-600 dark:text-gray-300">{t('invitations.itemsPerPage')}:</label>
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

          {filteredInvitations.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 dark:text-gray-500">
              {searchTerm || dateFilter ? (
                <>
                  <div className="text-5xl mb-3">🔍</div>
                  <p>{t('invitations.noMatchingResults')}</p>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-3">🎟️</div>
                  <p>{t('invitations.noInvitationsYet')}</p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Note */}
      <div className="mt-6 bg-primary-50 border-r-4 border-primary-500 p-4 rounded-lg">
        <p className="text-sm text-primary-800">
          <strong>{t('invitations.noteLabel')}</strong>
        </p>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setInvitationToDelete(null)
        }}
        onConfirm={confirmDelete}
        title={t('invitations.deleteModal.title')}
        message={t('invitations.deleteModal.message')}
        itemName={invitationToDelete ? `${invitationToDelete.guestName} (${invitationToDelete.guestPhone})` : ''}
        loading={deleteInvitationMutation.isPending}
      />
    </div>
  )
}