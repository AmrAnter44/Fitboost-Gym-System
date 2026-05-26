'use client'

import { useState, useEffect, ReactNode } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { PaymentMethod, validatePaymentDistribution, calculatePointsRequired, calculatePointsValue } from '../lib/paymentHelpers'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface PaymentMethodSelectorProps {
  value: string | PaymentMethod[]
  onChange: (method: string | PaymentMethod[]) => void
  totalAmount?: number
  allowMultiple?: boolean
  required?: boolean
  memberPoints?: number
  pointsValueInEGP?: number
  pointsEnabled?: boolean
}

interface PaymentAmounts {
  cash: number
  visa: number
  instapay: number
  wallet: number
  points: number
}

function CashIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9h.01M18 15h.01" />
    </svg>
  )
}

function CardIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 10h20M6 15h4" />
    </svg>
  )
}

function PhoneIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 18h2" />
    </svg>
  )
}

function WalletIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h12a2 2 0 012 2v2h2a1 1 0 011 1v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      <circle cx="17" cy="13" r="1.2" />
    </svg>
  )
}

function TrophyIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 4h8v5a4 4 0 11-8 0V4zM5 5h3v3a2 2 0 01-2 2H5V5zM16 5h3v5h-1a2 2 0 01-2-2V5zM10 14h4v3h-4zM8 20h8" />
    </svg>
  )
}

function CheckIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function AlertIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.14A2 2 0 003.84 21h16.32a2 2 0 001.73-3l-8.18-14.14a2 2 0 00-3.42 0z" />
    </svg>
  )
}

type MethodKey = 'cash' | 'visa' | 'instapay' | 'wallet' | 'points'

const METHOD_ICON: Record<MethodKey, (props: { className?: string }) => ReactNode> = {
  cash: CashIcon,
  visa: CardIcon,
  instapay: PhoneIcon,
  wallet: WalletIcon,
  points: TrophyIcon,
}

export default function PaymentMethodSelector({
  value,
  onChange,
  totalAmount,
  allowMultiple = false,
  required = false,
  memberPoints = 0,
  pointsValueInEGP = 0,
  pointsEnabled = false
}: PaymentMethodSelectorProps) {
  const { t, direction } = useLanguage()
  const [amounts, setAmounts] = useState<PaymentAmounts>({
    cash: 0,
    visa: 0,
    instapay: 0,
    wallet: 0,
    points: 0
  })
  const [errorMessage, setErrorMessage] = useState<string>('')

  const paymentMethods: Array<{
    value: MethodKey
    key: MethodKey
    accentBg: string
    accentRing: string
    accentText: string
  }> = [
    { value: 'cash', key: 'cash', accentBg: 'bg-green-50 dark:bg-green-900/20', accentRing: 'ring-green-200 dark:ring-green-800', accentText: 'text-green-700 dark:text-green-300' },
    { value: 'visa', key: 'visa', accentBg: 'bg-primary-50 dark:bg-primary-900/20', accentRing: 'ring-primary-200 dark:ring-primary-800', accentText: 'text-primary-700 dark:text-primary-300' },
    { value: 'instapay', key: 'instapay', accentBg: 'bg-primary-50 dark:bg-primary-900/20', accentRing: 'ring-primary-200 dark:ring-primary-800', accentText: 'text-primary-700 dark:text-primary-300' },
    { value: 'wallet', key: 'wallet', accentBg: 'bg-orange-50 dark:bg-orange-900/20', accentRing: 'ring-orange-200 dark:ring-orange-800', accentText: 'text-orange-700 dark:text-orange-300' },
    ...(pointsEnabled && memberPoints > 0 ? [
      { value: 'points' as MethodKey, key: 'points' as MethodKey, accentBg: 'bg-amber-50 dark:bg-amber-900/20', accentRing: 'ring-amber-200 dark:ring-amber-800', accentText: 'text-amber-700 dark:text-amber-300' }
    ] : []),
  ]

  const isMultiPayment = Array.isArray(value)
  const selectedSingleMethod = !isMultiPayment ? (value as string) : null

  const paidTotal = Object.values(amounts).reduce((sum, val) => sum + val, 0)
  const remaining = totalAmount ? totalAmount - paidTotal : 0
  const isValid = totalAmount ? Math.abs(remaining) < 0.01 && paidTotal > 0 : false

  useEffect(() => {
    if (!allowMultiple || !totalAmount) return

    if (paidTotal > 0) {
      if (remaining > 0.01) {
        setErrorMessage(t('multiPayment.validation.amountExceeds'))
      } else if (remaining < -0.01) {
        setErrorMessage(`المبلغ المدفوع ${paidTotal} أكبر من المطلوب ${totalAmount}`)
      } else {
        setErrorMessage('')
        handleMultiPaymentApply()
      }
    } else {
      setErrorMessage('')
    }
  }, [paidTotal, remaining, totalAmount, t, allowMultiple])

  useEffect(() => {
    if (Array.isArray(value) && value.length > 0) {
      const newAmounts: PaymentAmounts = {
        cash: value.find(m => m.method === 'cash')?.amount || 0,
        visa: value.find(m => m.method === 'visa')?.amount || 0,
        instapay: value.find(m => m.method === 'instapay')?.amount || 0,
        wallet: value.find(m => m.method === 'wallet')?.amount || 0,
        points: value.find(m => m.method === 'points')?.amount || 0,
      }
      setAmounts(newAmounts)
    }
  }, [value])

  const handleAmountChange = (method: keyof PaymentAmounts, newValue: string) => {
    const numValue = parseFloat(newValue) || 0

    if (method === 'points' && pointsValueInEGP > 0) {
      const maxPointsValue = calculatePointsValue(memberPoints, pointsValueInEGP)
      const cappedValue = Math.min(numValue, maxPointsValue)
      setAmounts(prev => ({
        ...prev,
        [method]: cappedValue
      }))
    } else {
      setAmounts(prev => ({
        ...prev,
        [method]: numValue
      }))
    }
  }

  const handleMultiPaymentApply = () => {
    if (!totalAmount) return

    const methods: PaymentMethod[] = []

    if (amounts.cash > 0) methods.push({ method: 'cash', amount: amounts.cash })
    if (amounts.visa > 0) methods.push({ method: 'visa', amount: amounts.visa })
    if (amounts.instapay > 0) methods.push({ method: 'instapay', amount: amounts.instapay })
    if (amounts.wallet > 0) methods.push({ method: 'wallet', amount: amounts.wallet })
    if (amounts.points > 0 && pointsValueInEGP > 0) {
      const pointsUsed = calculatePointsRequired(amounts.points, pointsValueInEGP)
      methods.push({ method: 'points', amount: amounts.points, pointsUsed })
    }

    const validation = validatePaymentDistribution(methods, totalAmount)
    if (!validation.valid) {
      setErrorMessage(validation.message || 'خطأ في التوزيع')
      return
    }

    onChange(methods)
    setErrorMessage('')
  }

  const handleQuickSelect = (method: keyof PaymentAmounts) => {
    if (!totalAmount) return

    if (method === 'points' && pointsValueInEGP > 0) {
      const maxPointsValue = calculatePointsValue(memberPoints, pointsValueInEGP)
      if (totalAmount > maxPointsValue) {
        setErrorMessage(t('multiPayment.validation.insufficientPoints') || 'رصيد النقاط غير كافي')
        return
      }
    }

    const newAmounts: PaymentAmounts = {
      cash: 0,
      visa: 0,
      instapay: 0,
      wallet: 0,
      points: 0,
      [method]: totalAmount
    }

    setAmounts(newAmounts)

    const methods: PaymentMethod[] = method === 'points' && pointsValueInEGP > 0
      ? [{ method, amount: totalAmount, pointsUsed: calculatePointsRequired(totalAmount, pointsValueInEGP) }]
      : [{ method, amount: totalAmount }]
    onChange(methods)
    setErrorMessage('')
  }

  const handleSingleMethodClick = (method: string) => {
    onChange(method)
  }

  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
        {t('members.paymentMethods.label')} {required && <span className="text-red-600 dark:text-red-400">*</span>}
      </label>

      {allowMultiple && (!totalAmount || totalAmount <= 0) && (
        <div className="bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-800 rounded-lg p-3 mb-3 text-center">
          <p className="text-sm text-amber-800 dark:text-amber-200 font-semibold inline-flex items-center justify-center gap-1.5">
            <AlertIcon className="w-4 h-4" />
            {t('multiPayment.enterAmountFirst') || 'يرجى إدخال المبلغ أولاً لعرض خيارات الدفع'}
          </p>
        </div>
      )}

      {allowMultiple && totalAmount && totalAmount > 0 ? (
        <div className="space-y-4">
          <div className="bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-800 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-base font-semibold text-primary-900 dark:text-primary-200">
                {t('multiPayment.totalAmount')}:
              </span>
              <span className="text-2xl font-bold text-primary-700 dark:text-primary-400">
                {totalAmount.toFixed(2)} {t('members.egp')}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span className={paidTotal > totalAmount ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                {t('multiPayment.paid')}: {paidTotal.toFixed(2)}
              </span>
              <span className={remaining > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}>
                {t('multiPayment.remaining')}: {Math.max(0, remaining).toFixed(2)}
              </span>
            </div>

            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-[width] duration-300 ${
                  paidTotal > totalAmount
                    ? 'bg-red-500 dark:bg-red-600'
                    : paidTotal === totalAmount
                    ? 'bg-green-500 dark:bg-green-600'
                    : 'bg-primary-500 dark:bg-primary-600'
                }`}
                style={{ width: `${Math.min((paidTotal / totalAmount) * 100, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {paymentMethods.map(method => {
              const isPoints = method.key === 'points'
              const pointsRequired = isPoints && amounts.points > 0 && pointsValueInEGP > 0
                ? calculatePointsRequired(amounts.points, pointsValueInEGP)
                : 0
              const maxPointsValue = isPoints && pointsValueInEGP > 0
                ? calculatePointsValue(memberPoints, pointsValueInEGP)
                : 0
              const Icon = METHOD_ICON[method.key]
              const disabledQuick = isPoints && maxPointsValue < totalAmount!

              return (
                <div key={method.value} className="relative">
                  <button
                    type="button"
                    onClick={() => handleQuickSelect(method.key)}
                    disabled={disabledQuick}
                    aria-label={`${t('multiPayment.payFullAmount') || 'دفع المبلغ الكلي'} ${t(`members.paymentMethods.${method.value}`)}`}
                    className={`absolute top-2 z-10 px-3 py-1 rounded-md text-xs font-bold transition-colors duration-200 ${
                      direction === 'rtl' ? 'left-2' : 'right-2'
                    } ${
                      amounts[method.key] === totalAmount && paidTotal === totalAmount
                        ? 'bg-green-600 text-white shadow-sm'
                        : disabledQuick
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 ring-1 ring-gray-300 dark:ring-gray-600'
                    }`}
                    title={`${t('multiPayment.payFullAmount') || 'دفع المبلغ الكلي'} (${totalAmount} ${t('members.egp')}) ${t('multiPayment.using') || 'بـ'} ${t(`members.paymentMethods.${method.value}`)}`}
                  >
                    {amounts[method.key] === totalAmount && paidTotal === totalAmount
                      ? <span className="inline-flex items-center gap-1"><CheckIcon className="w-3 h-3" />{t('multiPayment.all') || 'الكل'}</span>
                      : t('multiPayment.all') || 'الكل'}
                  </button>

                  <div
                    className={`${method.accentBg} ring-1 ${method.accentRing} dark:bg-gray-800/40 rounded-lg p-3 transition-colors duration-200`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={method.accentText}>
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm">
                        {t(`members.paymentMethods.${method.value}`)}
                      </span>
                    </div>

                    <input
                      type="number"
                      value={amounts[method.key] || ''}
                      onChange={(e) => handleAmountChange(method.key, e.target.value)}
                      placeholder="0"
                      min="0"
                      max={isPoints ? maxPointsValue : undefined}
                      step="0.01"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    />

                    {isPoints && (
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                          <span>{t('multiPayment.availablePoints') || 'النقاط المتاحة'}:</span>
                          <span className="font-bold text-amber-700 dark:text-amber-300 inline-flex items-center gap-1">{memberPoints}<TrophyIcon className="w-3 h-3" /></span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                          <span>{t('multiPayment.maxValue') || 'أقصى قيمة'}:</span>
                          <span className="font-bold">{maxPointsValue.toFixed(2)} {t('members.egp')}</span>
                        </div>
                        {pointsRequired > 0 && (
                          <div className="flex justify-between text-xs font-bold text-amber-700 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 p-1 rounded">
                            <span>{t('multiPayment.pointsToUse') || 'النقاط المطلوبة'}:</span>
                            <span className="inline-flex items-center gap-1">{pointsRequired}<TrophyIcon className="w-3 h-3" /></span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-800 rounded-lg p-3 text-red-700 dark:text-red-300 text-center font-semibold text-sm inline-flex items-center justify-center gap-1.5 w-full">
              <AlertIcon className="w-4 h-4" />
              {errorMessage}
            </div>
          )}

          {isValid && !errorMessage && (
            <div className="bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-800 rounded-lg p-3 text-green-700 dark:text-green-300 text-center font-semibold text-sm inline-flex items-center justify-center gap-1.5 w-full">
              <CheckIcon className="w-4 h-4" />
              المبلغ مطابق! يمكنك المتابعة الآن
            </div>
          )}
        </div>
      ) : !allowMultiple ? (
        <div className="grid grid-cols-2 gap-3">
          {paymentMethods.map((method) => {
            const Icon = METHOD_ICON[method.key]
            const selected = selectedSingleMethod === method.value
            return (
              <button
                key={method.value}
                type="button"
                onClick={() => handleSingleMethodClick(method.value)}
                aria-pressed={selected}
                className={`flex items-center justify-center gap-2 p-4 rounded-lg ring-1 transition-colors duration-200 ${
                  selected
                    ? `${method.accentBg} ring-primary-500 dark:ring-primary-400 shadow-sm`
                    : 'bg-white dark:bg-gray-800 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <span className={method.accentText}>
                  <Icon className="w-7 h-7" />
                </span>
                <span className="font-medium text-sm text-gray-700 dark:text-gray-200">
                  {t(`members.paymentMethods.${method.value}`)}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function getPaymentMethodIcon(method: string): string {
  const icons: { [key: string]: string } = {
    'cash': 'cash',
    'visa': 'visa',
    'instapay': 'instapay',
    'wallet': 'wallet'
  }
  return icons[method] || 'wallet'
}

export function getPaymentMethodLabel(method: string, locale: string = 'ar'): string {
  const labelsAr: { [key: string]: string } = {
    'cash': 'كاش',
    'visa': 'فيزا',
    'instapay': 'إنستاباي',
    'wallet': 'محفظة'
  }

  const labelsEn: { [key: string]: string } = {
    'cash': 'Cash',
    'visa': 'Visa',
    'instapay': 'InstaPay',
    'wallet': 'Wallet'
  }

  const labels = locale === 'ar' ? labelsAr : labelsEn
  return labels[method] || method
}
