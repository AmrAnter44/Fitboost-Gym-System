'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { PaymentMethod, validatePaymentDistribution, calculatePointsRequired, calculatePointsValue } from '../lib/paymentHelpers'

interface PaymentMethodSelectorProps {
  value: string | PaymentMethod[]
  onChange: (method: string | PaymentMethod[]) => void
  totalAmount?: number  // للدفع المتعدد
  allowMultiple?: boolean  // تفعيل خيار الدفع المتعدد
  required?: boolean
  memberPoints?: number  // نقاط العضو المتاحة
  pointsValueInEGP?: number  // قيمة النقطة بالجنيه
  pointsEnabled?: boolean  // تفعيل النقاط كوسيلة دفع
}

interface PaymentAmounts {
  cash: number
  visa: number
  instapay: number
  wallet: number
  points: number
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

  const paymentMethods = [
    { value: 'cash', key: 'cash' as const, icon: '💵', color: 'bg-green-100 border-green-500', gradientColor: 'from-green-100 to-green-50 border-green-500' },
    { value: 'visa', key: 'visa' as const, icon: '💳', color: 'bg-primary-100 border-primary-500', gradientColor: 'from-primary-100 to-primary-50 border-primary-500' },
    { value: 'instapay', key: 'instapay' as const, icon: '📱', color: 'bg-primary-100 border-primary-500', gradientColor: 'from-primary-100 to-primary-50 border-primary-500' },
    { value: 'wallet', key: 'wallet' as const, icon: '💰', color: 'bg-orange-100 border-orange-500', gradientColor: 'from-orange-100 to-orange-50 border-orange-500' },
    ...(pointsEnabled && memberPoints > 0 ? [
      { value: 'points', key: 'points' as const, icon: '🏆', color: 'bg-yellow-100 border-yellow-500', gradientColor: 'from-yellow-100 to-yellow-50 border-yellow-500' }
    ] : []),
  ]

  // التحقق إذا كانت القيمة مصفوفة (دفع متعدد)
  const isMultiPayment = Array.isArray(value)
  const selectedSingleMethod = !isMultiPayment ? (value as string) : null

  // حساب المبلغ المدفوع والمتبقي
  const paidTotal = Object.values(amounts).reduce((sum, val) => sum + val, 0)
  const remaining = totalAmount ? totalAmount - paidTotal : 0
  const isValid = totalAmount ? Math.abs(remaining) < 0.01 && paidTotal > 0 : false

  // تحديث الأخطاء وتطبيق الدفع تلقائياً
  useEffect(() => {
    if (!allowMultiple || !totalAmount) return

    if (paidTotal > 0) {
      if (remaining > 0.01) {
        setErrorMessage(t('multiPayment.validation.amountExceeds'))
      } else if (remaining < -0.01) {
        setErrorMessage(`المبلغ المدفوع ${paidTotal} أكبر من المطلوب ${totalAmount}`)
      } else {
        setErrorMessage('')
        // تطبيق الدفع تلقائياً عندما يكون المبلغ مطابق
        handleMultiPaymentApply()
      }
    } else {
      setErrorMessage('')
    }
  }, [paidTotal, remaining, totalAmount, t, allowMultiple])

  // تحميل المبالغ الحالية إذا كانت دفع متعدد
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

    // للنقاط: التحقق من عدم تجاوز الرصيد المتاح
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

    // تجميع الوسائل المستخدمة فقط (التي لها مبلغ > 0)
    const methods: PaymentMethod[] = []

    if (amounts.cash > 0) methods.push({ method: 'cash', amount: amounts.cash })
    if (amounts.visa > 0) methods.push({ method: 'visa', amount: amounts.visa })
    if (amounts.instapay > 0) methods.push({ method: 'instapay', amount: amounts.instapay })
    if (amounts.wallet > 0) methods.push({ method: 'wallet', amount: amounts.wallet })
    if (amounts.points > 0 && pointsValueInEGP > 0) {
      const pointsUsed = calculatePointsRequired(amounts.points, pointsValueInEGP)
      methods.push({ method: 'points', amount: amounts.points, pointsUsed })
    }

    // Validation نهائي
    const validation = validatePaymentDistribution(methods, totalAmount)
    if (!validation.valid) {
      setErrorMessage(validation.message || 'خطأ في التوزيع')
      return
    }

    onChange(methods)
    setErrorMessage('')
  }

  // دالة لتحديد المبلغ الكلي لطريقة دفع واحدة مباشرة
  const handleQuickSelect = (method: keyof PaymentAmounts) => {
    if (!totalAmount) return

    // للنقاط: التحقق من الرصيد المتاح
    if (method === 'points' && pointsValueInEGP > 0) {
      const maxPointsValue = calculatePointsValue(memberPoints, pointsValueInEGP)
      if (totalAmount > maxPointsValue) {
        setErrorMessage(t('multiPayment.validation.insufficientPoints') || 'رصيد النقاط غير كافي')
        return
      }
    }

    // إعادة تعيين كل المبالغ إلى 0
    const newAmounts: PaymentAmounts = {
      cash: 0,
      visa: 0,
      instapay: 0,
      wallet: 0,
      points: 0,
      [method]: totalAmount
    }

    setAmounts(newAmounts)

    // تطبيق الاختيار مباشرة
    const methods: PaymentMethod[] = method === 'points' && pointsValueInEGP > 0
      ? [{ method, amount: totalAmount, pointsUsed: calculatePointsRequired(totalAmount, pointsValueInEGP) }]
      : [{ method, amount: totalAmount }]
    onChange(methods)
    setErrorMessage('')
  }

  const handleSingleMethodClick = (method: string) => {
    // تحديد طريقة دفع واحدة
    onChange(method)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {t('members.paymentMethods.label')} {required && <span className="text-red-600 dark:text-red-400">*</span>}
      </label>

      {/* رسالة تحذيرية إذا كان allowMultiple مفعّل لكن المبلغ غير محدد */}
      {allowMultiple && (!totalAmount || totalAmount <= 0) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg p-3 mb-3 text-center">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 font-semibold">
            ⚠️ {t('multiPayment.enterAmountFirst') || 'يرجى إدخال المبلغ أولاً لعرض خيارات الدفع'}
          </p>
        </div>
      )}

      {/* واجهة الدفع المتعدد (دائماً ظاهرة إذا allowMultiple والمبلغ محدد) */}
      {allowMultiple && totalAmount && totalAmount > 0 ? (
        <div className="space-y-4">
          {/* المبلغ الكلي */}
          <div className="bg-gradient-to-r from-primary-50 to-primary-50 dark:from-primary-900/30 dark:to-primary-900/30 border-2 border-primary-300 dark:border-primary-700 rounded-lg p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
            <div className="flex justify-between items-center">
              <span className="text-base font-semibold text-primary-900 dark:text-primary-200">
                {t('multiPayment.totalAmount')}:
              </span>
              <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {totalAmount.toFixed(2)} {t('members.egp')}
              </span>
            </div>
          </div>

          {/* شريط التقدم */}
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
                className={`h-full transition-all duration-300 ${
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

          {/* وسائل الدفع */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {paymentMethods.map(method => {
              const isPoints = method.key === 'points'
              const pointsRequired = isPoints && amounts.points > 0 && pointsValueInEGP > 0
                ? calculatePointsRequired(amounts.points, pointsValueInEGP)
                : 0
              const maxPointsValue = isPoints && pointsValueInEGP > 0
                ? calculatePointsValue(memberPoints, pointsValueInEGP)
                : 0

              return (
                <div
                  key={method.value}
                  className="relative"
                >
                  {/* زر الاختيار السريع */}
                  <button
                    type="button"
                    onClick={() => handleQuickSelect(method.key)}
                    disabled={isPoints && maxPointsValue < totalAmount!}
                    className={`absolute top-2 z-10 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                      direction === 'rtl' ? 'left-2' : 'right-2'
                    } ${
                      amounts[method.key] === totalAmount && paidTotal === totalAmount
                        ? 'bg-green-600 text-white shadow-lg'
                        : isPoints && maxPointsValue < totalAmount!
                        ? 'bg-gray-300 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600'
                    }`}
                    title={`${t('multiPayment.payFullAmount') || 'دفع المبلغ الكلي'} (${totalAmount} ${t('members.egp')}) ${t('multiPayment.using') || 'بـ'} ${t(`members.paymentMethods.${method.value}`)}`}
                  >
                    {amounts[method.key] === totalAmount && paidTotal === totalAmount
                      ? `✓ ${t('multiPayment.all') || 'الكل'}`
                      : t('multiPayment.all') || 'الكل'}
                  </button>

                  <div
                    className={`bg-gradient-to-br ${method.gradientColor} dark:from-gray-800 dark:to-gray-800 border-2 dark:border-gray-600 rounded-lg p-3 transition-all hover:shadow-md`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{method.icon}</span>
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
                      className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-base font-bold focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none transition"
                    />

                    {/* معلومات إضافية للنقاط */}
                    {isPoints && (
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300">
                          <span>{t('multiPayment.availablePoints') || 'النقاط المتاحة'}:</span>
                          <span className="font-bold text-yellow-600">{memberPoints} 🏆</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300">
                          <span>{t('multiPayment.maxValue') || 'أقصى قيمة'}:</span>
                          <span className="font-bold">{maxPointsValue.toFixed(2)} {t('members.egp')}</span>
                        </div>
                        {pointsRequired > 0 && (
                          <div className="flex justify-between text-xs font-bold text-yellow-700 dark:text-yellow-200 bg-yellow-50 dark:bg-yellow-900/30 p-1 rounded">
                            <span>{t('multiPayment.pointsToUse') || 'النقاط المطلوبة'}:</span>
                            <span>{pointsRequired} 🏆</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* رسائل الخطأ */}
          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 rounded-lg p-3 text-red-700 dark:text-red-200 text-center font-semibold text-sm">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* رسالة النجاح */}
          {isValid && !errorMessage && (
            <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-700 rounded-lg p-3 text-green-700 dark:text-green-200 text-center font-semibold text-sm">
              ✅ المبلغ مطابق! يمكنك المتابعة الآن
            </div>
          )}
        </div>
      ) : !allowMultiple ? (
        /* أزرار اختيار وسيلة واحدة فقط - تظهر فقط إذا allowMultiple غير مفعّل */
        <div className="grid grid-cols-2 gap-3">
          {paymentMethods.map((method) => (
            <button
              key={method.value}
              type="button"
              onClick={() => handleSingleMethodClick(method.value)}
              className={`
                flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all
                ${selectedSingleMethod === method.value
                  ? `${method.color} dark:bg-gray-700 dark:border-primary-500 border-2 shadow-md scale-105`
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }
              `}
            >
              <span className="text-3xl">{method.icon}</span>
              <span className="font-medium text-sm text-gray-700 dark:text-gray-200">
                {t(`members.paymentMethods.${method.value}`)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// دالة للحصول على أيقونة طريقة الدفع
export function getPaymentMethodIcon(method: string): string {
  const icons: { [key: string]: string } = {
    'cash': '💵',
    'visa': '💳',
    'instapay': '📱',
    'wallet': '💰'
  }
  return icons[method] || '💰'
}

// دالة للحصول على اسم طريقة الدفع (بدون استخدام i18n)
export function getPaymentMethodLabel(method: string, locale: string = 'ar'): string {
  const labelsAr: { [key: string]: string } = {
    'cash': 'كاش 💵',
    'visa': 'فيزا 💳',
    'instapay': 'إنستاباي 📱',
    'wallet': 'محفظة 💰'
  }

  const labelsEn: { [key: string]: string } = {
    'cash': 'Cash 💵',
    'visa': 'Visa 💳',
    'instapay': 'InstaPay 📱',
    'wallet': 'Wallet 💰'
  }

  const labels = locale === 'ar' ? labelsAr : labelsEn
  return labels[method] || method
}
