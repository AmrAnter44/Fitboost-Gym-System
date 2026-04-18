'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '../../../../contexts/ToastContext'
import { usePermissions } from '../../../../hooks/usePermissions'
import PermissionDenied from '../../../../components/PermissionDenied'
import { useDebounce } from '../../../../hooks/useDebounce'

interface PTSession {
  ptNumber: number
  clientName: string
  phone: string
  sessionsRemaining: number
  coachName: string
}

export default function RegisterPTSessionPage() {
  const router = useRouter()
  const toast = useToast()
  const { user, loading: permissionsLoading } = usePermissions()
  const [sessions, setSessions] = useState<PTSession[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // منع الكوتش من الوصول لهذه الصفحة
  if (!permissionsLoading && user?.role === 'COACH') {
    return <PermissionDenied message="ليس لديك صلاحية تسجيل حصص PT. هذه الصفحة للموظفين فقط." />
  }

  const [formData, setFormData] = useState({
    ptNumber: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    notes: ''
  })

  useEffect(() => {
    fetchPTSessions()

    const params = new URLSearchParams(window.location.search)
    const ptNumber = params.get('ptNumber')
    if (ptNumber) {
      setFormData(prev => ({
        ...prev,
        ptNumber: ptNumber
      }))
    }
  }, [])

  const fetchPTSessions = async () => {
    try {
      const response = await fetch('/api/pt')
      const data = await response.json()
      setSessions(data.filter((pt: PTSession) => pt.sessionsRemaining > 0))
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.ptNumber) return
    setSubmitting(true)

    try {
      const sessionDateTime = `${formData.date}T${formData.time}:00`

      const response = await fetch('/api/pt/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ptNumber: parseInt(formData.ptNumber),
          sessionDate: sessionDateTime,
          notes: formData.notes
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(`تم تسجيل حضور ${result.session?.clientName || selectedPT?.clientName || ''} بنجاح!`)

        setFormData({
          ptNumber: '',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().slice(0, 5),
          notes: ''
        })

        fetchPTSessions()
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

  const selectPT = (pt: PTSession) => {
    setFormData({
      ...formData,
      ptNumber: pt.ptNumber.toString()
    })
  }

  const filteredSessions = sessions.filter(pt =>
    pt.clientName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
    pt.ptNumber.toString().includes(debouncedSearchTerm) ||
    pt.phone.includes(debouncedSearchTerm)
  )

  const selectedPT = sessions.find(pt => pt.ptNumber.toString() === formData.ptNumber)

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">📝 تسجيل حضور جلسة PT</h1>
          <p className="text-gray-600 dark:text-gray-300">سجل حضور العميل في جلسة التدريب الشخصي</p>
        </div>
        <button
          onClick={() => router.push('/pt/sessions/history')}
          className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
        >
          📊 سجل الحضور
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* قائمة الجلسات المتاحة */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">جلسات PT المتاحة</h2>

          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍 ابحث برقم PT أو الاسم أو الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
            />
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">جاري التحميل...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {searchTerm ? 'لا توجد نتائج للبحث' : 'لا توجد جلسات متاحة'}
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredSessions.map((pt) => (
                <div
                  key={pt.ptNumber}
                  onClick={() => selectPT(pt)}
                  className={`border rounded-lg p-4 cursor-pointer transition ${
                    formData.ptNumber === pt.ptNumber.toString()
                      ? 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-green-300 hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-lg">{pt.clientName}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{pt.phone}</p>
                    </div>
                    <span className="bg-green-600 text-white px-3 py-1 rounded-full font-bold text-sm">
                      {pt.ptNumber < 0 ? '🏃 Day Use' : `#${pt.ptNumber}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700 dark:text-gray-200">المدرب: {pt.coachName}</span>
                    <span className={`font-bold ${pt.sessionsRemaining <= 3 ? 'text-red-600' : 'text-green-600'}`}>
                      {pt.sessionsRemaining} جلسات متبقية
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* نموذج التسجيل */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">بيانات الحضور</h2>

          {selectedPT && (
            <div className="bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-200 dark:border-primary-700 rounded-lg p-4 mb-6">
              <h3 className="font-bold text-lg mb-2 dark:text-gray-100">الجلسة المحددة:</h3>
              <div className="space-y-1 dark:text-gray-200">
                <p><span className="font-semibold">رقم PT:</span> {selectedPT.ptNumber < 0 ? '🏃 Day Use' : `#${selectedPT.ptNumber}`}</p>
                <p><span className="font-semibold">العميل:</span> {selectedPT.clientName}</p>
                <p><span className="font-semibold">المدرب:</span> {selectedPT.coachName}</p>
                <p><span className="font-semibold">الجلسات المتبقية:</span>
                  <span className={`font-bold mr-2 ${selectedPT.sessionsRemaining <= 3 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {selectedPT.sessionsRemaining}
                  </span>
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-200">
                رقم PT <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <input
                type="number"
                required
                value={formData.ptNumber}
                onChange={(e) => setFormData({ ...formData, ptNumber: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-lg font-bold text-green-600 dark:text-green-400 dark:bg-gray-700"
                placeholder="أدخل رقم PT أو اختر من القائمة"
              />
            </div>

            <div className="bg-gradient-to-br from-primary-50 to-pink-50 dark:from-primary-900/30 dark:to-pink-900/30 border-2 border-primary-200 dark:border-primary-700 rounded-xl p-5">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2 dark:text-gray-100">
                <span>📅</span>
                <span>تاريخ ووقت الجلسة</span>
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 dark:text-gray-200">
                    التاريخ <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-mono text-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 dark:text-gray-200">
                    الوقت <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-mono text-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="mt-4 bg-white dark:bg-gray-800 border-2 border-primary-300 dark:border-primary-700 rounded-lg p-3">
                <p className="text-sm text-gray-600 dark:text-gray-300">الوقت المحدد:</p>
                <p className="text-lg font-mono font-bold text-primary-700 dark:text-primary-300">
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

            {/* اسم المسجل */}
            <div className="bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">👤</span>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">تسجيل بواسطة:</p>
                  <p className="font-bold text-gray-800 dark:text-gray-100">{user?.name || 'غير معروف'}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-200">
                ملاحظات (اختياري)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg resize-none dark:bg-gray-700 dark:text-white"
                rows={3}
                placeholder="أضف أي ملاحظات عن الجلسة..."
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !formData.ptNumber}
              className="w-full bg-green-600 text-white py-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg transition"
            >
              {submitting ? '⏳ جاري التسجيل...' : '✅ تسجيل الحضور'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
