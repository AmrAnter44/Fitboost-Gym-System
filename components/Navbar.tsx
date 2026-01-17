'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { usePermissions } from '../hooks/usePermissions'
import type { Permissions } from '../types/permissions'
import { useLanguage } from '../contexts/LanguageContext'
import { useSearch } from '../contexts/SearchContext'
import { useUpdate } from '../contexts/UpdateContext'

export default function Navbar() {
  const pathname = usePathname()
  const { openSearch } = useSearch()
  const { hasPermission, user, loading } = usePermissions()
  const { t, locale } = useLanguage()
  const { updateAvailable } = useUpdate()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)

  // Don't show navbar if no user is logged in
  if (!loading && !user) {
    return null
  }

  const allLinks = [
    { href: '/members', label: t('nav.members'), icon: '👥', permission: 'canViewMembers' as keyof Permissions, roleRequired: null },
    { href: '/pt', label: t('nav.pt'), icon: '💪', permission: 'canViewPT' as keyof Permissions, roleRequired: null },
    { href: '/coach/dashboard', label: t('nav.coach'), icon: '🏋️', permission: 'canRegisterPTAttendance' as keyof Permissions, roleRequired: 'COACH' },
    { href: '/coach/rotations', label: t('nav.rotations'), icon: '🔄', permission: 'canRegisterPTAttendance' as keyof Permissions, roleRequired: 'COACH' },
    { href: '/dayuse', label: t('nav.dayUse'), icon: '📊', permission: 'canViewDayUse' as keyof Permissions, roleRequired: null },
    { href: '/invitations', label: t('nav.invitations'), icon: '🎟️', permission: 'canViewVisitors' as keyof Permissions, roleRequired: null },
    { href: '/staff', label: t('nav.staff'), icon: '👷', permission: 'canViewStaff' as keyof Permissions, roleRequired: null },
    { href: '/receipts', label: t('nav.receipts'), icon: '🧾', permission: 'canViewReceipts' as keyof Permissions, roleRequired: null },
    { href: '/expenses', label: t('nav.expenses'), icon: '💸', permission: 'canViewExpenses' as keyof Permissions, roleRequired: null },
    { href: '/visitors', label: t('nav.visitors'), icon: '🚶', permission: 'canViewVisitors' as keyof Permissions, roleRequired: null },
    { href: '/followups', label: t('nav.followups'), icon: '📝', permission: 'canViewFollowUps' as keyof Permissions, roleRequired: null },
    { href: '/closing', label: t('nav.closing'), icon: '💰', permission: 'canAccessClosing' as keyof Permissions, roleRequired: null },
    { href: '/settings', label: t('nav.settings'), icon: '⚙️', permission: null, roleRequired: null },
  ]

  // Filter links based on permissions and role
  const links = allLinks.filter(link => {
    // Check permission
    if (link.permission && !hasPermission(link.permission)) return false

    // Check role if required
    if (link.roleRequired && user?.role !== link.roleRequired) return false

    return true
  })

  // Open search modal with Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        openSearch()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [openSearch])

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

  return (
    <>
      {/* ✅ Navbar أفقية مع أيقونات عمودية على اليمين */}
      <nav className="bg-blue-600 text-white shadow-xl sticky top-0 z-40 border-b border-blue-700">
        <div className="w-full px-2 sm:px-4 relative z-10">
          <div className="flex items-center justify-between gap-2">
            {/* Logo + Hamburger Menu - على اليسار */}
            <div className="flex items-center gap-2 flex-shrink-0 py-1.5">
              {/* Logo Button - للصفحة الرئيسية */}
              <Link
                href="/"
                className="logo-breathing"
                title={t('nav.home')}
              >
                <img
                  src="/assets/icon.png"
                  alt="Home"
                  className="w-12 h-12 sm:w-14 sm:h-14 drop-shadow-2xl"
                />
              </Link>

              {/* Hamburger Menu - على الموبايل فقط */}
              <button
                onClick={() => setShowDrawer(!showDrawer)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-all hover:scale-110 active:scale-95 lg:hidden"
                aria-label="القائمة"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

            {/* روابط التنقل - في الوسط على Desktop */}
            <div className="hidden lg:flex lg:justify-center lg:flex-wrap gap-1 xl:gap-1.5 py-1.5 flex-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 xl:px-4 py-2 xl:py-2.5 rounded-lg transition-all hover:bg-white/15 text-center flex items-center justify-center gap-1.5 hover:scale-105 active:scale-95 border border-transparent relative ${
                    pathname === link.href ? 'bg-white/20 font-bold border-white/30 shadow-lg' : 'hover:border-white/20'
                  }`}
                >
                  <span className="text-base xl:text-lg drop-shadow">{link.icon}</span>
                  <span className="text-sm xl:text-base font-bold whitespace-nowrap">{link.label}</span>
                  {/* Update badge for Settings */}
                  {link.href === '/settings' && updateAvailable && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-blue-600 animate-pulse"></span>
                  )}
                </Link>
              ))}
            </div>

            {/* الأيقونات أفقية على اليمين */}
            <div className="flex flex-row gap-2 items-center py-1">
              {/* User Icon - Dropdown */}
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center justify-center bg-white/10 backdrop-blur-sm p-1.5 rounded-full hover:bg-white/20 transition-all hover:scale-110 active:scale-95 border border-white/20"
                    title={user.name}
                  >
                    <div className="w-7 h-7 bg-gradient-to-br from-white/40 to-white/20 rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
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
                        className={`absolute mt-2 w-64 bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl overflow-hidden z-40 border-2 border-blue-500/50 ${
                          locale === 'ar' ? 'left-0' : 'right-0'
                        }`}>
                        {/* User Info */}
                        <div className="bg-blue-600 text-white p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center font-bold text-lg">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold">{user.name}</p>
                              <p className="text-xs text-white/80">{user.email}</p>
                              <p className="text-xs mt-1">{getRoleLabel(user.role)}</p>
                            </div>
                          </div>
                        </div>

                        {/* Menu Items */}
                        <div className="py-2">
                          {user.role === 'ADMIN' && (
                            <Link
                              href="/admin/users"
                              onClick={() => setShowUserMenu(false)}
                              className={`px-4 py-3 text-gray-700 hover:bg-blue-50/80 transition-all flex items-center gap-2 ${
                                locale === 'ar' ? 'hover:translate-x-1' : 'hover:-translate-x-1'
                              }`}
                            >
                              <span>👥</span>
                              <span>{t('auth.manageUsers')}</span>
                            </Link>
                          )}

                          <button
                            onClick={handleLogout}
                            className={`w-full px-4 py-3 text-red-600 hover:bg-red-50/80 transition-all flex items-center gap-2 font-bold ${
                              locale === 'ar' ? 'text-right hover:translate-x-1' : 'text-left hover:-translate-x-1'
                            }`}
                          >
                            <span>🚪</span>
                            <span>{t('auth.logout')}</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Quick Search Button */}
              <button
                onClick={() => openSearch()}
                className="w-9 h-9 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-all hover:scale-110 active:scale-95 flex items-center justify-center font-bold flex-shrink-0 border border-white/20 shadow-lg"
                title="بحث سريع (Ctrl+K)"
              >
                <span className="text-base">🔍</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile/Tablet Drawer - ينزلق من اليمين */}
      {showDrawer && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-[100] lg:hidden animate-fadeIn"
            onClick={() => setShowDrawer(false)}
          />

          {/* Drawer */}
          <div className={`fixed top-0 h-full w-72 sm:w-80 bg-white/95 backdrop-blur-lg z-[101] shadow-2xl lg:hidden overflow-y-auto border-blue-500 ${
            locale === 'ar'
              ? 'right-0 animate-slideRight border-l-4'
              : 'left-0 animate-slideLeft border-r-4'
          }`}>
            {/* Header */}
            <div className="bg-blue-600 text-white p-4 flex items-center justify-between sticky top-0">
              <div className="flex items-center gap-3">
                <img src='/icon.png' alt="logo" className='w-8 h-8'/>
                <span className="font-bold text-xl">{t('nav.menu')}</span>
              </div>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Navigation Links */}
            <div className="p-4 space-y-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setShowDrawer(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:translate-x-2 relative ${
                    pathname === link.href
                      ? 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 font-bold shadow-md border-r-4 border-blue-500'
                      : 'text-gray-700 hover:bg-gray-100/80'
                  }`}
                >
                  <span className="text-2xl drop-shadow">{link.icon}</span>
                  <span className="text-base">{link.label}</span>
                  {/* Update badge for Settings */}
                  {link.href === '/settings' && updateAvailable && (
                    <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                  )}
                </Link>
              ))}
            </div>

            {/* User Info at Bottom */}
            {user && (
              <div className="p-4 border-t mt-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-lg">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{user.name}</p>
                      <p className="text-xs text-gray-600">{getRoleLabel(user.role)}</p>
                    </div>
                  </div>

                  {user.role === 'ADMIN' && (
                    <Link
                      href="/admin/users"
                      onClick={() => setShowDrawer(false)}
                      className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition mb-2"
                    >
                      <span>👥</span>
                      <span className="text-sm">{t('auth.manageUsers')}</span>
                    </Link>
                  )}

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-bold"
                  >
                    <span>🚪</span>
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
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        @keyframes slideLeft {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }

        @keyframes logoBreathing {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.3));
          }
          50% {
            transform: scale(1.1);
            filter: drop-shadow(0 0 20px rgba(59, 130, 246, 0.6));
          }
        }

        .logo-breathing {
          display: inline-block;
          animation: logoBreathing 3s ease-in-out infinite;
          transition: all 0.3s ease;
        }

        .logo-breathing:hover {
          animation: none;
          transform: scale(1.15) rotate(5deg);
          filter: drop-shadow(0 0 25px rgba(59, 130, 246, 0.8));
        }

        .logo-breathing:active {
          transform: scale(0.95);
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