'use client'

import { useEffect, useRef } from 'react'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../contexts/ToastContext'
import { useLanguage } from '../contexts/LanguageContext'

//  بينبّه المستخدم (toast منبثق) لو عنده رسائل داخلية غير مقروءة —
//  أول ما يفتح السيستم، وكمان لو وصلته رسالة جديدة وهو شغّال.
export default function InternalMailNotifier() {
  const { user } = usePermissions()
  const toast = useToast()
  const { locale } = useLanguage()
  const prev = useRef<number | null>(null)
  const toastRef = useRef(toast)
  const localeRef = useRef(locale)
  toastRef.current = toast
  localeRef.current = locale

  useEffect(() => {
    if (!user) return
    let active = true

    const check = async () => {
      try {
        const r = await fetch('/api/inbox/unread-count')
        if (!r.ok || !active) return
        const d = await r.json()
        const count = d.count || 0
        const ar = localeRef.current === 'ar'
        if (prev.current === null) {
          if (count > 0) {
            toastRef.current.info(ar ? `📩 عندك ${count} رسالة داخلية غير مقروءة` : `📩 You have ${count} unread message(s)`, 6000)
          }
        } else if (count > prev.current) {
          toastRef.current.info(ar ? '📩 وصلتك رسالة داخلية جديدة' : '📩 You have a new internal message', 6000)
        }
        prev.current = count
      } catch { /* ignore */ }
    }

    check()
    const iv = setInterval(check, 60000)
    return () => { active = false; clearInterval(iv) }
  }, [user])

  return null
}
