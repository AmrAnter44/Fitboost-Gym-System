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

  // Don't show header if no user is logged in
  if (!user) {
    return null
  }

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 gap-4">
        {/* Left Side: Menu Toggle */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
          aria-label={t('nav.menu')}
        >
          <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Center: Empty (for future breadcrumbs or title) */}
        <div className="flex-1" />

        {/* Right Side: Actions */}
        <div className="flex items-center gap-2">
          {/* Quick Search Button */}
          <button
            onClick={() => openSearch()}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            title={`${t('nav.quickSearch')} (Ctrl+K)`}
          >
            <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* Notifications Center */}
          <NotificationsCenter />

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
              title={user.name}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 dark:from-gray-600 dark:to-gray-500 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-md">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <svg className="w-4 h-4 text-gray-700 dark:text-gray-300 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <>
                {/* Backdrop to close menu */}
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowUserMenu(false)}
                />

                {/* Menu */}
                <div
                  dir={locale === 'ar' ? 'rtl' : 'ltr'}
                  className={`absolute mt-2 w-64 bg-white dark:bg-gray-800 backdrop-blur-lg rounded-xl shadow-2xl overflow-hidden z-40 border border-gray-200 dark:border-gray-700 ${
                    locale === 'ar' ? 'left-0' : 'right-0'
                  }`}
                >
                  {/* User Info */}
                  <div className="bg-gradient-to-r from-primary-600 to-primary-700 dark:from-gray-900 dark:to-gray-800 text-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/20 dark:bg-gray-700 rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{user.name}</p>
                        <p className="text-xs text-white/80 dark:text-gray-300 truncate">{user.email}</p>
                        <p className="text-xs mt-1">{getRoleLabel(user.role)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    {(user.role === 'ADMIN' || user.role === 'OWNER') && (
                      <>
                        <Link
                          href="/admin/users"
                          onClick={() => setShowUserMenu(false)}
                          className="px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all flex items-center gap-2"
                        >
                          <span>👥</span>
                          <span>{t('auth.manageUsers')}</span>
                        </Link>
                        <Link
                          href="/admin/audit"
                          onClick={() => setShowUserMenu(false)}
                          className="px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all flex items-center gap-2"
                        >
                          <span>📝</span>
                          <span>{locale === 'ar' ? 'سجل النشاط' : 'Activity Log'}</span>
                        </Link>
                      </>
                    )}

                    {/* Separator before logout */}
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all flex items-center gap-2 font-bold"
                    >
                      <span>🚪</span>
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
