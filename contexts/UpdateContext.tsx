'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface UpdateContextType {
  updateAvailable: boolean
  setUpdateAvailable: (available: boolean) => void
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined)

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  return (
    <UpdateContext.Provider value={{ updateAvailable, setUpdateAvailable }}>
      {children}
    </UpdateContext.Provider>
  )
}

export function useUpdate() {
  const context = useContext(UpdateContext)
  if (context === undefined) {
    throw new Error('useUpdate must be used within an UpdateProvider')
  }
  return context
}
