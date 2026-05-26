'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '../contexts/LanguageContext'
import { useSearch } from '../contexts/SearchContext'
import NotificationsCenter from './NotificationsCenter'

interface TopHeaderProps {
  onMenuClick: () => void
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

export default function TopHeader({ onMenuClick }: TopHeaderProps) {
  const { openSearch } = useSearch()
  const { user } = usePermissions()
  const { t, locale } = useLanguage()
  const [showUserMenu, setShowUserMenu] = useState(false)

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

  if (!user) {
    return null
  }

  return (
    <header className="sticky top-0 z-40 bg-white/85 dark:bg-gray-900/85 backdrop-blur-md backdrop-saturate-150 border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 gap-4">
        {/* Mobile Menu Toggle */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
          aria-label={t('nav.menu') || 'Open menu'}
        >
          <svg className="w-6 h-6" {...stroke}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex-1" />

        {/* Right Side: Actions */}
        <div className="flex items-center gap-1.5">
          {/* Quick Search */}
          <button
            onClick={() => openSearch()}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/70 hover:bg-gray-200 dark:hover:bg-gray-800 border border-transparent hover:border-gray-300 dark:hover:border-gray-700 transition-colors duration-200"
            title={`${t('nav.quickSearch')} (Ctrl+K)`}
          >
            <svg className="w-4 h-4" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="hidden md:inline">{t('nav.quickSearch')}</span>
            <kbd className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold border border-gray-300 dark:border-gray-600 rounded text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900">⌘K</kbd>
          </button>

          <button
            onClick={() => openSearch()}
            className="sm:hidden p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
            aria-label={t('nav.quickSearch')}
          >
            <svg className="w-5 h-5" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* Notifications */}
          <NotificationsCenter />

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 pl-1.5 pr-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
              title={user.name}
              aria-haspopup="menu"
              aria-expanded={showUserMenu}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 rounded-full flex items-center justify-center font-bold text-primary-contrast dark:text-primary-contrast text-sm shadow-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 hidden sm:block" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowUserMenu(false)}
                  aria-hidden="true"
                />

                <div
                  dir={locale === 'ar' ? 'rtl' : 'ltr'}
                  role="menu"
                  className={`absolute mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden z-40 border border-gray-200 dark:border-gray-700 animate-modal-in ${
                    locale === 'ar' ? 'left-0' : 'right-0'
                  }`}
                >
                  <div className="bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 text-primary-contrast dark:text-primary-contrast p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/40 dark:bg-white/15 rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{user.name}</p>
                        <p className="text-xs opacity-90 truncate">{user.email}</p>
                        <p className="text-xs mt-1 opacity-80">{getRoleLabel(user.role)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="py-1">
                    {(user.role === 'ADMIN' || user.role === 'OWNER') && (
                      <>
                        <Link
                          href="/admin/users"
                          onClick={() => setShowUserMenu(false)}
                          className="px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 flex items-center gap-3"
                          role="menuitem"
                        >
                          <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" {...stroke}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z"/>
                          </svg>
                          <span className="text-sm">{t('auth.manageUsers')}</span>
                        </Link>
                        <Link
                          href="/admin/audit"
                          onClick={() => setShowUserMenu(false)}
                          className="px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 flex items-center gap-3"
                          role="menuitem"
                        >
                          <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" {...stroke}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                          </svg>
                          <span className="text-sm">{locale === 'ar' ? 'سجل النشاط' : 'Activity Log'}</span>
                        </Link>
                      </>
                    )}

                    <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors duration-200 flex items-center gap-3 font-bold"
                      role="menuitem"
                    >
                      <svg className="w-5 h-5" {...stroke}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                      </svg>
                      <span>{t('auth.logout')}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
