'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface DarkModeContextType {
  isDarkMode: boolean
  toggleDarkMode: () => void
  setDarkMode: (value: boolean) => void
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined)

export function DarkModeProvider({ children }: { children: ReactNode }) {
  // ✅ قراءة القيمة من localStorage مباشرة عند التهيئة
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false
    const savedMode = localStorage.getItem('darkMode')
    return savedMode === 'true'
  })
  const [mounted, setMounted] = useState(false)

  // تحميل الإعداد من قاعدة البيانات عند البداية
  useEffect(() => {
    setMounted(true)

    // جلب الإعدادات من API (للمستخدمين المسجلين)
    fetch('/api/user/settings')
      .then(res => {
        if (res.ok) return res.json()
        throw new Error('Not authenticated')
      })
      .then(data => {
        if (data.darkMode !== undefined) {
          setIsDarkMode(data.darkMode)
          localStorage.setItem('darkMode', String(data.darkMode))
          applyDarkMode(data.darkMode)
        }
      })
      .catch(() => {
        // استخدام localStorage كـ fallback للمستخدمين غير المسجلين
        console.log('Using localStorage for dark mode (user not authenticated)')
      })
  }, [])

  // تطبيق Dark Mode على الـ HTML element
  const applyDarkMode = (isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // حفظ في كل من API و localStorage
  const saveDarkMode = async (value: boolean) => {
    setIsDarkMode(value)
    localStorage.setItem('darkMode', String(value))
    applyDarkMode(value)

    // حفظ في قاعدة البيانات للمستخدمين المسجلين
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ darkMode: value })
      })

      // تجاهل الأخطاء بصمت (fallback account أو مستخدمين غير موجودين)
      if (!response.ok) {
        // localStorage already saved, we're good
        return
      }
    } catch (error) {
      // استمر بالعمل حتى لو فشل الحفظ في قاعدة البيانات
      // localStorage already saved
    }
  }

  const toggleDarkMode = () => {
    const newMode = !isDarkMode
    saveDarkMode(newMode)
  }

  const setDarkMode = (value: boolean) => {
    saveDarkMode(value)
  }

  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode, setDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  )
}

export function useDarkMode() {
  const context = useContext(DarkModeContext)
  if (context === undefined) {
    throw new Error('useDarkMode must be used within a DarkModeProvider')
  }
  return context
}
