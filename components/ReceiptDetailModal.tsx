'use client'

import { printReceiptFromData } from '../lib/printSystem'
import { useLanguage } from '../contexts/LanguageContext'
import { normalizePaymentMethod, getPaymentMethodLabel } from '../lib/paymentHelpers'
import { getReceiptTypeTranslationKey } from '../lib/translateReceiptType'

interface ReceiptDetailModalProps {
  receipt: {
    receiptNumber: number
    type: string
    amount: number
    paymentMethod: string
    itemDetails: string
    createdAt: string
  }
  onClose: () => void
}

export function ReceiptDetailModal({ receipt, onClose }: ReceiptDetailModalProps) {
  const { direction, t, language } = useLanguage()
  const details = JSON.parse(receipt.itemDetails)

  // ✅ معالجة طرق الدفع (واحدة أو متعددة)
  const paymentData = normalizePaymentMethod(receipt.paymentMethod, receipt.amount)
  const isMultiPayment = paymentData.methods.length > 1
  
  const getTypeLabel = (type: string) => {
    const translationKey = getReceiptTypeTranslationKey(type)
    return t(translationKey as any) || type
  }

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      'Member': 'from-primary-500 to-primary-600',
      'PT': 'from-green-500 to-green-600',
      'DayUse': 'from-purple-500 to-purple-600',
      'InBody': 'from-orange-500 to-orange-600'
    }
    return colors[type] || 'from-gray-500 to-gray-600'
  }

  const handlePrint = () => {
    printReceiptFromData(
      receipt.receiptNumber,
      receipt.type,
      receipt.amount,
      details,
      receipt.createdAt
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose} dir={direction}>
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`bg-gradient-to-r ${getTypeColor(receipt.type)} text-white p-4 rounded-t-2xl`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🧾</div>
              <div>
                <h2 className="text-xl font-bold">{t('receipts.detail.title')} - #{receipt.receiptNumber}</h2>
                <p className="text-sm opacity-90">{getTypeLabel(receipt.type)}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full w-9 h-9 flex items-center justify-center transition text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* Customer Info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {details.memberNumber && (
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
                <p className="text-xs text-primary-600 mb-1">{t('receipts.detail.membershipNumber')}</p>
                <p className="text-xl font-bold text-primary-600">#{details.memberNumber}</p>
              </div>
            )}
            {details.memberName && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">{t('receipts.detail.memberName')}</p>
                <p className="text-sm font-bold text-gray-800">{details.memberName}</p>
              </div>
            )}

            {details.clientName && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">{t('receipts.detail.clientName')}</p>
                <p className="text-sm font-bold text-gray-800">{details.clientName}</p>
              </div>
            )}

            {details.name && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">{t('receipts.detail.name')}</p>
                <p className="text-sm font-bold text-gray-800">{details.name}</p>
              </div>
            )}
          </div>

          {/* Service Details & Payment Details in 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Service Details */}
            <div className="border border-gray-200 rounded-lg p-3">
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm">
                <span>📋</span>
                <span>{t('receipts.detail.serviceDetails')}</span>
              </h3>

              <div className="space-y-1">
              {details.subscriptionPrice && (
                <div className="flex justify-between py-1 border-b text-sm">
                  <span className="text-gray-600">{t('receipts.detail.subscriptionPrice')}</span>
                  <span className="font-bold">{details.subscriptionPrice} {t('common.currency')}</span>
                </div>
              )}

              {details.sessionsPurchased && (
                <>
                  <div className="flex justify-between py-1 border-b text-sm">
                    <span className="text-gray-600">{t('receipts.detail.sessionsCount')}</span>
                    <span className="font-bold">{details.sessionsPurchased} {t('receipts.detail.sessions')}</span>
                  </div>
                  {details.pricePerSession && (
                    <div className="flex justify-between py-1 border-b text-sm">
                      <span className="text-gray-600">{t('receipts.detail.sessionPrice')}</span>
                      <span className="font-bold">{details.pricePerSession} {t('common.currency')}</span>
                    </div>
                  )}
                </>
              )}

              {details.coachName && (
                <div className="flex justify-between py-1 border-b text-sm">
                  <span className="text-gray-600">{t('receipts.detail.coachName')}</span>
                  <span className="font-bold">{details.coachName}</span>
                </div>
              )}

              {details.staffName && (
                <div className="flex justify-between py-1 border-b text-sm">
                  <span className="text-gray-600">{t('receipts.detail.staffName')}</span>
                  <span className="font-bold">{details.staffName}</span>
                </div>
              )}

              {details.serviceType && (
                <div className="flex justify-between py-1 border-b text-sm">
                  <span className="text-gray-600">{t('receipts.detail.serviceType')}</span>
                  <span className="font-bold">
                    {t(`receipts.type.${details.serviceType.toLowerCase()}` as any)}
                  </span>
                </div>
              )}
              </div>
            </div>

            {/* Payment Details */}
            <div className="border border-gray-200 rounded-lg p-3">
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm">
                <span>💰</span>
                <span>{t('receipts.detail.paymentDetails')}</span>
              </h3>

              <div className="space-y-1">
                {details.paidAmount !== undefined && (
                  <div className="flex justify-between py-1 border-b text-sm">
                    <span className="text-gray-600">{t('receipts.detail.paidAmount')}</span>
                    <span className="font-bold text-green-600">{details.paidAmount} {t('common.currency')}</span>
                  </div>
                )}

                {details.remainingAmount !== undefined && details.remainingAmount > 0 && (
                  <div className="flex justify-between py-1 border-b text-sm">
                    <span className="text-gray-600">{t('receipts.detail.remainingAmount')}</span>
                    <span className="font-bold text-red-600">{details.remainingAmount} {t('common.currency')}</span>
                  </div>
                )}

                {/* ✅ طريقة الدفع - دعم الدفع المتعدد */}
                <div className="py-1 border-b text-sm">
                  <span className="text-gray-600 block mb-1">
                    {isMultiPayment ? t('receipts.detail.paymentMethods') : t('receipts.detail.paymentMethod')}
                  </span>
                  {isMultiPayment ? (
                    <div className="flex flex-wrap gap-1">
                      {paymentData.methods.map((pm, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full text-xs font-bold"
                        >
                          <span>{getPaymentMethodLabel(pm.method, language)}</span>
                          <span className="text-primary-600">({pm.amount} {t('common.currency')})</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-primary-100 text-primary-800 px-2 py-1 rounded-full text-xs font-bold">
                      {getPaymentMethodLabel(paymentData.methods[0].method, language)}
                    </span>
                  )}
                </div>

                <div className="flex justify-between py-2 bg-green-50 px-2 rounded-lg mt-2">
                  <span className="font-bold text-gray-800 text-sm">{t('receipts.detail.total')}</span>
                  <span className="font-bold text-xl text-green-600">{receipt.amount} {t('common.currency')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Date */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">{t('receipts.detail.issueDate')}</p>
            <p className="text-sm font-bold text-gray-800">
              {new Date(receipt.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-gray-50 rounded-b-2xl flex gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <span>🖨️</span>
            <span>{t('receipts.detail.printReceipt')}</span>
          </button>
          
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition font-medium"
          >
            {t('receipts.detail.close')}
          </button>
        </div>
      </div>
    </div>
  )
}