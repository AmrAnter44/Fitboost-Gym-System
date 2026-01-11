'use client'

import { ReactNode } from 'react'
import { AdminDateProvider } from '../contexts/AdminDateContext'
import { LanguageProvider } from '../contexts/LanguageContext'
import { LicenseProvider } from '../contexts/LicenseContext'
import { ToastProvider } from '../contexts/ToastContext'
import { DeviceSettingsProvider } from '../contexts/DeviceSettingsContext'
import { SearchProvider } from '../contexts/SearchContext'
import { UpdateProvider } from '../contexts/UpdateContext'
import Navbar from './Navbar'
import { PreventInputScroll } from '../app/PreventInputScroll'
import LicenseLockedScreen from './LicenseLockedScreen'
import ToastContainer from './ToastContainer'
import SearchModal from './SearchModal'
import BarcodeInputDetector from './BarcodeInputDetector'
import UpdateNotification from './UpdateNotification'

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <LicenseProvider>
      <LanguageProvider>
        <DeviceSettingsProvider>
          <SearchProvider>
            <ToastProvider>
              <UpdateProvider>
                <AdminDateProvider>
                  <LicenseLockedScreen />
                  <PreventInputScroll />
                  <BarcodeInputDetector />
                  <UpdateNotification />
                  <Navbar />
                  <ToastContainer />
                  <SearchModal />
                  <main>{children}</main>
                </AdminDateProvider>
              </UpdateProvider>
            </ToastProvider>
          </SearchProvider>
        </DeviceSettingsProvider>
      </LanguageProvider>
    </LicenseProvider>
  )
}
