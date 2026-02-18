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
  const [generatedQRCode, setGeneratedQRCode] = useState<string | null>(null)
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null)
  const [showQRModal, setShowQRModal] = useState(false)

  // منع الكوتش من الوصول لهذه الصفحة
  if (!permissionsLoading && user?.role === 'COACH') {
    return <PermissionDenied message="ليس لديك صلاحية تسجيل حصص PT. هذه الصفحة للموظفين فقط." />
  }

  const [formData, setFormData] = useState({
    ptNumber: '',
    date: new Date().toISOString().split('T')[0], // التاريخ الحالي
    time: new Date().toTimeString().slice(0, 5), // الوقت الحالي
    notes: ''
  })

  useEffect(() => {
    fetchPTSessions()
    
    // قراءة ptNumber من URL إذا وجد
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
      // فلترة الجلسات التي لديها جلسات متبقية فقط
      setSessions(data.filter((pt: PTSession) => pt.sessionsRemaining > 0))
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
        toast.success('تم تسجيل الحضور بنجاح!')

        // حفظ QR code وعرض النافذة المنبثقة
        if (result.qrCode) {
          setGeneratedQRCode(result.qrCode)
          setQrCodeImage(result.qrCodeImage || null)
          setShowQRModal(true)
        }

        // إعادة تعيين النموذج
        setFormData({
          ptNumber: '',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().slice(0, 5),
          notes: ''
        })

        // تحديث القائمة
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

  // فلترة الجلسات حسب البحث
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
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">جاري التحميل...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">
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

            <div className="bg-gradient-to-br from-primary-50 to-pink-50 dark:from-primary-900/30 dark:to-pink-900/30 border-2 border-primary-200 dark:border-primary-700 rounded-xl p-5 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
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

      {/* QR Code Modal */}
      {showQRModal && generatedQRCode && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full mb-3">
                  <span className="text-4xl">✅</span>
                </div>
                <h3 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
                  تم إنشاء QR Code بنجاح!
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  احفظ هذا الكود للعميل أو أرسله عبر WhatsApp
                </p>
              </div>

              {/* QR Code Display */}
              <div className="bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/30 dark:to-primary-900/30 border-2 border-primary-300 dark:border-primary-700 rounded-xl p-6 mb-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                {/* QR Code Image */}
                {qrCodeImage && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 flex justify-center">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 font-medium">
                        📷 امسح هذا الكود مع الكوتش:
                      </p>
                      <img
                        src={qrCodeImage}
                        alt="QR Code"
                        className="w-64 h-64 mx-auto border-4 border-gray-200 dark:border-gray-600 rounded-lg shadow-lg"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        وجه الكاميرا نحو الكود لتسجيل حضورك
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 font-medium">
                  🔐 كود الحصة الآمن (32 حرف ورقم):
                </p>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-3">
                  <p className="font-mono text-lg font-bold text-primary-700 dark:text-primary-300 break-all select-all">
                    {generatedQRCode}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">تنسيق سهل القراءة:</p>
                  <p className="font-mono text-sm font-medium text-primary-600 dark:text-primary-400 select-all">
                    {generatedQRCode.match(/.{1,4}/g)?.join('-')}
                  </p>
                </div>
              </div>

              {/* Copy Button */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedQRCode)
                  toast.success('تم نسخ QR Code')
                }}
                className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-medium mb-3"
              >
                📋 نسخ QR Code
              </button>

              {/* WhatsApp Button */}
              <button
                onClick={() => {
                  const selectedPT = sessions.find(pt => pt.ptNumber.toString() === formData.ptNumber)
                  if (selectedPT) {
                    // رابط صفحة تسجيل الحضور
                    const checkInUrl = `${window.location.origin}/pt/check-in`

                    const text = `مرحباً ${selectedPT.clientName}! 👋\n\nحصة PT القادمة معك جاهزة 💪\n\n🔐 QR Code الخاص بحصتك:\n${generatedQRCode}\n\n✅ لتسجيل حضورك تلقائياً:\n${checkInUrl}\n\nالصق الكود في الصفحة وسجل حضورك بنفسك!\n\n⏰ موعد الحصة: ${new Date(formData.date + 'T' + formData.time).toLocaleString('ar-EG')}\n\nبالتوفيق! 🏋️`

                    const whatsappUrl = `https://wa.me/${selectedPT.phone}?text=${encodeURIComponent(text)}`
                    window.open(whatsappUrl, '_blank')
                  }
                }}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium mb-3"
              >
                💬 إرسال عبر WhatsApp
              </button>

              {/* Close Button */}
              <button
                onClick={() => setShowQRModal(false)}
                className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
              >
                إغلاق
              </button>

              {/* Security Note */}
              <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                <p className="text-xs text-yellow-800 dark:text-yellow-300">
                  <strong>⚠️ تحذير أمني:</strong> هذا الكود فريد وآمن (16 حرف + 16 رقم). لا تشاركه إلا مع العميل المعني فقط.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}