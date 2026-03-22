'use client'

import { useSearch } from '../contexts/SearchContext'
import { useLanguage } from '../contexts/LanguageContext'
import { usePermissions } from '../hooks/usePermissions'

export default function FloatingSearchButton() {
  const { openSearch } = useSearch()
  const { t, locale } = useLanguage()
  const { user, loading } = usePermissions()
  const direction = locale === 'ar' ? 'rtl' : 'ltr'

  // Don't show button if no user is logged in
  if (!loading && !user) {
    return null
  }

  return (
    <button
      onClick={() => openSearch()}
      className={`
        fixed bottom-6 end-6
        z-50
        w-14 h-14
        bg-gradient-to-br from-primary-500 to-primary-600
        dark:from-primary-600 dark:to-primary-700
        hover:from-primary-600 hover:to-primary-700
        dark:hover:from-primary-700 dark:hover:to-primary-800
        text-white
        rounded-full
        shadow-2xl
        hover:shadow-primary-500/50
        dark:hover:shadow-primary-600/50
        transition-all duration-300
        hover:scale-110
        active:scale-95
        flex items-center justify-center
        group
      `}
      title={`${t('nav.quickSearch')} (Ctrl+K)`}
    >
      <svg
        className="w-6 h-6 group-hover:scale-110 transition-transform"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>

      {/* Pulse effect */}
      <span className="absolute inset-0 rounded-full bg-primary-400 dark:bg-primary-500 animate-ping opacity-20"></span>
    </button>
  )
}
