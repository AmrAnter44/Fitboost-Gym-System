'use client'

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        {/* Big 404 */}
        <div className="relative mb-6">
          <span className="text-[120px] font-black text-primary-200 dark:text-gray-700 leading-none select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl">🏋️</span>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          الصفحة غير موجودة
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm leading-relaxed">
          عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            الرئيسية
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-xl transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            رجوع
          </button>
        </div>
      </div>
    </div>
  )
}
