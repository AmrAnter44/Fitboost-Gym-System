'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { safeStorage, isDocumentAvailable } from '../lib/safeStorage'

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
  // ✅ قراءة القيمة من localStorage مباشرة عند التهيئة
  const [locale, setLocale] = useState<Language>(() => {
    const savedLocale = safeStorage.getItem('locale') as Language
    if (savedLocale && (savedLocale === 'ar' || savedLocale === 'en')) {
      return savedLocale
    }
    return 'ar'
  })
  const [messages, setMessages] = useState<any>({})

  // جلب الإعدادات من قاعدة البيانات عند البداية
  useEffect(() => {
    fetch('/api/user/settings')
      .then(res => {
        if (res.ok) return res.json()
        throw new Error('Not authenticated')
      })
      .then(data => {
        if (data.locale && (data.locale === 'ar' || data.locale === 'en')) {
          setLocale(data.locale)
          safeStorage.setItem('locale', data.locale)
        }
      })
      .catch(() => {
        // استخدام localStorage كـ fallback للمستخدمين غير المسجلين
        console.log('Using localStorage for locale (user not authenticated)')
      })
  }, [])

  useEffect(() => {
    // تحميل ملف الترجمة المناسب
    import(`../messages/${locale}.json`).then((msgs) => {
      setMessages(msgs.default)
    })

    // تحديث dir و lang في html (SSR safe)
    if (isDocumentAvailable()) {
      document.documentElement.lang = locale
      document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
    }
  }, [locale])

  const setLanguage = async (lang: Language) => {
    setLocale(lang)
    safeStorage.setItem('locale', lang)

    // حفظ في قاعدة البيانات للمستخدمين المسجلين
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: lang })
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
