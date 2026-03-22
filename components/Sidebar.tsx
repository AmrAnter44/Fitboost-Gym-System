'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { usePermissions } from '../hooks/usePermissions'
import type { Permissions } from '../types/permissions'
import { useLanguage } from '../contexts/LanguageContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  isCollapsed: boolean
  setIsCollapsed: (value: boolean) => void
}

export default function Sidebar({ isOpen, onClose, isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname()
  const { hasPermission, user, loading } = usePermissions()
  const { t, locale } = useLanguage()
  const { settings } = useServiceSettings()
  const direction = locale === 'ar' ? 'rtl' : 'ltr'
  const [showUserMenu, setShowUserMenu] = useState(false)

  // Don't show sidebar if no user is logged in
  if (!loading && !user) {
    return null
  }

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

  // Define navigation groups
  const navigationGroups = [
    {
      title: t('nav.overview'),
      icon: '📊',
      links: [
        { href: '/', label: t('nav.dashboard'), icon: '🏠', permission: null },
      ]
    },
    {
      title: t('nav.clientManagement'),
      icon: '👥',
      links: [
        { href: '/members', label: t('nav.members'), icon: '👥', permission: 'canViewMembers' as keyof Permissions },
        { href: '/visitors', label: t('nav.visitors'), icon: '🚶', permission: 'canViewVisitors' as keyof Permissions },
        { href: '/followups', label: t('nav.followups'), icon: '📝', permission: 'canViewFollowUps' as keyof Permissions },
      ]
    },
    {
      title: t('nav.services'),
      icon: '💼',
      links: [
        { href: '/pt', label: t('nav.pt'), icon: '💪', permission: 'canViewPT' as keyof Permissions },
        { href: '/nutrition', label: t('nav.nutrition'), icon: '🥗', permission: 'canViewNutrition' as keyof Permissions, enabled: settings.nutritionEnabled },
        { href: '/physiotherapy', label: t('nav.physiotherapy'), icon: '🏥', permission: 'canViewPhysiotherapy' as keyof Permissions, enabled: settings.physiotherapyEnabled },
        { href: '/group-classes', label: t('nav.groupClasses'), icon: '🎯', permission: 'canViewGroupClass' as keyof Permissions, enabled: settings.groupClassEnabled },
        { href: '/more', label: t('nav.more'), icon: '➕', permission: 'canViewMore' as keyof Permissions, enabled: settings.moreEnabled },
        { href: '/spa-bookings', label: t('nav.spaBookings'), icon: '💆', permission: 'canViewSpaBookings' as keyof Permissions, enabled: settings.spaEnabled },
        { href: '/dayuse', label: t('nav.dayUse'), icon: '📊', permission: 'canViewDayUse' as keyof Permissions },
      ]
    },
    {
      title: t('nav.financial'),
      icon: '💰',
      links: [
        { href: '/receipts', label: t('nav.receipts'), icon: '🧾', permission: 'canViewReceipts' as keyof Permissions },
        { href: '/expenses', label: t('nav.expenses'), icon: '💸', permission: 'canViewExpenses' as keyof Permissions },
        { href: '/closing', label: t('nav.closing'), icon: '💰', permission: 'canAccessClosing' as keyof Permissions },
      ]
    },
    {
      title: t('nav.management'),
      icon: '⚙️',
      links: [
        { href: '/staff', label: t('nav.staff'), icon: '👷', permission: 'canViewStaff' as keyof Permissions },
        { href: '/settings', label: t('nav.settings'), icon: '⚙️', permission: null },
      ]
    },
  ]

  // Filter links based on permissions and enabled status
  const filteredGroups = navigationGroups.map(group => ({
    ...group,
    links: group.links.filter(link => {
      // Check if service is enabled
      if ('enabled' in link && link.enabled === false) return false

      // Check permission
      if (link.permission && !hasPermission(link.permission)) return false

      return true
    })
  })).filter(group => group.links.length > 0) // Remove empty groups

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        dir={direction}
        className={`
          fixed lg:sticky
          top-0
          ${direction === 'rtl' ? 'right-0' : 'left-0'}
          z-50 lg:z-30
          h-screen
          ${isCollapsed ? 'w-20' : 'w-72'}
          bg-white dark:bg-gray-800
          ${direction === 'rtl' ? 'border-l' : 'border-r'} border-gray-200 dark:border-gray-700
          shadow-2xl
          transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : `${direction === 'rtl' ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
          flex flex-col
          overflow-hidden
        `}
      >
        {/* Logo Header */}
        <div className={`
          flex items-center justify-between
          border-b border-gray-200 dark:border-gray-700
          bg-gradient-to-r from-primary-600 to-primary-700 dark:from-gray-900 dark:to-gray-800
          text-white
          flex-shrink-0
          ${isCollapsed ? 'justify-center py-9 px-2' : 'p-4'}
        `}>
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <img
                src={settings.gymLogo || '/assets/icon.png'}
                alt="Logo"
                className="w-10 h-10 object-contain drop-shadow-lg"
              />
              <div>
                <h2 className="font-bold text-lg leading-tight">
                  {t('common.appTitle')}
                </h2>
                <p className="text-xs text-white/80">
                  {t('common.appSubtitle')}
                </p>
              </div>
            </div>
          )}

          {/* Collapse Toggle - Desktop Only */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`
              hidden lg:flex
              p-2 rounded-lg
              hover:bg-white/20 dark:hover:bg-gray-700
              transition-all
              ${isCollapsed ? 'absolute top-4 left-4' : ''}
            `}
            title={isCollapsed ? (locale === 'ar' ? 'توسيع' : 'Expand') : (locale === 'ar' ? 'طي' : 'Collapse')}
          >
            <svg
              className={`w-5 h-5 transition-transform ${direction === 'rtl' ? (isCollapsed ? '' : 'rotate-180') : (isCollapsed ? 'rotate-180' : '')}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Close Button - Mobile Only */}
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:bg-white/20 dark:hover:bg-gray-700 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-6 scrollbar-thin">
          {filteredGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {/* Group Links */}
              <div className="space-y-1 mb-4">
                {group.links.map((link) => {
                  const isActive = pathname === link.href

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => onClose()}
                      className={`
                        flex items-center gap-3
                        px-3 py-2.5 rounded-lg
                        transition-all duration-200
                        group relative
                        ${isCollapsed ? 'justify-center' : ''}
                        ${isActive
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-bold shadow-sm'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                        }
                      `}
                      title={isCollapsed ? link.label : undefined}
                    >
                      {/* Icon */}
                      <span className={`text-xl flex-shrink-0 ${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>
                        {link.icon}
                      </span>

                      {/* Label */}
                      {!isCollapsed && (
                        <span className="text-sm font-medium truncate flex-1">
                          {link.label}
                        </span>
                      )}

                      {/* Active Indicator */}
                      {isActive && (
                        <div className={`
                          absolute ${direction === 'rtl' ? 'left-0' : 'right-0'} top-0 h-full w-1
                          bg-primary-600 dark:bg-primary-500 rounded-full
                        `} />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Footer */}
        {user && (
          <div className="border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            {/* User Menu */}
            <div className="p-3">
              {!isCollapsed && (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="w-full flex items-center gap-3 px-2 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 dark:from-gray-600 dark:to-gray-500 rounded-full flex items-center justify-center font-bold text-white shadow-md">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {getRoleLabel(user.role)}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {showUserMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />

                      <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden z-50 border border-gray-200 dark:border-gray-700">
                        {(user.role === 'ADMIN' || user.role === 'OWNER') && (
                          <>
                            <Link
                              href="/admin/users"
                              onClick={() => { setShowUserMenu(false); onClose(); }}
                              className="flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                            >
                              <span>👥</span>
                              <span className="text-sm">{t('auth.manageUsers')}</span>
                            </Link>
                            <Link
                              href="/admin/audit"
                              onClick={() => { setShowUserMenu(false); onClose(); }}
                              className="flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                            >
                              <span>📝</span>
                              <span className="text-sm">{locale === 'ar' ? 'سجل النشاط' : 'Activity Log'}</span>
                            </Link>
                            <div className="border-t border-gray-200 dark:border-gray-700" />
                          </>
                        )}

                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                        >
                          <span>🚪</span>
                          <span className="text-sm font-bold">{t('auth.logout')}</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {isCollapsed && (
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="relative w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 dark:from-gray-600 dark:to-gray-500 rounded-full flex items-center justify-center font-bold text-white shadow-md hover:scale-110 transition-all mx-auto"
                >
                  {user.name.charAt(0).toUpperCase()}

                  {/* Dropdown Menu - Collapsed */}
                  {showUserMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />

                      <div className={`absolute ${direction === 'rtl' ? 'right-full mr-2' : 'left-full ml-2'} bottom-0 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden z-50 border border-gray-200 dark:border-gray-700`}>
                        <div className="bg-gradient-to-r from-primary-600 to-primary-700 dark:from-gray-900 dark:to-gray-800 text-white p-3">
                          <p className="font-bold text-sm">{user.name}</p>
                          <p className="text-xs text-white/80">{getRoleLabel(user.role)}</p>
                        </div>

                        {(user.role === 'ADMIN' || user.role === 'OWNER') && (
                          <>
                            <Link
                              href="/admin/users"
                              onClick={() => { setShowUserMenu(false); onClose(); }}
                              className="flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                            >
                              <span>👥</span>
                              <span className="text-sm">{t('auth.manageUsers')}</span>
                            </Link>
                            <Link
                              href="/admin/audit"
                              onClick={() => { setShowUserMenu(false); onClose(); }}
                              className="flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                            >
                              <span>📝</span>
                              <span className="text-sm">{locale === 'ar' ? 'سجل النشاط' : 'Activity Log'}</span>
                            </Link>
                            <div className="border-t border-gray-200 dark:border-gray-700" />
                          </>
                        )}

                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                        >
                          <span>🚪</span>
                          <span className="text-sm font-bold">{t('auth.logout')}</span>
                        </button>
                      </div>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
