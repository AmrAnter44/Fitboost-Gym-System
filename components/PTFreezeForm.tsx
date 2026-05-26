'use client'

import { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { formatDateYMD } from '../lib/dateFormatter'
import ConfirmDialog from './ConfirmDialog'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface PTSession {
  ptNumber: number
  clientName: string
  phone: string
  expiryDate?: string
  isFrozen?: boolean
  freezeUntil?: string | null
}

interface Props {
  session: PTSession
  onClose: () => void
  onSuccess: () => void
}

export default function PTFreezeForm({ session, onClose, onSuccess }: Props) {
  const { locale, direction } = useLanguage()
  const [days, setDays] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showUnfreezeConfirm, setShowUnfreezeConfirm] = useState(false)

  const isCurrentlyFrozen = !!session.isFrozen

  const computedNewExpiry = (() => {
    const n = parseInt(days, 10)
    if (!n || n <= 0 || !session.expiryDate) return null
    const d = new Date(session.expiryDate)
    d.setDate(d.getDate() + n)
    return d
  })()

  const handleFreeze = async () => {
    setError('')
    const n = parseInt(days, 10)
    if (!n || n <= 0) {
      setError(locale === 'ar' ? 'عدد أيام الفريز مطلوب' : 'Freeze days required')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/pt/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ptNumber: session.ptNumber, freezeDays: n }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      onSuccess()
    } catch (e: any) {
      setError(e?.message || (locale === 'ar' ? 'فشل التجميد' : 'Failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleUnfreeze = () => {
    setShowUnfreezeConfirm(true)
  }

  const performUnfreeze = async () => {
    setShowUnfreezeConfirm(false)
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/pt/freeze?ptNumber=${session.ptNumber}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      onSuccess()
    } catch (e: any) {
      setError(e?.message || (locale === 'ar' ? 'فشل فك التجميد' : 'Failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pt-freeze-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg ring-1 ring-gray-200 dark:ring-gray-700 max-w-md w-full p-6" dir={direction}>
        <div className="flex justify-between items-center mb-4">
          <h2 id="pt-freeze-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg className="w-7 h-7 text-blue-500" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
            </svg>
            <span>{locale === 'ar' ? 'تجميد PT' : 'Freeze PT'}</span>
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-300 rounded-lg p-1 transition-colors duration-200 disabled:opacity-50"
            aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
          >
            <svg className="w-6 h-6" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-3 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-blue-200 dark:ring-blue-900/50 p-4 mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{locale === 'ar' ? 'العميل' : 'Client'}</p>
          <p className="font-bold text-gray-900 dark:text-gray-100">{session.clientName} <span className="text-blue-600 dark:text-blue-400">#{session.ptNumber}</span></p>
          {session.expiryDate && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {locale === 'ar' ? 'تاريخ الانتهاء الحالي:' : 'Current expiry:'} <span className="font-mono">{formatDateYMD(session.expiryDate)}</span>
            </p>
          )}
          {isCurrentlyFrozen && (
            <div className="mt-2 bg-blue-50 dark:bg-blue-900/40 ring-1 ring-blue-200 dark:ring-blue-900/50 rounded-lg px-3 py-2">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <svg className="w-4 h-4" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
                </svg>
                <span>
                  {locale === 'ar' ? 'الاشتراك مجمّد حالياً' : 'Currently frozen'}
                  {session.freezeUntil && (
                    <span className="ms-2 font-mono">
                      {locale === 'ar' ? 'حتى' : 'until'} {formatDateYMD(session.freezeUntil)}
                    </span>
                  )}
                </span>
              </p>
            </div>
          )}
        </div>

        {isCurrentlyFrozen ? (
          <button
            onClick={handleUnfreeze}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-bold transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading
              ? (locale === 'ar' ? 'جاري...' : '...')
              : (locale === 'ar' ? 'فك التجميد' : 'Unfreeze')}
          </button>
        ) : (
          <>
            <div className="mb-4">
              <label htmlFor="freeze-days" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {locale === 'ar' ? 'عدد أيام الفريز' : 'Freeze days'} *
              </label>
              <input
                id="freeze-days"
                type="number"
                min="1"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                placeholder={locale === 'ar' ? 'مثلاً: 7' : 'e.g. 7'}
              />
              {computedNewExpiry && (
                <p className="mt-2 text-sm text-blue-700 dark:text-blue-300 font-bold flex items-center gap-2">
                  <svg className="w-4 h-4" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    {locale === 'ar' ? 'تاريخ الانتهاء الجديد:' : 'New expiry:'} <span className="font-mono">{formatDateYMD(computedNewExpiry)}</span>
                  </span>
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleFreeze}
                disabled={loading || !days || parseInt(days, 10) <= 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading
                  ? (locale === 'ar' ? 'جاري...' : '...')
                  : (locale === 'ar' ? 'تجميد' : 'Freeze')}
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="px-5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg font-bold transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={showUnfreezeConfirm}
        title={locale === 'ar' ? 'فك تجميد الاشتراك' : 'Unfreeze Subscription'}
        message={locale === 'ar'
          ? `هتفك تجميد اشتراك ${session.clientName}؟\nملاحظة: تاريخ الانتهاء اللي اتمد بالفريز هيفضل زي ما هو.`
          : `Unfreeze ${session.clientName}'s subscription?\nNote: the extended expiry date will remain as is.`}
        confirmText={locale === 'ar' ? 'فك التجميد' : 'Unfreeze'}
        cancelText={locale === 'ar' ? 'إلغاء' : 'Cancel'}
        type="danger"
        onConfirm={performUnfreeze}
        onCancel={() => setShowUnfreezeConfirm(false)}
      />
    </div>
  )
}
