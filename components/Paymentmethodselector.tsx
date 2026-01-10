'use client'

import { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { PaymentMethod } from '../lib/paymentHelpers'
import MultiPaymentModal from './MultiPaymentModal'

interface PaymentMethodSelectorProps {
  value: string | PaymentMethod[]
  onChange: (method: string | PaymentMethod[]) => void
  totalAmount?: number  // للدفع المتعدد
  allowMultiple?: boolean  // تفعيل خيار الدفع المتعدد
  required?: boolean
}

export default function PaymentMethodSelector({
  value,
  onChange,
  totalAmount,
  allowMultiple = false,
  required = false
}: PaymentMethodSelectorProps) {
  const { t } = useLanguage()
  const [showMultiPaymentModal, setShowMultiPaymentModal] = useState(false)

  const paymentMethods = [
    { value: 'cash', icon: '💵', color: 'bg-green-100 border-green-500' },
    { value: 'visa', icon: '💳', color: 'bg-blue-100 border-blue-500' },
    { value: 'instapay', icon: '📱', color: 'bg-purple-100 border-purple-500' },
    { value: 'wallet', icon: '💰', color: 'bg-orange-100 border-orange-500' },
  ]

  // التحقق إذا كانت القيمة مصفوفة (دفع متعدد)
  const isMultiPayment = Array.isArray(value)
  const selectedSingleMethod = !isMultiPayment ? (value as string) : null

  const handleMultiPaymentConfirm = (methods: PaymentMethod[]) => {
    onChange(methods)
    setShowMultiPaymentModal(false)
  }

  const handleSingleMethodClick = (method: string) => {
    // إذا كان الدفع متعدد مفعّل والمستخدم ضغط على وسيلة واحدة،
    // نعيد إلى الوضع الفردي
    onChange(method)
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        {t('members.paymentMethods.label')} {required && <span className="text-red-600">*</span>}
      </label>

      {/* عرض الوسائل المتعددة المختارة */}
      {isMultiPayment && value.length > 0 && (
        <div className="mb-3 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-purple-900">
              🔀 {t('members.paymentMethods.multiplePayments')}
            </span>
            <button
              type="button"
              onClick={() => setShowMultiPaymentModal(true)}
              className="text-xs text-purple-600 hover:text-purple-800 underline"
            >
              تعديل
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {value.map((pm) => {
              const methodInfo = paymentMethods.find(m => m.value === pm.method)
              return (
                <div
                  key={pm.method}
                  className={`${methodInfo?.color} border-2 rounded-lg p-2 text-center`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-xl">{methodInfo?.icon}</span>
                    <span className="text-xs font-semibold">
                      {t(`members.paymentMethods.${pm.method}`)}
                    </span>
                  </div>
                  <div className="text-lg font-bold text-gray-800 mt-1">
                    {pm.amount.toFixed(2)} {t('members.egp')}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* أزرار اختيار وسيلة واحدة */}
      <div className="grid grid-cols-2 gap-3">
        {paymentMethods.map((method) => (
          <button
            key={method.value}
            type="button"
            onClick={() => handleSingleMethodClick(method.value)}
            className={`
              flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all
              ${selectedSingleMethod === method.value
                ? `${method.color} border-2 shadow-md scale-105`
                : 'bg-white border-gray-300 hover:border-gray-400'
              }
            `}
          >
            <span className="text-3xl">{method.icon}</span>
            <span className="font-medium text-sm">
              {t(`members.paymentMethods.${method.value}`)}
            </span>
          </button>
        ))}

        {/* زر الدفع المتعدد */}
        {allowMultiple && totalAmount && totalAmount > 0 && (
          <button
            type="button"
            onClick={() => setShowMultiPaymentModal(true)}
            className="col-span-2 flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 transition-all shadow-md hover:shadow-lg"
          >
            <span className="text-3xl">🔀</span>
            <span className="font-bold text-sm text-purple-900">
              {t('members.paymentMethods.multiplePayments')}
            </span>
          </button>
        )}
      </div>

      {/* عرض الطريقة المختارة (للدفع الفردي فقط) */}
      {selectedSingleMethod && !isMultiPayment && (
        <div className="mt-3 text-center">
          <p className="text-sm text-gray-600">
            {t('members.paymentMethods.selectedMethod')}
            <span className="font-bold text-blue-600 mr-1">
              {t(`members.paymentMethods.${selectedSingleMethod}`)} {paymentMethods.find(m => m.value === selectedSingleMethod)?.icon}
            </span>
          </p>
        </div>
      )}

      {/* Modal الدفع المتعدد */}
      {allowMultiple && totalAmount && (
        <MultiPaymentModal
          isOpen={showMultiPaymentModal}
          totalAmount={totalAmount}
          onConfirm={handleMultiPaymentConfirm}
          onCancel={() => setShowMultiPaymentModal(false)}
        />
      )}
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
