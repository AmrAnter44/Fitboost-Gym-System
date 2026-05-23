'use client'

import { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { formatDateYMD } from '../lib/dateFormatter'
import ConfirmDialog from './ConfirmDialog'

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
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6" dir={direction}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <span>❄️</span>
            <span>{locale === 'ar' ? 'تجميد PT' : 'Freeze PT'}</span>
          </h2>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600 text-3xl leading-none disabled:opacity-50">×</button>
        </div>

        {error && (
          <div className="mb-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">
            ⚠️ {error}
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-4 mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">{locale === 'ar' ? 'العميل' : 'Client'}</p>
          <p className="font-bold text-gray-900 dark:text-gray-100">{session.clientName} <span className="text-blue-600">#{session.ptNumber}</span></p>
          {session.expiryDate && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {locale === 'ar' ? 'تاريخ الانتهاء الحالي:' : 'Current expiry:'} <span className="font-mono">{formatDateYMD(session.expiryDate)}</span>
            </p>
          )}
          {isCurrentlyFrozen && (
            <div className="mt-2 bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700 rounded-lg px-3 py-2">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
                ❄️ {locale === 'ar' ? 'الاشتراك مجمّد حالياً' : 'Currently frozen'}
                {session.freezeUntil && (
                  <span className="ms-2 font-mono">
                    {locale === 'ar' ? 'حتى' : 'until'} {formatDateYMD(session.freezeUntil)}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {isCurrentlyFrozen ? (
          <button
            onClick={handleUnfreeze}
            disabled={loading}
            className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 disabled:bg-gray-400"
          >
            {loading ? (locale === 'ar' ? '⏳ جاري...' : '⏳ ...') : (locale === 'ar' ? '🔥 فك التجميد' : '🔥 Unfreeze')}
          </button>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">
                {locale === 'ar' ? 'عدد أيام الفريز' : 'Freeze days'} *
              </label>
              <input
                type="number"
                min="1"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500"
                placeholder={locale === 'ar' ? 'مثلاً: 7' : 'e.g. 7'}
              />
              {computedNewExpiry && (
                <p className="mt-2 text-sm text-blue-700 dark:text-blue-300 font-bold">
                  ✅ {locale === 'ar' ? 'تاريخ الانتهاء الجديد:' : 'New expiry:'} <span className="font-mono">{formatDateYMD(computedNewExpiry)}</span>
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleFreeze}
                disabled={loading || !days || parseInt(days, 10) <= 0}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? (locale === 'ar' ? '⏳ جاري...' : '⏳ ...') : (locale === 'ar' ? '❄️ تجميد' : '❄️ Freeze')}
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="px-5 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-xl font-bold hover:bg-gray-400 dark:hover:bg-gray-600"
              >
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={showUnfreezeConfirm}
        title={locale === 'ar' ? '🔥 فك تجميد الاشتراك' : '🔥 Unfreeze Subscription'}
        message={locale === 'ar'
          ? `هتفك تجميد اشتراك ${session.clientName}؟\nملاحظة: تاريخ الانتهاء اللي اتمد بالفريز هيفضل زي ما هو.`
          : `Unfreeze ${session.clientName}'s subscription?\nNote: the extended expiry date will remain as is.`}
        confirmText={locale === 'ar' ? '🔥 فك التجميد' : '🔥 Unfreeze'}
        cancelText={locale === 'ar' ? 'إلغاء' : 'Cancel'}
        type="danger"
        onConfirm={performUnfreeze}
        onCancel={() => setShowUnfreezeConfirm(false)}
      />
    </div>
  )
}
