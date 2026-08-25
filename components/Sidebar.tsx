'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, type ReactNode } from 'react'
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

const iconClass = 'w-5 h-5 flex-shrink-0'
const strokeProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const NavIcons: Record<string, ReactNode> = {
  dashboard: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
  ),
  members: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
  ),
  visitors: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M3 12h15"/></svg>
  ),
  followups: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
  ),
  pt: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l2-2m12 12l-2 2M4 8l4 4m8 4l4-4M8 16l4-4 4 4M4 16l4-4M16 8l4 4"/></svg>
  ),
  nutrition: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M12 2a7 7 0 017 7c0 5-7 13-7 13S5 14 5 9a7 7 0 017-7zm0 4a3 3 0 100 6 3 3 0 000-6z"/></svg>
  ),
  physiotherapy: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M12 11V3m0 0L8 7m4-4l4 4M5 21h14a2 2 0 002-2v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7a2 2 0 002 2zm4-6h6"/></svg>
  ),
  groupClasses: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
  ),
  more: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
  ),
  spa: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2 3 2 6 0 9-2-3-2-6 0-9zm-6 8c3 0 5 2 5 5H6a5 5 0 010-5zm12 0a5 5 0 010 5h-5c0-3 2-5 5-5z"/></svg>
  ),
  dayuse: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
  ),
  receipts: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h4m6-4V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3-2 3 2 3-2 3 2v-4"/></svg>
  ),
  expenses: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
  ),
  closing: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14l3-3 4 4 5-5"/></svg>
  ),
  reports: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6m0 13l-3-3m3 3l3-3m6 3V10m0 9l3-3m-3 3l-3-3"/></svg>
  ),
  staff: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
  ),
  whatsapp: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M3 20l1.5-4.5A8 8 0 1112 20H7l-4 0z"/></svg>
  ),
  settings: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
  ),
  notifications: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
  ),
  audit: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
  ),
  lostFound: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/></svg>
  ),
  mail: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25H4.5a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5H4.5A2.25 2.25 0 0 0 2.25 6.75m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/></svg>
  ),
  complaints: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.019Z"/></svg>
  ),
  maintenance: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437"/></svg>
  ),
  tasks: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"/></svg>
  ),
  logout: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
  ),
  payroll: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
  ),
  schedule: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg>
  ),
  myPayslips: (
    <svg className={iconClass} {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"/></svg>
  ),
  chevronDown: (
    <svg className="w-4 h-4 text-gray-500 flex-shrink-0" {...strokeProps}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
  ),
}

export default function Sidebar({ isOpen, onClose, isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname()
  const { hasPermission, user, loading } = usePermissions()
  const { t, locale } = useLanguage()
  const { settings } = useServiceSettings()
  const direction = locale === 'ar' ? 'rtl' : 'ltr'
  const [showUserMenu, setShowUserMenu] = useState(false)
  //  الإعدادات (settings) بتتقري من localStorage، فبتختلف بين السيرفر وأول رندر على الكلاينت.
  //  نأجّل فلترة الروابط المعتمدة على الإعدادات لحد ما الكومبوننت يـ mount عشان نتجنّب hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  //  📱 واتساب ويب يظهر في نسخة الإلكترون فقط — مش على الموقع (الويب)
  const [isElectronApp, setIsElectronApp] = useState(false)
  useEffect(() => {
    setIsElectronApp(!!(window as any).electron?.isElectron || navigator.userAgent.toLowerCase().includes('electron'))
  }, [])

  //  بادجات: رسائل الوارد غير المقروءة + المهام المفتوحة
  const [inboxUnread, setInboxUnread] = useState(0)
  const [tasksPending, setTasksPending] = useState(0)
  useEffect(() => {
    if (!user) return
    let active = true
    const fetchCounts = () => {
      fetch('/api/inbox/unread-count').then((r) => (r.ok ? r.json() : null)).then((d) => { if (active && d) setInboxUnread(d.count || 0) }).catch(() => {})
      fetch('/api/tasks/pending-count').then((r) => (r.ok ? r.json() : null)).then((d) => { if (active && d) setTasksPending(d.count || 0) }).catch(() => {})
    }
    fetchCounts()
    const iv = setInterval(fetchCounts, 60000) //  تحديث كل دقيقة
    return () => { active = false; clearInterval(iv) }
  }, [user, pathname])

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

  const isCoach = user?.role === 'COACH'

  const navigationGroups: Array<{ title: string; links: Array<{ href: string; label: string; icon: ReactNode; permission: keyof Permissions | null; enabled?: boolean }> }> = [
    {
      title: t('nav.overview'),
      links: [
        { href: isCoach ? '/coach' : '/', label: t('nav.dashboard'), icon: NavIcons.dashboard, permission: null },
        //  صندوق الوارد للمستقبِلين بس (الأدمن/الأونر بيبعتوا مش بيستقبلوا)
        ...(user?.role !== 'OWNER' && user?.role !== 'ADMIN'
          ? [{ href: '/inbox', label: locale === 'ar' ? 'صندوق الوارد' : 'Inbox', icon: NavIcons.mail, permission: null }]
          : []),
        //  مهامي — لكل موظف غير الأدمن/الأونر (اللي بيسندوا مش بيتسند لهم)
        ...(user?.role !== 'OWNER' && user?.role !== 'ADMIN'
          ? [{ href: '/tasks', label: locale === 'ar' ? 'مهامي' : 'My Tasks', icon: NavIcons.tasks, permission: null }]
          : []),
        ...(isCoach ? [
          { href: '/coach/my-members', label: locale === 'ar' ? 'أعضاء محتملين' : 'Potential Members', icon: NavIcons.members, permission: null },
          { href: '/coach/more', label: locale === 'ar' ? 'اشتراكات More' : 'My More', icon: NavIcons.more, permission: null },
          { href: '/coach/notifications', label: locale === 'ar' ? 'إشعاراتي' : 'My Notifications', icon: NavIcons.notifications, permission: null },
        ] : []),
      ]
    },
    {
      title: t('nav.clientManagement'),
      links: [
        { href: '/members', label: t('nav.members'), icon: NavIcons.members, permission: 'canViewMembers' as keyof Permissions },
        { href: '/followups', label: t('nav.followups'), icon: NavIcons.followups, permission: 'canViewFollowUps' as keyof Permissions },
      ]
    },
    {
      title: t('nav.services'),
      links: [
        { href: '/pt', label: t('nav.pt'), icon: NavIcons.pt, permission: 'canViewPT' as keyof Permissions },
        //  متابعة الكباتن + التغذية + العلاج الطبيعي بقوا تابات جوّه صفحة الحصص المخصصة (/pt)
        //  — مش لينكات مستقلة في السايدبار
        { href: '/group-classes', label: t('nav.groupClasses'), icon: NavIcons.groupClasses, permission: 'canViewGroupClass' as keyof Permissions, enabled: settings.groupClassEnabled },
        { href: '/more', label: t('nav.more'), icon: NavIcons.more, permission: 'canViewMore' as keyof Permissions, enabled: settings.moreEnabled },
        { href: '/spa-bookings', label: t('nav.spaBookings'), icon: NavIcons.spa, permission: 'canViewSpaBookings' as keyof Permissions, enabled: settings.spaEnabled },
        { href: '/dayuse', label: t('nav.dayUse'), icon: NavIcons.dayuse, permission: 'canViewDayUse' as keyof Permissions },
      ]
    },
    {
      title: t('nav.financial'),
      links: [
        { href: '/receipts', label: t('nav.receipts'), icon: NavIcons.receipts, permission: 'canViewReceipts' as keyof Permissions },
        { href: '/expenses', label: t('nav.expenses'), icon: NavIcons.expenses, permission: 'canViewExpenses' as keyof Permissions },
        { href: '/closing', label: t('nav.closing'), icon: NavIcons.closing, permission: 'canAccessClosing' as keyof Permissions },
        { href: '/reports', label: t('nav.reports'), icon: NavIcons.reports, permission: 'canViewReports' as keyof Permissions },
      ]
    },
    {
      title: t('nav.management'),
      links: [
        { href: '/staff', label: t('nav.staff'), icon: NavIcons.staff, permission: 'canViewStaff' as keyof Permissions },
        ...(user?.staffId && user?.role !== 'OWNER' && user?.role !== 'ADMIN' ? [
          { href: '/my-payslips', label: locale === 'ar' ? 'مرتباتي' : 'My Payslips', icon: NavIcons.myPayslips, permission: null },
        ] : []),
        ...(!isCoach && isElectronApp ? [{ href: '/whatsapp-web', label: 'WhatsApp Web', icon: NavIcons.whatsapp, permission: 'canViewWhatsAppInbox' as keyof Permissions }] : []),
        { href: '/settings', label: t('nav.settings'), icon: NavIcons.settings, permission: null },
      ]
    },
  ]

  const filteredGroups = navigationGroups.map(group => ({
    ...group,
    links: group.links.filter(link => {
      //  فلترة الإعدادات بتتفعّل بعد الـ mount بس (عشان الـ SSR وأول رندر يبقوا متطابقين)
      if (mounted && 'enabled' in link && link.enabled === false) return false
      //  استثناء: /closing يظهر لو عنده canAccessClosing OR canCloseDayOnly
      if (link.href === '/closing') {
        return hasPermission('canAccessClosing') || hasPermission('canCloseDayOnly')
      }
      //  استثناء: /expenses يظهر لأي حد عنده صلاحية واحدة من صلاحيات المصاريف
      // (canViewExpenses أو canCreateExpense أو canEditExpense أو canDeleteExpense)
      // قبل كده كان لازم canViewExpenses بس → اللي عنده canCreateExpense ماكانش يلاقي الصفحة
      if (link.href === '/expenses') {
        return hasPermission('canViewExpenses') ||
          hasPermission('canCreateExpense') ||
          hasPermission('canEditExpense') ||
          hasPermission('canDeleteExpense')
      }
      if (link.permission && !hasPermission(link.permission)) return false
      return true
    })
  })).filter(group => group.links.length > 0)

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden animate-backdrop-in"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        dir={direction}
        aria-label={t('nav.menu') || 'Navigation'}
        className={`
          fixed lg:sticky
          top-0
          start-0
          z-50 lg:z-30
          h-full
          ${isCollapsed ? 'w-20' : 'w-72'}
          bg-white dark:bg-gray-900
          border-e border-gray-200 dark:border-gray-800
          shadow-xl lg:shadow-md
          transition-[width,transform] duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : `${direction === 'rtl' ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
          flex flex-col
          overflow-hidden
        `}
      >
        {/* Logo Header */}
        <div className={`
          flex items-center justify-between
          border-b border-gray-200 dark:border-gray-800
          bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800
          text-white
          flex-shrink-0
          ${isCollapsed ? 'justify-center py-9 px-2' : 'p-4'}
        `}>
          {!isCollapsed && (
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <h2 className="font-bold text-lg leading-tight text-gray-900 dark:text-white truncate">
                  Fitboost System
                </h2>
                <p className="text-xs text-gray-800/70 dark:text-white/80 truncate">
                  {t('common.appSubtitle')}
                </p>
              </div>
            </div>
          )}

          {/* Collapse Toggle - Desktop Only */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`
              hidden lg:flex items-center justify-center
              p-2 rounded-lg
              text-gray-900/80 dark:text-white
              hover:bg-black/10 dark:hover:bg-white/10
              transition-colors duration-200
              ${isCollapsed ? 'absolute top-4 start-4' : ''}
            `}
            title={isCollapsed ? (locale === 'ar' ? 'توسيع' : 'Expand') : (locale === 'ar' ? 'طي' : 'Collapse')}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={`w-5 h-5 transition-transform duration-200 ${direction === 'rtl' ? (isCollapsed ? '' : 'rotate-180') : (isCollapsed ? 'rotate-180' : '')}`}
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
            className="lg:hidden p-2 rounded-lg text-gray-900/80 dark:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors duration-200"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-5 scrollbar-thin">
          {filteredGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {!isCollapsed && (
                <h3 className="px-3 mb-2 text-[11px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500">
                  {group.title}
                </h3>
              )}
              <div className="space-y-1">
                {group.links.map((link) => {
                  const isActive = pathname === link.href
                  const badgeCount = link.href === '/inbox' ? inboxUnread : link.href === '/tasks' ? tasksPending : 0

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => onClose()}
                      aria-current={isActive ? 'page' : undefined}
                      className={`
                        flex items-center gap-3
                        px-3 py-2.5 rounded-lg
                        transition-colors duration-200
                        group relative
                        ${isCollapsed ? 'justify-center' : ''}
                        ${isActive
                          ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-300 font-bold shadow-sm'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }
                      `}
                      title={isCollapsed ? link.label : undefined}
                    >
                      {link.icon && (
                        <span className={`relative ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'} transition-colors`}>
                          {link.icon}
                          {/*  نقطة حمراء على الأيقونة في وضع الطي لما فيه عناصر غير مقروءة/مفتوحة */}
                          {isCollapsed && badgeCount > 0 && (
                            <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900" aria-hidden="true" />
                          )}
                        </span>
                      )}

                      {!isCollapsed && (
                        <span className="text-sm font-medium truncate flex-1">
                          {link.label}
                        </span>
                      )}

                      {/*  بادج العدد (صندوق الوارد / المهام المفتوحة) */}
                      {!isCollapsed && badgeCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold">
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}

                      {isActive && (
                        <span className="absolute end-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-primary-600 dark:bg-primary-400 rounded-full" aria-hidden="true" />
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
          <div className="border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
            <div className="p-3">
              {!isCollapsed && (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="w-full flex items-center gap-3 px-2 py-2 bg-gray-50 dark:bg-gray-800/60 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
                    aria-haspopup="menu"
                    aria-expanded={showUserMenu}
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-primary-contrast dark:text-primary-contrast shadow-md bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700">
                      {(user as any).profileImage ? (
                        <img src={(user as any).profileImage} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        user.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-start">
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {getRoleLabel(user.role)}
                      </p>
                    </div>
                    {NavIcons.chevronDown}
                  </button>

                  {showUserMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />

                      <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden z-50 border border-gray-200 dark:border-gray-700 animate-modal-in" role="menu">
                        {(user.role === 'ADMIN' || user.role === 'OWNER') && (
                          <>
                            <Link
                              href="/admin/users"
                              onClick={() => { setShowUserMenu(false); onClose(); }}
                              className="flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                              role="menuitem"
                            >
                              <span className="text-gray-500 dark:text-gray-400">{NavIcons.members}</span>
                              <span className="text-sm">{t('auth.manageUsers')}</span>
                            </Link>
                            <Link
                              href="/admin/internal-mail"
                              onClick={() => { setShowUserMenu(false); onClose(); }}
                              className="flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                              role="menuitem"
                            >
                              <span className="text-gray-500 dark:text-gray-400">{NavIcons.mail}</span>
                              <span className="text-sm">{locale === 'ar' ? 'الإيميل الداخلي' : 'Internal Mail'}</span>
                            </Link>
                            <Link
                              href="/admin/tasks"
                              onClick={() => { setShowUserMenu(false); onClose(); }}
                              className="flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                              role="menuitem"
                            >
                              <span className="text-gray-500 dark:text-gray-400">{NavIcons.tasks}</span>
                              <span className="text-sm">{locale === 'ar' ? 'المهام' : 'Tasks'}</span>
                            </Link>
                            <Link
                              href="/admin/audit"
                              onClick={() => { setShowUserMenu(false); onClose(); }}
                              className="flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                              role="menuitem"
                            >
                              <span className="text-gray-500 dark:text-gray-400">{NavIcons.audit}</span>
                              <span className="text-sm">{locale === 'ar' ? 'سجل النشاط' : 'Activity Log'}</span>
                            </Link>
                            <div className="border-t border-gray-200 dark:border-gray-700" />
                          </>
                        )}

                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors duration-200"
                          role="menuitem"
                        >
                          <span>{NavIcons.logout}</span>
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
                  className="relative w-10 h-10 overflow-hidden bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 rounded-full flex items-center justify-center font-bold text-primary-contrast dark:text-primary-contrast shadow-md hover:scale-110 transition-transform duration-200 mx-auto"
                  aria-haspopup="menu"
                  aria-expanded={showUserMenu}
                >
                  {(user as any).profileImage ? (
                    <img src={(user as any).profileImage} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}

                  {showUserMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />

                      <div className={`absolute ${direction === 'rtl' ? 'right-full me-2' : 'left-full ms-2'} bottom-0 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden z-50 border border-gray-200 dark:border-gray-700 animate-modal-in`} role="menu">
                        <div className="bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 text-primary-contrast dark:text-primary-contrast p-3">
                          <p className="font-bold text-sm">{user.name}</p>
                          <p className="text-xs opacity-80">{getRoleLabel(user.role)}</p>
                        </div>

                        {(user.role === 'ADMIN' || user.role === 'OWNER') && (
                          <>
                            <Link
                              href="/admin/users"
                              onClick={() => { setShowUserMenu(false); onClose(); }}
                              className="flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                              role="menuitem"
                            >
                              <span className="text-gray-500 dark:text-gray-400">{NavIcons.members}</span>
                              <span className="text-sm">{t('auth.manageUsers')}</span>
                            </Link>
                            <Link
                              href="/admin/internal-mail"
                              onClick={() => { setShowUserMenu(false); onClose(); }}
                              className="flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                              role="menuitem"
                            >
                              <span className="text-gray-500 dark:text-gray-400">{NavIcons.mail}</span>
                              <span className="text-sm">{locale === 'ar' ? 'الإيميل الداخلي' : 'Internal Mail'}</span>
                            </Link>
                            <Link
                              href="/admin/tasks"
                              onClick={() => { setShowUserMenu(false); onClose(); }}
                              className="flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                              role="menuitem"
                            >
                              <span className="text-gray-500 dark:text-gray-400">{NavIcons.tasks}</span>
                              <span className="text-sm">{locale === 'ar' ? 'المهام' : 'Tasks'}</span>
                            </Link>
                            <Link
                              href="/admin/audit"
                              onClick={() => { setShowUserMenu(false); onClose(); }}
                              className="flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                              role="menuitem"
                            >
                              <span className="text-gray-500 dark:text-gray-400">{NavIcons.audit}</span>
                              <span className="text-sm">{locale === 'ar' ? 'سجل النشاط' : 'Activity Log'}</span>
                            </Link>
                            <div className="border-t border-gray-200 dark:border-gray-700" />
                          </>
                        )}

                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors duration-200"
                          role="menuitem"
                        >
                          <span>{NavIcons.logout}</span>
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
