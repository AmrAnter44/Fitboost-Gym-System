'use client'

import { useEffect } from 'react'
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

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

export function ReceiptDetailModal({ receipt, onClose }: ReceiptDetailModalProps) {
  const { direction, t, language } = useLanguage()
  const details = JSON.parse(receipt.itemDetails)

  const paymentData = normalizePaymentMethod(receipt.paymentMethod, receipt.amount)
  const isMultiPayment = paymentData.methods.length > 1

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const getTypeLabel = (type: string) => {
    const translationKey = getReceiptTypeTranslationKey(type)
    return t(translationKey as any) || type
  }

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      'Member': 'bg-primary-600 dark:bg-primary-700',
      'PT': 'bg-emerald-600 dark:bg-emerald-700',
      'DayUse': 'bg-primary-600 dark:bg-primary-700',
      'InBody': 'bg-amber-600 dark:bg-amber-700'
    }
    return colors[type] || 'bg-gray-600 dark:bg-gray-700'
  }

  const handlePrint = () => {
    printReceiptFromData(
      receipt.receiptNumber,
      receipt.type,
      receipt.amount,
      details,
      receipt.createdAt,
      undefined,
      { printOnly: true }
    )
  }

  return (
    <div
      className="fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-backdrop-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-detail-title"
      dir={direction}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl max-w-5xl w-full shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-h-[90vh] overflow-hidden flex flex-col animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`${getTypeColor(receipt.type)} text-white p-4 rounded-t-2xl`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center">
                <svg className="w-7 h-7" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
              </div>
              <div>
                <h2 id="receipt-detail-title" className="text-xl font-bold">{t('receipts.detail.title')} - #{receipt.receiptNumber}</h2>
                <p className="text-sm opacity-90">{getTypeLabel(receipt.type)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              autoFocus
              aria-label="إغلاق"
              className="text-white hover:bg-white/20 rounded-lg w-9 h-9 flex items-center justify-center transition-colors duration-200"
            >
              <svg className="w-5 h-5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {details.memberNumber && (
              <div className="bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-200 dark:ring-primary-700 rounded-lg p-3">
                <p className="text-xs text-primary-600 dark:text-primary-400 mb-1">{t('receipts.detail.membershipNumber')}</p>
                <p className="text-xl font-bold text-primary-600 dark:text-primary-400">#{details.memberNumber}</p>
              </div>
            )}
            {details.memberName && (
              <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('receipts.detail.memberName')}</p>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{details.memberName}</p>
              </div>
            )}

            {details.clientName && (
              <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('receipts.detail.clientName')}</p>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{details.clientName}</p>
              </div>
            )}

            {details.name && (
              <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('receipts.detail.name')}</p>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{details.name}</p>
              </div>
            )}
          </div>

          {(details.kind === 'membershipTransferIdentity' || details.kind === 'membershipTransfer') && (
            <div className="ring-1 ring-purple-200 dark:ring-purple-800 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
              <h3 className="font-bold text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-2 text-sm">
                <svg className="w-5 h-5" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                </svg>
                <span>{details.kind === 'membershipTransferIdentity' ? 'تغيير ملكية العضوية' : 'نقل عضوية'}</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {details.kind === 'membershipTransferIdentity' ? (
                  <>
                    {details.previousOwner?.name && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">المالك السابق</p>
                        <p className="font-bold dark:text-gray-100">{details.previousOwner.name}</p>
                        {details.previousOwner.phone && (
                          <p className="text-xs font-mono text-gray-500 dark:text-gray-400" dir="ltr">{details.previousOwner.phone}</p>
                        )}
                      </div>
                    )}
                    {details.newOwner?.name && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">المالك الجديد</p>
                        <p className="font-bold text-purple-700 dark:text-purple-300">{details.newOwner.name}</p>
                        {details.newOwner.phone && (
                          <p className="text-xs font-mono text-gray-500 dark:text-gray-400" dir="ltr">{details.newOwner.phone}</p>
                        )}
                      </div>
                    )}
                    {details.remainingDays !== undefined && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">الأيام المتبقية</p>
                        <p className="font-bold dark:text-gray-100">{details.remainingDays} يوم</p>
                      </div>
                    )}
                    {details.expiryDate && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">ينتهي في</p>
                        <p className="font-bold dark:text-gray-100">{new Date(details.expiryDate).toLocaleDateString('ar-EG')}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {details.fromMember?.name && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">من</p>
                        <p className="font-bold dark:text-gray-100">{details.fromMember.name} {details.fromMember.memberNumber && <span className="text-xs text-gray-500">#{details.fromMember.memberNumber}</span>}</p>
                      </div>
                    )}
                    {details.toMember?.name && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">إلى</p>
                        <p className="font-bold text-purple-700 dark:text-purple-300">{details.toMember.name} {details.toMember.memberNumber && <span className="text-xs text-gray-500">#{details.toMember.memberNumber}</span>}</p>
                        {details.toMember.phone && (
                          <p className="text-xs font-mono text-gray-500 dark:text-gray-400" dir="ltr">{details.toMember.phone}</p>
                        )}
                      </div>
                    )}
                    {details.transferredDays !== undefined && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">الأيام المنقولة</p>
                        <p className="font-bold dark:text-gray-100">{details.transferredDays} يوم</p>
                      </div>
                    )}
                    {details.toNewExpiryDate && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">تاريخ الانتهاء الجديد</p>
                        <p className="font-bold dark:text-gray-100">{new Date(details.toNewExpiryDate).toLocaleDateString('ar-EG')}</p>
                      </div>
                    )}
                  </>
                )}
                {details.transferFee !== undefined && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">رسوم النقل</p>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">{details.transferFee} ج.م</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg p-3">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                </svg>
                <span>{t('receipts.detail.serviceDetails')}</span>
              </h3>

              <div className="space-y-1">
              {details.discount && details.discount > 0 && details.originalPrice && (
                <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700 text-sm">
                  <span className="text-gray-600 dark:text-gray-300">السعر الأصلي</span>
                  <span className="font-bold text-gray-500 dark:text-gray-400 line-through">
                    {details.originalPrice} {t('common.currency')}
                  </span>
                </div>
              )}
              {details.discount && details.discount > 0 && (
                <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700 text-sm">
                  <span className="text-gray-600 dark:text-gray-300 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" {...stroke}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 6h.008v.008h-.008V15zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    <span>الخصم</span>
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    - {details.discount} {t('common.currency')}
                  </span>
                </div>
              )}
              {details.subscriptionPrice && (
                <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700 text-sm">
                  <span className="text-gray-600 dark:text-gray-300">{t('receipts.detail.subscriptionPrice')}</span>
                  <span className="font-bold dark:text-gray-100">{details.subscriptionPrice} {t('common.currency')}</span>
                </div>
              )}

              {details.sessionsPurchased && (
                <>
                  <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700 text-sm">
                    <span className="text-gray-600 dark:text-gray-300">{t('receipts.detail.sessionsCount')}</span>
                    <span className="font-bold dark:text-gray-100">{details.sessionsPurchased} {t('receipts.detail.sessions')}</span>
                  </div>
                  {details.pricePerSession && (
                    <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">{t('receipts.detail.sessionPrice')}</span>
                      <span className="font-bold dark:text-gray-100">{details.pricePerSession} {t('common.currency')}</span>
                    </div>
                  )}
                </>
              )}

              {details.coachName && (
                <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700 text-sm">
                  <span className="text-gray-600 dark:text-gray-300">{t('receipts.detail.coachName')}</span>
                  <span className="font-bold dark:text-gray-100">{details.coachName}</span>
                </div>
              )}

              {details.staffName && (
                <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700 text-sm">
                  <span className="text-gray-600 dark:text-gray-300">{t('receipts.detail.staffName')}</span>
                  <span className="font-bold dark:text-gray-100">{details.staffName}</span>
                </div>
              )}

              {details.salesPersonName && (
                <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700 text-sm">
                  <span className="text-gray-600 dark:text-gray-300">السيلز</span>
                  <span className="font-bold dark:text-gray-100">{details.salesPersonName}</span>
                </div>
              )}

              {details.serviceType && (
                <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700 text-sm">
                  <span className="text-gray-600 dark:text-gray-300">{t('receipts.detail.serviceType')}</span>
                  <span className="font-bold dark:text-gray-100">
                    {t(`receipts.type.${details.serviceType.toLowerCase()}` as any)}
                  </span>
                </div>
              )}
              </div>
            </div>

            <div className="ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg p-3">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{t('receipts.detail.paymentDetails')}</span>
              </h3>

              <div className="space-y-1">
                {details.paidAmount !== undefined && (
                  <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700 text-sm">
                    <span className="text-gray-600 dark:text-gray-300">{t('receipts.detail.paidAmount')}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{details.paidAmount} {t('common.currency')}</span>
                  </div>
                )}

                {details.remainingAmount !== undefined && details.remainingAmount > 0 && (
                  <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700 text-sm">
                    <span className="text-gray-600 dark:text-gray-300">{t('receipts.detail.remainingAmount')}</span>
                    <span className="font-bold text-red-600 dark:text-red-400">{details.remainingAmount} {t('common.currency')}</span>
                  </div>
                )}

                <div className="py-1 border-b border-gray-200 dark:border-gray-700 text-sm">
                  <span className="text-gray-600 dark:text-gray-300 block mb-1">
                    {isMultiPayment ? t('receipts.detail.paymentMethods') : t('receipts.detail.paymentMethod')}
                  </span>
                  {isMultiPayment ? (
                    <div className="flex flex-wrap gap-1">
                      {paymentData.methods.map((pm, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-300 px-2.5 py-0.5 rounded-full text-xs font-bold"
                        >
                          <span>{getPaymentMethodLabel(pm.method, language)}</span>
                          <span className="text-primary-600 dark:text-primary-400">({pm.amount} {t('common.currency')})</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-300 px-2.5 py-0.5 rounded-full text-xs font-bold">
                      {getPaymentMethodLabel(paymentData.methods[0].method, language)}
                    </span>
                  )}
                </div>

                <div className="flex justify-between py-2 bg-emerald-50 dark:bg-emerald-900/30 px-2 rounded-lg mt-2">
                  <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">{t('receipts.detail.total')}</span>
                  <span className="font-bold text-xl text-emerald-600 dark:text-emerald-400">{receipt.amount} {t('common.currency')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('receipts.detail.issueDate')}</p>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
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

        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl flex gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg transition-colors duration-200 font-bold flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
          >
            <svg className="w-5 h-5" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
            </svg>
            <span>{t('receipts.detail.printReceipt')}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
          >
            {t('receipts.detail.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
