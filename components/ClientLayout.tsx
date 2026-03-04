'use client'

import { ReactNode } from 'react'
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
import Navbar from './Navbar'
import { PreventInputScroll } from '../app/PreventInputScroll'
import ToastContainer from './ToastContainer'
import SearchModal from './SearchModal'
import BarcodeInputDetector from './BarcodeInputDetector'
// import UpdateNotification from './UpdateNotification' // ✅ تم تعطيل نظام التحديثات
import InstallPrompt from './InstallPrompt'
import KeyboardShortcuts from './KeyboardShortcuts'
import Breadcrumb from './Breadcrumb'
import BackToTop from './BackToTop'
import LicenseLockedScreen from './LicenseLockedScreen'
import ErrorTrackingProvider from './ErrorTrackingProvider'

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
                          <PreventInputScroll />
                          <BarcodeInputDetector />
                          {/* <UpdateNotification /> */} {/* ✅ تم تعطيل نظام التحديثات */}
                          <InstallPrompt />
                          <LicenseLockedScreen />
                          <Navbar />
                          <Breadcrumb />
                          <ToastContainer />
                          <SearchModal />
                          <KeyboardShortcuts />
                          <main className="overflow-x-hidden w-full max-w-full">{children}</main>
                          <BackToTop />
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
