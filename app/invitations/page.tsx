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
import AssignSalesButton from '../../components/AssignSalesButton'
import { LoadingScreen } from '../../components/Spinner'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Invitation {
  id: string
  guestName: string
  guestPhone: string
  notes?: string
  createdAt: string
  member: {
    memberNumber: string
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

  // Optimistic Delete
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
      <div className="mb-6 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
          <svg {...stroke} className="w-6 h-6" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('invitations.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('invitations.subtitle')}</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: t('invitations.totalInvitations'), value: stats.total, tone: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' },
          { label: t('invitations.today'), value: stats.today, tone: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
          { label: t('invitations.thisWeek'), value: stats.thisWeek, tone: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
          { label: t('invitations.thisMonth'), value: stats.thisMonth, tone: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
            <div className={`w-10 h-10 rounded-lg ${stat.tone} flex items-center justify-center mb-2`}>
              <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
              </svg>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 inline-flex items-center gap-1">
              <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              {t('invitations.search')}
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('invitations.searchPlaceholder')}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 inline-flex items-center gap-1">
              <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              {t('invitations.filterByDate')}
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>
        </div>
        {(searchTerm || dateFilter) && (
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <button
              onClick={() => {
                setSearchTerm('')
                setDateFilter('')
              }}
              className="inline-flex items-center gap-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-lg font-bold transition-colors duration-200"
            >
              <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              {t('invitations.clearFilters')}
            </button>
            <p className="text-sm text-gray-600 dark:text-gray-400">
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
        <LoadingScreen message={t('invitations.loading')} />
      ) : (
        <div>
          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {currentInvitations.map((invitation) => (
              <div key={invitation.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 border-s-4 border-primary-500">
                <div className="flex justify-between items-start mb-3 gap-2 flex-wrap">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {formatDateYMD(invitation.createdAt)} • {new Date(invitation.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <h3 className="font-bold text-base text-primary-700 dark:text-primary-400">{invitation.guestName}</h3>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <AssignSalesButton
                      entityType="invitation"
                      entityId={invitation.id}
                      currentSalesStaff={null}
                      size="xs"
                      onAssigned={() => queryClient.invalidateQueries({ queryKey: ['invitations'] })}
                    />
                    <button
                      onClick={() => handleDelete(invitation)}
                      className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 text-xs font-bold px-2 py-1 rounded-lg transition-colors duration-200"
                      aria-label={t('invitations.delete')}
                    >
                      <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                      {t('invitations.delete')}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <svg {...stroke} className="w-4 h-4 text-gray-400" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                    </svg>
                    <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{invitation.guestPhone}</span>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('invitations.hostingMemberLabel')}</p>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">{invitation.member.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{invitation.member.phone}</p>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex-shrink-0">
                        #{invitation.member.memberNumber}
                      </span>
                    </div>
                  </div>

                  {invitation.notes && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('invitations.notesLabel')}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{invitation.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Table for large screens */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-start font-bold">{t('invitations.date')}</th>
                    <th className="px-4 py-3 text-start font-bold">{t('invitations.guestName')}</th>
                    <th className="px-4 py-3 text-start font-bold">{t('invitations.guestPhone')}</th>
                    <th className="px-4 py-3 text-start font-bold">{t('invitations.hostingMember')}</th>
                    <th className="px-4 py-3 text-start font-bold">{t('invitations.membershipNumber')}</th>
                    <th className="px-4 py-3 text-start font-bold">{t('invitations.notes')}</th>
                    <th className="px-4 py-3 text-start font-bold">{t('invitations.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {currentInvitations.map((invitation) => (
                    <tr key={invitation.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        <p className="font-mono text-sm">
                          {formatDateYMD(invitation.createdAt)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(invitation.createdAt).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-primary-700 dark:text-primary-400">
                          {invitation.guestName}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        <p className="font-mono">{invitation.guestPhone}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        <p className="font-bold">{invitation.member.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{invitation.member.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                          #{invitation.member.memberNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {invitation.notes ? (
                          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate" title={invitation.notes}>
                            {invitation.notes}
                          </p>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <AssignSalesButton
                            entityType="invitation"
                            entityId={invitation.id}
                            currentSalesStaff={null}
                            size="xs"
                            onAssigned={() => queryClient.invalidateQueries({ queryKey: ['invitations'] })}
                          />
                          <button
                            onClick={() => handleDelete(invitation)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors duration-200"
                            aria-label={t('invitations.delete')}
                            title={t('invitations.delete')}
                          >
                            <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {filteredInvitations.length > 0 && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-4 py-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {t('invitations.showingPagination', {
                  start: (startIndex + 1).toString(),
                  end: Math.min(endIndex, filteredInvitations.length).toString(),
                  total: filteredInvitations.length.toString()
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                  title={t('invitations.firstPage')}
                >
                  {t('invitations.firstPage')}
                </button>

                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                  title={t('invitations.previousPage')}
                >
                  {t('invitations.previousPage')}
                </button>

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
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors duration-200 ${
                          currentPage === pageNum
                            ? 'bg-primary-500 text-primary-contrast'
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        aria-current={currentPage === pageNum ? 'page' : undefined}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                  title={t('invitations.nextPage')}
                >
                  {t('invitations.nextPage')}
                </button>

                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                  title={t('invitations.lastPage')}
                >
                  {t('invitations.lastPage')}
                </button>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <label className="text-gray-600 dark:text-gray-400 font-bold">{t('invitations.itemsPerPage')}:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
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
            <div className="flex flex-col items-center justify-center py-12 text-center bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
              {searchTerm || dateFilter ? (
                <>
                  <svg {...stroke} className="w-12 h-12 text-gray-400" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                  <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('invitations.noMatchingResults')}</h3>
                </>
              ) : (
                <>
                  <svg {...stroke} className="w-12 h-12 text-gray-400" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
                  </svg>
                  <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('invitations.noInvitationsYet')}</h3>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Note */}
      <div className="mt-6 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-900/50 p-4 rounded-lg flex items-start gap-2">
        <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400 flex-shrink-0 mt-0.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
        <p className="text-sm text-primary-800 dark:text-primary-300">
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