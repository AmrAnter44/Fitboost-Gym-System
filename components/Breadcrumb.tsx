'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLanguage } from '../contexts/LanguageContext'
import { usePermissions } from '../hooks/usePermissions'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

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
  'system':         'system.systemHealth',
  'admin':          'auth.manageUsers',
  'users':          'auth.manageUsers',
  'audit':          'settingsPage.quickLinks.audit.title',
}

function homeIcon() {
  return (
    <svg {...stroke} className="w-3.5 h-3.5">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function chevron(isRtl: boolean) {
  return (
    <svg {...stroke} className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round"
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
      className="bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-800 shadow-sm px-4 py-2"
    >
      <ol className="flex items-center gap-1.5 flex-wrap text-xs">
        {crumbs.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && chevron(isRtl)}

            {crumb.isLast ? (
              <span aria-current="page" className="flex items-center gap-1 text-gray-900 dark:text-gray-100 font-bold">
                {i === 0 && homeIcon()}
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-primary-700 dark:hover:text-primary-400 transition-colors duration-200"
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
