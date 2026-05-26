// components/MultiPaymentModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { PaymentMethod, validatePaymentDistribution } from '../lib/paymentHelpers'

interface MultiPaymentModalProps {
  isOpen: boolean
  totalAmount: number
  onConfirm: (methods: PaymentMethod[]) => void
  onCancel: () => void
}

interface PaymentAmounts {
  cash: number
  visa: number
  instapay: number
  wallet: number
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const methodIconFor: Record<string, JSX.Element> = {
  cash: (
    <svg className="w-5 h-5" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  ),
  visa: (
    <svg className="w-5 h-5" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  ),
  instapay: (
    <svg className="w-5 h-5" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  ),
  wallet: (
    <svg className="w-5 h-5" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
    </svg>
  ),
}

export default function MultiPaymentModal({
  isOpen,
  totalAmount,
  onConfirm,
  onCancel
}: MultiPaymentModalProps) {
  const { t, direction } = useLanguage()

  const [amounts, setAmounts] = useState<PaymentAmounts>({
    cash: 0,
    visa: 0,
    instapay: 0,
    wallet: 0
  })

  const [errorMessage, setErrorMessage] = useState<string>('')

  const paidTotal = Object.values(amounts).reduce((sum, val) => sum + val, 0)
  const remaining = totalAmount - paidTotal
  const isValid = Math.abs(remaining) < 0.01 && paidTotal > 0

  useEffect(() => {
    if (paidTotal > 0) {
      if (remaining > 0.01) {
        setErrorMessage(t('multiPayment.validation.amountExceeds'))
      } else if (remaining < -0.01) {
        setErrorMessage(`المبلغ المدفوع ${paidTotal} أكبر من المطلوب ${totalAmount}`)
      } else {
        setErrorMessage('')
      }
    } else {
      setErrorMessage('')
    }
  }, [paidTotal, remaining, totalAmount, t])

  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', onKey)
    }
  }, [isOpen])

  const handleAmountChange = (method: keyof PaymentAmounts, value: string) => {
    const numValue = parseFloat(value) || 0
    setAmounts(prev => ({
      ...prev,
      [method]: numValue
    }))
  }

  const handleConfirm = () => {
    const methods: PaymentMethod[] = []

    if (amounts.cash > 0) methods.push({ method: 'cash', amount: amounts.cash })
    if (amounts.visa > 0) methods.push({ method: 'visa', amount: amounts.visa })
    if (amounts.instapay > 0) methods.push({ method: 'instapay', amount: amounts.instapay })
    if (amounts.wallet > 0) methods.push({ method: 'wallet', amount: amounts.wallet })

    const validation = validatePaymentDistribution(methods, totalAmount)
    if (!validation.valid) {
      setErrorMessage(validation.message || 'خطأ في التوزيع')
      return
    }

    onConfirm(methods)

    setAmounts({ cash: 0, visa: 0, instapay: 0, wallet: 0 })
    setErrorMessage('')
  }

  const handleCancel = () => {
    setAmounts({ cash: 0, visa: 0, instapay: 0, wallet: 0 })
    setErrorMessage('')
    onCancel()
  }

  if (!isOpen) return null

  const paymentOptions = [
    { key: 'cash' as const, label: t('members.paymentMethods.cash'), tint: 'bg-emerald-50 dark:bg-emerald-900/20 ring-emerald-200 dark:ring-emerald-800', iconBg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' },
    { key: 'visa' as const, label: t('members.paymentMethods.visa'), tint: 'bg-primary-50 dark:bg-primary-900/20 ring-primary-200 dark:ring-primary-800', iconBg: 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' },
    { key: 'instapay' as const, label: t('members.paymentMethods.instapay'), tint: 'bg-indigo-50 dark:bg-indigo-900/20 ring-indigo-200 dark:ring-indigo-800', iconBg: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' },
    { key: 'wallet' as const, label: t('members.paymentMethods.wallet'), tint: 'bg-amber-50 dark:bg-amber-900/20 ring-amber-200 dark:ring-amber-800', iconBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' }
  ]

  return (
    <div
      className="fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-backdrop-in"
      onClick={handleCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="multi-payment-title"
      dir={direction}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-primary-600 dark:bg-primary-700 text-primary-contrast p-6 rounded-t-2xl">
          <h2 id="multi-payment-title" className="text-2xl font-bold flex items-center gap-2">
            <svg className="w-7 h-7" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            <span>{t('multiPayment.title')}</span>
          </h2>
          <p className="text-primary-100 mt-2">
            {t('multiPayment.mustMatchTotal')}
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-800 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-primary-900 dark:text-primary-200">
                {t('multiPayment.totalAmount')}:
              </span>
              <span className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                {totalAmount.toFixed(2)} {t('members.egp')}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm font-bold">
              <span className={paidTotal > totalAmount ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                {t('multiPayment.paid')}: {paidTotal.toFixed(2)}
              </span>
              <span className={remaining > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                {t('multiPayment.remaining')}: {Math.max(0, remaining).toFixed(2)}
              </span>
            </div>

            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className={`h-full transition-[width] duration-300 ${
                  paidTotal > totalAmount
                    ? 'bg-red-500'
                    : paidTotal === totalAmount
                    ? 'bg-emerald-500'
                    : 'bg-primary-500'
                }`}
                style={{ width: `${Math.min((paidTotal / totalAmount) * 100, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paymentOptions.map(option => (
              <div
                key={option.key}
                className={`${option.tint} ring-1 rounded-lg p-4 transition-colors duration-200`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`${option.iconBg} w-9 h-9 rounded-lg flex items-center justify-center`}>
                    {methodIconFor[option.key]}
                  </div>
                  <span className="font-bold text-gray-700 dark:text-gray-200">{option.label}</span>
                </div>

                <input
                  type="number"
                  value={amounts[option.key] || ''}
                  onChange={(e) => handleAmountChange(option.key, e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
            ))}
          </div>

          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-800 rounded-lg p-3 text-red-700 dark:text-red-300 text-center font-bold flex items-center justify-center gap-2">
              <svg className="w-5 h-5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {isValid && !errorMessage && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800 rounded-lg p-3 text-emerald-700 dark:text-emerald-300 text-center font-bold flex items-center justify-center gap-2">
              <svg className="w-5 h-5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>المبلغ مطابق! يمكنك التأكيد الآن</span>
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end rounded-b-2xl">
          <button
            type="button"
            onClick={handleCancel}
            className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
          >
            {t('multiPayment.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isValid}
            autoFocus
            className="px-6 py-2.5 rounded-lg font-bold transition-colors duration-200 bg-primary-600 hover:bg-primary-700 text-primary-contrast disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
          >
            {t('multiPayment.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
