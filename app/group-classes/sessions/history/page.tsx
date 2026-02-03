'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../../contexts/LanguageContext'
import { useConfirm } from '../../../../hooks/useConfirm'
import { useSuccess } from '../../../../hooks/useSuccess'
import { usePermissions } from '../../../../hooks/usePermissions'
import ConfirmDialog from '../../../../components/ConfirmDialog'
import SuccessDialog from '../../../../components/SuccessDialog'

interface GroupClassSessionRecord {
  id: string
  groupClassNumber: number
  clientName: string
  instructorName: string
  sessionDate: string
  notes: string | null
  createdAt: string
  groupClass: {
    clientName: string
    instructorName: string
    phone: string
  }
}

export default function GroupClassSessionHistoryPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const { confirm, isOpen: isConfirmOpen, options: confirmOptions, handleConfirm, handleCancel } = useConfirm()
  const { show: showSuccess, isOpen: isSuccessOpen, options: successOptions, handleClose: handleSuccessClose } = useSuccess()
  const { user } = usePermissions()
  const [sessions, setSessions] = useState<GroupClassSessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterGroupClassNumber, setFilterGroupClassNumber] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const isCoach = user?.role === 'COACH'

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/group-classes/sessions')
      const data = await response.json()
      setSessions(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (sessionId: string, groupClassNumber: number) => {
    const confirmed = await confirm({
      title: t('groupClass.sessionHistory.deleteConfirm.title'),
      message: t('groupClass.sessionHistory.deleteConfirm.message', { groupClassNumber: groupClassNumber.toString() }),
      confirmText: t('groupClass.sessionHistory.deleteConfirm.confirm'),
      cancelText: t('groupClass.sessionHistory.deleteConfirm.cancel'),
      type: 'danger'
    })

    if (!confirmed) return

    try {
      const response = await fetch(`/api/group-classes/sessions?sessionId=${sessionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await showSuccess({
          title: t('groupClass.sessionHistory.success.title'),
          message: t('groupClass.sessionHistory.success.message'),
          type: 'success'
        })
        fetchSessions()
      } else {
        await showSuccess({
          title: t('groupClass.sessionHistory.error.title'),
          message: t('groupClass.sessionHistory.error.deleteFailed'),
          type: 'error'
        })
      }
    } catch (error) {
      await showSuccess({
        title: t('groupClass.sessionHistory.error.title'),
        message: t('groupClass.sessionHistory.error.deleteError'),
        type: 'error'
      })
    }
  }

  // فلترة السجلات
  const filteredSessions = sessions.filter(session => {
    const matchesSearch =
      session.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.instructorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.groupClassNumber.toString().includes(searchTerm)

    const matchesGroupClassNumber = !filterGroupClassNumber || session.groupClassNumber.toString() === filterGroupClassNumber

    const sessionDate = new Date(session.sessionDate)
    const matchesDateFrom = !dateFrom || sessionDate >= new Date(dateFrom)
    const matchesDateTo = !dateTo || sessionDate <= new Date(dateTo)

    return matchesSearch && matchesGroupClassNumber && matchesDateFrom && matchesDateTo
  })

  // إحصائيات
  const totalSessions = filteredSessions.length
  const uniqueGroupClass = new Set(filteredSessions.map(s => s.groupClassNumber)).size
  const todaySessions = filteredSessions.filter(s => {
    const sessionDate = new Date(s.sessionDate).toDateString()
    const today = new Date().toDateString()
    return sessionDate === today
  }).length

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">📊 {t('groupClass.sessionHistory.title')}</h1>
          <p className="text-gray-600">{t('groupClass.sessionHistory.subtitle')}</p>
        </div>
        {!isCoach && (
          <button
            onClick={() => router.push('/groupClass/sessions/register')}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
          >
            ➕ {t('groupClass.sessionHistory.registerNew')}
          </button>
        )}
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm mb-1">{t('groupClass.sessionHistory.totalSessions')}</p>
              <p className="text-4xl font-bold">{totalSessions}</p>
            </div>
            <div className="text-5xl opacity-20">📊</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm mb-1">{t('groupClass.sessionHistory.todaySessions')}</p>
              <p className="text-4xl font-bold">{todaySessions}</p>
            </div>
            <div className="text-5xl opacity-20">📅</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm mb-1">{t('groupClass.sessionHistory.numberOfClients')}</p>
              <p className="text-4xl font-bold">{uniqueGroupClass}</p>
            </div>
            <div className="text-5xl opacity-20">👥</div>
          </div>
        </div>
      </div>

      {/* الفلاتر */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">🔍 {t('groupClass.sessionHistory.filtersAndSearch')}</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t('groupClass.sessionHistory.generalSearch')}</label>
            <input
              type="text"
              placeholder={t('groupClass.sessionHistory.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('groupClass.sessionHistory.specificGroupClassNumber')}</label>
            <input
              type="number"
              placeholder={t('groupClass.sessionHistory.groupClassNumberPlaceholder')}
              value={filterGroupClassNumber}
              onChange={(e) => setFilterGroupClassNumber(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('groupClass.sessionHistory.fromDate')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('groupClass.sessionHistory.toDate')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>
        </div>

        {(searchTerm || filterGroupClassNumber || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setSearchTerm('')
              setFilterGroupClassNumber('')
              setDateFrom('')
              setDateTo('')
            }}
            className="mt-4 text-sm text-purple-600 hover:text-purple-700"
          >
            ❌ {t('groupClass.sessionHistory.clearFilters')}
          </button>
        )}
      </div>

      {/* جدول السجلات */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="text-center py-12">{t('groupClass.sessionHistory.loading')}</div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {t('groupClass.sessionHistory.noRecords')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-right">{t('groupClass.sessionHistory.groupClassNumber')}</th>
                  <th className="px-4 py-3 text-right">{t('groupClass.sessionHistory.client')}</th>
                  <th className="px-4 py-3 text-right">{t('groupClass.sessionHistory.instructor')}</th>
                  <th className="px-4 py-3 text-right">{t('groupClass.sessionHistory.sessionDate')}</th>
                  <th className="px-4 py-3 text-right">{t('groupClass.sessionHistory.sessionTime')}</th>
                  <th className="px-4 py-3 text-right">{t('groupClass.sessionHistory.notes')}</th>
                  <th className="px-4 py-3 text-right">{t('groupClass.sessionHistory.registrationDate')}</th>
                  <th className="px-4 py-3 text-right">{t('groupClass.sessionHistory.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((session) => {
                  const sessionDate = new Date(session.sessionDate)
                  const isToday = sessionDate.toDateString() === new Date().toDateString()

                  return (
                    <tr
                      key={session.id}
                      className={`border-t hover:bg-gray-50 ${isToday ? 'bg-purple-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        {session.groupClassNumber < 0 ? (
                          <span className="font-bold text-purple-600">🏃 Day Use</span>
                        ) : (
                          <span className="font-bold text-purple-600">#{session.groupClassNumber}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold">{session.clientName}</p>
                          <p className="text-sm text-gray-600">{session.groupClass.phone}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">{session.instructorName}</td>
                      <td className="px-4 py-3">
                        <span className={`font-mono ${isToday ? 'font-bold text-purple-600' : ''}`}>
                          {sessionDate.toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-purple-600">
                          {sessionDate.toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {session.notes ? (
                          <span className="text-sm text-gray-700">{session.notes}</span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">
                          {new Date(session.createdAt).toLocaleDateString('ar-EG')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(session.id, session.groupClassNumber)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                          🗑️ {t('groupClass.sessionHistory.delete')}
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

      {/* ملخص بالأسفل */}
      {filteredSessions.length > 0 && (
        <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-gray-700">
            {t('groupClass.sessionHistory.showing', { count: filteredSessions.length.toString(), total: sessions.length.toString() })}
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
    </div>
  )
}
