'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useDarkMode } from '@/contexts/DarkModeContext'
import { useToast } from '@/contexts/ToastContext'

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

export default function ReceiptSuccessModal({
  receipt,
  isOpen,
  onClose
}: ReceiptSuccessModalProps) {
  const { t, direction } = useLanguage()
  const { isDarkMode } = useDarkMode()
  const toast = useToast()
  const [sending, setSending] = useState(false)
  const [hasElectron, setHasElectron] = useState(false)

  useEffect(() => {
    setHasElectron(typeof window !== 'undefined' && !!(window as any).electron)
  }, [])

  if (!isOpen || !receipt) return null

  // Parse item details
  let itemDetails: any = {}
  try {
    itemDetails = JSON.parse(receipt.itemDetails)
  } catch (error) {
    console.error('Error parsing item details:', error)
  }

  const phone = itemDetails.phone || receipt.phone || ''
  const memberName = itemDetails.memberName || itemDetails.clientName || receipt.memberName || ''

  // Get receipt type label
  const getReceiptTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      membership: '🎫 اشتراك عضوية',
      membership_renewal: '🔄 تجديد اشتراك',
      pt_new: '🏋️ اشتراك PT جديد',
      pt_renew: '🔄 تجديد PT',
      nutrition_new: '🥗 اشتراك تغذية جديد',
      nutrition_renew: '🔄 تجديد تغذية',
      physio_new: '🏥 اشتراك علاج طبيعي',
      physio_renew: '🔄 تجديد علاج',
      class_new: '🎯 اشتراك جروب كلاس',
      class_renew: '🔄 تجديد جروب كلاس'
    }
    return typeMap[type] || type
  }

  // Send via WhatsApp
  const handleSendWhatsApp = async () => {
    if (!phone) {
      toast.error('رقم الهاتف غير متوفر')
      return
    }

    setSending(true)

    try {
      if (hasElectron) {
        // Electron Mode
        const electron = (window as any).electron
        const result = await electron.whatsapp.sendReceipt(receipt.id)

        if (result.success) {
          toast.success('✅ تم إرسال الإيصال عبر WhatsApp')
        } else {
          toast.error(result.error || 'فشل إرسال الإيصال')
        }
      } else {
        // Browser Mode
        const response = await fetch('/api/whatsapp/send-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiptId: receipt.id })
        })

        const data = await response.json()

        if (data.success) {
          toast.success('✅ تم إرسال الإيصال عبر WhatsApp')
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

  // Print receipt
  const handlePrint = () => {
    window.open(`/receipts/${receipt.id}/print`, '_blank')
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      dir={direction}
      onClick={onClose}
    >
      <div
        className={`${
          isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
        } rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white hover:bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center transition"
          >
            ✕
          </button>

          <div className="text-6xl mb-3">✅</div>
          <h2 className="text-2xl font-bold mb-1">تمت العملية بنجاح!</h2>
          <p className="text-green-100 text-sm">تم إنشاء الإيصال وحفظه في النظام</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Receipt Details */}
          <div className={`${
            isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
          } border-2 rounded-xl p-4`}>
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <span>🧾</span>
              <span>تفاصيل الإيصال</span>
            </h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">رقم الإيصال:</span>
                <span className="font-bold font-mono">{receipt.receiptNumber}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">نوع الخدمة:</span>
                <span className="font-medium">{getReceiptTypeLabel(receipt.type)}</span>
              </div>

              {memberName && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">اسم العميل:</span>
                  <span className="font-medium">{memberName}</span>
                </div>
              )}

              {phone && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">رقم الهاتف:</span>
                  <span className="font-mono">{phone}</span>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t border-gray-300 dark:border-gray-600">
                <span className="text-gray-600 dark:text-gray-400">المبلغ المدفوع:</span>
                <span className="font-bold text-lg text-green-600 dark:text-green-400">
                  {receipt.amount.toFixed(0)} جنيه
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">طريقة الدفع:</span>
                <span className="font-medium">
                  {receipt.paymentMethod === 'cash' ? '💵 كاش' :
                   receipt.paymentMethod === 'visa' ? '💳 فيزا' :
                   receipt.paymentMethod === 'instapay' ? '📱 إنستاباي' :
                   receipt.paymentMethod}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {phone && (
              <button
                onClick={handleSendWhatsApp}
                disabled={sending}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-xl transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>جاري الإرسال...</span>
                  </>
                ) : (
                  <>
                    <span className="text-xl">📱</span>
                    <span>إرسال عبر WhatsApp</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={handlePrint}
              className={`w-full ${
                isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-blue-500 hover:bg-blue-600'
              } text-white font-bold py-3 px-6 rounded-xl transition shadow-lg flex items-center justify-center gap-2`}
            >
              <span className="text-xl">🖨️</span>
              <span>طباعة الإيصال</span>
            </button>

            <button
              onClick={onClose}
              className={`w-full ${
                isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 border-gray-600'
                  : 'bg-gray-100 hover:bg-gray-200 border-gray-300'
              } border-2 font-bold py-3 px-6 rounded-xl transition`}
            >
              ✕ إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
