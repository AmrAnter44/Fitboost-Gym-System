'use client'

import { ReactNode } from 'react'
import { AdminDateProvider } from '../contexts/AdminDateContext'
import { LanguageProvider } from '../contexts/LanguageContext'
import { LicenseProvider } from '../contexts/LicenseContext'
import Navbar from './Navbar'
import { PreventInputScroll } from '../app/PreventInputScroll'
import LicenseLockedScreen from './LicenseLockedScreen'

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <LicenseProvider>
      <LanguageProvider>
        <AdminDateProvider>
          <LicenseLockedScreen />
          <PreventInputScroll />
          <Navbar />
          <main>{children}</main>
        </AdminDateProvider>
      </LanguageProvider>
    </LicenseProvider>
  )
}
