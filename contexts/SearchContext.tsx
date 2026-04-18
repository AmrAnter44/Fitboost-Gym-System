'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface SearchContextType {
  isOpen: boolean
  searchValue: string | null
  openSearch: (value?: string) => void
  closeSearch: () => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

export function SearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchValue, setSearchValue] = useState<string | null>(null)

  const openSearch = (value?: string) => {
    setSearchValue(value || null)
    setIsOpen(true)
  }

  const closeSearch = () => {
    setIsOpen(false)
    setSearchValue(null)
  }

  return (
    <SearchContext.Provider value={{ isOpen, searchValue, openSearch, closeSearch }}>
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch() {
  const context = useContext(SearchContext)
  if (!context) {
    throw new Error('useSearch must be used within SearchProvider')
  }
  return context
}
