'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '../../../contexts/ToastContext'

interface SessionInfo {
  id: string
  groupClassNumber: number
  clientName: string
  instructorName: string
  sessionDate: string
  attended: boolean
  sessionsRemaining: number
}

export default function GroupClassCheckInPage() {
  const router = useRouter()
  const toast = useToast()
  const [qrCode, setQrCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!qrCode.trim() || qrCode.trim().length === 0) {
      toast.warning('يرجى إدخال رقم GroupClass أو Barcode')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/groupClass/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode: qrCode.trim() })
      })

      const result = await response.json()

      if (response.ok) {
        setSessionInfo(result.session)
        setShowSuccess(true)
        setQrCode('')
        toast.success('تم تسجيل حضورك بنجاح!')
      } else {
        toast.error(result.error || 'Barcode غير صحيح')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  if (showSuccess && sessionInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-400 via-green-500 to-primary-600 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center">
          {/* Success Animation */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-primary-100 rounded-full mb-4 animate-bounce">
              <span className="text-6xl">✅</span>
            </div>
            <h1 className="text-3xl font-bold text-primary-700 mb-2">
              تم تسجيل حضورك بنجاح!
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              استمتع بجلستك مع المدرب
            </p>
          </div>

          {/* Session Details */}
          <div className="bg-gradient-to-br from-primary-50 to-primary-50 border-2 border-primary-300 rounded-2xl p-6 mb-6 text-right dark:border-gray-600 dark:bg-gray-700 dark:text-white">
            <h3 className="text-lg font-bold text-primary-800 mb-4 text-center">
              تفاصيل الجلسة
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-primary-200 pb-2">
                <span className="text-gray-600 dark:text-gray-300">الاسم:</span>
                <span className="font-bold text-primary-900">{sessionInfo.clientName}</span>
              </div>
              <div className="flex justify-between items-center border-b border-primary-200 pb-2">
                <span className="text-gray-600 dark:text-gray-300">رقم GroupClass:</span>
                <span className="font-bold text-primary-900">
                  {sessionInfo.groupClassNumber < 0 ? '🏃 Day Use' : `#${sessionInfo.groupClassNumber}`}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-primary-200 pb-2">
                <span className="text-gray-600 dark:text-gray-300">المدرب:</span>
                <span className="font-bold text-primary-900">{sessionInfo.instructorName}</span>
              </div>
              <div className="flex justify-between items-center border-b border-primary-200 pb-2">
                <span className="text-gray-600 dark:text-gray-300">التاريخ:</span>
                <span className="font-bold text-primary-900">
                  {new Date(sessionInfo.sessionDate).toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center bg-primary-100 -mx-6 px-6 py-3 mt-4">
                <span className="text-primary-800 font-semibold">الجلسات المتبقية:</span>
                <span className="text-3xl font-bold text-primary-600">
                  {sessionInfo.sessionsRemaining}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => {
                setShowSuccess(false)
                setSessionInfo(null)
              }}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-600 text-white py-4 rounded-xl hover:from-primary-700 hover:to-primary-700 font-bold text-lg shadow-lg"
            >
              تسجيل جلسة أخرى
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
            >
              العودة للصفحة الرئيسية
            </button>
          </div>

          {/* Motivational Message */}
          <div className="mt-6 bg-yellow-50 border-r-4 border-yellow-400 p-4 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-700">
            <p className="text-sm text-yellow-800">
              <strong>🥗 نصيحة:</strong> استمر في متابعة نظامك الغذائي واستمتع بجلستك!
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-green-600 to-primary-500 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-100 to-primary-100 rounded-full mb-4">
            <span className="text-5xl">🥗</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            تسجيل حضور جلسة جروب كلاسيس
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            أدخل رقم GroupClass أو Barcode الخاص بجلستك
          </p>
        </div>

        {/* Message */}
        {/* Form */}
        <form onSubmit={handleCheckIn} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              رقم GroupClass / Barcode <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              placeholder="أدخل رقم GroupClass أو امسح Barcode..."
              className="w-full px-4 py-4 border-2 border-primary-300 rounded-xl focus:outline-none focus:border-primary-500 font-mono text-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              autoFocus
              disabled={loading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-2">
              💡 أدخل الرقم المرسل لك عبر WhatsApp أو امسح الباركود
            </p>
          </div>

          {/* Character Counter */}
          {qrCode && (
            <div className="bg-primary-50 border-2 border-primary-200 rounded-xl p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <p className="text-xs text-primary-700 mb-2">
                الكود المدخل ({qrCode.length}):
              </p>
              <p className="font-mono text-sm text-primary-900 break-all select-all">
                {qrCode.match(/.{1,4}/g)?.join('-') || qrCode}
              </p>
              {qrCode.length === 32 ? (
                <p className="text-xs text-primary-600 mt-2 flex items-center gap-1">
                  <span>✅</span>
                  <span>طول الكود صحيح</span>
                </p>
              ) : (
                <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                  <span>⚠️</span>
                  <span>يجب أن يكون 32 حرف</span>
                </p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || qrCode.length !== 32}
            className="w-full bg-gradient-to-r from-primary-600 to-primary-600 text-white py-4 rounded-xl hover:from-primary-700 hover:to-primary-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-bold text-lg shadow-lg transition"
          >
            {loading ? '⏳ جاري التحقق...' : '✅ تسجيل الحضور'}
          </button>
        </form>

        {/* Security Notice */}
        <div className="mt-6 bg-primary-50 border-r-4 border-primary-500 p-4 rounded-lg">
          <p className="text-xs text-primary-800">
            <strong>🔒 ملاحظة أمنية:</strong> QR Code الخاص بك فريد وآمن.
            لا تشاركه مع أي شخص آخر. كل QR Code يستخدم مرة واحدة فقط.
          </p>
        </div>

        {/* Help Section */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            لم تستلم QR Code؟
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
            تواصل مع المدرب أو الإدارة للحصول على الكود
          </p>
        </div>
      </div>
    </div>
  )
}
