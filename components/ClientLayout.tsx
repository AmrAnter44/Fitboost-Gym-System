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
import QueryProvider from './QueryProvider'
import Sidebar from './Sidebar'
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
import Link from 'next/link'

function LayoutContent({ children }: { children: ReactNode }) {
  const { settings } = useServiceSettings()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const { t, locale } = useLanguage()

  return (
    <>
      <PreventInputScroll />
      <BarcodeInputDetector />
      <UpdateNotification />
      <InstallPrompt />
      <LicenseLockedScreen />
      <ToastContainer />
      <SearchModal />
      <KeyboardShortcuts />

      {/* Layout: Sidebar + Content */}
      <div className="flex h-screen overflow-hidden">
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
            className="lg:hidden sticky top-0 z-30 bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-800 dark:to-primary-900 border-b-2 border-primary-800 dark:border-primary-950 px-4 py-2.5 shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              {/* Hamburger Menu */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 rounded-lg hover:bg-white/20 dark:hover:bg-gray-700 transition-all flex-shrink-0"
                aria-label={t('nav.menu')}
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Title in Center */}
              <div className="flex items-center justify-center flex-1">
                <Link
                  href="/"
                  className="flex items-center gap-2"
                  title={t('nav.home')}
                >
                  <span className="font-bold text-sm text-white">Fitboost System</span>
                </Link>
              </div>

              {/* Spacer for balance */}
              <div className="w-9 flex-shrink-0"></div>
            </div>
          </div>

          {/* Breadcrumb */}
          <Breadcrumb />

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
                  <UpdateProvider>
                    <AdminDateProvider>
                      <LicenseProvider>
                        <LayoutContent>{children}</LayoutContent>
                      </LicenseProvider>
                    </AdminDateProvider>
                  </UpdateProvider>
                </ToastProvider>
              </SearchProvider>
            </DeviceSettingsProvider>
          </ServiceSettingsProvider>
        </LanguageProvider>
      </DarkModeProvider>
    </QueryProvider>
  )
}
