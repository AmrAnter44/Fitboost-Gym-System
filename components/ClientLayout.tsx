'use client'

import { ReactNode, useEffect, useState } from 'react'
import { AdminDateProvider } from '../contexts/AdminDateContext'
import { LanguageProvider, useLanguage } from '../contexts/LanguageContext'
import { ToastProvider } from '../contexts/ToastContext'
import { DeviceSettingsProvider } from '../contexts/DeviceSettingsContext'
import { SearchProvider } from '../contexts/SearchContext'
import { UpdateProvider } from '../contexts/UpdateContext'
import { ServiceSettingsProvider, useServiceSettings } from '../contexts/ServiceSettingsContext'
import { DarkModeProvider } from '../contexts/DarkModeContext'
import { LicenseProvider } from '../contexts/LicenseContext'
import { BulkSenderProvider } from '../contexts/BulkSenderContext'
import { PWAInstallProvider } from '../contexts/PWAInstallContext'
import { TabsProvider, useTabs } from '../contexts/TabsContext'
import QueryProvider from './QueryProvider'
import Sidebar from './Sidebar'
import TabBar from './TabBar'
import TabFrames from './TabFrames'
import { PreventInputScroll } from '../app/PreventInputScroll'
import ToastContainer from './ToastContainer'
import SearchModal from './SearchModal'
import BarcodeInputDetector from './BarcodeInputDetector'
import FloatingSearchButton from './FloatingSearchButton'
import UpdateNotification from './UpdateNotification'
import OutdatedBanner from './OutdatedBanner'
import SessionGuard from './SessionGuard'
import InstallPrompt from './InstallPrompt'
import KeyboardShortcuts from './KeyboardShortcuts'
import Breadcrumb from './Breadcrumb'
import BackToTop from './BackToTop'
import LicenseLockedScreen from './LicenseLockedScreen'
import BulkSenderOverlay from './BulkSenderOverlay'
import InternalMailNotifier from './InternalMailNotifier'
import FollowUpReminderBar from './FollowUpReminderBar'
import SalesRemindersBar from './SalesRemindersBar'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePermissions } from '../hooks/usePermissions'
import { useSupportUnread } from '../hooks/useSupportUnread'

function LayoutContent({ children }: { children: ReactNode }) {
  const { settings } = useServiceSettings()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const { t, locale } = useLanguage()
  const { isEmbedded } = useTabs()
  const pathname = usePathname() || ''
  // 💬 صفحة الدعم الفني شات فل-هايت (زي واتساب): مفيش breadcrumb ولا سكرول للصفحة نفسها
  //    (البار العلوي للموبايل بالهامبرجر بيفضل ظاهر عشان السايدبار يتفتح من الشات)
  const isChatPage = pathname === '/support' || pathname.startsWith('/support/')
  // 💬 ردود FitBoost الجديدة — مصدر واحد للبادج في السايدبار والنقطة على زرار المنيو (بيرجّع 0 على /support)
  const { user, loading: authLoading } = usePermissions()
  const supportUnread = useSupportUnread(!authLoading && !!user && !isEmbedded, pathname)

  // 🎂 فحص أعياد الميلاد (نقاط + تهنئة على الأبلكيشن) مرة في اليوم من أي صفحة —
  // مش بس الداشبورد، عشان الريسبشن/الكوتش اللي بيفتحوا على صفحات تانية.
  // السيرفر نفسه بيمنع التكرار في نفس اليوم.
  useEffect(() => {
    if (isEmbedded || typeof window === 'undefined') return
    const key = 'birthdayCheck:' + new Date().toDateString()
    try { if (sessionStorage.getItem(key)) return } catch {}
    const t = setTimeout(() => {
      fetch('/api/auto-birthday-check')
        .then(r => { if (r.ok) try { sessionStorage.setItem(key, '1') } catch {} })
        .catch(() => {})
    }, 4000)
    return () => clearTimeout(t)
  }, [isEmbedded])

  return (
    <>
      <SessionGuard />
      <PreventInputScroll />
      <BarcodeInputDetector />
      {!isEmbedded && <UpdateNotification />}
      {!isEmbedded && <InstallPrompt />}
      <LicenseLockedScreen />
      <ToastContainer />
      <InternalMailNotifier />
      <BulkSenderOverlay />
      <SearchModal />
      <KeyboardShortcuts />

      {/* Layout: TabBar + (Sidebar + Content) */}
      <div className="flex flex-col h-screen overflow-hidden">
        {/* ⬆️ تحذير النسخة القديمة — جزء من الصفحة (مش فوقها) عشان مايغطيش حاجة */}
        {!isEmbedded && <OutdatedBanner />}
        {/* Tab Strip - visible for all tabs, hidden inside iframes */}
        <TabBar />

        <div className="relative flex-1 min-h-0 overflow-hidden">
          <div className="flex h-full overflow-hidden">
            {/* Sidebar */}
            <Sidebar
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
              isCollapsed={isSidebarCollapsed}
              setIsCollapsed={setIsSidebarCollapsed}
              supportUnread={supportUnread}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Mobile Top Bar - Shows only on mobile when sidebar is hidden */}
              <div
                dir={locale === 'ar' ? 'rtl' : 'ltr'}
                className="lg:hidden sticky top-0 z-30 bg-white/85 dark:bg-gray-900/85 backdrop-blur-md backdrop-saturate-150 border-b border-gray-200 dark:border-gray-800 px-4 py-2.5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Hamburger Menu */}
                  <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="relative p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 flex-shrink-0"
                    aria-label={supportUnread > 0
                      ? `${t('nav.menu')} — ${locale === 'ar' ? `${supportUnread} رد جديد من الدعم الفني` : `${supportUnread} new support repl${supportUnread === 1 ? 'y' : 'ies'}`}`
                      : t('nav.menu')}
                  >
                    {/* 💬 نقطة خضرا لما فيه ردود جديدة من FitBoost */}
                    {supportUnread > 0 && (
                      <span className="absolute top-1 end-1 w-2.5 h-2.5 rounded-full bg-[#25d366] ring-2 ring-white dark:ring-gray-900" aria-hidden="true" />
                    )}
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>

                  {/* Title in Center */}
                  <div className="flex items-center justify-center flex-1">
                    <Link
                      href="/"
                      className="flex items-center gap-2"
                      title={t('nav.home')}
                    >
                      <span className="font-bold text-sm text-gray-900 dark:text-gray-100">Fitboost System</span>
                    </Link>
                  </div>

                  {/* Spacer for balance */}
                  <div className="w-9 flex-shrink-0"></div>
                </div>
              </div>

              {/* Breadcrumb */}
              {!isChatPage && <Breadcrumb />}

              {/*  بار تذكير المتابعات (لغير السيلز) + بار تذكيرات السيلز الثابت — فوق المحتوى في كل الصفحات */}
              {!isEmbedded && <FollowUpReminderBar />}
              {!isEmbedded && <SalesRemindersBar />}

              {/* Main Content */}
              <main className={`flex-1 min-h-0 overflow-x-hidden bg-gray-50 dark:bg-gray-900 ${isChatPage ? 'overflow-y-hidden' : 'overflow-y-auto'}`}>
                <div className={`w-full max-w-full ${isChatPage ? 'h-full' : ''}`}>
                  {children}
                </div>
              </main>

              {/* Floating Search Button — مخفي في شات الدعم عشان مايغطيش زرار الإرسال */}
              {!isChatPage && <FloatingSearchButton />}

              {/* Back to Top Button */}
              {!isChatPage && <BackToTop />}
            </div>
          </div>

          {/* Secondary tabs (kept-alive iframes) overlay sidebar+content, not the tab strip */}
          <TabFrames />
        </div>
      </div>
    </>
  )
}

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <DarkModeProvider>
        <LanguageProvider>
          <ServiceSettingsProvider>
            <DeviceSettingsProvider>
              <SearchProvider>
                <ToastProvider>
                  <BulkSenderProvider>
                    <PWAInstallProvider>
                    <UpdateProvider>
                      <AdminDateProvider>
                        <LicenseProvider>
                          <TabsProvider>
                            <LayoutContent>{children}</LayoutContent>
                          </TabsProvider>
                        </LicenseProvider>
                      </AdminDateProvider>
                    </UpdateProvider>
                    </PWAInstallProvider>
                  </BulkSenderProvider>
                </ToastProvider>
              </SearchProvider>
            </DeviceSettingsProvider>
          </ServiceSettingsProvider>
        </LanguageProvider>
      </DarkModeProvider>
    </QueryProvider>
  )
}
