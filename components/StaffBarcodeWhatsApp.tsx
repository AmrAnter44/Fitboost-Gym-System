'use client'

import { useState } from 'react'
import Toast from './Toast'

interface StaffBarcodeWhatsAppProps {
  staffCode: string
  staffName: string
  staffPhone: string
}

export default function StaffBarcodeWhatsApp({ staffCode, staffName, staffPhone }: StaffBarcodeWhatsAppProps) {
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [barcodeImage, setBarcodeImage] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)

  // توليد الباركود عن طريق API
  const handleGenerateBarcode = async () => {
    setLoading(true)
    try {
      // ✅ نستخرج الرقم من staffCode (بدون s أو S)
      // مثال: s22 -> 22, s001 -> 1, s444 -> 444
      const numericCode = staffCode.replace(/[sS]/g, '')

      // ✅ الموظفين: 9 أرقام (100000000 + الرقم)
      // s022 -> 100000022, s444 -> 100000444, s007 -> 100000007
      const barcodeText = (100000000 + parseInt(numericCode, 10)).toString()

      const res = await fetch('/api/barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: barcodeText }),
      })

      const data = await res.json()
      if (data.barcode) {
        setBarcodeImage(data.barcode)
        setShowBarcodeModal(true)
      } else {
        setToast({ message: 'حدث خطأ أثناء توليد الباركود', type: 'error' })
      }
    } catch (error) {
      console.error('Error generating barcode:', error)
      setToast({ message: 'حدث خطأ أثناء توليد الباركود', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadBarcode = () => {
    if (!barcodeImage) return
    const a = document.createElement('a')
    a.href = barcodeImage
    a.download = `barcode-staff-${staffCode}.png`
    a.click()
  }

  const handleSendBarcode = () => {
    if (!barcodeImage) {
      setToast({ message: 'يجب توليد الباركود أولاً', type: 'warning' })
      return
    }

    handleDownloadBarcode()

    setTimeout(() => {
      const displayCode = staffCode.toLowerCase().startsWith('s')
        ? staffCode.toUpperCase()
        : `S${staffCode}`
      const message = `Barcode الموظف #${displayCode} (${staffName})\n\n🌐 *الموقع الإلكتروني:*\nhttps://www.xgym.website/`
      const phone = staffPhone.replace(/\D/g, '') // تنظيف رقم الهاتف
      const url = `https://wa.me/2${phone}?text=${encodeURIComponent(message)}`
      window.open(url, '_blank')

      setToast({ message: 'تم تحميل صورة الباركود!\nسيتم فتح واتساب الآن، قم بإرفاق الصورة المحملة مع الرسالة.', type: 'success' })
    }, 500)
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* أزرار مدمجة صغيرة */}
      <div className="flex gap-2">
        <button
          onClick={handleGenerateBarcode}
          disabled={loading}
          className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm flex items-center gap-1"
          title="عرض Barcode"
        >
          🔢
        </button>

        <button
          onClick={handleSendBarcode}
          disabled={loading}
          className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm flex items-center gap-1"
          title="إرسال Barcode عبر واتساب"
        >
          📲
        </button>
      </div>

      {/* Modal عرض الباركود */}
      {showBarcodeModal && barcodeImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowBarcodeModal(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">🔢 Barcode الموظف</h3>
              <button
                onClick={() => setShowBarcodeModal(false)}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
                type="button"
              >
                ×
              </button>
            </div>

            <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 mb-6 text-center">
              <p className="text-sm text-purple-600 mb-2">الموظف</p>
              <p className="text-xl font-bold text-purple-800">{staffName}</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">
                #{staffCode.toLowerCase().startsWith('s') ? staffCode.toUpperCase() : `S${staffCode}`}
              </p>
            </div>

            {/* Logo أعلى الباركود */}
            <div className="flex justify-center mb-4">
              <div className="bg-white rounded-lg shadow-lg p-3 border-2 border-purple-400">
                <img
                  src="/assets/icon.png"
                  alt="Gym Logo"
                  className="w-16 h-16 object-contain"
                />
              </div>
            </div>

            {/* الباركود بدون تداخل */}
            <div className="bg-white border-2 border-purple-200 rounded-lg p-6 mb-6 flex justify-center">
              <img
                src={barcodeImage}
                alt={`Barcode S${staffCode}`}
                className="max-w-full h-auto"
                style={{ minWidth: '300px' }}
              />
            </div>

            <div className="space-y-3">
              <button
                onClick={handleDownloadBarcode}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-bold flex items-center justify-center gap-2"
              >
                <span>💾</span>
                <span>تحميل الصورة</span>
              </button>

              <button
                onClick={() => {
                  handleSendBarcode()
                  setShowBarcodeModal(false)
                }}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold flex items-center justify-center gap-2"
              >
                <span>📲</span>
                <span>تحميل وإرسال عبر واتساب</span>
              </button>

              <button
                onClick={() => setShowBarcodeModal(false)}
                className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
