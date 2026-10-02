'use client'

/**
 * 🔒 حارس الجلسة: لو حساب المستخدم اتمسح أو اتعطّل وهو فاتح السيستم، يطلع على
 * صفحة الدخول فوراً بدل ما الصفحات تفضل مفتوحة بالبيانات القديمة.
 *
 * - أي طلب /api يرجع 401 → نتأكد من /api/auth/me (عشان 401 «باسورد غلط» مثلاً
 *   مايطلّعش حد بالغلط) → لو الجلسة فعلاً منتهية نروح /login.
 * - فحص كل دقيقة + لما الشاشة ترجع للواجهة (حتى لو مفيش طلبات بتتعمل).
 */
import { useEffect } from 'react'

const SKIP = ['/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/public/', '/api/license']
const CHECK_MS = 60_000

let redirecting = false
let checking: Promise<void> | null = null

function onLoginPage() {
  const p = window.location.pathname
  return p.startsWith('/login') || p.startsWith('/setup') || p.startsWith('/check')
}

function confirmSession(): Promise<void> {
  if (checking) return checking
  checking = (async () => {
    try {
      const r = await fetch('/api/auth/me', { cache: 'no-store' })
      if (r.status === 401 && !redirecting && !onLoginPage()) {
        redirecting = true
        try { sessionStorage.clear() } catch {}
        // الصفحة الأم (مش جوه تاب/iframe)
        const top = window.top && window.top !== window ? window.top : window
        top.location.href = '/login'
      }
    } catch {
      // مفيش نت — مانطلّعش حد
    } finally {
      checking = null
    }
  })()
  return checking
}

export default function SessionGuard() {
  useEffect(() => {
    if (typeof window === 'undefined' || onLoginPage()) return

    const orig = window.fetch
    const patched: typeof window.fetch = async (input, init) => {
      const res = await orig(input as any, init)
      try {
        if (res.status === 401) {
          const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
          const path = url.startsWith('http') ? new URL(url).pathname : url
          if (path.startsWith('/api/') && !SKIP.some(s => path.startsWith(s))) confirmSession()
        }
      } catch {}
      return res
    }
    window.fetch = patched

    const id = setInterval(confirmSession, CHECK_MS)
    const onVis = () => { if (document.visibilityState === 'visible') confirmSession() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    return () => {
      if (window.fetch === patched) window.fetch = orig
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onVis)
    }
  }, [])
  return null
}
