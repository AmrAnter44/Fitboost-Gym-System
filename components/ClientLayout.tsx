'use client'

import { ReactNode } from 'react'
import { AdminDateProvider } from '../contexts/AdminDateContext'
import { LanguageProvider } from '../contexts/LanguageContext'
import { LicenseProvider } from '../contexts/LicenseContext'
import { ToastProvider } from '../contexts/ToastContext'
import { DeviceSettingsProvider } from '../contexts/DeviceSettingsContext'
import { SearchProvider } from '../contexts/SearchContext'
import { UpdateProvider } from '../contexts/UpdateContext'
import { ServiceSettingsProvider } from '../contexts/ServiceSettingsContext'
import { DarkModeProvider } from '../contexts/DarkModeContext'
import QueryProvider from './QueryProvider'
import Navbar from './Navbar'
import { PreventInputScroll } from '../app/PreventInputScroll'
import LicenseLockedScreen from './LicenseLockedScreen'
import ToastContainer from './ToastContainer'
import SearchModal from './SearchModal'
import BarcodeInputDetector from './BarcodeInputDetector'
import UpdateNotification from './UpdateNotification'
import InstallPrompt from './InstallPrompt'
import KeyboardShortcuts from './KeyboardShortcuts'

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <LicenseProvider>
        <DarkModeProvider>
          <LanguageProvider>
            <ServiceSettingsProvider>
              <DeviceSettingsProvider>
                <SearchProvider>
                  <ToastProvider>
                    <UpdateProvider>
                      <AdminDateProvider>
                      <LicenseLockedScreen />
                      <PreventInputScroll />
                      <BarcodeInputDetector />
                      <UpdateNotification />
                      <InstallPrompt />
                      <Navbar />
                      <ToastContainer />
                      <SearchModal />
                      <KeyboardShortcuts />
                        <main className="overflow-x-hidden w-full max-w-full">{children}</main>
                      </AdminDateProvider>
                    </UpdateProvider>
                  </ToastProvider>
                </SearchProvider>
              </DeviceSettingsProvider>
            </ServiceSettingsProvider>
          </LanguageProvider>
        </DarkModeProvider>
      </LicenseProvider>
    </QueryProvider>
  )
}
