'use client'

import { useState } from 'react'
import { usePWAInstall } from '../contexts/PWAInstallContext'
import { useLanguage } from '../contexts/LanguageContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

//  زرار تحميل/تثبيت الـ PWA السريع — بيظهر في الإعدادات
export default function PWAInstallButton() {
  const { canInstall, isStandalone, isIOS, promptInstall } = usePWAInstall()
  const { locale } = useLanguage()
  const ar = locale === 'ar'
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [showIOS, setShowIOS] = useState(false)

  const handleInstall = async () => {
    if (isIOS) { setShowIOS(v => !v); return }
    setBusy(true); setMsg('')
    const res = await promptInstall()
    setBusy(false)
    if (res === 'accepted') setMsg(ar ? 'تم تثبيت التطبيق ✅' : 'App installed ✅')
    else if (res === 'dismissed') setMsg(ar ? 'اتلغى التثبيت' : 'Install dismissed')
    else setMsg(ar ? 'التثبيت مش متاح دلوقتي — جرّب من متصفح كروم/إيدج على الموبايل' : 'Install not available now — try Chrome/Edge on mobile')
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
          <svg {...stroke} className="w-5 h-5 sm:w-6 sm:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" /></svg>
        </div>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">{ar ? 'تحميل التطبيق (PWA)' : 'Install App (PWA)'}</h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{ar ? 'ثبّت التطبيق على الجهاز للوصول السريع من الشاشة الرئيسية' : 'Install the app for quick access from the home screen'}</p>
        </div>
      </div>

      {isStandalone ? (
        <div className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800 rounded-lg px-3 py-2">
          <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
          {ar ? 'التطبيق متثبّت بالفعل' : 'App already installed'}
        </div>
      ) : (
        <>
          <button
            onClick={handleInstall}
            disabled={busy || (!canInstall && !isIOS)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-primary-contrast font-bold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
            {busy ? (ar ? 'جاري التثبيت...' : 'Installing...') : (ar ? 'تثبيت سريع' : 'Quick install')}
          </button>

          {!canInstall && !isIOS && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {ar
                ? 'لو الزرار مش شغّال: افتح النظام من متصفح كروم/إيدج على الموبايل، أو التطبيق متثبّت بالفعل.'
                : 'If disabled: open the system in Chrome/Edge on mobile, or the app is already installed.'}
            </p>
          )}

          {msg && <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">{msg}</p>}

          {isIOS && showIOS && (
            <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800 text-sm text-blue-800 dark:text-blue-200">
              <p className="font-bold mb-1">{ar ? 'للتثبيت على iPhone:' : 'To install on iPhone:'}</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>{ar ? 'اضغط زر المشاركة (Share) في سفاري' : 'Tap the Share button in Safari'}</li>
                <li>{ar ? 'اختر «إضافة إلى الشاشة الرئيسية»' : 'Choose "Add to Home Screen"'}</li>
                <li>{ar ? 'اضغط «إضافة»' : 'Tap "Add"'}</li>
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  )
}
