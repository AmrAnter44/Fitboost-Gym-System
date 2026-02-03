// components/PermissionDenied.tsx
'use client'

import { useRouter } from 'next/navigation'

interface PermissionDeniedProps {
  message?: string
  showBackButton?: boolean
}

export default function PermissionDenied({ 
  message = 'ليس لديك صلاحية للوصول إلى هذه الصفحة',
  showBackButton = true 
}: PermissionDeniedProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50" dir="rtl">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          {/* Icon */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-red-100 rounded-full">
              <svg 
                className="w-12 h-12 text-red-600" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            🚫 الوصول مرفوض
          </h1>

          {/* Message */}
          <p className="text-lg text-gray-600 mb-8">
            {message}
          </p>

          {/* Description */}
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">
              إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع المسؤول للحصول على الصلاحيات المناسبة.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {showBackButton && (
              <button
                onClick={() => router.back()}
                className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-3 rounded-lg hover:from-primary-700 hover:to-primary-800 transition font-bold shadow-lg"
              >
                ← العودة للخلف
              </button>
            )}
            
            <button
              onClick={() => router.push('/')}
              className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition font-bold"
            >
              🏠 العودة للصفحة الرئيسية
            </button>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            💡 <strong>نصيحة:</strong> تأكد من تسجيل الدخول بحساب يملك الصلاحيات المطلوبة
          </p>
        </div>
      </div>
    </div>
  )
}