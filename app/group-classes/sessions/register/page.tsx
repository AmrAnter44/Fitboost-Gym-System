'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '../../../../contexts/ToastContext'
import { usePermissions } from '../../../../hooks/usePermissions'
import PermissionDenied from '../../../../components/PermissionDenied'
import { useDebounce } from '../../../../hooks/useDebounce'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface GroupClassSession {
  groupClassNumber: number
  clientName: string
  phone: string
  sessionsRemaining: number
  instructorName: string
}

export default function RegisterGroupClassSessionPage() {
  const router = useRouter()
  const toast = useToast()
  const { user, loading: permissionsLoading } = usePermissions()
  const [sessions, setSessions] = useState<GroupClassSession[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  if (!permissionsLoading && user?.role === 'COACH') {
    return <PermissionDenied message="ليس لديك صلاحية تسجيل جلسات جروب كلاسيس. هذه الصفحة للموظفين فقط." />
  }

  const [formData, setFormData] = useState({
    groupClassNumber: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    notes: ''
  })

  useEffect(() => {
    fetchGroupClassSessions()

    const params = new URLSearchParams(window.location.search)
    const groupClassNumber = params.get('groupClassNumber')
    if (groupClassNumber) {
      setFormData(prev => ({
        ...prev,
        groupClassNumber: groupClassNumber
      }))
    }
  }, [])

  const fetchGroupClassSessions = async () => {
    try {
      const response = await fetch('/api/group-classes')
      const data = await response.json()
      setSessions(data.filter((groupClass: GroupClassSession) => groupClass.sessionsRemaining > 0))
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const sessionDateTime = `${formData.date}T${formData.time}:00`

      const response = await fetch('/api/group-classes/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupClassNumber: parseInt(formData.groupClassNumber),
          sessionDate: sessionDateTime,
          notes: formData.notes
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success('تم تسجيل الحضور بنجاح!')

        setFormData({
          groupClassNumber: '',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().slice(0, 5),
          notes: ''
        })

        fetchGroupClassSessions()
      } else {
        toast.error(result.error || 'فشل تسجيل الحضور')
      }
    } catch (error) {
      console.error(error)
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setSubmitting(false)
    }
  }

  const selectGroupClass = (groupClass: GroupClassSession) => {
    setFormData({
      ...formData,
      groupClassNumber: groupClass.groupClassNumber.toString()
    })
  }

  const filteredSessions = sessions.filter(groupClass =>
    groupClass.clientName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
    groupClass.groupClassNumber.toString().includes(debouncedSearchTerm) ||
    groupClass.phone.includes(debouncedSearchTerm)
  )

  const selectedGroupClass = sessions.find(groupClass => groupClass.groupClassNumber.toString() === formData.groupClassNumber)

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <div className="flex justify-between items-center mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="inline-flex w-10 h-10 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
            <svg {...stroke} className="w-6 h-6" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">تسجيل حضور جلسة جروب كلاسيس</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">سجل حضور العميل في جلسة جروب كلاسيس</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/group-classes/sessions/history')}
          className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg transition-colors duration-200 inline-flex items-center gap-2 text-sm"
        >
          <svg {...stroke} className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
          سجل الحضور
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">جلسات جروب كلاسيس المتاحة</h2>

          <div className="mb-4 relative">
            <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-gray-400 dark:text-gray-500">
              <svg {...stroke} className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
            </span>
            <input
              type="text"
              placeholder="ابحث برقم GroupClass أو الاسم أو الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full ps-10 pe-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400" aria-busy="true" aria-live="polite">جاري التحميل...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg {...stroke} className="w-12 h-12 text-gray-400" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <h3 className="mt-3 text-gray-700 dark:text-gray-300 font-bold">{searchTerm ? 'لا توجد نتائج للبحث' : 'لا توجد جلسات متاحة'}</h3>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredSessions.map((groupClass) => (
                <button
                  type="button"
                  key={groupClass.groupClassNumber}
                  onClick={() => selectGroupClass(groupClass)}
                  className={`w-full text-start rounded-lg p-4 cursor-pointer transition-colors duration-200 ring-1 ${
                    formData.groupClassNumber === groupClass.groupClassNumber.toString()
                      ? 'ring-primary-500 dark:ring-primary-400 bg-primary-50 dark:bg-primary-900/30'
                      : 'ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{groupClass.clientName}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{groupClass.phone}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 bg-primary-500 text-primary-contrast px-2.5 py-0.5 rounded-full font-bold text-xs">
                      {groupClass.groupClassNumber < 0 ? 'Day Use' : `#${groupClass.groupClassNumber}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700 dark:text-gray-300">المدرب: {groupClass.instructorName}</span>
                    <span className={`font-bold ${groupClass.sessionsRemaining <= 3 ? 'text-red-600 dark:text-red-400' : 'text-primary-700 dark:text-primary-400'}`}>
                      {groupClass.sessionsRemaining} جلسات متبقية
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">بيانات الحضور</h2>

          {selectedGroupClass && (
            <div className="bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-200 dark:ring-primary-700 rounded-lg p-4 mb-6">
              <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-gray-100">الجلسة المحددة:</h3>
              <div className="space-y-1 text-gray-700 dark:text-gray-300">
                <p><span className="font-bold">رقم GroupClass:</span> {selectedGroupClass.groupClassNumber < 0 ? 'Day Use' : `#${selectedGroupClass.groupClassNumber}`}</p>
                <p><span className="font-bold">العميل:</span> {selectedGroupClass.clientName}</p>
                <p><span className="font-bold">المدرب:</span> {selectedGroupClass.instructorName}</p>
                <p><span className="font-bold">الجلسات المتبقية:</span>
                  <span className={`font-bold ms-2 ${selectedGroupClass.sessionsRemaining <= 3 ? 'text-red-600 dark:text-red-400' : 'text-primary-700 dark:text-primary-400'}`}>
                    {selectedGroupClass.sessionsRemaining}
                  </span>
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                رقم GroupClass <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <input
                type="number"
                required
                value={formData.groupClassNumber}
                onChange={(e) => setFormData({ ...formData, groupClassNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-bold text-lg placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                placeholder="أدخل رقم GroupClass أو اختر من القائمة"
              />
            </div>

            <div className="bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-200 dark:ring-primary-700 rounded-xl p-5">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>
                <span>تاريخ ووقت الجلسة</span>
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    التاريخ <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    الوقت <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  />
                </div>
              </div>

              <div className="mt-4 bg-white dark:bg-gray-800 ring-1 ring-primary-300 dark:ring-primary-700 rounded-lg p-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">الوقت المحدد:</p>
                <p className="text-lg font-mono font-bold text-primary-700 dark:text-primary-400">
                  {new Date(`${formData.date}T${formData.time}`).toLocaleString('ar-EG', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                ملاحظات (اختياري)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 resize-none"
                rows={3}
                placeholder="أضف أي ملاحظات عن الجلسة..."
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !formData.groupClassNumber}
              className="w-full bg-primary-500 hover:bg-primary-600 text-primary-contrast py-3 rounded-lg font-bold text-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  جاري التسجيل...
                </>
              ) : (
                <>
                  <svg {...stroke} className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  تسجيل الحضور
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
