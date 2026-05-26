'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useToast } from '@/contexts/ToastContext'
import { printReceiptFromData } from '../lib/printSystem'

interface Receipt {
  id: string
  receiptNumber: string
  type: string
  amount: number
  paymentMethod: string
  itemDetails: string
  createdAt: string
  memberName?: string
  phone?: string
}

interface ReceiptSuccessModalProps {
  receipt: Receipt | null
  isOpen: boolean
  onClose: () => void
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const receiptTypeIconFor: Record<string, JSX.Element> = {
  membership: (
    <svg className="w-4 h-4" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
    </svg>
  ),
  renew: (
    <svg className="w-4 h-4" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06" />
    </svg>
  ),
  pt: (
    <svg className="w-4 h-4" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  nutrition: (
    <svg className="w-4 h-4" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3" />
    </svg>
  ),
  physio: (
    <svg className="w-4 h-4" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  ),
  class: (
    <svg className="w-4 h-4" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
}

const cashIcon = (
  <svg className="w-4 h-4" {...stroke}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const visaIcon = (
  <svg className="w-4 h-4" {...stroke}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
  </svg>
)

const phoneIcon = (
  <svg className="w-4 h-4" {...stroke}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
  </svg>
)

export default function ReceiptSuccessModal({
  receipt,
  isOpen,
  onClose
}: ReceiptSuccessModalProps) {
  const { t, direction } = useLanguage()
  const toast = useToast()
  const [sending, setSending] = useState(false)
  const [hasElectron, setHasElectron] = useState(false)

  useEffect(() => {
    setHasElectron(typeof window !== 'undefined' && !!(window as any).electron)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', onKey)
    }
  }, [isOpen, onClose])

  if (!isOpen || !receipt) return null

  let itemDetails: any = {}
  try {
    itemDetails = JSON.parse(receipt.itemDetails)
  } catch (error) {
    console.error('Error parsing item details:', error)
  }

  const phone = itemDetails.phone || receipt.phone || ''
  const memberName = itemDetails.memberName || itemDetails.clientName || receipt.memberName || ''

  const getReceiptTypeLabel = (type: string): { label: string; icon: JSX.Element } => {
    const typeMap: Record<string, { label: string; icon: JSX.Element }> = {
      membership: { label: 'اشتراك عضوية', icon: receiptTypeIconFor.membership },
      membership_renewal: { label: 'تجديد اشتراك', icon: receiptTypeIconFor.renew },
      pt_new: { label: 'اشتراك PT جديد', icon: receiptTypeIconFor.pt },
      pt_renew: { label: 'تجديد PT', icon: receiptTypeIconFor.renew },
      nutrition_new: { label: 'اشتراك تغذية جديد', icon: receiptTypeIconFor.nutrition },
      nutrition_renew: { label: 'تجديد تغذية', icon: receiptTypeIconFor.renew },
      physio_new: { label: 'اشتراك علاج طبيعي', icon: receiptTypeIconFor.physio },
      physio_renew: { label: 'تجديد علاج', icon: receiptTypeIconFor.renew },
      class_new: { label: 'اشتراك جروب كلاس', icon: receiptTypeIconFor.class },
      class_renew: { label: 'تجديد جروب كلاس', icon: receiptTypeIconFor.renew }
    }
    return typeMap[type] || { label: type, icon: receiptTypeIconFor.membership }
  }

  const getPaymentMethodLabelLocal = (method: string): { label: string; icon: JSX.Element } => {
    if (method === 'cash') return { label: 'كاش', icon: cashIcon }
    if (method === 'visa') return { label: 'فيزا', icon: visaIcon }
    if (method === 'instapay') return { label: 'إنستاباي', icon: phoneIcon }
    return { label: method, icon: cashIcon }
  }

  const handleSendWhatsApp = async () => {
    if (!phone) {
      toast.error('رقم الهاتف غير متوفر')
      return
    }

    setSending(true)

    try {
      if (hasElectron) {
        const electron = (window as any).electron
        const result = await electron.whatsapp.sendReceipt(receipt.id)

        if (result.success) {
          toast.success('تم إرسال الإيصال عبر WhatsApp')
        } else {
          toast.error(result.error || 'فشل إرسال الإيصال')
        }
      } else {
        const response = await fetch('/api/whatsapp/send-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiptId: receipt.id })
        })

        const data = await response.json()

        if (data.success) {
          toast.success('تم إرسال الإيصال عبر WhatsApp')
        } else {
          toast.error(data.error || 'فشل إرسال الإيصال')
        }
      }
    } catch (error) {
      console.error('Error sending WhatsApp:', error)
      toast.error('حدث خطأ أثناء الإرسال')
    } finally {
      setSending(false)
    }
  }

  const handlePrint = () => {
    try {
      const details = typeof receipt.itemDetails === 'string' ? JSON.parse(receipt.itemDetails) : receipt.itemDetails
      printReceiptFromData(
        parseInt(receipt.receiptNumber),
        receipt.type,
        receipt.amount,
        details,
        receipt.createdAt,
        receipt.paymentMethod,
        { printOnly: true }
      )
    } catch (error) {
      console.error('Error printing receipt:', error)
    }
  }

  const typeInfo = getReceiptTypeLabel(receipt.type)
  const paymentInfo = getPaymentMethodLabelLocal(receipt.paymentMethod)

  return (
    <div
      className="fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-backdrop-in"
      dir={direction}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-success-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden ring-1 ring-emerald-200 dark:ring-emerald-900/50 animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-emerald-600 dark:bg-emerald-700 p-6 text-white text-center relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="absolute top-4 end-4 text-white hover:bg-white/20 rounded-lg w-8 h-8 flex items-center justify-center transition-colors duration-200"
          >
            <svg className="w-5 h-5" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white/15 flex items-center justify-center">
            <svg className="w-10 h-10" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 id="receipt-success-title" className="text-2xl font-bold mb-1">تمت العملية بنجاح!</h2>
          <p className="text-emerald-100 text-sm">تم إنشاء الإيصال وحفظه في النظام</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-xl p-4">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
              <span>تفاصيل الإيصال</span>
            </h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">رقم الإيصال:</span>
                <span className="font-bold font-mono text-gray-900 dark:text-gray-100">{receipt.receiptNumber}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">نوع الخدمة:</span>
                <span className="font-bold text-gray-900 dark:text-gray-100 inline-flex items-center gap-1.5">
                  {typeInfo.icon}
                  <span>{typeInfo.label}</span>
                </span>
              </div>

              {memberName && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">اسم العميل:</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100">{memberName}</span>
                </div>
              )}

              {phone && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">رقم الهاتف:</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">{phone}</span>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">المبلغ المدفوع:</span>
                <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                  {receipt.amount.toFixed(0)} جنيه
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">طريقة الدفع:</span>
                <span className="font-bold text-gray-900 dark:text-gray-100 inline-flex items-center gap-1.5">
                  {paymentInfo.icon}
                  <span>{paymentInfo.label}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {phone && (
              <button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={sending}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-lg transition-colors duration-200 shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
              >
                {sending ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" {...stroke}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06" />
                    </svg>
                    <span>جاري الإرسال...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" {...stroke}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                    <span>إرسال عبر WhatsApp</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              autoFocus
              className="w-full bg-primary-600 hover:bg-primary-700 text-primary-contrast font-bold py-2.5 px-5 rounded-lg transition-colors duration-200 shadow-sm flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
            >
              <svg className="w-5 h-5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
              </svg>
              <span>طباعة الإيصال</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold py-2.5 px-5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
