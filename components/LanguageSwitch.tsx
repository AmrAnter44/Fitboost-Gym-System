'use client'

import { useLanguage } from '../contexts/LanguageContext'

export default function LanguageSwitch() {
  const { locale, setLanguage, t } = useLanguage()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLanguage(locale === 'ar' ? 'en' : 'ar')}
        className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition flex items-center gap-2"
        title={t('settings.changeLanguage')}
      >
        <span className="text-lg">🌐</span>
        <span className="font-medium">
          {locale === 'ar' ? 'EN' : 'عربي'}
        </span>
      </button>
    </div>
  )
}
