'use client'

import { ReactNode, useState } from 'react'
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

function LayoutContent({ children }: { children: ReactNode }) {
  const { settings } = useServiceSettings()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const { t, locale } = useLanguage()
  const { isEmbedded } = useTabs()

  return (
    <>
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
                    className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 flex-shrink-0"
                    aria-label={t('nav.menu')}
                  >
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
              <Breadcrumb />

              {/*  بار تذكير المتابعات (لغير السيلز) + بار تذكيرات السيلز الثابت — فوق المحتوى في كل الصفحات */}
              {!isEmbedded && <FollowUpReminderBar />}
              {!isEmbedded && <SalesRemindersBar />}

              {/* Main Content */}
              <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900">
                <div className="w-full max-w-full">
                  {children}
                </div>
              </main>

              {/* Floating Search Button */}
              <FloatingSearchButton />

              {/* Back to Top Button */}
              <BackToTop />
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
                    <UpdateProvider>
                      <AdminDateProvider>
                        <LicenseProvider>
                          <TabsProvider>
                            <LayoutContent>{children}</LayoutContent>
                          </TabsProvider>
                        </LicenseProvider>
                      </AdminDateProvider>
                    </UpdateProvider>
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
