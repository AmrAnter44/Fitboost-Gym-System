'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '../../../../contexts/ToastContext'
import { usePermissions } from '../../../../hooks/usePermissions'
import PermissionDenied from '../../../../components/PermissionDenied'

interface NutritionSession {
  nutritionNumber: number
  clientName: string
  phone: string
  sessionsRemaining: number
  nutritionistName: string
}

export default function RegisterNutritionSessionPage() {
  const router = useRouter()
  const toast = useToast()
  const { user, loading: permissionsLoading } = usePermissions()
  const [sessions, setSessions] = useState<NutritionSession[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [generatedQRCode, setGeneratedQRCode] = useState<string | null>(null)
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null)
  const [showQRModal, setShowQRModal] = useState(false)

  // منع الكوتش من الوصول لهذه الصفحة
  if (!permissionsLoading && user?.role === 'COACH') {
    return <PermissionDenied message="ليس لديك صلاحية تسجيل جلسات التغذية. هذه الصفحة للموظفين فقط." />
  }

  const [formData, setFormData] = useState({
    nutritionNumber: '',
    date: new Date().toISOString().split('T')[0], // التاريخ الحالي
    time: new Date().toTimeString().slice(0, 5), // الوقت الحالي
    notes: ''
  })

  useEffect(() => {
    fetchNutritionSessions()

    // قراءة nutritionNumber من URL إذا وجد
    const params = new URLSearchParams(window.location.search)
    const nutritionNumber = params.get('nutritionNumber')
    if (nutritionNumber) {
      setFormData(prev => ({
        ...prev,
        nutritionNumber: nutritionNumber
      }))
    }
  }, [])

  const fetchNutritionSessions = async () => {
    try {
      const response = await fetch('/api/nutrition')
      const data = await response.json()
      // فلترة الجلسات التي لديها جلسات متبقية فقط
      setSessions(data.filter((nutrition: NutritionSession) => nutrition.sessionsRemaining > 0))
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

      const response = await fetch('/api/nutrition/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nutritionNumber: parseInt(formData.nutritionNumber),
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
          nutritionNumber: '',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().slice(0, 5),
          notes: ''
        })

        // تحديث القائمة
        fetchNutritionSessions()
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

  const selectNutrition = (nutrition: NutritionSession) => {
    setFormData({
      ...formData,
      nutritionNumber: nutrition.nutritionNumber.toString()
    })
  }

  // فلترة الجلسات حسب البحث
  const filteredSessions = sessions.filter(nutrition =>
    nutrition.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    nutrition.nutritionNumber.toString().includes(searchTerm) ||
    nutrition.phone.includes(searchTerm)
  )

  const selectedNutrition = sessions.find(nutrition => nutrition.nutritionNumber.toString() === formData.nutritionNumber)

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">📝 تسجيل حضور جلسة التغذية</h1>
          <p className="text-gray-600">سجل حضور العميل في جلسة التغذية</p>
        </div>
        <button
          onClick={() => router.push('/nutrition/sessions/history')}
          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
        >
          📊 سجل الحضور
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* قائمة الجلسات المتاحة */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">جلسات التغذية المتاحة</h2>

          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍 ابحث برقم Nutrition أو الاسم أو الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'لا توجد نتائج للبحث' : 'لا توجد جلسات متاحة'}
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredSessions.map((nutrition) => (
                <div
                  key={nutrition.nutritionNumber}
                  onClick={() => selectNutrition(nutrition)}
                  className={`border rounded-lg p-4 cursor-pointer transition ${
                    formData.nutritionNumber === nutrition.nutritionNumber.toString()
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-lg">{nutrition.clientName}</h3>
                      <p className="text-sm text-gray-600">{nutrition.phone}</p>
                    </div>
                    <span className="bg-green-600 text-white px-3 py-1 rounded-full font-bold text-sm">
                      {nutrition.nutritionNumber < 0 ? '🏃 Day Use' : `#${nutrition.nutritionNumber}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">أخصائي التغذية: {nutrition.nutritionistName}</span>
                    <span className={`font-bold ${nutrition.sessionsRemaining <= 3 ? 'text-red-600' : 'text-green-600'}`}>
                      {nutrition.sessionsRemaining} جلسات متبقية
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* نموذج التسجيل */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">بيانات الحضور</h2>

          {selectedNutrition && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6">
              <h3 className="font-bold text-lg mb-2">الجلسة المحددة:</h3>
              <div className="space-y-1">
                <p><span className="font-semibold">رقم Nutrition:</span> {selectedNutrition.nutritionNumber < 0 ? '🏃 Day Use' : `#${selectedNutrition.nutritionNumber}`}</p>
                <p><span className="font-semibold">العميل:</span> {selectedNutrition.clientName}</p>
                <p><span className="font-semibold">أخصائي التغذية:</span> {selectedNutrition.nutritionistName}</p>
                <p><span className="font-semibold">الجلسات المتبقية:</span>
                  <span className={`font-bold mr-2 ${selectedNutrition.sessionsRemaining <= 3 ? 'text-red-600' : 'text-green-600'}`}>
                    {selectedNutrition.sessionsRemaining}
                  </span>
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                رقم Nutrition <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                required
                value={formData.nutritionNumber}
                onChange={(e) => setFormData({ ...formData, nutritionNumber: e.target.value })}
                className="w-full px-4 py-3 border-2 rounded-lg text-lg font-bold text-green-600"
                placeholder="أدخل رقم Nutrition أو اختر من القائمة"
              />
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-50 border-2 border-green-200 rounded-xl p-5">
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
                    className="w-full px-4 py-3 border-2 rounded-lg font-mono text-lg"
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
                    className="w-full px-4 py-3 border-2 rounded-lg font-mono text-lg"
                  />
                </div>
              </div>

              <div className="mt-4 bg-white border-2 border-green-300 rounded-lg p-3">
                <p className="text-sm text-gray-600">الوقت المحدد:</p>
                <p className="text-lg font-mono font-bold text-green-700">
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
                className="w-full px-4 py-3 border-2 rounded-lg resize-none"
                rows={3}
                placeholder="أضف أي ملاحظات عن الجلسة..."
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !formData.nutritionNumber}
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
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3">
                  <span className="text-4xl">✅</span>
                </div>
                <h3 className="text-2xl font-bold text-green-700 mb-2">
                  تم إنشاء QR Code بنجاح!
                </h3>
                <p className="text-gray-600 text-sm">
                  احفظ هذا الكود للعميل أو أرسله عبر WhatsApp
                </p>
              </div>

              {/* QR Code Display */}
              <div className="bg-gradient-to-br from-green-50 to-green-50 border-2 border-green-300 rounded-xl p-6 mb-4">
                {/* QR Code Image */}
                {qrCodeImage && (
                  <div className="bg-white rounded-xl p-4 mb-4 flex justify-center">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-3 font-medium">
                        📷 امسح هذا الكود مع أخصائي التغذية:
                      </p>
                      <img
                        src={qrCodeImage}
                        alt="QR Code"
                        className="w-64 h-64 mx-auto border-4 border-gray-200 rounded-lg shadow-lg"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        وجه الكاميرا نحو الكود لتسجيل حضورك
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-sm text-gray-600 mb-3 font-medium">
                  🔐 كود الجلسة الآمن (32 حرف ورقم):
                </p>
                <div className="bg-white rounded-lg p-4 mb-3">
                  <p className="font-mono text-lg font-bold text-green-700 break-all select-all">
                    {generatedQRCode}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">تنسيق سهل القراءة:</p>
                  <p className="font-mono text-sm font-medium text-green-600 select-all">
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
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium mb-3"
              >
                📋 نسخ QR Code
              </button>

              {/* WhatsApp Button */}
              <button
                onClick={() => {
                  const selectedNutrition = sessions.find(nutrition => nutrition.nutritionNumber.toString() === formData.nutritionNumber)
                  if (selectedNutrition) {
                    // رابط صفحة تسجيل الحضور
                    const checkInUrl = `${window.location.origin}/nutrition/check-in`

                    const text = `مرحباً ${selectedNutrition.clientName}! 👋\n\nجلسة التغذية القادمة معك جاهزة 🥗\n\n🔐 QR Code الخاص بجلستك:\n${generatedQRCode}\n\n✅ لتسجيل حضورك تلقائياً:\n${checkInUrl}\n\nالصق الكود في الصفحة وسجل حضورك بنفسك!\n\n⏰ موعد الجلسة: ${new Date(formData.date + 'T' + formData.time).toLocaleString('ar-EG')}\n\nبالتوفيق! 🥗`

                    const whatsappUrl = `https://wa.me/${selectedNutrition.phone}?text=${encodeURIComponent(text)}`
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
                className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 font-medium"
              >
                إغلاق
              </button>

              {/* Security Note */}
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
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
