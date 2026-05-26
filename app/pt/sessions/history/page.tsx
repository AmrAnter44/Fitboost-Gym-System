'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../../contexts/LanguageContext'
import { useConfirm } from '../../../../hooks/useConfirm'
import { useSuccess } from '../../../../hooks/useSuccess'
import { usePermissions } from '../../../../hooks/usePermissions'
import ConfirmDialog from '../../../../components/ConfirmDialog'
import SuccessDialog from '../../../../components/SuccessDialog'
import { useDebounce } from '../../../../hooks/useDebounce'
import { LoadingScreen } from '../../../../components/Spinner'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface PTSessionRecord {
  id: string
  ptNumber: number
  clientName: string
  coachName: string
  sessionDate: string
  notes: string | null
  signature?: string | null
  attendedBy?: string | null
  createdAt: string
  isFreeSession?: boolean
  memberId?: string | null
  pt?: {
    clientName: string
    coachName: string
    phone: string
  } | null
  member?: {
    name: string
    memberNumber: string
    phone: string
  } | null
}

export default function PTSessionHistoryPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const { confirm, isOpen: isConfirmOpen, options: confirmOptions, handleConfirm, handleCancel } = useConfirm()
  const { show: showSuccess, isOpen: isSuccessOpen, options: successOptions, handleClose: handleSuccessClose } = useSuccess()
  const { user } = usePermissions()
  const [sessions, setSessions] = useState<PTSessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [filterPTNumber, setFilterPTNumber] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewingSignature, setViewingSignature] = useState<string | null>(null)

  const isCoach = user?.role === 'COACH'

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/pt/sessions')
      const data = await response.json()
      setSessions(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (sessionId: string, ptNumber: number) => {
    const confirmed = await confirm({
      title: t('pt.sessionHistory.deleteConfirm.title'),
      message: t('pt.sessionHistory.deleteConfirm.message', { ptNumber: ptNumber.toString() }),
      confirmText: t('pt.sessionHistory.deleteConfirm.confirm'),
      cancelText: t('pt.sessionHistory.deleteConfirm.cancel'),
      type: 'danger'
    })

    if (!confirmed) return

    try {
      const response = await fetch(`/api/pt/sessions?sessionId=${sessionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await showSuccess({
          title: t('pt.sessionHistory.success.title'),
          message: t('pt.sessionHistory.success.message'),
          type: 'success'
        })
        fetchSessions()
      } else {
        await showSuccess({
          title: t('pt.sessionHistory.error.title'),
          message: t('pt.sessionHistory.error.deleteFailed'),
          type: 'error'
        })
      }
    } catch (error) {
      await showSuccess({
        title: t('pt.sessionHistory.error.title'),
        message: t('pt.sessionHistory.error.deleteError'),
        type: 'error'
      })
    }
  }

  const filteredSessions = sessions.filter(session => {
    const term = debouncedSearchTerm.toLowerCase()
    const matchesSearch = !term ||
      (session.clientName && session.clientName.toLowerCase().includes(term)) ||
      (session.coachName && session.coachName.toLowerCase().includes(term)) ||
      (session.ptNumber && session.ptNumber.toString().includes(term)) ||
      (session.member?.name && session.member.name.toLowerCase().includes(term)) ||
      (session.member?.memberNumber && session.member.memberNumber.toString().includes(term))

    const matchesPTNumber = !filterPTNumber || (session.ptNumber && session.ptNumber.toString() === filterPTNumber)

    const sessionDate = session.sessionDate ? new Date(session.sessionDate) : null
    if (!sessionDate || isNaN(sessionDate.getTime())) {
      return matchesSearch && matchesPTNumber && !dateFrom && !dateTo
    }

    let matchesDateFrom = true
    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      fromDate.setHours(0, 0, 0, 0)
      matchesDateFrom = sessionDate >= fromDate
    }

    let matchesDateTo = true
    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      matchesDateTo = sessionDate <= toDate
    }

    return matchesSearch && matchesPTNumber && matchesDateFrom && matchesDateTo
  })

  const totalSessions = filteredSessions.length
  const uniquePTs = new Set(filteredSessions.map(s => s.ptNumber)).size
  const todaySessions = filteredSessions.filter(s => {
    const sessionDate = new Date(s.sessionDate).toDateString()
    const today = new Date().toDateString()
    return sessionDate === today
  }).length

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <div className="flex justify-between items-center mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="inline-flex w-10 h-10 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
            <svg {...stroke} className="w-6 h-6" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('pt.sessionHistory.title')}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('pt.sessionHistory.subtitle')}</p>
          </div>
        </div>
        {!isCoach && (
          <button
            onClick={() => router.push('/pt/sessions/register')}
            className="bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 inline-flex items-center gap-2 text-sm"
          >
            <svg {...stroke} className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            {t('pt.sessionHistory.registerNew')}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('pt.sessionHistory.totalSessions')}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{totalSessions}</div>
            </div>
            <span className="inline-flex w-10 h-10 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
              <svg {...stroke} className="w-6 h-6" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('pt.sessionHistory.todaySessions')}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{todaySessions}</div>
            </div>
            <span className="inline-flex w-10 h-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
              <svg {...stroke} className="w-6 h-6" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('pt.sessionHistory.numberOfClients')}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{uniquePTs}</div>
            </div>
            <span className="inline-flex w-10 h-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
              <svg {...stroke} className="w-6 h-6" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 inline-flex items-center gap-2">
          <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
          {t('pt.sessionHistory.filtersAndSearch')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('pt.sessionHistory.generalSearch')}</label>
            <input
              type="text"
              placeholder={t('pt.sessionHistory.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('pt.sessionHistory.specificPTNumber')}</label>
            <input
              type="number"
              placeholder={t('pt.sessionHistory.ptNumberPlaceholder')}
              value={filterPTNumber}
              onChange={(e) => setFilterPTNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('pt.sessionHistory.fromDate')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('pt.sessionHistory.toDate')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>
        </div>

        {(searchTerm || filterPTNumber || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setSearchTerm('')
              setFilterPTNumber('')
              setDateFrom('')
              setDateTo('')
            }}
            className="mt-4 inline-flex items-center gap-1 text-sm text-primary-700 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 transition-colors duration-200"
          >
            <svg {...stroke} className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            {t('pt.sessionHistory.clearFilters')}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
        {loading ? (
          <LoadingScreen message={t('pt.sessionHistory.loading')} />
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg {...stroke} className="w-12 h-12 text-gray-400" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <h3 className="mt-3 text-gray-700 dark:text-gray-300 font-bold">{t('pt.sessionHistory.noRecords')}</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-start font-bold">{t('pt.sessionHistory.ptNumber')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('pt.sessionHistory.client')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('pt.sessionHistory.coach')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('pt.sessionHistory.sessionDate')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('pt.sessionHistory.sessionTime')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('pt.sessionHistory.notes')}</th>
                  <th className="px-4 py-3 text-start font-bold">الإمضاء</th>
                  <th className="px-4 py-3 text-start font-bold">{t('pt.sessionHistory.registrationDate')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('pt.sessionHistory.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {filteredSessions.map((session) => {
                  const sessionDate = new Date(session.sessionDate)
                  const isToday = sessionDate.toDateString() === new Date().toDateString()

                  return (
                    <tr
                      key={session.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors ${isToday ? 'bg-green-50/60 dark:bg-green-900/10' : ''}`}
                    >
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {session.isFreeSession ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
                              مجاني
                            </span>
                            {session.member && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">#{session.member.memberNumber}</span>
                            )}
                          </div>
                        ) : session.ptNumber < 0 ? (
                          <span className="font-bold text-primary-700 dark:text-primary-400">Day Use</span>
                        ) : (
                          <span className="font-bold text-green-600 dark:text-green-400">#{session.ptNumber}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        <div>
                          <p className="font-bold text-gray-900 dark:text-gray-100">{session.clientName}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {session.isFreeSession && session.member ? session.member.phone : session.pt?.phone || '-'}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{session.coachName}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        <span className={`font-mono ${isToday ? 'font-bold text-green-600 dark:text-green-400' : ''}`}>
                          {sessionDate.toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-primary-700 dark:text-primary-400">
                          {sessionDate.toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {session.notes ? (
                          <span className="text-sm">{session.notes}</span>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {session.signature ? (
                          <button
                            onClick={() => setViewingSignature(session.signature!)}
                            aria-label="عرض الإمضاء"
                            className="inline-block ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg overflow-hidden hover:ring-primary-400 transition-colors duration-200"
                          >
                            <img
                              src={session.signature}
                              alt="إمضاء"
                              className="w-16 h-8 object-contain bg-white"
                            />
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(session.createdAt).toLocaleDateString('ar-EG')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(session.id, session.ptNumber)}
                          aria-label={t('pt.sessionHistory.delete')}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 inline-flex items-center gap-1"
                        >
                          <svg {...stroke} className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
                          {t('pt.sessionHistory.delete')}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filteredSessions.length > 0 && (
        <div className="mt-4 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-900/50 rounded-lg p-4">
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {t('pt.sessionHistory.showing', { count: filteredSessions.length.toString(), total: sessions.length.toString() })}
          </p>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={confirmOptions.title}
        message={confirmOptions.message}
        confirmText={confirmOptions.confirmText}
        cancelText={confirmOptions.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        type={confirmOptions.type}
      />

      {/* Success/Error Dialog */}
      <SuccessDialog
        isOpen={isSuccessOpen}
        title={successOptions.title}
        message={successOptions.message}
        buttonText={successOptions.buttonText}
        onClose={handleSuccessClose}
        type={successOptions.type}
      />

      {/* Signature Viewer Modal */}
      {viewingSignature && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
          role="dialog" aria-modal="true" aria-labelledby="signature-title"
          onClick={() => setViewingSignature(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-lg w-full p-6 animate-modal-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="signature-title" className="text-xl font-bold text-gray-900 dark:text-gray-100 inline-flex items-center gap-2">
                <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
                إمضاء العميل
              </h3>
              <button
                onClick={() => setViewingSignature(null)}
                aria-label="Close"
                className="p-1 rounded text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-200"
              >
                <svg {...stroke} className="w-6 h-6" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="ring-1 ring-gray-200 dark:ring-gray-700 rounded-xl overflow-hidden bg-white p-4">
              <img
                src={viewingSignature}
                alt="إمضاء العميل"
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
