'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '../../../contexts/ToastContext'

interface SessionInfo {
  id: string
  ptNumber: number
  clientName: string
  coachName: string
  sessionDate: string
  attended: boolean
  sessionsRemaining: number
}

export default function PTCheckInPage() {
  const router = useRouter()
  const toast = useToast()
  const [qrCode, setQrCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!qrCode.trim() || qrCode.trim().length === 0) {
      toast.warning('يرجى إدخال رقم PT أو Barcode')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/pt/check-in', {
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
      <div className="min-h-screen bg-gradient-to-br from-green-400 via-blue-500 to-purple-600 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center">
          {/* Success Animation */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-4 animate-bounce">
              <span className="text-6xl">✅</span>
            </div>
            <h1 className="text-3xl font-bold text-green-700 mb-2">
              تم تسجيل حضورك بنجاح!
            </h1>
            <p className="text-gray-600">
              استمتع بتمرينك مع الكوتش
            </p>
          </div>

          {/* Session Details */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-300 rounded-2xl p-6 mb-6 text-right">
            <h3 className="text-lg font-bold text-blue-800 mb-4 text-center">
              تفاصيل الحصة
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-blue-200 pb-2">
                <span className="text-gray-600">الاسم:</span>
                <span className="font-bold text-blue-900">{sessionInfo.clientName}</span>
              </div>
              <div className="flex justify-between items-center border-b border-blue-200 pb-2">
                <span className="text-gray-600">رقم PT:</span>
                <span className="font-bold text-blue-900">
                  {sessionInfo.ptNumber < 0 ? '🏃 Day Use' : `#${sessionInfo.ptNumber}`}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-blue-200 pb-2">
                <span className="text-gray-600">الكوتش:</span>
                <span className="font-bold text-blue-900">{sessionInfo.coachName}</span>
              </div>
              <div className="flex justify-between items-center border-b border-blue-200 pb-2">
                <span className="text-gray-600">التاريخ:</span>
                <span className="font-bold text-blue-900">
                  {new Date(sessionInfo.sessionDate).toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center bg-green-100 -mx-6 px-6 py-3 mt-4">
                <span className="text-green-800 font-semibold">الحصص المتبقية:</span>
                <span className="text-3xl font-bold text-green-600">
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
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl hover:from-blue-700 hover:to-purple-700 font-bold text-lg shadow-lg"
            >
              تسجيل حصة أخرى
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-300 font-medium"
            >
              العودة للصفحة الرئيسية
            </button>
          </div>

          {/* Motivational Message */}
          <div className="mt-6 bg-yellow-50 border-r-4 border-yellow-400 p-4 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>💪 نصيحة:</strong> استمر في التمرين واستمتع بحصتك!
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full mb-4">
            <span className="text-5xl">🏋️</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            تسجيل حضور PT
          </h1>
          <p className="text-gray-600">
            أدخل رقم PT أو Barcode الخاص بحصتك
          </p>
        </div>

        {/* Message */}
        {/* Form */}
        <form onSubmit={handleCheckIn} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              رقم PT / Barcode <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              placeholder="أدخل رقم PT أو امسح Barcode..."
              className="w-full px-4 py-4 border-2 border-purple-300 rounded-xl focus:outline-none focus:border-purple-500 font-mono text-lg"
              autoFocus
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-2">
              💡 أدخل الرقم المرسل لك عبر WhatsApp أو امسح الباركود
            </p>
          </div>

          {/* Character Counter */}
          {qrCode && (
            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
              <p className="text-xs text-purple-700 mb-2">
                الكود المدخل ({qrCode.length}):
              </p>
              <p className="font-mono text-sm text-purple-900 break-all select-all">
                {qrCode.match(/.{1,4}/g)?.join('-') || qrCode}
              </p>
              {qrCode.length === 32 ? (
                <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
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
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-bold text-lg shadow-lg transition"
          >
            {loading ? '⏳ جاري التحقق...' : '✅ تسجيل الحضور'}
          </button>
        </form>

        {/* Security Notice */}
        <div className="mt-6 bg-blue-50 border-r-4 border-blue-500 p-4 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>🔒 ملاحظة أمنية:</strong> QR Code الخاص بك فريد وآمن.
            لا تشاركه مع أي شخص آخر. كل QR Code يستخدم مرة واحدة فقط.
          </p>
        </div>

        {/* Help Section */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            لم تستلم QR Code؟
          </p>
          <p className="text-xs text-gray-500 mt-1">
            تواصل مع الكوتش أو الإدارة للحصول على الكود
          </p>
        </div>
      </div>
    </div>
  )
}
