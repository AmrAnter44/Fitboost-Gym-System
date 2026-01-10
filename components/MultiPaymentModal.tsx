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

  // حساب المبلغ المدفوع والمتبقي
  const paidTotal = Object.values(amounts).reduce((sum, val) => sum + val, 0)
  const remaining = totalAmount - paidTotal
  const isValid = Math.abs(remaining) < 0.01 && paidTotal > 0

  // تحديث الأخطاء
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

  const handleAmountChange = (method: keyof PaymentAmounts, value: string) => {
    const numValue = parseFloat(value) || 0
    setAmounts(prev => ({
      ...prev,
      [method]: numValue
    }))
  }

  const handleConfirm = () => {
    // تجميع الوسائل المستخدمة فقط (التي لها مبلغ > 0)
    const methods: PaymentMethod[] = []

    if (amounts.cash > 0) methods.push({ method: 'cash', amount: amounts.cash })
    if (amounts.visa > 0) methods.push({ method: 'visa', amount: amounts.visa })
    if (amounts.instapay > 0) methods.push({ method: 'instapay', amount: amounts.instapay })
    if (amounts.wallet > 0) methods.push({ method: 'wallet', amount: amounts.wallet })

    // Validation نهائي
    const validation = validatePaymentDistribution(methods, totalAmount)
    if (!validation.valid) {
      setErrorMessage(validation.message || 'خطأ في التوزيع')
      return
    }

    onConfirm(methods)

    // إعادة تعيين
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
    { key: 'cash' as const, icon: '💵', label: t('members.paymentMethods.cash'), color: 'from-green-100 to-green-50 border-green-500' },
    { key: 'visa' as const, icon: '💳', label: t('members.paymentMethods.visa'), color: 'from-blue-100 to-blue-50 border-blue-500' },
    { key: 'instapay' as const, icon: '📱', label: t('members.paymentMethods.instapay'), color: 'from-purple-100 to-purple-50 border-purple-500' },
    { key: 'wallet' as const, icon: '💰', label: t('members.paymentMethods.wallet'), color: 'from-orange-100 to-orange-50 border-orange-500' }
  ]

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      dir={direction}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-2xl">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span>🔀</span>
            <span>{t('multiPayment.title')}</span>
          </h2>
          <p className="text-purple-100 mt-2">
            {t('multiPayment.mustMatchTotal')}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* المبلغ الكلي */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-blue-900">
                {t('multiPayment.totalAmount')}:
              </span>
              <span className="text-3xl font-bold text-blue-600">
                {totalAmount.toFixed(2)} {t('members.egp')}
              </span>
            </div>
          </div>

          {/* شريط التقدم */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span className={paidTotal > totalAmount ? 'text-red-600' : 'text-green-600'}>
                {t('multiPayment.paid')}: {paidTotal.toFixed(2)}
              </span>
              <span className={remaining > 0 ? 'text-orange-600' : 'text-green-600'}>
                {t('multiPayment.remaining')}: {Math.max(0, remaining).toFixed(2)}
              </span>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  paidTotal > totalAmount
                    ? 'bg-red-500'
                    : paidTotal === totalAmount
                    ? 'bg-green-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min((paidTotal / totalAmount) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* وسائل الدفع */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paymentOptions.map(option => (
              <div
                key={option.key}
                className={`bg-gradient-to-br ${option.color} border-2 rounded-lg p-4 transition-all hover:shadow-md`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{option.icon}</span>
                  <span className="font-semibold text-gray-700">{option.label}</span>
                </div>

                <input
                  type="number"
                  value={amounts[option.key] || ''}
                  onChange={(e) => handleAmountChange(option.key, e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-lg font-bold focus:border-purple-500 focus:outline-none transition"
                />
              </div>
            ))}
          </div>

          {/* رسائل الخطأ */}
          {errorMessage && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3 text-red-700 text-center font-semibold">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* رسالة النجاح */}
          {isValid && !errorMessage && (
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3 text-green-700 text-center font-semibold">
              ✅ المبلغ مطابق! يمكنك التأكيد الآن
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t flex gap-3 justify-end">
          <button
            onClick={handleCancel}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
          >
            {t('multiPayment.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              isValid
                ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 shadow-lg'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {t('multiPayment.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
