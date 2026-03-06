'use client'

import { ReactNode, useState } from 'react'
import { AdminDateProvider } from '../contexts/AdminDateContext'
import { LanguageProvider } from '../contexts/LanguageContext'
import { ToastProvider } from '../contexts/ToastContext'
import { DeviceSettingsProvider } from '../contexts/DeviceSettingsContext'
import { SearchProvider } from '../contexts/SearchContext'
import { UpdateProvider } from '../contexts/UpdateContext'
import { ServiceSettingsProvider } from '../contexts/ServiceSettingsContext'
import { DarkModeProvider } from '../contexts/DarkModeContext'
import { LicenseProvider } from '../contexts/LicenseContext'
import QueryProvider from './QueryProvider'
import Sidebar from './Sidebar'
import { PreventInputScroll } from '../app/PreventInputScroll'
import ToastContainer from './ToastContainer'
import SearchModal from './SearchModal'
import BarcodeInputDetector from './BarcodeInputDetector'
import FloatingSearchButton from './FloatingSearchButton'
// import UpdateNotification from './UpdateNotification' // ✅ تم تعطيل نظام التحديثات
import InstallPrompt from './InstallPrompt'
import KeyboardShortcuts from './KeyboardShortcuts'
import Breadcrumb from './Breadcrumb'
import BackToTop from './BackToTop'
import LicenseLockedScreen from './LicenseLockedScreen'
import ErrorTrackingProvider from './ErrorTrackingProvider'

function LayoutContent({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <>
      <PreventInputScroll />
      <BarcodeInputDetector />
      {/* <UpdateNotification /> */} {/* ✅ تم تعطيل نظام التحديثات */}
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
          {/* Mobile Menu Button - Shows only on mobile when sidebar is hidden */}
          <div className="lg:hidden sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            >
              <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
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
    <ErrorTrackingProvider>
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
    </ErrorTrackingProvider>
  )
}
