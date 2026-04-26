'use client'

import { useLicense } from '../contexts/LicenseContext'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * LicenseLockedScreen
 * --------------------
 * يعرض الشاشة الحمراء عند انتهاء الترخيص — مع استثناءات:
 *
 *  - صفحة /login: لا تظهر أبداً (عشان OWNER يقدر يدخل يجدّد الرخصة).
 *  - المستخدم غير مسجّل دخول: لا تظهر.
 *  - المستخدم OWNER: لا تظهر (السيستم بيشتغل له عادي حتى مع رخصة منتهية).
 *  - أي دور آخر (ADMIN/MANAGER/STAFF/COACH) + رخصة غير صالحة: تظهر الشاشة الحمراء.
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
    // إعادة الفحص كل 30 ثانية للسيشنات المفتوحة
    const interval = setInterval(fetchUser, 30_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [pathname, ctxValid])

  // نستخدم server-side flag كمصدر أساسي، ونرجع للـ context كـ fallback
  const isValid = serverLicenseValid !== null ? serverLicenseValid : ctxValid
  const message = serverLicenseMessage || ctxMessage

  const isLoginPage = pathname?.startsWith('/login')
  const isPublicPage = pathname?.startsWith('/check') || pathname?.startsWith('/member')
  const shouldHide =
    isValid ||                 // الرخصة صالحة
    isLoginPage ||             // صفحة تسجيل الدخول
    isPublicPage ||            // الصفحات العامة (PWA العضو)
    checkingUser ||            // لسه بنحمّل الدور
    !role ||                   // المستخدم مش عامل login
    role === 'OWNER'           // OWNER يدخل عادي حتى مع رخصة منتهية

  if (shouldHide) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-red-600 flex items-center justify-center">
      <div className="text-center text-white p-8 max-w-2xl">
        {/* أيقونة القفل */}
        <div className="mb-8">
          <div className="text-9xl mb-4">🔒</div>
          <h1 className="text-4xl font-bold mb-4">النظام معطل</h1>
        </div>

        {/* الرسالة */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 mb-8">
          <p className="text-2xl mb-6">{message || 'الرخصة منتهية أو غير صالحة'}</p>
          <p className="text-lg opacity-90">
            برجاء التواصل مع مالك النظام (OWNER) لتفعيل الرخصة من جديد.
          </p>
        </div>

        {/* زر إعادة المحاولة */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={checkLicense}
            disabled={isChecking}
            className="bg-white text-red-600 px-8 py-4 rounded-xl font-bold text-xl hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
          >
            {isChecking ? 'جاري الفحص...' : '🔄 إعادة المحاولة'}
          </button>

          <button
            onClick={async () => {
              try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
              window.location.href = '/login'
            }}
            className="bg-white/20 text-white border-2 border-white px-8 py-4 rounded-xl font-bold text-xl hover:bg-white/30 transition-all"
          >
            🚪 تسجيل خروج
          </button>
        </div>

        <div className="mt-8 text-sm opacity-75">
          <p>إذا كنت تعتقد أن هذه رسالة خطأ، يرجى التواصل مع الدعم الفني</p>
        </div>
      </div>
    </div>
  )
}
