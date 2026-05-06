'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '../../../../contexts/ToastContext'
import { usePermissions } from '../../../../hooks/usePermissions'
import PermissionDenied from '../../../../components/PermissionDenied'
import { useDebounce } from '../../../../hooks/useDebounce'

interface PhysiotherapySession {
  physioNumber: number
  clientName: string
  phone: string
  sessionsRemaining: number
  therapistName: string
}

export default function RegisterPhysiotherapySessionPage() {
  const router = useRouter()
  const toast = useToast()
  const { user, loading: permissionsLoading } = usePermissions()
  const [sessions, setSessions] = useState<PhysiotherapySession[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // منع الكوتش من الوصول لهذه الصفحة
  if (!permissionsLoading && user?.role === 'COACH') {
    return <PermissionDenied message="ليس لديك صلاحية تسجيل جلسات العلاج الطبيعي. هذه الصفحة للموظفين فقط." />
  }

  const [formData, setFormData] = useState({
    physioNumber: '',
    date: new Date().toISOString().split('T')[0], // التاريخ الحالي
    time: new Date().toTimeString().slice(0, 5), // الوقت الحالي
    notes: ''
  })

  useEffect(() => {
    fetchPhysiotherapySessions()

    // قراءة physioNumber من URL إذا وجد
    const params = new URLSearchParams(window.location.search)
    const physioNumber = params.get('physioNumber')
    if (physioNumber) {
      setFormData(prev => ({
        ...prev,
        physioNumber: physioNumber
      }))
    }
  }, [])

  const fetchPhysiotherapySessions = async () => {
    try {
      const response = await fetch('/api/physiotherapy')
      const data = await response.json()
      // فلترة الجلسات التي لديها جلسات متبقية فقط
      setSessions(data.filter((physiotherapy: PhysiotherapySession) => physiotherapy.sessionsRemaining > 0))
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
      // دمج التاريخ والوقت
      const sessionDateTime = `${formData.date}T${formData.time}:00`

      const response = await fetch('/api/physiotherapy/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          physioNumber: parseInt(formData.physioNumber),
          sessionDate: sessionDateTime,
          notes: formData.notes
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success('تم تسجيل الحضور بنجاح!')

        // إعادة تعيين النموذج
        setFormData({
          physioNumber: '',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().slice(0, 5),
          notes: ''
        })

        // تحديث القائمة
        fetchPhysiotherapySessions()
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

  const selectPhysiotherapy = (physiotherapy: PhysiotherapySession) => {
    setFormData({
      ...formData,
      physioNumber: physiotherapy.physioNumber.toString()
    })
  }

  // فلترة الجلسات حسب البحث
  const filteredSessions = sessions.filter(physiotherapy =>
    physiotherapy.clientName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
    physiotherapy.physioNumber.toString().includes(debouncedSearchTerm) ||
    physiotherapy.phone.includes(debouncedSearchTerm)
  )

  const selectedPhysiotherapy = sessions.find(physiotherapy => physiotherapy.physioNumber.toString() === formData.physioNumber)

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">📝 تسجيل حضور جلسة العلاج الطبيعي</h1>
          <p className="text-gray-600 dark:text-gray-300">سجل حضور العميل في جلسة العلاج الطبيعي</p>
        </div>
        <button
          onClick={() => router.push('/physiotherapy/sessions/history')}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          📊 سجل الحضور
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* قائمة الجلسات المتاحة */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">جلسات العلاج الطبيعي المتاحة</h2>

          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍 ابحث برقم Physiotherapy أو الاسم أو الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
            />
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">جاري التحميل...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">
              {searchTerm ? 'لا توجد نتائج للبحث' : 'لا توجد جلسات متاحة'}
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredSessions.map((physiotherapy) => (
                <div
                  key={physiotherapy.physioNumber}
                  onClick={() => selectPhysiotherapy(physiotherapy)}
                  className={`border rounded-lg p-4 cursor-pointer transition ${
                    formData.physioNumber === physiotherapy.physioNumber.toString()
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 dark:border-blue-400'
                      : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-lg">{physiotherapy.clientName}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{physiotherapy.phone}</p>
                    </div>
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full font-bold text-sm">
                      {physiotherapy.physioNumber < 0 ? '🏃 Day Use' : `#${physiotherapy.physioNumber}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700 dark:text-gray-200">أخصائي العلاج الطبيعي: {physiotherapy.therapistName}</span>
                    <span className={`font-bold ${physiotherapy.sessionsRemaining <= 3 ? 'text-red-600' : 'text-blue-600'}`}>
                      {physiotherapy.sessionsRemaining} جلسات متبقية
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

          {selectedPhysiotherapy && (
            <div className="bg-blue-50 dark:bg-blue-900/50 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
              <h3 className="font-bold text-lg mb-2">الجلسة المحددة:</h3>
              <div className="space-y-1">
                <p><span className="font-semibold">رقم Physiotherapy:</span> {selectedPhysiotherapy.physioNumber < 0 ? '🏃 Day Use' : `#${selectedPhysiotherapy.physioNumber}`}</p>
                <p><span className="font-semibold">العميل:</span> {selectedPhysiotherapy.clientName}</p>
                <p><span className="font-semibold">أخصائي العلاج الطبيعي:</span> {selectedPhysiotherapy.therapistName}</p>
                <p><span className="font-semibold">الجلسات المتبقية:</span>
                  <span className={`font-bold mr-2 ${selectedPhysiotherapy.sessionsRemaining <= 3 ? 'text-red-600' : 'text-blue-600'}`}>
                    {selectedPhysiotherapy.sessionsRemaining}
                  </span>
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                رقم Physiotherapy <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                required
                value={formData.physioNumber}
                onChange={(e) => setFormData({ ...formData, physioNumber: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg text-lg font-bold text-blue-600 dark:text-blue-400"
                placeholder="أدخل رقم Physiotherapy أو اختر من القائمة"
              />
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-50 dark:from-blue-900/20 dark:to-blue-800/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-5 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span>📅</span>
                <span>تاريخ ووقت الجلسة</span>
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    التاريخ <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg font-mono text-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    الوقت <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg font-mono text-lg"
                  />
                </div>
              </div>

              <div className="mt-4 bg-white dark:bg-gray-800 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-3">
                <p className="text-sm text-gray-600 dark:text-gray-300">الوقت المحدد:</p>
                <p className="text-lg font-mono font-bold text-blue-700 dark:text-blue-400">
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
              <label className="block text-sm font-medium mb-2">
                ملاحظات (اختياري)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg resize-none"
                rows={3}
                placeholder="أضف أي ملاحظات عن الجلسة..."
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !formData.physioNumber}
              className="w-full bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg transition"
            >
              {submitting ? '⏳ جاري التسجيل...' : '✅ تسجيل الحضور'}
            </button>
          </form>
        </div>
      </div>

    </div>
  )
}
