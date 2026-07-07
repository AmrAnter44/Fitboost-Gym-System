'use client'

import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../contexts/LanguageContext'
import CoachConversionsPanel from '../../../components/CoachConversionsPanel'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

// الصفحة المستقلة أصبحت مجرد wrapper — نفس المحتوى موجود كتاب داخل صفحة الحصص المخصصة (/pt)
export default function ManagerCoachConversionsPage() {
  const router = useRouter()
  const { locale, direction } = useLanguage()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6" dir={direction}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-700 dark:text-gray-200"
              aria-label={locale === 'ar' ? 'رجوع' : 'Back'}
            >
              <svg {...stroke} className={`w-5 h-5 ${direction === 'rtl' ? 'rotate-180' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                <svg {...stroke} className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14l3-3 4 4 5-5" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {locale === 'ar' ? 'متابعة الكباتن مع العملاء' : 'Coach Conversion Tracking'}
                </h1>
              </div>
            </div>
          </div>
        </div>

        <CoachConversionsPanel />
      </div>
    </div>
  )
}
