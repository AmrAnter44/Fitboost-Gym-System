'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLanguage } from '../contexts/LanguageContext'
import { usePermissions } from '../hooks/usePermissions'

// Map route segment → translation key
const SEGMENT_KEYS: Record<string, string> = {
  '':               'nav.home',
  'members':        'nav.members',
  'pt':             'nav.pt',
  'nutrition':      'nav.nutrition',
  'physiotherapy':  'nav.physiotherapy',
  'group-classes':  'nav.groupClasses',
  'dayuse':         'nav.dayUse',
  'staff':          'nav.staff',
  'receipts':       'nav.receipts',
  'expenses':       'nav.expenses',
  'visitors':       'nav.visitors',
  'followups':      'nav.followups',
  'spa-bookings':   'nav.spaBookings',
  'closing':        'nav.closing',
  'settings':       'nav.settings',
  'admin':          'auth.manageUsers',
  'users':          'auth.manageUsers',
}

function homeIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function chevron(isRtl: boolean) {
  return (
    <svg className="w-3.5 h-3.5 text-white/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d={isRtl ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
    </svg>
  )
}

export default function Breadcrumb() {
  const pathname = usePathname()
  const { t, locale } = useLanguage()
  const { user, loading } = usePermissions()

  // Don't render while loading, not logged in, or on home page
  if (loading || !user || pathname === '/') return null

  const isRtl = locale === 'ar'

  // Build segments from pathname
  const rawSegments = pathname.split('/').filter(Boolean)

  // Build crumb list: home + each segment
  const crumbs: { label: string; href: string; isLast: boolean }[] = [
    { label: t('nav.home' as any), href: '/', isLast: rawSegments.length === 0 },
  ]

  rawSegments.forEach((seg, i) => {
    const key = SEGMENT_KEYS[seg]
    // Skip numeric IDs or unknown segments
    const label = key ? t(key as any) : seg
    const href = '/' + rawSegments.slice(0, i + 1).join('/')
    crumbs.push({ label, href, isLast: i === rawSegments.length - 1 })
  })

  return (
    <nav
      aria-label="breadcrumb"
      dir={isRtl ? 'rtl' : 'ltr'}
      className="bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-800 dark:to-primary-900 border-b-2 border-primary-800 dark:border-primary-950 px-4 py-2 shadow-md"
    >
      <ol className="flex items-center gap-1.5 flex-wrap text-xs">
        {crumbs.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-1.5">
            {/* Separator before each crumb (except first) */}
            {i > 0 && chevron(isRtl)}

            {crumb.isLast ? (
              // Current page — not a link
              <span className="flex items-center gap-1 text-white font-bold drop-shadow">
                {i === 0 && homeIcon()}
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="flex items-center gap-1 text-white/80 hover:text-white transition-colors"
              >
                {i === 0 && homeIcon()}
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
