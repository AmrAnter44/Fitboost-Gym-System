'use client'

import { useLicense } from '../contexts/LicenseContext'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

/**
 * LicenseLockedScreen
 * --------------------
 */
export default function LicenseLockedScreen() {
  const { isValid: ctxValid, message: ctxMessage, isChecking, checkLicense } = useLicense()
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)
  const [serverLicenseValid, setServerLicenseValid] = useState<boolean | null>(null)
  const [serverLicenseMessage, setServerLicenseMessage] = useState<string>('')
  const [checkingUser, setCheckingUser] = useState(true)

  useEffect(() => {
    let cancelled = false

    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json()
            setRole(data?.user?.role || null)
            if (typeof data?.license?.valid === 'boolean') {
              setServerLicenseValid(data.license.valid)
              setServerLicenseMessage(data.license.message || '')
            }
          } else {
            setRole(null)
            setServerLicenseValid(null)
          }
        }
      } catch {
        if (!cancelled) {
          setRole(null)
          setServerLicenseValid(null)
        }
      } finally {
        if (!cancelled) setCheckingUser(false)
      }
    }

    fetchUser()
    // الـ polling الدوري في النافذة العلوية فقط — تابات الـ iframes بتكتفي بفحص الـ mount
    // (كل iframe كان بيضيف طلب /api/auth/me كل 30 ثانية زيادة)
    const isTopWindow = typeof window !== 'undefined' && window.self === window.top
    const interval = isTopWindow ? setInterval(fetchUser, 30_000) : null
    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
  }, [ctxValid])

  const isValid = serverLicenseValid !== null ? serverLicenseValid : ctxValid
  const message = serverLicenseMessage || ctxMessage

  const isLoginPage = pathname?.startsWith('/login')
  const isPublicPage = pathname?.startsWith('/check') || pathname?.startsWith('/member')
  const shouldHide =
    isValid ||
    isLoginPage ||
    isPublicPage ||
    checkingUser ||
    !role ||
    role === 'OWNER'

  if (shouldHide) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="license-locked-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-red-200 dark:ring-red-900/50 max-w-xl w-full p-8 text-center">
        {/* Lock icon */}
        <div className="mx-auto w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mb-6">
          <svg className="w-10 h-10" {...stroke}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h1 id="license-locked-title" className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          النظام معطل
        </h1>

        <p className="text-lg text-gray-700 dark:text-gray-300 mb-2">
          {message || 'الرخصة منتهية أو غير صالحة'}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-8">
          برجاء التواصل مع مالك النظام (OWNER) لتفعيل الرخصة من جديد.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={checkLicense}
            disabled={isChecking}
            className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast px-6 py-3 rounded-lg font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg className={`w-5 h-5 ${isChecking ? 'animate-spin' : ''}`} {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isChecking ? 'جاري الفحص...' : 'إعادة المحاولة'}
          </button>

          <button
            onClick={async () => {
              try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
              window.location.href = '/login'
            }}
            className="inline-flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-6 py-3 rounded-lg font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            <svg className="w-5 h-5" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            تسجيل خروج
          </button>
        </div>

        <p className="mt-8 text-xs text-gray-500 dark:text-gray-400">
          إذا كنت تعتقد أن هذه رسالة خطأ، يرجى التواصل مع الدعم الفني
        </p>
      </div>
    </div>
  )
}
