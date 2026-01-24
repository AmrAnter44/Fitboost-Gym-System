'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Language = 'ar' | 'en'
type Direction = 'rtl' | 'ltr'

interface LanguageContextType {
  locale: Language
  language: Language  // alias for locale
  direction: Direction
  setLanguage: (lang: Language) => void
  t: (key: string, params?: Record<string, string>) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Language>('ar')
  const [messages, setMessages] = useState<any>({})

  useEffect(() => {
    // جلب اللغة المحفوظة من localStorage
    const savedLocale = localStorage.getItem('locale') as Language
    if (savedLocale && (savedLocale === 'ar' || savedLocale === 'en')) {
      setLocale(savedLocale)
    }
  }, [])

  useEffect(() => {
    // تحميل ملف الترجمة المناسب
    import(`../messages/${locale}.json`).then((msgs) => {
      setMessages(msgs.default)
    })

    // تحديث dir و lang في html
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  }, [locale])

  const setLanguage = (lang: Language) => {
    setLocale(lang)
    localStorage.setItem('locale', lang)
  }

  // دالة الترجمة البسيطة
  const t = (key: string, params?: Record<string, string>): string => {
    const keys = key.split('.')
    let value: any = messages

    for (const k of keys) {
      value = value?.[k]
    }

    if (typeof value !== 'string') {
      // فقط اظهر التحذير اذا كانت الرسائل محملة بالفعل (ليس كائن فارغ)
      if (Object.keys(messages).length > 0) {
        console.warn(`Translation missing for key: ${key}`)
      }
      return key
    }

    // استبدال المتغيرات
    if (params) {
      Object.entries(params).forEach(([param, val]) => {
        value = value.replace(`{${param}}`, val)
      })
    }

    return value
  }

  const direction: Direction = locale === 'ar' ? 'rtl' : 'ltr'

  return (
    <LanguageContext.Provider value={{ locale, language: locale, direction, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
