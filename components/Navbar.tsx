'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useMemo, type ReactElement } from 'react'
import { usePermissions } from '../hooks/usePermissions'
import type { Permissions } from '../types/permissions'
import { useLanguage } from '../contexts/LanguageContext'
import { useSearch } from '../contexts/SearchContext'
import NotificationsCenter from './NotificationsCenter'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const Icon = {
  users: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-3a4 4 0 11-8 0 4 4 0 018 0zm6-4a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  ),
  plus: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
  ),
  bell: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0" /></svg>
  ),
  dumbbell: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 8v8m0-4H3m18 4V8m0 4h3M9 6h6v12H9z" /></svg>
  ),
  nutrition: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 2a8 8 0 00-3 15.5V20a2 2 0 002 2h2a2 2 0 002-2v-2.5A8 8 0 0012 2z" /></svg>
  ),
  hospital: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m-4-4h8M5 21h14a2 2 0 002-2V7l-7-4-7 4v12a2 2 0 002 2z" /></svg>
  ),
  chart: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 17V9m5 8V5m5 12v-6" /></svg>
  ),
  staff: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 11a4 4 0 100-8 4 4 0 000 8zm0 2c-3.31 0-6 2.69-6 6v2h12v-2c0-3.31-2.69-6-6-6z" /></svg>
  ),
  receipt: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m-6 4h6m-6 4h4M6 3h12a1 1 0 011 1v17l-3-2-3 2-3-2-3 2-3-2V4a1 1 0 011-1z" /></svg>
  ),
  expense: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2 0-3 1-3 2s1 2 3 2 3 1 3 2-1 2-3 2m0-8V6m0 12v-2m9-4a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  walker: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M13 4a2 2 0 11-4 0 2 2 0 014 0zm-2 4l-3 6 3 2v6m0-8l4-2v-4" /></svg>
  ),
  pencil: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5h-7a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-7m-1.5-9.5a2.121 2.121 0 113 3L12 17l-4 1 1-4 9.5-9.5z" /></svg>
  ),
  spa: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 11a4 4 0 100-8 4 4 0 000 8zm-7 10a7 7 0 0114 0H5z" /></svg>
  ),
  whatsapp: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12a9 9 0 11-3.34-7L21 4l-1.34 3.66A9 9 0 0121 12zM3 21l1.65-4.95" /></svg>
  ),
  cash: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2 0-3 1-3 2s1 2 3 2 3 1 3 2-1 2-3 2m0-8V6m0 12v-2M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
  ),
  cog: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.3l2-1.6-2-3.4-2.4.9a7 7 0 00-2.3-1.3L14 2h-4l-.6 2.3a7 7 0 00-2.3 1.3l-2.4-.9-2 3.4 2 1.6c-.1.4-.1.9-.1 1.3s0 .9.1 1.3l-2 1.6 2 3.4 2.4-.9a7 7 0 002.3 1.3L10 22h4l.6-2.3a7 7 0 002.3-1.3l2.4.9 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z" /></svg>
  ),
  logout: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h6a2 2 0 012 2v1" /></svg>
  ),
  search: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
  ),
  menu: (
    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
  ),
  close: (
    <svg className="w-6 h-6" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
  ),
}

type NavLink = {
  href: string
  label: string
  icon: ReactElement
  permission: keyof Permissions | null
  roleRequired: string | null
  enabled?: boolean
}

export default function Navbar() {
  const pathname = usePathname()
  const { openSearch } = useSearch()
  const { hasPermission, user, loading } = usePermissions()
  const { t, locale } = useLanguage()
  const { settings } = useServiceSettings()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [drawerClosing, setDrawerClosing] = useState(false)

  const closeDrawer = () => {
    setDrawerClosing(true)
    setTimeout(() => {
      setShowDrawer(false)
      setDrawerClosing(false)
    }, 200)
  }

  const links = useMemo<NavLink[]>(() => {
    const allLinks: NavLink[] = [
      { href: '/coach/my-members', label: locale === 'ar' ? 'أعضاء محتملين' : 'Potential Members', icon: Icon.users, permission: null, roleRequired: 'COACH' },
      { href: '/coach/more', label: locale === 'ar' ? 'اشتراكات More' : 'My More', icon: Icon.plus, permission: null, roleRequired: 'COACH' },
      { href: '/coach/notifications', label: locale === 'ar' ? 'إشعاراتي' : 'My Notifications', icon: Icon.bell, permission: null, roleRequired: 'COACH' },
      { href: '/members', label: t('nav.members'), icon: Icon.users, permission: 'canViewMembers' as keyof Permissions, roleRequired: null },
      { href: '/pt', label: t('nav.pt'), icon: Icon.dumbbell, permission: 'canViewPT' as keyof Permissions, roleRequired: null },
      //  متابعة الكباتن بقت تاب جوّه صفحة الحصص المخصصة (/pt) — مش لينك مستقل
      { href: '/nutrition', label: t('nav.nutrition'), icon: Icon.nutrition, permission: 'canViewNutrition' as keyof Permissions, roleRequired: null, enabled: settings.nutritionEnabled },
      { href: '/physiotherapy', label: t('nav.physiotherapy'), icon: Icon.hospital, permission: 'canViewPhysiotherapy' as keyof Permissions, roleRequired: null, enabled: settings.physiotherapyEnabled },
      { href: '/group-classes', label: t('nav.groupClasses'), icon: Icon.users, permission: 'canViewGroupClass' as keyof Permissions, roleRequired: null, enabled: settings.groupClassEnabled },
      { href: '/dayuse', label: t('nav.dayUse'), icon: Icon.chart, permission: 'canViewDayUse' as keyof Permissions, roleRequired: null },
      { href: '/staff', label: t('nav.staff'), icon: Icon.staff, permission: 'canViewStaff' as keyof Permissions, roleRequired: null },
      { href: '/receipts', label: t('nav.receipts'), icon: Icon.receipt, permission: 'canViewReceipts' as keyof Permissions, roleRequired: null },
      { href: '/expenses', label: t('nav.expenses'), icon: Icon.expense, permission: 'canViewExpenses' as keyof Permissions, roleRequired: null },
      { href: '/visitors', label: t('nav.visitors'), icon: Icon.walker, permission: 'canViewVisitors' as keyof Permissions, roleRequired: null },
      { href: '/followups', label: t('nav.followups'), icon: Icon.pencil, permission: 'canViewFollowUps' as keyof Permissions, roleRequired: null },
      { href: '/spa-bookings', label: t('nav.spaBookings'), icon: Icon.spa, permission: 'canViewSpaBookings' as keyof Permissions, roleRequired: null, enabled: settings.spaEnabled },
      { href: '/whatsapp-web', label: 'WhatsApp Web', icon: Icon.whatsapp, permission: 'canViewWhatsAppInbox' as keyof Permissions, roleRequired: null },
      { href: '/closing', label: t('nav.closing'), icon: Icon.cash, permission: 'canAccessClosing' as keyof Permissions, roleRequired: null },
      { href: '/settings', label: t('nav.settings'), icon: Icon.cog, permission: 'canAccessSettings' as keyof Permissions, roleRequired: null },
    ]

    return allLinks.filter(link => {
      if ('enabled' in link && link.enabled === false) return false
      //  /expenses يظهر لأي صلاحية من صلاحيات المصاريف (نفس الفلسفة بتاعت Sidebar)
      if (link.href === '/expenses') {
        if (hasPermission('canViewExpenses') ||
            hasPermission('canCreateExpense') ||
            hasPermission('canEditExpense') ||
            hasPermission('canDeleteExpense')) {
          return true
        }
        return false
      }
      if (link.permission && !hasPermission(link.permission)) return false
      if (link.roleRequired && user?.role !== link.roleRequired) return false
      return true
    })
  }, [t, locale, settings.nutritionEnabled, settings.physiotherapyEnabled, settings.groupClassEnabled, settings.spaEnabled, hasPermission, user?.role])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const getRoleLabel = (role: string) => {
    const roleKey = role.toLowerCase()
    return t(`roles.${roleKey}` as any) || role
  }

  if (!loading && !user) {
    return null
  }

  return (
    <>
      <nav
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        //  pt-[env(safe-area-inset-top)] عشان الـ notch بتاع الـ iPhone ميغطيش الأزرار
        className="bg-white/85 dark:bg-gray-900/85 backdrop-blur-md backdrop-saturate-150 border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-40 pt-[env(safe-area-inset-top)]"
      >
        <div className="w-full px-2 sm:px-4 relative z-10">
          <div className="flex items-center justify-between gap-2">
            {/* Mobile hamburger */}
            <div className="flex items-center gap-2 flex-shrink-0 py-1.5 lg:hidden">
              <button
                onClick={() => setShowDrawer(!showDrawer)}
                className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
                aria-label={t('nav.menu')}
                aria-expanded={showDrawer}
              >
                {Icon.menu}
              </button>
            </div>

            <div className="hidden lg:block flex-shrink-0 py-1.5" />

            {/* Mobile title */}
            <div className="flex lg:hidden items-center justify-center flex-1 py-1.5">
              <Link
                href={user?.role === 'COACH' ? '/coach' : '/'}
                className="flex items-center gap-2"
                title={t('nav.home')}
              >
                <span className="font-bold text-base text-gray-900 dark:text-gray-100">Fitboost System</span>
              </Link>
            </div>

            {/* Desktop nav links */}
            <div className="hidden lg:flex lg:justify-center lg:flex-wrap gap-1 xl:gap-1.5 py-1.5 flex-1">
              {links.map((link) => {
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`px-3 xl:px-4 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-1.5 text-sm font-bold whitespace-nowrap ${
                      isActive
                        ? 'bg-primary-500 text-primary-contrast'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {link.icon && <span className="flex-shrink-0">{link.icon}</span>}
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </div>

            {/* Right actions */}
            <div className="flex flex-row gap-1.5 items-center py-1">
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center justify-center p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
                    title={user.name}
                    aria-haspopup="menu"
                    aria-expanded={showUserMenu}
                    aria-label={user.name}
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 rounded-full flex items-center justify-center font-bold text-sm text-primary-contrast shadow-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  </button>

                  {showUserMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setShowUserMenu(false)}
                      />

                      <div
                        dir={locale === 'ar' ? 'rtl' : 'ltr'}
                        className={`absolute mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden z-40 ${
                          locale === 'ar' ? 'left-0' : 'right-0'
                        }`}
                      >
                        <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-primary-contrast p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center font-bold text-lg">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold truncate">{user.name}</p>
                              <p className="text-xs opacity-80 truncate">{user.email}</p>
                              <p className="text-xs mt-1 opacity-90">{getRoleLabel(user.role)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="py-2">
                          {(user.role === 'ADMIN' || user.role === 'OWNER') && (
                            <>
                              <Link
                                href="/admin/users"
                                onClick={() => setShowUserMenu(false)}
                                className="px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors duration-200 flex items-center gap-2 text-sm"
                              >
                                {Icon.users}
                                <span>{t('auth.manageUsers')}</span>
                              </Link>
                              <Link
                                href="/admin/audit"
                                onClick={() => setShowUserMenu(false)}
                                className="px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors duration-200 flex items-center gap-2 text-sm"
                              >
                                {Icon.pencil}
                                <span>{locale === 'ar' ? 'سجل النشاط' : 'Activity Log'}</span>
                              </Link>
                            </>
                          )}

                          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

                          <button
                            onClick={handleLogout}
                            className="w-full px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors duration-200 flex items-center gap-2 font-bold text-start text-sm"
                          >
                            {Icon.logout}
                            <span>{t('auth.logout')}</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Notifications Center */}
              <NotificationsCenter />

              {/* Quick Search */}
              <button
                onClick={() => openSearch()}
                className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
                title="بحث سريع (Ctrl+K)"
                aria-label="Quick search"
              >
                {Icon.search}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile/Tablet Drawer */}
      {showDrawer && (
        <>
          <div
            className={`fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] lg:hidden transition-opacity duration-200 ${drawerClosing ? 'opacity-0' : 'opacity-100'}`}
            onClick={() => closeDrawer()}
          />

          <div
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            className={`fixed top-0 h-full w-72 sm:w-80 bg-white dark:bg-gray-800 z-[101] shadow-2xl lg:hidden overflow-y-auto ring-1 ring-gray-200 dark:ring-gray-700 transition-transform duration-200 ease-out ${
              locale === 'ar'
                ? `right-0 ${drawerClosing ? 'translate-x-full' : 'translate-x-0'}`
                : `left-0 ${drawerClosing ? '-translate-x-full' : 'translate-x-0'}`
            } ${!drawerClosing ? (locale === 'ar' ? 'animate-slideRight' : 'animate-slideLeft') : ''}`}
          >
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 pt-[calc(env(safe-area-inset-top)+1rem)] flex items-center justify-between sticky top-0 z-10">
              <button
                onClick={() => closeDrawer()}
                className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 flex-shrink-0"
                aria-label={t('common.close') || 'Close'}
              >
                {Icon.close}
              </button>

              <div className="flex items-center gap-2 flex-1 justify-center">
                <span className="font-bold text-base text-gray-900 dark:text-gray-100">Fitboost System</span>
              </div>

              <div className="w-10" />
            </div>

            <div className="p-3 space-y-1">
              {links.map((link) => {
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => closeDrawer()}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 text-sm font-bold ${
                      isActive
                        ? 'bg-primary-500 text-primary-contrast'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                    }`}
                  >
                    {link.icon && <span className="flex-shrink-0">{link.icon}</span>}
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </div>

            {user && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 mt-2">
                <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 ring-1 ring-gray-200 dark:ring-gray-700">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-primary-500 to-primary-600 text-primary-contrast rounded-full flex items-center justify-center font-bold text-lg">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 dark:text-gray-100 truncate">{user.name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{getRoleLabel(user.role)}</p>
                    </div>
                  </div>

                  {(user.role === 'ADMIN' || user.role === 'OWNER') && (
                    <Link
                      href="/admin/users"
                      onClick={() => closeDrawer()}
                      className="flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200 mb-2 text-sm font-bold"
                    >
                      {Icon.users}
                      <span>{t('auth.manageUsers')}</span>
                    </Link>
                  )}

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 font-bold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                  >
                    {Icon.logout}
                    <span>{t('auth.logout')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <style jsx global>{`
        @keyframes slideRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slideLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slideRight {
          animation: slideRight 0.2s ease-out;
        }
        .animate-slideLeft {
          animation: slideLeft 0.2s ease-out;
        }
      `}</style>
    </>
  )
}
