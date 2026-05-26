// components/PermissionDenied.tsx
'use client'

import { useRouter } from 'next/navigation'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

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
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-900 p-4"
      dir="rtl"
    >
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg ring-1 ring-gray-200 dark:ring-gray-700 p-8 text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-red-100 dark:bg-red-900/40 rounded-full">
              <svg {...stroke} className="w-12 h-12 text-red-600 dark:text-red-400">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4 inline-flex items-center gap-2">
            <svg {...stroke} className="w-7 h-7 text-red-600 dark:text-red-400">
              <circle cx="12" cy="12" r="9" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.6 5.6l12.8 12.8" />
            </svg>
            الوصول مرفوض
          </h1>

          <p className="text-lg text-gray-700 dark:text-gray-300 mb-8">
            {message}
          </p>

          <div className="bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800 dark:text-red-200">
              إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع المسؤول للحصول على الصلاحيات المناسبة.
            </p>
          </div>

          <div className="space-y-3">
            {showBackButton && (
              <button
                onClick={() => router.back()}
                className="w-full inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                <svg {...stroke} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                العودة للخلف
              </button>
            )}

            <button
              onClick={() => router.push('/')}
              className="w-full inline-flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2.5 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
            >
              <svg {...stroke} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              العودة للصفحة الرئيسية
            </button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 inline-flex items-start gap-1.5">
            <svg {...stroke} className="w-4 h-4 mt-0.5 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span><strong>نصيحة:</strong> تأكد من تسجيل الدخول بحساب يملك الصلاحيات المطلوبة</span>
          </p>
        </div>
      </div>
    </div>
  )
}
