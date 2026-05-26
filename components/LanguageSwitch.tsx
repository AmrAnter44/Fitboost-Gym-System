'use client'

import { useLanguage } from '../contexts/LanguageContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

export default function LanguageSwitch() {
  const { locale, setLanguage, t } = useLanguage()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLanguage(locale === 'ar' ? 'en' : 'ar')}
        aria-label={t('settings.changeLanguage')}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast rounded-lg font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
        title={t('settings.changeLanguage')}
      >
        <svg {...stroke} className="w-5 h-5">
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
        </svg>
        <span>
          {locale === 'ar' ? 'EN' : 'عربي'}
        </span>
      </button>
    </div>
  )
}
