'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface AdminDateContextType {
  customCreatedAt: Date | null
  setCustomCreatedAt: (date: Date | null) => void
}

const AdminDateContext = createContext<AdminDateContextType | undefined>(undefined)

export function AdminDateProvider({ children }: { children: ReactNode }) {
  const [customCreatedAt, setCustomCreatedAt] = useState<Date | null>(null)

  return (
    <AdminDateContext.Provider value={{ customCreatedAt, setCustomCreatedAt }}>
      {children}
    </AdminDateContext.Provider>
  )
}

export function useAdminDate() {
  const context = useContext(AdminDateContext)
  if (context === undefined) {
    throw new Error('useAdminDate must be used within an AdminDateProvider')
  }
  return context
}
